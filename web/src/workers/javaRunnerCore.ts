export const JAVA_MAX_PROJECT_FILES = 50
export const JAVA_MAX_PROJECT_BYTES = 2_000_000
export const JAVA_MAX_OUTPUT_BYTES = 256 * 1024

const encoder = new TextEncoder()

export type JavaProjectFile = {
  path: string
  content: string
  language: string
}

export type JavaRunRequest = {
  code: string
  entryPath: string
  files: JavaProjectFile[]
}

export type JavaOutputState = {
  stdout: string[]
  stderr: string[]
  outputBytes: number
  outputTruncated: boolean
}

export function safeJavaProjectPath(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const segments = normalized.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) {
    throw new Error(`Unsupported Java file path: ${path}`)
  }
  return segments.join('/')
}

export function validateJavaProject(request: JavaRunRequest) {
  if (request.files.length > JAVA_MAX_PROJECT_FILES) {
    throw new Error(`Java projects support up to ${JAVA_MAX_PROJECT_FILES} files.`)
  }

  const entryPath = safeJavaProjectPath(request.entryPath)
  const effectiveFiles = request.files.map((file) => {
    const path = safeJavaProjectPath(file.path)
    return { ...file, path, content: path === entryPath ? request.code : file.content }
  })
  const totalBytes = effectiveFiles.reduce((total, file) => total + encoder.encode(file.content).byteLength, 0)
  if (totalBytes > JAVA_MAX_PROJECT_BYTES) {
    throw new Error(`Java projects support up to ${JAVA_MAX_PROJECT_BYTES.toLocaleString('en-US')} bytes of source code.`)
  }

  const javaFiles = effectiveFiles.filter((file) => file.language === 'java' || file.path.toLowerCase().endsWith('.java'))
  if (!javaFiles.some((file) => file.path === entryPath)) {
    throw new Error(`Java entry file not found: ${entryPath}`)
  }
  if (!entryPath.toLowerCase().endsWith('.java')) throw new Error('The Java entry file must end in .java.')

  for (const file of javaFiles) {
    if (/^\s*package\s+[\w.]+\s*;/m.test(file.content)) {
      throw new Error('Java packages are not supported yet. Keep Main.java and helper classes in the default package.')
    }
  }

  const basenames = javaFiles.map((file) => file.path.split('/').pop() ?? '')
  if (new Set(basenames).size !== basenames.length) {
    throw new Error('Java files must have unique filenames while packages are disabled.')
  }

  return { entryPath, javaFiles }
}

export function appendJavaOutput(
  state: JavaOutputState,
  stream: 'stdout' | 'stderr',
  value: unknown,
  emit: (stream: 'stdout' | 'stderr', text: string) => void,
) {
  if (state.outputTruncated) return

  const text = String(value)
  const nextBytes = encoder.encode(text).byteLength
  if (state.outputBytes + nextBytes > JAVA_MAX_OUTPUT_BYTES) {
    state.outputTruncated = true
    const message = `\nOutput stopped after ${JAVA_MAX_OUTPUT_BYTES / 1024} KB.\n`
    state.stderr.push(message)
    emit('stderr', message)
    return
  }

  state.outputBytes += nextBytes
  state[stream].push(text)
  emit(stream, text)
}
