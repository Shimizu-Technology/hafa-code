/// <reference lib="webworker" />
/**
 * Owns the Rust Lab toolchain: downloads and verifies the pinned chunks, keeps them in
 * Cache Storage, unpacks the standard library into an in-memory filesystem (a WASIFarm),
 * and compiles rustc.wasm. rustc itself runs in rustLabCompiler.worker.ts, which blocks
 * while it compiles; this worker stays responsive to serve its file reads.
 */
import { Directory, File, OpenFile, ConsoleStdout, PreopenDirectory, type Inode } from '@bjorn3/browser_wasi_shim'
import { WASIFarm } from '@oligami/browser_wasi_shim-threads'
import type { CompilerRequest, CompilerResponse, ToolchainRequest, ToolchainResponse } from '../protocol'
import { TOOLCHAIN, TOOLCHAIN_CACHE_NAME, chunkUrl } from '../toolchain'
import { rustcArguments, SOURCE_PATH, OUTPUT_DIRECTORY, OUTPUT_FILE } from '../compileOptions'
import { brotliDecompressStream } from './brotli'
import { readTar } from './tar'
import threadUrl from './rustLabThread.worker.ts?worker&url'
import backgroundUrl from './rustLabBackground.worker.ts?worker&url'

declare const self: DedicatedWorkerGlobalScope

const post = (message: ToolchainResponse, transfer: Transferable[] = []) => self.postMessage(message, transfer)
const DOWNLOAD_CONCURRENCY = 3
/** WASIFarm's shared buffer for file data in flight; rustc reads rlibs of up to ~32 MB at once. */
const FARM_ALLOCATOR_BYTES = 256 * 1024 * 1024

class IntegrityError extends Error {}

let compiler: Worker | null = null
let root: PreopenDirectory | null = null
let output: Directory | null = null
let diagnostics = ''
let compileQueue: Promise<void> = Promise.resolve()

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function openCache() {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(TOOLCHAIN_CACHE_NAME)
  } catch {
    return null
  }
}

async function pruneCache(cache: Cache | null) {
  if (!cache) return
  const wanted = new Set(TOOLCHAIN.assets.flatMap((asset) => asset.chunks.map((chunk) => new URL(chunkUrl(chunk), self.location.origin).href)))
  for (const request of await cache.keys()) {
    if (!wanted.has(request.url)) await cache.delete(request)
  }
}

/** Fetches every chunk of every asset (from Cache Storage when possible), verifying each SHA-256. */
async function loadChunks(cache: Cache | null, onBytes: (bytes: number) => void) {
  let fromCache = true
  const jobs = TOOLCHAIN.assets.flatMap((asset) => asset.chunks.map((chunk, index) => ({ asset, chunk, index })))
  const results = new Map<string, Uint8Array[]>(TOOLCHAIN.assets.map((asset) => [asset.name, []]))

  const loadOne = async ({ chunk }: (typeof jobs)[number]) => {
    const url = chunkUrl(chunk)
    const cached = await cache?.match(url)
    if (cached) {
      const bytes = new Uint8Array(await cached.arrayBuffer())
      if (await sha256Hex(bytes) === chunk.sha256) {
        onBytes(bytes.length)
        return bytes
      }
      await cache?.delete(url)
    }
    fromCache = false
    // The verified copy lives in Cache Storage; skip the HTTP cache so it is not stored twice.
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok || !response.body) throw new Error(`The Rust toolchain download failed (HTTP ${response.status}).`)
    const reader = response.body.getReader()
    const bytes = new Uint8Array(chunk.bytes)
    let offset = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (offset + value.length > bytes.length) throw new IntegrityError('A Rust toolchain file was larger than expected.')
      bytes.set(value, offset)
      offset += value.length
      onBytes(value.length)
    }
    if (offset !== chunk.bytes || await sha256Hex(bytes) !== chunk.sha256) {
      throw new IntegrityError('A Rust toolchain file did not match its pinned SHA-256 checksum, so it was not used.')
    }
    try {
      await cache?.put(url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }))
    } catch {
      // Storage may be full or disabled; the lab still works for this visit.
    }
    return bytes
  }

  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++]
      results.get(job.asset.name)![job.index] = await loadOne(job)
    }
  }
  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker))
  return { chunks: results, fromCache }
}

function streamOf(parts: Uint8Array[]) {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < parts.length) controller.enqueue(parts[index++])
      else controller.close()
    },
  })
}

async function unpackedStream(parts: Uint8Array[]) {
  return streamOf(parts).pipeThrough(await brotliDecompressStream())
}

/** The wasm32-wasip1 standard library, mounted where rustc --sysroot /sysroot looks for it. */
async function buildSysroot(stream: ReadableStream<Uint8Array>) {
  const lib = new Map<string, Inode>()
  await readTar(stream, ({ name, type, data }) => {
    if (type !== '0') return
    const parts = name.split('/').filter(Boolean)
    let directory = lib
    for (const part of parts.slice(0, -1)) {
      let child = directory.get(part)
      if (!(child instanceof Directory)) {
        child = new Directory(new Map())
        directory.set(part, child)
      }
      directory = (child as Directory).contents
    }
    directory.set(parts[parts.length - 1], new File(data, { readonly: true }))
  })
  const nest = (name: string, child: Inode) => new Directory(new Map([[name, child]]))
  return new PreopenDirectory('/sysroot', new Map([
    ['lib', nest('rustlib', nest(TOOLCHAIN.target, nest('lib', new Directory(lib))))],
  ]))
}

async function load() {
  const startedAt = performance.now()
  const totalBytes = TOOLCHAIN.assets.reduce((total, asset) => total + asset.bytes, 0)
  let loadedBytes = 0
  let lastReport = 0
  const report = (force = false) => {
    const now = performance.now()
    if (!force && now - lastReport < 100) return
    lastReport = now
    post({ type: 'progress', phase: 'downloading', loadedBytes, totalBytes })
  }
  report(true)

  const cache = await openCache()
  const { chunks, fromCache } = await loadChunks(cache, (bytes) => {
    loadedBytes += bytes
    report()
  })
  report(true)
  void pruneCache(cache).catch(() => {})

  post({ type: 'progress', phase: 'unpacking', loadedBytes, totalBytes })
  const [module, sysroot] = await Promise.all([
    unpackedStream(chunks.get('rustc')!).then((stream) => WebAssembly.compileStreaming(
      new Response(stream, { headers: { 'Content-Type': 'application/wasm' } }),
    )),
    unpackedStream(chunks.get('sysroot')!).then(buildSysroot),
  ])
  chunks.clear()

  post({ type: 'progress', phase: 'starting', loadedBytes, totalBytes })
  output = new Directory(new Map())
  root = new PreopenDirectory('/', new Map<string, Inode>([
    [SOURCE_PATH.slice(1), new File(new Uint8Array())],
    [OUTPUT_DIRECTORY.slice(1), output],
  ]))
  const decoder = new TextDecoder()
  const farm = new WASIFarm(
    new OpenFile(new File(new Uint8Array())),
    // rustc's stdout only carries its linker command line; diagnostics arrive on stderr as JSON.
    new ConsoleStdout(() => {}),
    new ConsoleStdout((bytes) => { diagnostics += decoder.decode(bytes, { stream: true }) }),
    [sysroot, root],
    { allocator_size: FARM_ALLOCATOR_BYTES },
  )

  compiler = new Worker(new URL('./rustLabCompiler.worker.ts', import.meta.url), { type: 'module', name: 'Rust Lab compiler' })
  await new Promise<void>((resolve, reject) => {
    compiler!.onmessage = (event: MessageEvent<CompilerResponse>) => {
      if (event.data.type === 'ready') resolve()
    }
    compiler!.onerror = (event) => reject(new Error(event.message || 'The Rust compiler worker could not start.'))
    const init: CompilerRequest = {
      type: 'init',
      module,
      farm: farm.get_ref(),
      threadUrl: new URL(threadUrl, import.meta.url).href,
      backgroundUrl: new URL(backgroundUrl, import.meta.url).href,
    }
    compiler!.postMessage(init)
  })
  post({ type: 'ready', fromCache, durationMs: Math.round(performance.now() - startedAt) })
}

function compile(id: number, source: string) {
  return new Promise<void>((resolve) => {
    if (!compiler || !root || !output) {
      post({ type: 'failed', message: 'The Rust toolchain is not loaded yet.' })
      resolve()
      return
    }
    const startedAt = performance.now()
    diagnostics = ''
    root.dir.contents.set(SOURCE_PATH.slice(1), new File(new TextEncoder().encode(source)))
    output.contents.clear()
    compiler.onmessage = (event: MessageEvent<CompilerResponse>) => {
      if (event.data.type !== 'done') return
      const binary = output?.contents.get(OUTPUT_FILE)
      const wasm = binary instanceof File ? binary.data.slice().buffer as ArrayBuffer : null
      output?.contents.clear()
      // A wasm rustc that stops without writing diagnostics or a program crashed rather than reporting an error.
      const crashed = !wasm && !diagnostics.includes('"$message_type"') && !diagnostics.includes('"level"')
      const message: ToolchainResponse = {
        type: 'compiled',
        id,
        wasm,
        diagnostics: event.data.error && crashed ? `${diagnostics}\n${event.data.error}`.trim() : diagnostics,
        durationMs: Math.round(performance.now() - startedAt),
        crashed,
      }
      post(message, wasm ? [wasm] : [])
      resolve()
    }
    const request: CompilerRequest = { type: 'compile', args: rustcArguments() }
    compiler.postMessage(request)
  })
}

self.onmessage = (event: MessageEvent<ToolchainRequest>) => {
  const request = event.data
  if (request.type === 'load') {
    load().catch((error: unknown) => {
      post({
        type: 'failed',
        message: error instanceof Error ? error.message : String(error),
        integrity: error instanceof IntegrityError,
      })
    })
  } else if (request.type === 'compile') {
    compileQueue = compileQueue.then(() => compile(request.id, request.source))
  }
}
