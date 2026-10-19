const FIRST_SUCCESS_STORAGE_KEY = 'hafa-code-first-success-v1'
const MAX_REMEMBERED_PROJECTS = 200

function readIds(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(FIRST_SUCCESS_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** True once a project has had its first successful run in this browser. */
export function hasCelebratedFirstSuccess(projectId: string) {
  return readIds().includes(projectId)
}

/**
 * Records the first successful run for a project. Returns true only the first time,
 * so the success moment plays once per project rather than on every run.
 */
export function claimFirstSuccess(projectId: string) {
  const ids = readIds()
  if (ids.includes(projectId)) return false
  try {
    localStorage.setItem(FIRST_SUCCESS_STORAGE_KEY, JSON.stringify([...ids, projectId].slice(-MAX_REMEMBERED_PROJECTS)))
  } catch {
    // Without storage the moment may repeat after a reload, which is harmless.
  }
  return true
}

export type RunMilestone = 'first-success' | 'fixed' | null

/**
 * Decides which message a finished run earns: "Fixed. It runs now." after an error,
 * the project's first success, or nothing.
 */
export function runMilestone(previousStatus: string | null, status: string, firstSuccessClaimed: boolean): RunMilestone {
  if (status !== 'success') return null
  // Fixing an error is the more useful message, even on a project's first success.
  if (previousStatus === 'error' || previousStatus === 'timeout') return 'fixed'
  if (firstSuccessClaimed) return 'first-success'
  return null
}
