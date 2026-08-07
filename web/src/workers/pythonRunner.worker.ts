import { loadPyodide } from 'pyodide'
import { installRunner, postRunnerMessage, type RunRequest } from './runnerProtocol'

const PROJECT_ROOT = '/home/pyodide/project'

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

async function runPython(request: RunRequest) {
  const { id, code, files } = request
  const entryPath = safeProjectPath(request.entryPath)
  const stdout: string[] = []
  const stderr: string[] = []
  const indexURL = new URL(`${import.meta.env.BASE_URL}assets/pyodide/`, self.location.origin).href
  const pyodide = await loadPyodide({
    indexURL,
    packages: [],
    stdin: () => null,
    stdout: (message) => appendOutput(id, 'stdout', message, stdout),
    stderr: (message) => appendOutput(id, 'stderr', message, stderr),
  })

  pyodide.FS.mkdirTree(PROJECT_ROOT)
  files.forEach((file) => {
    const path = safeProjectPath(file.path)
    const directory = parentDirectory(path)
    if (directory) pyodide.FS.mkdirTree(`${PROJECT_ROOT}/${directory}`)
    pyodide.FS.writeFile(`${PROJECT_ROOT}/${path}`, file.path === entryPath ? code : file.content, { encoding: 'utf8' })
  })

  postRunnerMessage({ id, type: 'started' })

  try {
    const projectRoot = JSON.stringify(PROJECT_ROOT)
    const entryFile = JSON.stringify(`${PROJECT_ROOT}/${entryPath}`)
    const result = await pyodide.runPythonAsync(`
import os
import runpy
import sys

project_root = ${projectRoot}
entry_file = ${entryFile}
os.chdir(project_root)
sys.argv = [entry_file]
sys.path.insert(0, os.path.dirname(entry_file))
sys.path.insert(0, project_root)
runpy.run_path(entry_file, run_name="__main__")
`)
    if (result && typeof result === 'object' && 'destroy' in result) result.destroy()
  } catch (error) {
    appendOutput(id, 'stderr', error instanceof Error ? error.message : String(error), stderr)
  }

  return { stdout: stdout.join(''), stderr: stderr.join('') }
}

installRunner(runPython)
