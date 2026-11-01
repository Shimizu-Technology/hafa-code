import { RunnerValidationError } from './runnerProtocol'

export const GO_MAX_PROJECT_FILES = 50
export const GO_MAX_PROJECT_BYTES = 2_000_000
export const GO_DEADLOCK_MESSAGE = 'fatal error: all goroutines are asleep - deadlock!'

const encoder = new TextEncoder()

export type GoProjectFile = {
  path: string
  content: string
  language: string
}

export type GoRunRequest = {
  code: string
  entryPath: string
  files: GoProjectFile[]
}

export type GoSourceFile = {
  path: string
  content: string
}

export type GoDiagnostic = {
  path: string
  line: number
  column: number
  message: string
}

/** The parts of wasm_exec.js's Go class the runner uses. */
export interface GoProcess {
  argv: string[]
  env: Record<string, string>
  exit: (code: number) => void
  exited: boolean
  importObject: WebAssembly.Imports
  run(instance: WebAssembly.Instance): Promise<void>
  _resume(): void
  _scheduledTimeouts: Map<number, unknown>
}

export type GoProcessConstructor = new () => GoProcess

export type GoRunOutcome =
  | { kind: 'diagnostics'; diagnostics: GoDiagnostic[] }
  | { kind: 'exited'; exitCode: number }
  | { kind: 'deadlock' }

type GoGlobals = {
  fs?: unknown
  __hafaGoRequest?: { files: string }
  __hafaGoReport?: (kind: string, payload: string) => void
}

type NodeStyleCallback = (error: Error | null, result?: number) => void

function safeGoProjectPath(path: string) {
  const segments = path.replace(/\\/g, '/').split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) {
    throw new RunnerValidationError(`Unsupported Go file path: ${path}`)
  }
  return segments.join('/')
}

/**
 * Applies the shared project limits and the `go run .` package rules before
 * the runtime loads: every .go file sits at the top of the project in package
 * main, and there are no modules to resolve.
 */
export function validateGoProject(request: GoRunRequest): GoSourceFile[] {
  if (request.files.length > GO_MAX_PROJECT_FILES) {
    throw new RunnerValidationError(`Go projects support up to ${GO_MAX_PROJECT_FILES} files.`)
  }

  const entryPath = safeGoProjectPath(request.entryPath)
  const effectiveFiles = request.files.map((file) => {
    const path = safeGoProjectPath(file.path)
    return { path, content: path === entryPath ? request.code : file.content }
  })
  const totalBytes = effectiveFiles.reduce((total, file) => total + encoder.encode(file.content).byteLength, 0)
  if (totalBytes > GO_MAX_PROJECT_BYTES) {
    throw new RunnerValidationError(`Go projects support up to ${GO_MAX_PROJECT_BYTES.toLocaleString('en-US')} bytes of source code.`)
  }

  if (!entryPath.toLowerCase().endsWith('.go')) throw new RunnerValidationError('The Go entry file must end in .go.')
  if (!effectiveFiles.some((file) => file.path === entryPath)) {
    throw new RunnerValidationError(`Go entry file not found: ${entryPath}`)
  }

  const moduleFile = effectiveFiles.find((file) => /(^|\/)go\.(mod|sum|work)$/.test(file.path))
  if (moduleFile) {
    throw new RunnerValidationError(`Go modules are not available in Hafa Code. Remove ${moduleFile.path}; the runner builds the top-level .go files with the standard library only.`)
  }

  const goFiles = effectiveFiles.filter((file) => file.path.endsWith('.go'))
  const nested = goFiles.find((file) => file.path.includes('/'))
  if (nested) {
    throw new RunnerValidationError(`Move ${nested.path} to the top of the project. Hafa Code runs one Go package, so every .go file belongs next to main.go.`)
  }

  return goFiles
    .filter((file) => !file.path.endsWith('_test.go'))
    .map(({ path, content }) => ({ path, content }))
}

/** Compiler errors in the `file:line:column: message` form `go build` prints. */
export function formatGoDiagnostics(diagnostics: GoDiagnostic[]) {
  return diagnostics
    .map(({ path, line, column, message }) => (line ? `${path}:${line}:${column}: ${message}` : `${path}: ${message}`))
    .join('\n')
    .concat('\n')
}

function notImplemented() {
  const error = new Error('not implemented') as Error & { code?: string }
  error.code = 'ENOSYS'
  return error
}

/**
 * A wasm_exec.js `fs` replacement: stdout/stderr stream to the terminal,
 * stdin reads wait for terminal input, and every file or directory operation
 * fails as unavailable. Go programs therefore see real *os.File standard
 * streams and no host filesystem.
 */
export function createGoFileSystem({
  write,
  readLine,
}: {
  write: (stream: 'stdout' | 'stderr', text: string) => void
  readLine: () => Promise<string | null>
}) {
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() }
  let pendingInput = new Uint8Array(0)
  let inputClosed = false
  let pendingReads = 0

  const writeBytes = (fd: number, bytes: Uint8Array) => {
    const stream = fd === 2 ? 'stderr' : fd === 1 ? 'stdout' : null
    if (!stream) throw notImplemented()
    const text = decoders[stream].decode(bytes, { stream: true })
    if (text) write(stream, text)
    return bytes.length
  }

  const fill = (buffer: Uint8Array, offset: number, length: number) => {
    const count = Math.min(length, pendingInput.length)
    buffer.set(pendingInput.subarray(0, count), offset)
    pendingInput = pendingInput.subarray(count)
    return count
  }

  const unavailable = (...args: unknown[]) => {
    const callback = args[args.length - 1]
    if (typeof callback === 'function') (callback as NodeStyleCallback)(notImplemented())
  }

  const fileSystem = {
    constants: { O_WRONLY: -1, O_RDWR: -1, O_CREAT: -1, O_TRUNC: -1, O_APPEND: -1, O_EXCL: -1, O_DIRECTORY: -1 },
    writeSync: writeBytes,
    write(fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null, callback: NodeStyleCallback) {
      if (position !== null) {
        callback(notImplemented())
        return
      }
      try {
        callback(null, writeBytes(fd, buffer.subarray(offset, offset + length)))
      } catch (error) {
        callback(error as Error)
      }
    },
    read(fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null, callback: NodeStyleCallback) {
      if (fd !== 0 || position !== null) {
        callback(notImplemented())
        return
      }
      if (pendingInput.length > 0 || inputClosed || length === 0) {
        callback(null, fill(buffer, offset, length))
        return
      }
      pendingReads += 1
      readLine().then(
        (line) => {
          if (line === null) inputClosed = true
          else pendingInput = encoder.encode(`${line}\n`)
          pendingReads -= 1
          callback(null, fill(buffer, offset, length))
        },
        () => {
          inputClosed = true
          pendingReads -= 1
          callback(null, 0)
        },
      )
    },
    fsync(_fd: number, callback: NodeStyleCallback) { callback(null) },
    chmod: unavailable, chown: unavailable, close: unavailable, fchmod: unavailable, fchown: unavailable,
    fstat: unavailable, ftruncate: unavailable, lchown: unavailable, link: unavailable, lstat: unavailable,
    mkdir: unavailable, open: unavailable, readdir: unavailable, readlink: unavailable, rename: unavailable,
    rmdir: unavailable, stat: unavailable, symlink: unavailable, truncate: unavailable, unlink: unavailable,
    utimes: unavailable,
  }

  return {
    fileSystem,
    /** True while the program waits for a line of terminal input. */
    get waitingForInput() { return pendingReads > 0 },
  }
}

/**
 * Runs one Go program in a fresh instance of the compiled runner module.
 *
 * The Go WebAssembly runtime never reports a deadlock: when every goroutine
 * is blocked it simply returns control to JavaScript and waits for events. The
 * runner reports Go's own deadlock error when the instance goes idle with no
 * pending timer and no pending stdin read, because nothing can wake it again.
 */
export async function runGoModule({
  module,
  Go,
  globals,
  files,
  write,
  readLine,
  onStarted,
}: {
  module: WebAssembly.Module
  Go: GoProcessConstructor
  globals: GoGlobals
  files: GoSourceFile[]
  write: (stream: 'stdout' | 'stderr', text: string) => void
  readLine: () => Promise<string | null>
  onStarted: () => void
}): Promise<GoRunOutcome> {
  const go = new Go()
  go.argv = ['main']
  go.env = {}
  const host = createGoFileSystem({ write, readLine })

  return new Promise<GoRunOutcome>((resolve, reject) => {
    let settled = false
    let depth = 0
    let diagnostics: GoDiagnostic[] | null = null

    const settle = (outcome: GoRunOutcome) => {
      if (settled) return
      settled = true
      resolve(outcome)
    }

    go.exit = (code) => {
      settle(diagnostics ? { kind: 'diagnostics', diagnostics } : { kind: 'exited', exitCode: code })
    }

    const checkIdle = () => {
      if (depth > 0 || settled || go.exited) return
      if (host.waitingForInput || go._scheduledTimeouts.size > 0) return
      settle({ kind: 'deadlock' })
    }

    const enterGo = (callback: () => void) => {
      depth += 1
      try {
        callback()
      } finally {
        depth -= 1
      }
      checkIdle()
    }

    const resume = go._resume.bind(go)
    go._resume = () => enterGo(resume)

    globals.fs = host.fileSystem
    globals.__hafaGoRequest = { files: JSON.stringify(files) }
    globals.__hafaGoReport = (kind, payload) => {
      if (kind === 'diagnostics') diagnostics = JSON.parse(payload) as GoDiagnostic[]
      if (kind === 'started') onStarted()
    }

    WebAssembly.instantiate(module, go.importObject).then((instance) => {
      enterGo(() => {
        // run() executes Go synchronously until the program first blocks or
        // exits; its promise only tracks the exit.
        go.run(instance).catch(reject)
      })
    }, reject)
  })
}
