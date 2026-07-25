import { describe, expect, test, vi } from 'vitest'
import type { SavedProject } from './codeRunner'
import { markProjectPendingCloudSync } from './cloudSyncStorage'
import { createConflictCopy, duplicateProject, type ProjectLibrary } from './projectStorage'
import { mergeCloudAndLocalProjects } from './workspace'

function project(id: string, updatedAt: string, organizationId: string | null = '10'): SavedProject {
  return {
    id,
    title: `Project ${id}`,
    kind: 'ruby',
    visibility: 'private',
    organizationId,
    organization: organizationId ? { id: Number(organizationId), name: 'FDMS', slug: 'fdms' } : null,
    owner: { id: 1, fullName: 'Student One' },
    entryPath: 'main.rb',
    files: [{ path: 'main.rb', language: 'ruby', content: `puts ${JSON.stringify(updatedAt)}` }],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt,
    archivedAt: null,
    lockVersion: 2,
  }
}

describe('classroom project reconciliation', () => {
  test('keeps an unsynced class draft and projects from other workspaces', () => {
    const draft = project('draft-uuid', '2026-07-25T01:00:00.000Z')
    const personal = project('personal-uuid', '2026-07-25T02:00:00.000Z', null)
    const library: ProjectLibrary = { activeProjectId: draft.id, projects: [draft, personal] }

    const merged = mergeCloudAndLocalProjects([], library, '10')

    expect(merged.projects.map((candidate) => candidate.id)).toEqual([draft.id, personal.id])
    expect(merged.activeProjectId).toBe(draft.id)
  })

  test('prefers a pending local revision over an older cloud response', () => {
    const local = project('42', '2026-07-25T02:00:00.000Z')
    const cloud = project('42', '2026-07-25T01:00:00.000Z')
    markProjectPendingCloudSync(local.id, local.updatedAt)

    const merged = mergeCloudAndLocalProjects(
      [cloud],
      { activeProjectId: local.id, projects: [local] },
      '10',
    )

    expect(merged.projects[0].updatedAt).toBe(local.updatedAt)
    expect(merged.projects[0].files[0].content).toContain(local.updatedAt)
  })

  test('uses the cloud revision when the local copy is fully synced', () => {
    const local = project('42', '2026-07-25T01:00:00.000Z')
    const cloud = project('42', '2026-07-25T02:00:00.000Z')

    const merged = mergeCloudAndLocalProjects(
      [cloud],
      { activeProjectId: local.id, projects: [local] },
      '10',
    )

    expect(merged.projects[0].updatedAt).toBe(cloud.updatedAt)
  })
})

describe('class starter duplication', () => {
  test('keeps the copy in its class and makes it teacher-only', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
    const source = { ...project('42', '2026-07-25T01:00:00.000Z'), visibility: 'organization' as const }

    const copy = duplicateProject(source)

    expect(copy.id).not.toBe(source.id)
    expect(copy.organizationId).toBe(source.organizationId)
    expect(copy.organization).toEqual(source.organization)
    expect(copy.visibility).toBe('private')
    expect(copy.owner).toBeNull()
    expect(copy.lockVersion).toBeUndefined()
    expect(copy.files).not.toBe(source.files)
  })
})

describe('save conflict recovery', () => {
  test('preserves the local work as a private unsynced class copy', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000002')
    const source = {
      ...project('42', '2026-07-25T01:00:00.000Z'),
      title: 'A'.repeat(120),
      visibility: 'organization' as const,
    }

    const copy = createConflictCopy(source)

    expect(copy.id).not.toBe(source.id)
    expect(copy.title).toHaveLength(120)
    expect(copy.title).toMatch(/ Conflict Copy$/)
    expect(copy.visibility).toBe('private')
    expect(copy.organizationId).toBe(source.organizationId)
    expect(copy.lockVersion).toBeUndefined()
    expect(copy.files[0].content).toBe(source.files[0].content)
  })
})
