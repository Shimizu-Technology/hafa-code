import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  CHECKPOINT_STORAGE_KEY,
  PROJECT_LIBRARY_STORAGE_KEY,
  createLocalCheckpoint,
  createProject,
  loadCheckpointLibrary,
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

  test('does not claim that a local checkpoint exists when persistence fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    expect(createLocalCheckpoint(createProject('javascript'))).toBeNull()
  })
})
