import {
  COLOR_MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type ColorModePreference,
  type ThemePreference,
} from '../hooks/usePreferences'
import {
  CHECKPOINT_STORAGE_KEY,
  loadCheckpointLibrary,
  normalizeCheckpointLibrary,
  normalizeProjectLibrary,
  PROJECT_LIBRARY_STORAGE_KEY,
  type CheckpointLibrary,
  type ProjectLibrary,
} from './projectStorage'
import {
  loadPracticeProgress,
  normalizePracticeProgress,
  PRACTICE_PROGRESS_STORAGE_KEY,
  resetPracticeProgressCache,
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
  const currentById = new Map(current.projects.map((project) => [project.id, project]))
  const importedIds = new Set(imported.projects.map((project) => project.id))
  return {
    activeProjectId: imported.activeProjectId,
    projects: [
      ...imported.projects.map((project) => /^\d+$/.test(project.id) ? currentById.get(project.id) ?? project : project),
      ...current.projects.filter((project) => !importedIds.has(project.id)),
    ],
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

export type WorkspaceRestoreState = {
  library: ProjectLibrary
  checkpoints: CheckpointLibrary
  practiceProgress: PracticeProgress
  theme: ThemePreference
  colorMode: ColorModePreference
}

/** Writes a restore as one recoverable transaction before React state changes. */
export function persistWorkspaceRestore(state: WorkspaceRestoreState, storage: Storage = localStorage) {
  const entries = [
    [PROJECT_LIBRARY_STORAGE_KEY, JSON.stringify(state.library)],
    [CHECKPOINT_STORAGE_KEY, JSON.stringify(state.checkpoints)],
    [PRACTICE_PROGRESS_STORAGE_KEY, JSON.stringify(state.practiceProgress)],
    [THEME_STORAGE_KEY, state.theme],
    [COLOR_MODE_STORAGE_KEY, state.colorMode],
  ] as const
  const previous = new Map(entries.map(([key]) => [key, storage.getItem(key)]))

  try {
    entries.forEach(([key, value]) => storage.setItem(key, value))
  } catch (error) {
    for (const [key] of [...entries].reverse()) {
      try {
        const previousValue = previous.get(key)
        if (previousValue === null || previousValue === undefined) storage.removeItem(key)
        else storage.setItem(key, previousValue)
      } catch {
        // Continue rolling back the remaining keys even if the storage provider fails again.
      }
    }
    resetPracticeProgressCache()
    throw new Error('This browser could not finish the restore. Your existing workspace was kept.', { cause: error })
  }

  resetPracticeProgressCache()
}
