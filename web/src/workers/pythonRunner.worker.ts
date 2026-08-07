import { loadPyodide } from 'pyodide'
import { installRunner, postRunnerMessage, type RunRequest } from './runnerProtocol'
import { createStdinBridge } from './stdinBridge'

const PROJECT_ROOT = '/home/pyodide/project'
const inputBridges = new Map<string, ReturnType<typeof createStdinBridge>>()
let pyodidePromise: ReturnType<typeof loadPyodide> | null = null

type PythonWorkerGlobal = typeof globalThis & {
  __hafa_readline?: () => Promise<string>
  __hafa_write_prompt?: (prompt: string) => void
}

function safeProjectPath(path: string) {
  const segments = path.replace(/\\/g, '/').split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Unsupported project path: ${path}`)
  }
  return segments.join('/')
}

function parentDirectory(path: string) {
  return path.includes('/') ? path.split('/').slice(0, -1).join('/') : ''
}

function appendOutput(id: string, stream: 'stdout' | 'stderr', message: string, output: string[]) {
  const text = message.endsWith('\n') ? message : `${message}\n`
  output.push(text)
  postRunnerMessage({ id, type: 'output', stream, text })
}

function getPyodide(indexURL: string) {
  pyodidePromise ??= loadPyodide({
    indexURL,
    packages: [],
    stdin: () => null,
  }).catch((error) => {
    pyodidePromise = null
    throw error
  })
  return pyodidePromise
}

async function runPython(request: RunRequest) {
  const { id, code, files } = request
  const entryPath = safeProjectPath(request.entryPath)
  const stdout: string[] = []
  const stderr: string[] = []
  const workerGlobal = globalThis as PythonWorkerGlobal
  const previousReadline = workerGlobal.__hafa_readline
  const previousWritePrompt = workerGlobal.__hafa_write_prompt
  const indexURL = new URL(`${import.meta.env.BASE_URL}assets/pyodide/`, self.location.origin).href
  const pyodide = await getPyodide(indexURL)
  pyodide.setStdout({ batched: (message) => appendOutput(id, 'stdout', message, stdout) })
  pyodide.setStderr({ batched: (message) => appendOutput(id, 'stderr', message, stderr) })
  pyodide.setStdin({ stdin: () => null })

  pyodide.runPython(`
import os
import shutil
shutil.rmtree(${JSON.stringify(PROJECT_ROOT)}, ignore_errors=True)
os.makedirs(${JSON.stringify(PROJECT_ROOT)}, exist_ok=True)
`)

  files.forEach((file) => {
    const path = safeProjectPath(file.path)
    const directory = parentDirectory(path)
    if (directory) pyodide.FS.mkdirTree(`${PROJECT_ROOT}/${directory}`)
    pyodide.FS.writeFile(`${PROJECT_ROOT}/${path}`, file.path === entryPath ? code : file.content, { encoding: 'utf8' })
  })

  postRunnerMessage({ id, type: 'started' })

  const inputBridge = createStdinBridge(() => postRunnerMessage({ id, type: 'input_request' }))
  inputBridges.set(id, inputBridge)
  workerGlobal.__hafa_readline = inputBridge.read
  workerGlobal.__hafa_write_prompt = (prompt) => {
    if (prompt) appendOutput(id, 'stdout', prompt, stdout)
  }

  try {
    const projectRoot = JSON.stringify(PROJECT_ROOT)
    const entryFile = JSON.stringify(`${PROJECT_ROOT}/${entryPath}`)
    const result = await pyodide.runPythonAsync(`
import os
import runpy
import sys
import builtins
from js import __hafa_readline, __hafa_write_prompt
from pyodide.ffi import can_run_sync, run_sync

if not hasattr(builtins, "__hafa_original_input"):
    builtins.__hafa_original_input = builtins.input

def __hafa_input(prompt=""):
    if not can_run_sync():
        raise RuntimeError("Interactive input requires a browser with WebAssembly JSPI support.")
    if prompt:
        __hafa_write_prompt(str(prompt))
    return run_sync(__hafa_readline())

project_root = ${projectRoot}
entry_file = ${entryFile}
os.chdir(project_root)
sys.argv = [entry_file]
entry_dir = os.path.dirname(entry_file)
for module_name, module in list(sys.modules.items()):
    module_file = getattr(module, "__file__", None)
    if module_file and os.path.abspath(module_file).startswith(project_root + os.sep):
        del sys.modules[module_name]
sys.path[:] = [path for path in sys.path if path not in (entry_dir, project_root)]
sys.path.insert(0, entry_dir)
sys.path.insert(0, project_root)
builtins.input = __hafa_input
runpy.run_path(entry_file, run_name="__main__")
`)
    if (result && typeof result === 'object' && 'destroy' in result) result.destroy()
  } catch (error) {
    appendOutput(id, 'stderr', error instanceof Error ? error.message : String(error), stderr)
  } finally {
    pyodide.runPython('builtins.input = builtins.__hafa_original_input')
    inputBridge.abort()
    inputBridges.delete(id)
    workerGlobal.__hafa_readline = previousReadline
    workerGlobal.__hafa_write_prompt = previousWritePrompt
  }

  return { stdout: stdout.join(''), stderr: stderr.join('') }
}

installRunner(runPython, {
  onStdin: ({ id, value }) => inputBridges.get(id)?.write(value),
  onAbort: ({ id }) => inputBridges.get(id)?.abort(),
})
