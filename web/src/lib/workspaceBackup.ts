import type { ColorModePreference, ThemePreference } from '../hooks/usePreferences'
import {
  loadCheckpointLibrary,
  normalizeCheckpointLibrary,
  normalizeProjectLibrary,
  type CheckpointLibrary,
  type ProjectLibrary,
} from './projectStorage'
import {
  loadPracticeProgress,
  normalizePracticeProgress,
  type PracticeProgress,
} from './practiceProgress'

const BACKUP_FORMAT = 'hafa-code-workspace'
const BACKUP_VERSION = 1

export interface WorkspaceBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  data: {
    library: ProjectLibrary
    checkpoints: CheckpointLibrary
    practiceProgress: PracticeProgress
    preferences: {
      theme: ThemePreference
      colorMode: ColorModePreference
    }
  }
}

type WorkspaceBackupInput = {
  library: ProjectLibrary
  theme: ThemePreference
  colorMode: ColorModePreference
}

function normalizeTheme(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function normalizeColorMode(value: unknown): ColorModePreference {
  return value === 'colorblind' ? 'colorblind' : 'default'
}

export function createWorkspaceBackup({ library, theme, colorMode }: WorkspaceBackupInput): WorkspaceBackup {
  const normalizedLibrary = normalizeProjectLibrary(library)
  if (!normalizedLibrary) throw new Error('There are no valid projects to back up.')

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      library: normalizedLibrary,
      checkpoints: loadCheckpointLibrary(),
      practiceProgress: loadPracticeProgress(),
      preferences: { theme, colorMode },
    },
  }
}

export function serializeWorkspaceBackup(backup: WorkspaceBackup) {
  return JSON.stringify(backup, null, 2)
}

export function downloadWorkspaceBackup(backup: WorkspaceBackup) {
  const date = backup.exportedAt.slice(0, 10)
  const blob = new Blob([serializeWorkspaceBackup(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `hafa-code-workspace-${date}.json`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function parseWorkspaceBackup(raw: string): WorkspaceBackup {
  let candidate: unknown
  try {
    candidate = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (!candidate || typeof candidate !== 'object') {
    throw new Error('That file is not a Håfa Code workspace backup.')
  }

  const value = candidate as Record<string, unknown>
  if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error('That file is not a supported Håfa Code workspace backup.')
  }

  const data = value.data as Record<string, unknown> | undefined
  const library = normalizeProjectLibrary((data?.library ?? null) as ProjectLibrary | null)
  if (!library) throw new Error('That backup does not contain any valid projects.')

  const preferences = (data?.preferences ?? {}) as Record<string, unknown>
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    data: {
      library,
      checkpoints: normalizeCheckpointLibrary(data?.checkpoints),
      practiceProgress: normalizePracticeProgress(data?.practiceProgress as Partial<PracticeProgress> | null),
      preferences: {
        theme: normalizeTheme(preferences.theme),
        colorMode: normalizeColorMode(preferences.colorMode),
      },
    },
  }
}

export function mergeWorkspaceLibraries(current: ProjectLibrary, imported: ProjectLibrary): ProjectLibrary {
  const importedIds = new Set(imported.projects.map((project) => project.id))
  return {
    activeProjectId: imported.activeProjectId,
    projects: [...imported.projects, ...current.projects.filter((project) => !importedIds.has(project.id))],
  }
}

export function mergeCheckpointLibraries(current: CheckpointLibrary, imported: CheckpointLibrary): CheckpointLibrary {
  const result: CheckpointLibrary = { ...current }
  for (const [projectId, checkpoints] of Object.entries(imported)) {
    const existing = result[projectId] ?? []
    const importedIds = new Set(checkpoints.map((checkpoint) => checkpoint.id))
    result[projectId] = [...checkpoints, ...existing.filter((checkpoint) => !importedIds.has(checkpoint.id))]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 30)
  }
  return result
}

export function mergePracticeProgress(current: PracticeProgress, imported: PracticeProgress): PracticeProgress {
  return {
    completedChallengeIds: [...new Set([...imported.completedChallengeIds, ...current.completedChallengeIds])],
    projectChallenges: { ...current.projectChallenges, ...imported.projectChallenges },
  }
}
