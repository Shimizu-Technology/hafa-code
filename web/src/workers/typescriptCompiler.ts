import ts from 'typescript'
import type { ProjectFile } from '../lib/projectTypes'
import { HAFA_TYPESCRIPT_DECLARATIONS } from '../lib/typescriptEnvironment'

export const TYPESCRIPT_MAX_FILES = 50
export const TYPESCRIPT_MAX_SOURCE_BYTES = 2_000_000

export type TypeScriptCompileResult = {
  diagnostics: string[]
  entryModule: string | null
  modules: Record<string, string>
}

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.Node16,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  strict: true,
  noEmitOnError: true,
  skipLibCheck: true,
  lib: ['lib.es2020.d.ts'],
  types: [],
  rootDir: '/project',
  outDir: '/output',
}

function safeProjectPath(path: string) {
  if (!path || path.startsWith('/') || path.endsWith('/') || path.includes('\\')) return false
  const segments = path.split('/')
  return segments.every((segment) => segment && segment !== '.' && segment !== '..' && !segment.startsWith('.'))
}

function outputModulePath(fileName: string) {
  return fileName.replace(/^\/output\//, '')
}

function entryModulePath(entryPath: string) {
  return entryPath.replace(/\.ts$/i, '.js')
}

function diagnosticText(diagnostic: ts.Diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || diagnostic.start === undefined) return `error TS${diagnostic.code}: ${message}`

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  const path = diagnostic.file.fileName.replace(/^\/project\//, '')
  return `${path}:${line + 1}:${character + 1} - error TS${diagnostic.code}: ${message}`
}

export function compileTypeScriptProject(
  files: ProjectFile[],
  entryPath: string,
  libraries: Readonly<Record<string, string>>,
): TypeScriptCompileResult {
  if (files.length > TYPESCRIPT_MAX_FILES) {
    return { diagnostics: [`TypeScript projects can include at most ${TYPESCRIPT_MAX_FILES} files.`], entryModule: null, modules: {} }
  }

  const totalBytes = new TextEncoder().encode(files.map((file) => file.content).join('')).byteLength
  if (totalBytes > TYPESCRIPT_MAX_SOURCE_BYTES) {
    return { diagnostics: ['TypeScript projects can include at most 2 MB of source code.'], entryModule: null, modules: {} }
  }

  if (!safeProjectPath(entryPath) || !entryPath.toLowerCase().endsWith('.ts') || entryPath.toLowerCase().endsWith('.d.ts')) {
    return { diagnostics: ['Choose a .ts source file as the TypeScript entry file.'], entryModule: null, modules: {} }
  }

  const typeScriptFiles = files.filter((file) => file.language === 'typescript' || file.path.toLowerCase().endsWith('.ts'))
  if (!typeScriptFiles.some((file) => file.path === entryPath)) {
    return { diagnostics: [`The TypeScript entry file ${entryPath} was not found.`], entryModule: null, modules: {} }
  }

  const virtualFiles = new Map<string, string>()
  for (const file of typeScriptFiles) {
    if (!safeProjectPath(file.path)) {
      return { diagnostics: [`The project path ${file.path || '(empty)'} is not supported.`], entryModule: null, modules: {} }
    }
    const virtualPath = `/project/${file.path}`
    if (virtualFiles.has(virtualPath)) {
      return { diagnostics: [`The TypeScript project contains duplicate file path ${file.path}.`], entryModule: null, modules: {} }
    }
    virtualFiles.set(virtualPath, file.content)
  }

  for (const [fileName, source] of Object.entries(libraries)) virtualFiles.set(`/lib/${fileName}`, source)
  virtualFiles.set('/lib/hafa-code.d.ts', HAFA_TYPESCRIPT_DECLARATIONS)

  const emitted = new Map<string, string>()
  const host: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      const source = virtualFiles.get(fileName)
      return source === undefined ? undefined : ts.createSourceFile(fileName, source, languageVersion, true)
    },
    getDefaultLibFileName: () => '/lib/lib.es2020.d.ts',
    writeFile: (fileName, content) => emitted.set(fileName, content),
    getCurrentDirectory: () => '/project',
    getDirectories: (directory) => {
      const prefix = `${directory.replace(/\/$/, '')}/`
      return [...new Set([...virtualFiles.keys()]
        .filter((fileName) => fileName.startsWith(prefix))
        .map((fileName) => fileName.slice(prefix.length).split('/')[0])
        .filter((segment) => segment && [...virtualFiles.keys()].some((fileName) => fileName.startsWith(`${prefix}${segment}/`))))]
    },
    fileExists: (fileName) => virtualFiles.has(fileName),
    readFile: (fileName) => virtualFiles.get(fileName),
    directoryExists: (directory) => {
      const prefix = `${directory.replace(/\/$/, '')}/`
      return [...virtualFiles.keys()].some((fileName) => fileName.startsWith(prefix))
    },
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    realpath: (fileName) => fileName,
  }

  const rootNames = typeScriptFiles.map((file) => `/project/${file.path}`).concat('/lib/hafa-code.d.ts')
  const program = ts.createProgram({ rootNames, options: compilerOptions, host })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  const emitResult = program.emit()
  const allDiagnostics = [...diagnostics, ...emitResult.diagnostics]
  const uniqueDiagnostics = [...new Map(allDiagnostics.map((diagnostic) => {
    const key = `${diagnostic.file?.fileName ?? ''}:${diagnostic.start ?? ''}:${diagnostic.code}:${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`
    return [key, diagnosticText(diagnostic)]
  })).values()]

  if (emitResult.emitSkipped || uniqueDiagnostics.length) {
    return { diagnostics: uniqueDiagnostics.length ? uniqueDiagnostics : ['TypeScript could not emit this project.'], entryModule: null, modules: {} }
  }

  const modules = Object.fromEntries([...emitted.entries()]
    .filter(([fileName]) => fileName.endsWith('.js'))
    .map(([fileName, source]) => [outputModulePath(fileName), source]))
  const entryModule = entryModulePath(entryPath)
  if (!modules[entryModule]) {
    return { diagnostics: [`TypeScript did not emit the entry module ${entryModule}.`], entryModule: null, modules: {} }
  }

  return { diagnostics: [], entryModule, modules }
}
