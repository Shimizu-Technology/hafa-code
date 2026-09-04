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
  serializeWorkspaceBackup,
} from './workspaceBackup'

function library(kind: 'ruby' | 'java' = 'ruby'): ProjectLibrary {
  const project = starterProject(kind)
  return { activeProjectId: project.id, projects: [project] }
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
})
