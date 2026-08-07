import { describe, expect, it } from 'vitest'
import {
  FILE_LANGUAGES,
  PROJECT_KINDS,
  defaultEntryPath,
  inferFileLanguage,
  projectKindDefinition,
  starterProject,
} from './codeRunner'

describe('language registry', () => {
  it('describes every supported project kind in display order', () => {
    expect(PROJECT_KINDS).toEqual(['ruby', 'javascript', 'python', 'web'])
    expect(PROJECT_KINDS.map((kind) => projectKindDefinition(kind).shortLabel)).toEqual(['Ruby', 'JS', 'Python', 'Web'])
  })

  it('keeps runnable and preview-only project capabilities explicit', () => {
    expect(projectKindDefinition('ruby').runner?.language).toBe('ruby')
    expect(projectKindDefinition('ruby').runner?.terminalCommand('main.rb')).toBe('ruby main.rb')
    expect(projectKindDefinition('javascript').runner?.language).toBe('javascript')
    expect(projectKindDefinition('javascript').runner?.terminalCommand('src/main.js')).toBe('node src/main.js')
    expect(projectKindDefinition('python').runner?.language).toBe('python')
    expect(projectKindDefinition('python').runner?.terminalCommand('src/main.py')).toBe('python src/main.py')
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
    expect(FILE_LANGUAGES).toEqual(['ruby', 'javascript', 'python', 'html', 'css', 'json', 'plain'])
    expect(inferFileLanguage('lib/hello.rb', 'javascript')).toBe('ruby')
    expect(inferFileLanguage('src/index.mjs', 'ruby')).toBe('javascript')
    expect(inferFileLanguage('src/main.py', 'ruby')).toBe('python')
    expect(inferFileLanguage('README', 'ruby')).toBe('ruby')
    expect(inferFileLanguage('README', 'javascript')).toBe('plain')
    expect(inferFileLanguage('README', 'python')).toBe('python')
    expect(inferFileLanguage('README', 'web')).toBe('plain')
  })
})
