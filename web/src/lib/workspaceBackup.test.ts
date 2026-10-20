import { beforeEach, describe, expect, it } from 'vitest'
import { starterProject } from './codeRunner'
import { decodeSharedProject, encodeProjectForShare, saveCheckpointLibrary, type ProjectLibrary } from './projectStorage'
import { savePracticeProgress } from './practiceProgress'
import { emptyLessonLinks, LESSON_LINKS_STORAGE_KEY, loadLessonLinks, mergeLessonLinks, recordLessonLink, resetLessonLinksCache, saveLessonLinks } from './lessonLinks'
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

  it.each([1, 2, 3, 4, 5, 6])('rolls every storage key back when restore write %s fails', (failAt) => {
    const initial = {
      'hafa-code-projects-v2': 'old-projects',
      'hafa-code-checkpoints-v1': 'old-checkpoints',
      'hafa-code-practice-progress-v1': 'old-progress',
      'hafa-code-lesson-links-v1': 'old-lesson-links',
      'hafa-code-theme-v1': 'dark',
      'hafa-code-color-mode-v1': 'colorblind',
    }
    const storage = new FailingStorage(initial, failAt)
    const nextLibrary = library('java')

    expect(() => persistWorkspaceRestore({
      library: nextLibrary,
      checkpoints: {},
      practiceProgress: { completedChallengeIds: [], projectChallenges: {} },
      lessonLinks: emptyLessonLinks(),
      theme: 'light',
      colorMode: 'default',
    }, storage)).toThrow(/existing workspace was kept/i)
    expect(storage.snapshot()).toEqual(initial)
  })

  it('confirms when every workspace record was restored', () => {
    expect(persistWorkspaceRestore({
      library: library('ruby'),
      checkpoints: {},
      practiceProgress: { completedChallengeIds: [], projectChallenges: {} },
      lessonLinks: emptyLessonLinks(),
      theme: 'system',
      colorMode: 'default',
    })).toBe(true)
  })
})

describe('workspace backups and lesson records', () => {
  const LESSON_URL = 'https://learn.codeschoolofguam.com/lessons/42'

  beforeEach(() => {
    localStorage.clear()
    resetLessonLinksCache()
  })

  it('round-trips the lesson return and starter key for backed-up projects only', () => {
    const backedUp = library('ruby')
    const projectId = backedUp.activeProjectId
    let links = recordLessonLink(emptyLessonLinks(), projectId, { returnTarget: { url: LESSON_URL, label: 'Lesson 2' }, starterKey: 'csg-python-pilot:lesson-2' })
    links = recordLessonLink(links, 'some-other-browser-project', { returnTarget: { url: `${LESSON_URL}9`, label: 'Elsewhere' }, starterKey: 'csg:other' })
    saveLessonLinks(links)

    const backup = createWorkspaceBackup({ library: backedUp, theme: 'system', colorMode: 'default' })
    expect(Object.keys(backup.data.lessonLinks.projects)).toEqual([projectId])
    expect(backup.data.lessonLinks.starters).toEqual({ 'csg-python-pilot:lesson-2': projectId })

    const parsed = parseWorkspaceBackup(serializeWorkspaceBackup(backup))
    expect(parsed.data.lessonLinks.projects[projectId]).toMatchObject({ returnUrl: LESSON_URL, returnLabel: 'Lesson 2', starterKey: 'csg-python-pilot:lesson-2' })

    // Restoring on a fresh browser brings back "Back to your lesson" and reopen-by-link.
    localStorage.clear()
    resetLessonLinksCache()
    const merged = mergeLessonLinks(loadLessonLinks(), parsed.data.lessonLinks, parsed.data.library.projects.map((project) => project.id))
    persistWorkspaceRestore({ library: parsed.data.library, checkpoints: {}, practiceProgress: parsed.data.practiceProgress, lessonLinks: merged, theme: 'system', colorMode: 'default' })
    expect(loadLessonLinks()).toEqual(merged)
    expect(JSON.parse(localStorage.getItem(LESSON_LINKS_STORAGE_KEY)!).starters).toEqual({ 'csg-python-pilot:lesson-2': projectId })
  })

  it('re-validates lesson records with the return-link allowlist on import', () => {
    const backedUp = library('ruby')
    const projectId = backedUp.activeProjectId
    const backup = createWorkspaceBackup({ library: backedUp, theme: 'system', colorMode: 'default' })
    const tampered = JSON.parse(serializeWorkspaceBackup(backup))
    tampered.data.lessonLinks = {
      projects: {
        [projectId]: { returnUrl: 'https://learn.codeschoolofguam.com.evil.com/lessons/1', returnLabel: 'Evil', starterKey: null, updatedAt: '2026-10-20T00:00:00.000Z' },
        'not-in-backup': { returnUrl: LESSON_URL, returnLabel: 'Orphan', starterKey: null, updatedAt: '2026-10-20T00:00:00.000Z' },
      },
      starters: { 'bad key with spaces': projectId, 'csg:ok': 'not-in-backup' },
    }
    const parsed = parseWorkspaceBackup(JSON.stringify(tampered))
    expect(parsed.data.lessonLinks).toEqual(emptyLessonLinks())

    tampered.data.lessonLinks.projects[projectId].returnUrl = 'javascript:alert(1)'
    expect(parseWorkspaceBackup(JSON.stringify(tampered)).data.lessonLinks.projects).toEqual({})

    tampered.data.lessonLinks.projects[projectId].returnUrl = LESSON_URL
    tampered.data.lessonLinks.projects[projectId].returnLabel = '\u202eLesson\u0000 two'
    expect(parseWorkspaceBackup(JSON.stringify(tampered)).data.lessonLinks.projects[projectId]).toMatchObject({ returnUrl: LESSON_URL, returnLabel: 'Lesson two' })
  })

  it('opens older backups without lesson records', () => {
    const backup = JSON.parse(serializeWorkspaceBackup(createWorkspaceBackup({ library: library('ruby'), theme: 'system', colorMode: 'default' })))
    delete backup.data.lessonLinks
    expect(parseWorkspaceBackup(JSON.stringify(backup)).data.lessonLinks).toEqual(emptyLessonLinks())
  })

  it("keeps this browser's record and adds the backup's for projects it does not track", () => {
    const current = recordLessonLink(emptyLessonLinks(), 'p1', { returnTarget: { url: LESSON_URL, label: 'Current' }, starterKey: 'csg:one' })
    let imported = recordLessonLink(emptyLessonLinks(), 'p1', { returnTarget: { url: `${LESSON_URL}0`, label: 'Old' }, starterKey: 'csg:one' })
    imported = recordLessonLink(imported, 'p2', { returnTarget: { url: `${LESSON_URL}1`, label: 'Second' }, starterKey: 'csg:two' })
    imported = recordLessonLink(imported, 'gone', { returnTarget: { url: `${LESSON_URL}2`, label: 'Gone' }, starterKey: 'csg:three' })
    const merged = mergeLessonLinks(current, imported, ['p1', 'p2'])
    expect(merged.projects.p1.returnLabel).toBe('Current')
    expect(merged.projects.p2.returnLabel).toBe('Second')
    expect(merged.projects.gone).toBeUndefined()
    expect(merged.starters).toEqual({ 'csg:one': 'p1', 'csg:two': 'p2' })

    // A starter pointing at a project this browser no longer has follows the backup.
    const stale = { projects: {}, starters: { 'csg:two': 'deleted-here' } }
    expect(mergeLessonLinks(stale, imported, ['p1', 'p2']).starters['csg:two']).toBe('p2')
  })

  it('never puts lesson records into a Share payload after a restore', () => {
    const backedUp = library('ruby')
    saveLessonLinks(recordLessonLink(emptyLessonLinks(), backedUp.activeProjectId, { returnTarget: { url: LESSON_URL, label: 'Lesson 2' }, starterKey: 'csg:share' }))
    const parsed = parseWorkspaceBackup(serializeWorkspaceBackup(createWorkspaceBackup({ library: backedUp, theme: 'system', colorMode: 'default' })))
    const encoded = encodeProjectForShare(parsed.data.library.projects[0])
    const decoded = JSON.stringify(decodeSharedProject(encoded))
    expect(decoded).not.toContain('learn.codeschoolofguam.com')
    expect(decoded).not.toContain('csg:share')
  })
})
