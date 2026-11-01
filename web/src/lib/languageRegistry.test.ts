import { describe, expect, it } from 'vitest'
import { editorInsertsSpaces, editorTabSize } from './languageRegistry'
import {
  FILE_LANGUAGES,
  PROJECT_KINDS,
  defaultEntryPath,
  inferFileLanguage,
  GO_STARTUP_TIMEOUT_MS,
  projectKindDefinition,
  starterProject,
} from './codeRunner'

describe('language registry', () => {
  it('describes every supported project kind in display order', () => {
    expect(PROJECT_KINDS).toEqual(['ruby', 'javascript', 'typescript', 'python', 'java', 'go', 'sql', 'web'])
    expect(PROJECT_KINDS.map((kind) => projectKindDefinition(kind).shortLabel)).toEqual(['Ruby', 'JS', 'TS', 'Python', 'Java', 'Go', 'SQL', 'Web'])
  })

  it('keeps runnable and preview-only project capabilities explicit', () => {
    expect(projectKindDefinition('ruby').runner?.language).toBe('ruby')
    expect(projectKindDefinition('ruby').runner?.terminalCommand('main.rb')).toBe('ruby main.rb')
    expect(projectKindDefinition('javascript').runner?.language).toBe('javascript')
    expect(projectKindDefinition('javascript').runner?.terminalCommand('src/main.js')).toBe('node src/main.js')
    expect(projectKindDefinition('typescript').runner?.language).toBe('typescript')
    expect(projectKindDefinition('typescript').runner?.terminalCommand('src/main.ts')).toBe('tsc src/main.ts && node src/main.js')
    expect(projectKindDefinition('python').runner?.language).toBe('python')
    expect(projectKindDefinition('python').runner?.terminalCommand('src/main.py')).toBe('python src/main.py')
    expect(projectKindDefinition('java').runner?.language).toBe('java')
    expect(projectKindDefinition('java').entryPath).toBe('Main.java')
    expect(projectKindDefinition('java').runner?.terminalCommand('Main.java')).toBe('javac Main.java && java -cp . Main')
    expect(projectKindDefinition('java').runner?.terminalCommand('src/Main.java')).toBe('javac src/Main.java && java -cp src Main')
    expect(projectKindDefinition('java').runner?.terminalCommand('practice files/Main.java')).toBe("javac 'practice files/Main.java' && java -cp 'practice files' Main")
    expect(projectKindDefinition('java').runner?.startupTimeoutMs).toBe(120_000)
    expect(projectKindDefinition('java').runner?.executionTimeoutMs).toBe(30_000)
    expect(projectKindDefinition('java').runner?.startupNote).toBe('The first Java run downloads the browser compiler and may take longer on a mobile connection.')
    expect(projectKindDefinition('go').runner?.language).toBe('go')
    expect(projectKindDefinition('go').entryPath).toBe('main.go')
    expect(projectKindDefinition('go').runner?.terminalCommand('main.go')).toBe('go run .')
    expect(projectKindDefinition('go').runner?.startupTimeoutMs).toBe(GO_STARTUP_TIMEOUT_MS)
    expect(projectKindDefinition('go').runner?.executionTimeoutMs).toBeUndefined()
    expect(projectKindDefinition('go').runner?.firstLoadLabel).toBe('Downloading Go (first time only)')
    expect(projectKindDefinition('go').runner?.prewarm).toBeUndefined()
    expect(projectKindDefinition('sql').runner?.language).toBe('sql')
    expect(projectKindDefinition('sql').runner?.terminalCommand('main.sql')).toBe('sqlite3 :memory: < main.sql')
    expect(projectKindDefinition('web').runner).toBeUndefined()
  })

  it.each(PROJECT_KINDS)('creates a valid %s starter project from its definition', (kind) => {
    const definition = projectKindDefinition(kind)
    const project = starterProject(kind)

    expect(project.kind).toBe(kind)
    expect(project.title).toBe(definition.starterTitle)
    expect(project.entryPath).toBe(definition.entryPath)
    expect(project.files).toEqual(definition.starterFiles)
    expect(defaultEntryPath(project.files, kind)).toBe(definition.entryPath)
  })

  it('returns fresh starter files instead of sharing mutable registry objects', () => {
    const first = starterProject('ruby')
    first.files[0].content = 'changed'

    expect(starterProject('ruby').files[0].content).toContain('Hafa adai, Ruby!')
  })

  it('centralizes file extensions while preserving unknown-file fallbacks', () => {
    expect(FILE_LANGUAGES).toEqual(['ruby', 'javascript', 'typescript', 'python', 'java', 'go', 'sql', 'html', 'css', 'json', 'plain'])
    expect(inferFileLanguage('lib/hello.rb', 'javascript')).toBe('ruby')
    expect(inferFileLanguage('src/index.mjs', 'ruby')).toBe('javascript')
    expect(inferFileLanguage('src/main.ts', 'ruby')).toBe('typescript')
    expect(inferFileLanguage('src/main.py', 'ruby')).toBe('python')
    expect(inferFileLanguage('src/Main.java', 'ruby')).toBe('java')
    expect(inferFileLanguage('greeting.go', 'ruby')).toBe('go')
    expect(inferFileLanguage('README', 'go')).toBe('plain')
    expect(inferFileLanguage('queries/report.sql', 'ruby')).toBe('sql')
    expect(inferFileLanguage('README', 'ruby')).toBe('ruby')
    expect(inferFileLanguage('README', 'javascript')).toBe('plain')
    expect(inferFileLanguage('README', 'python')).toBe('python')
    expect(inferFileLanguage('README', 'web')).toBe('plain')
  })

  it('indents Go with tabs like gofmt and keeps spaces elsewhere', () => {
    expect(editorInsertsSpaces('go')).toBe(false)
    expect(editorTabSize('go')).toBe(4)
    expect(editorInsertsSpaces('python')).toBe(true)
    expect(editorInsertsSpaces('javascript')).toBe(true)
  })
})
