import { beforeEach, describe, expect, it } from 'vitest'
import { starterProject } from './codeRunner'
import { saveCheckpointLibrary, type ProjectLibrary } from './projectStorage'
import { savePracticeProgress } from './practiceProgress'
import {
  createWorkspaceBackup,
  mergeCheckpointLibraries,
  mergePracticeProgress,
  mergeWorkspaceLibraries,
  parseWorkspaceBackup,
  persistWorkspaceRestore,
  serializeWorkspaceBackup,
} from './workspaceBackup'

function library(kind: 'ruby' | 'java' = 'ruby'): ProjectLibrary {
  const project = starterProject(kind)
  return { activeProjectId: project.id, projects: [project] }
}

class FailingStorage implements Storage {
  private values: Map<string, string>
  private writes = 0
  private readonly failAt: number

  constructor(initial: Record<string, string>, failAt: number) {
    this.values = new Map(Object.entries(initial))
    this.failAt = failAt
  }

  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) {
    this.writes += 1
    if (this.writes === this.failAt) throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    this.values.set(key, value)
  }
  snapshot() { return Object.fromEntries(this.values) }
}

describe('workspace backups', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips projects, checkpoints, practice progress, and preferences', () => {
    const source = library('java')
    const project = source.projects[0]
    saveCheckpointLibrary({
      [project.id]: [{
        id: 'checkpoint-1',
        title: 'Before refactor',
        createdAt: '2026-09-04T00:00:00.000Z',
        snapshot: { title: project.title, kind: project.kind, entryPath: project.entryPath, files: project.files },
      }],
    })
    savePracticeProgress({ completedChallengeIds: ['java-order-total'], projectChallenges: { [project.id]: 'java-order-total' } })

    const parsed = parseWorkspaceBackup(serializeWorkspaceBackup(createWorkspaceBackup({
      library: source,
      theme: 'dark',
      colorMode: 'colorblind',
    })))

    expect(parsed.data.library.activeProjectId).toBe(source.activeProjectId)
    expect(parsed.data.library.projects[0]).toMatchObject(source.projects[0])
    expect(parsed.data.checkpoints[project.id]).toHaveLength(1)
    expect(parsed.data.practiceProgress.completedChallengeIds).toEqual(['java-order-total'])
    expect(parsed.data.preferences).toEqual({ theme: 'dark', colorMode: 'colorblind' })
  })

  it('rejects project exports and unsupported backup versions', () => {
    expect(() => parseWorkspaceBackup(JSON.stringify(starterProject('ruby')))).toThrow(/not a supported Håfa Code workspace backup/i)
    expect(() => parseWorkspaceBackup(JSON.stringify({ format: 'hafa-code-workspace', version: 2, data: {} }))).toThrow(/not a supported/i)
  })

  it('merges imported records first without duplicating matching ids', () => {
    const current = library('ruby')
    const imported = library('java')
    const matchingCurrent = { ...current.projects[0], id: imported.projects[0].id }

    expect(mergeWorkspaceLibraries(
      { activeProjectId: current.activeProjectId, projects: [matchingCurrent, ...current.projects] },
      imported,
    ).projects).toEqual([imported.projects[0], current.projects[0]])

    const mergedCheckpoints = mergeCheckpointLibraries(
      { p1: [{ id: 'same', title: 'Old', createdAt: '2026-09-01', snapshot: { title: 'Old', kind: 'ruby', entryPath: 'main.rb', files: current.projects[0].files } }] },
      { p1: [{ id: 'same', title: 'Imported', createdAt: '2026-09-04', snapshot: { title: 'Imported', kind: 'java', entryPath: 'Main.java', files: imported.projects[0].files } }] },
    )
    expect(mergedCheckpoints.p1.map((checkpoint) => checkpoint.title)).toEqual(['Imported'])

    expect(mergePracticeProgress(
      { completedChallengeIds: ['ruby-one'], projectChallenges: { p1: 'ruby-one' } },
      { completedChallengeIds: ['java-one'], projectChallenges: { p1: 'java-one' } },
    )).toEqual({
      completedChallengeIds: ['java-one', 'ruby-one'],
      projectChallenges: { p1: 'java-one' },
    })
  })

  it('keeps a loaded cloud project when an older backup has the same server id', () => {
    const current = library('java')
    const imported = library('java')
    current.projects[0] = { ...current.projects[0], id: '42', title: 'Current cloud project', updatedAt: '2026-09-04T02:00:00.000Z' }
    current.activeProjectId = '42'
    imported.projects[0] = { ...imported.projects[0], id: '42', title: 'Older backup', updatedAt: '2026-09-03T02:00:00.000Z' }
    imported.activeProjectId = '42'

    const merged = mergeWorkspaceLibraries(current, imported)

    expect(merged.activeProjectId).toBe('42')
    expect(merged.projects).toEqual([current.projects[0]])
  })

  it('deduplicates project and checkpoint ids and rejects invalid checkpoint dates', () => {
    const source = createWorkspaceBackup({ library: library('ruby'), theme: 'system', colorMode: 'default' })
    const project = source.data.library.projects[0]
    source.data.library.projects.push({ ...project, title: 'Duplicate project' })
    source.data.checkpoints[project.id] = [
      { id: 'same', title: 'Keep me', createdAt: '2026-09-04T00:00:00.000Z', snapshot: { title: project.title, kind: project.kind, entryPath: project.entryPath, files: project.files } },
      { id: 'same', title: 'Duplicate', createdAt: '2026-09-03T00:00:00.000Z', snapshot: { title: project.title, kind: project.kind, entryPath: project.entryPath, files: project.files } },
      { id: 'bad-date', title: 'Invalid', createdAt: 'not-a-date', snapshot: { title: project.title, kind: project.kind, entryPath: project.entryPath, files: project.files } },
    ]

    const parsed = parseWorkspaceBackup(serializeWorkspaceBackup(source))

    expect(parsed.data.library.projects.map((candidate) => candidate.title)).toEqual([project.title])
    expect(parsed.data.checkpoints[project.id].map((checkpoint) => checkpoint.title)).toEqual(['Keep me'])
  })

  it.each([1, 2, 3, 4, 5])('rolls every storage key back when restore write %s fails', (failAt) => {
    const initial = {
      'hafa-code-projects-v2': 'old-projects',
      'hafa-code-checkpoints-v1': 'old-checkpoints',
      'hafa-code-practice-progress-v1': 'old-progress',
      'hafa-code-theme-v1': 'dark',
      'hafa-code-color-mode-v1': 'colorblind',
    }
    const storage = new FailingStorage(initial, failAt)
    const nextLibrary = library('java')

    expect(() => persistWorkspaceRestore({
      library: nextLibrary,
      checkpoints: {},
      practiceProgress: { completedChallengeIds: [], projectChallenges: {} },
      theme: 'light',
      colorMode: 'default',
    }, storage)).toThrow(/existing workspace was kept/i)
    expect(storage.snapshot()).toEqual(initial)
  })
})
