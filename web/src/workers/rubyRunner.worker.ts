import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser'
import rubyWasmUrl from '@ruby/3.3-wasm-wasi/dist/ruby+stdlib.wasm?url'
import { installRunner, postRunnerMessage, type RunRequest } from './runnerProtocol'

let rubyModulePromise: Promise<WebAssembly.Module> | null = null
const pendingInputResolvers = new Map<string, { resolve: (value: string) => void; reject: (reason: Error) => void }>()

function getRubyModule() {
  rubyModulePromise ??= fetch(rubyWasmUrl)
    .then((response) => response.arrayBuffer())
    .then((buffer) => WebAssembly.compile(buffer))
  return rubyModulePromise
}

function rubyStringLiteral(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value))
  return `[${bytes.join(',')}].pack('C*').force_encoding('UTF-8')`
}

function captureRubyOutput(id: string, args: unknown[], streamName: 'stdout' | 'stderr', stream: string[]) {
  const text = args.map(String).join(' ')
  const output = text.endsWith('\n') ? text : `${text}\n`
  stream.push(output)
  postRunnerMessage({ id, type: 'output', stream: streamName, text: output })
}

async function runRuby({ id, code, files, entryPath, stdin = '' }: RunRequest) {
  const stdout: string[] = []
  const stderr: string[] = []
  const stdinQueue = (stdin.match(/[^\n]*\n|[^\n]+/g) ?? [])[Symbol.iterator]()
  const originalLog = console.log
  const originalWarn = console.warn
  const previousGets = (globalThis as { __hafa_gets?: () => Promise<string> }).__hafa_gets

  const readLine = () => {
    const queuedLine = stdinQueue.next()
    if (!queuedLine.done) return Promise.resolve(queuedLine.value)

    postRunnerMessage({ id, type: 'input_request' })
    return new Promise<string>((resolve, reject) => {
      pendingInputResolvers.set(id, {
        resolve: (value) => {
          pendingInputResolvers.delete(id)
          resolve(value.endsWith('\n') ? value : `${value}\n`)
        },
        reject: (reason) => {
          pendingInputResolvers.delete(id)
          reject(reason)
        },
      })
    })
  }

  ;(globalThis as { __hafa_gets?: () => Promise<string> }).__hafa_gets = readLine
  console.log = (...args: unknown[]) => captureRubyOutput(id, args, 'stdout', stdout)
  console.warn = (...args: unknown[]) => captureRubyOutput(id, args, 'stderr', stderr)

  try {
    const module = await getRubyModule()
    const { vm } = await DefaultRubyVM(module, { consolePrint: true })
    postRunnerMessage({ id, type: 'started' })

    try {
      const rubyFiles = files.filter((file) => file.language === 'ruby')
      const fileMap = Object.fromEntries(rubyFiles.map((file) => [file.path, file.content]))
      fileMap[entryPath] = code
      const rubyHash = Object.entries(fileMap)
        .map(([path, content]) => `${rubyStringLiteral(path)} => ${rubyStringLiteral(content)}`)
        .join(', ')
      await vm.evalAsync(`
        require 'js'
        $hafa_code_files = { ${rubyHash} }
        $hafa_code_loaded = {}

        module Kernel
          def gets(*)
            JS.global.__hafa_gets.await.to_s
          end

          def require_relative(path)
            caller_path = caller_locations(1, 1)&.first&.path.to_s
            base = caller_path.include?("/") ? caller_path.split("/")[0...-1].join("/") : ""
            candidate = [base, path].reject(&:empty?).join("/")
            candidate = "#{candidate}.rb" unless candidate.end_with?(".rb")
            source = $hafa_code_files[candidate]
            raise LoadError, "cannot load such file -- #{path}" unless source
            return false if $hafa_code_loaded[candidate]

            $hafa_code_loaded[candidate] = true
            TOPLEVEL_BINDING.eval(source, candidate)
            true
          end
        end

        class << STDIN
          def gets(*)
            JS.global.__hafa_gets.await.to_s
          end
        end

        TOPLEVEL_BINDING.eval($hafa_code_files.fetch(${rubyStringLiteral(entryPath)}), ${rubyStringLiteral(entryPath)})
      `)
    } catch (error) {
      captureRubyOutput(id, [error instanceof Error ? error.message : String(error)], 'stderr', stderr)
    }
  } finally {
    console.log = originalLog
    console.warn = originalWarn
    ;(globalThis as { __hafa_gets?: () => Promise<string> }).__hafa_gets = previousGets
    pendingInputResolvers.delete(id)
  }

  return { stdout: stdout.join(''), stderr: stderr.join('') }
}

installRunner(runRuby, {
  onStdin: ({ id, value }) => pendingInputResolvers.get(id)?.resolve(value),
  onAbort: ({ id }) => pendingInputResolvers.get(id)?.reject(new Error('Execution stopped.')),
})
