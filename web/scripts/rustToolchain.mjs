/**
 * The Rust Lab's compiler toolchain: pinned upstream release files, verified by SHA-256,
 * split into small content-addressed chunks for the static host.
 *
 * Nothing here is committed to git. A build downloads the two pinned files once into
 * node_modules/.cache, checks them against src/labs/rust/toolchainManifest.json, and emits
 * the chunks as /assets/rust-toolchain/<sha256-prefix>.bin. See docs/RUST_LAB.md.
 *
 *   node scripts/rustToolchain.mjs --manifest   regenerate the manifest after changing PINNED_FILES
 *   node scripts/rustToolchain.mjs --verify     download (if needed) and verify against the manifest
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliDecompressSync } from 'node:zlib'

const WEB_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..')
export const MANIFEST_PATH = join(WEB_DIRECTORY, 'src/labs/rust/toolchainManifest.json')
export const CACHE_DIRECTORY = join(WEB_DIRECTORY, 'node_modules/.cache/hafa-rust-toolchain')
export const TOOLCHAIN_ASSET_DIRECTORY = 'assets/rust-toolchain'
/** Netlify's CDN keeps files under roughly 5 MB at the edge; larger files are served from origin. */
export const CHUNK_BYTES = 4 * 1024 * 1024

const RELEASE = 'v0.2.0'
const SOURCES = [
  (file) => `https://github.com/oligamiq/rust_wasm/releases/download/${RELEASE}-release/${file}`,
  (file) => `https://rustwasm0.pages.dev/${RELEASE}/${file}`,
]

/** rustc 1.83.0-dev built for wasm32-wasip1-threads with lld linked in, and its wasm32-wasip1 standard library. */
export const PINNED_FILES = [
  { name: 'rustc', file: 'rustc_opt.wasm.br', sha256: '05b5f6da92ca33981371ea07f300ce927a688da719d9ef113931a2993e06bdd2' },
  { name: 'sysroot', file: 'wasm32-wasip1.tar.br', sha256: '5c579477e831574ce3fa6abddaa1b9c29543625cd961b298883b5bdeed4191cd' },
]

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** A chunk's public file name is a prefix of its own SHA-256, so the URL changes with the content. */
export const chunkFileName = (chunkSha256) => `${chunkSha256.slice(0, 32)}.bin`

/** A stalled source must not hang a build; the files are about 20 MB each. */
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000

/** Tries each source in turn and returns the first copy whose SHA-256 matches the pin. */
async function download(pinned) {
  const errors = []
  for (const source of SOURCES) {
    const url = source(pinned.file)
    try {
      const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      const actual = sha256(bytes)
      if (actual !== pinned.sha256) throw new Error(`SHA-256 ${actual} does not match the pinned ${pinned.sha256}`)
      return bytes
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`Could not download a verified copy of the Rust Lab toolchain file ${pinned.file}.\n${errors.join('\n')}`)
}

/** Returns the verified bytes of one pinned file, downloading it into the cache when missing. */
export async function pinnedFileBytes(pinned) {
  mkdirSync(CACHE_DIRECTORY, { recursive: true })
  const cachePath = join(CACHE_DIRECTORY, `${pinned.sha256}-${pinned.file}`)
  if (existsSync(cachePath)) {
    const cached = readFileSync(cachePath)
    if (sha256(cached) === pinned.sha256) return cached
  }
  const bytes = await download(pinned)
  writeFileSync(`${cachePath}.partial`, bytes)
  renameSync(`${cachePath}.partial`, cachePath)
  return bytes
}

export function splitIntoChunks(bytes) {
  const chunks = []
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    const data = bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.length))
    chunks.push({ sha256: sha256(data), bytes: data.length, data })
  }
  return chunks
}

export function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
}

/**
 * Downloads (or reads from cache) every pinned file, checks it against the committed
 * manifest chunk by chunk, and returns the files to publish.
 */
export async function toolchainOutputFiles(manifest = readManifest()) {
  const files = []
  for (const asset of manifest.assets) {
    const pinned = PINNED_FILES.find((candidate) => candidate.name === asset.name)
    if (!pinned || pinned.sha256 !== asset.sha256) throw new Error(`The Rust Lab manifest entry ${asset.name} does not match PINNED_FILES.`)
    const chunks = splitIntoChunks(await pinnedFileBytes(pinned))
    if (chunks.length !== asset.chunks.length || chunks.some((chunk, index) => chunk.sha256 !== asset.chunks[index].sha256 || chunk.bytes !== asset.chunks[index].bytes)) {
      throw new Error(`The Rust Lab manifest chunks for ${asset.name} are stale. Run node scripts/rustToolchain.mjs --manifest.`)
    }
    for (const chunk of chunks) files.push({ fileName: `${TOOLCHAIN_ASSET_DIRECTORY}/${chunkFileName(chunk.sha256)}`, source: chunk.data })
  }
  return files
}

async function writeManifest() {
  const assets = []
  for (const pinned of PINNED_FILES) {
    const bytes = await pinnedFileBytes(pinned)
    assets.push({
      name: pinned.name,
      file: pinned.file,
      sha256: pinned.sha256,
      bytes: bytes.length,
      unpackedBytes: brotliDecompressSync(bytes).length,
      chunks: splitIntoChunks(bytes).map(({ sha256: chunkSha256, bytes: chunkBytes }) => ({ sha256: chunkSha256, bytes: chunkBytes })),
    })
  }
  const manifest = {
    comment: 'Generated by web/scripts/rustToolchain.mjs --manifest. Pinned oligamiq/rust_wasm release files; see docs/RUST_LAB.md.',
    release: RELEASE,
    rustcVersion: '1.83.0-dev',
    target: 'wasm32-wasip1',
    chunkBytes: CHUNK_BYTES,
    assets,
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote ${MANIFEST_PATH}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--manifest')) await writeManifest()
  else if (process.argv.includes('--verify')) {
    const files = await toolchainOutputFiles()
    console.log(`Verified ${files.length} Rust Lab toolchain chunks`)
  } else {
    console.log('Usage: node scripts/rustToolchain.mjs --manifest | --verify')
  }
}
