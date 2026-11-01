import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  CHECKPOINT_STORAGE_KEY,
  PROJECT_LIBRARY_STORAGE_KEY,
  createLocalCheckpoint,
  createProject,
  loadCheckpointLibrary,
  parseImportedProject,
  projectExportFormat,
  loadProjectLibrary,
  saveCheckpointLibrary,
  saveProjectLibrary,
} from './projectStorage'

function storageThatThrows() {
  return {
    setItem: vi.fn(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    }),
  } as unknown as Storage
}

describe('project storage failures', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  test('reports a blocked project-library write instead of throwing', () => {
    const storage = storageThatThrows()
    const project = createProject('ruby')

    expect(saveProjectLibrary({ activeProjectId: project.id, projects: [project] }, storage)).toBe(false)
    expect(storage.setItem).toHaveBeenCalledWith(PROJECT_LIBRARY_STORAGE_KEY, expect.any(String))
  })

  test('reports a blocked checkpoint-library write instead of throwing', () => {
    const storage = storageThatThrows()

    expect(saveCheckpointLibrary({}, storage)).toBe(false)
    expect(storage.setItem).toHaveBeenCalledWith(CHECKPOINT_STORAGE_KEY, '{}')
  })

  test('falls back to usable empty state when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })

    expect(loadProjectLibrary().projects).toHaveLength(1)
    expect(loadCheckpointLibrary()).toEqual({})
  })

  test('does not overwrite fallback state after a browser storage read fails', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })

    expect(loadProjectLibrary().projects).toHaveLength(1)
    expect(createLocalCheckpoint(createProject('javascript'))).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
  })

  test('preserves a legacy project when the migrated library cannot be saved', () => {
    const legacyProject = createProject('ruby')
    localStorage.setItem('hafa-code-project-v1', JSON.stringify(legacyProject))
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    expect(loadProjectLibrary().projects[0].id).toBe(legacyProject.id)
    expect(removeItem).not.toHaveBeenCalled()
  })

  test('does not claim that a local checkpoint exists when persistence fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    expect(createLocalCheckpoint(createProject('javascript'))).toBeNull()
  })
})

describe('Go project portability', () => {
  test('exports a one-file Go project as source and round-trips a multi-file project as JSON', () => {
    const project = createProject('go')
    expect(projectExportFormat(project)).toEqual({ kind: 'source', fileName: 'go-playground.go' })

    const multiFile = { ...project, files: [...project.files, { path: 'helper.go', language: 'go' as const, content: 'package main\n\nfunc helper() {}\n' }] }
    expect(projectExportFormat(multiFile).kind).toBe('json')
    const imported = parseImportedProject(JSON.stringify(multiFile))
    expect(imported).toMatchObject({ kind: 'go', entryPath: 'main.go' })
    expect(imported.files.map((file) => [file.path, file.language])).toEqual([['main.go', 'go'], ['helper.go', 'go']])
  })
})
