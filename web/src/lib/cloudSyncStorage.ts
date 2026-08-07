const PENDING_SYNC_STORAGE_KEY = 'hafa-code-pending-cloud-sync-v1'

type PendingSyncMap = Record<string, string>

function loadPendingSyncMap(): PendingSyncMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_SYNC_STORAGE_KEY) || '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed).filter(([id, updatedAt]) => typeof id === 'string' && typeof updatedAt === 'string'),
    )
  } catch {
    return {}
  }
}

function savePendingSyncMap(pending: PendingSyncMap) {
  if (Object.keys(pending).length === 0) {
    localStorage.removeItem(PENDING_SYNC_STORAGE_KEY)
    return
  }

  localStorage.setItem(PENDING_SYNC_STORAGE_KEY, JSON.stringify(pending))
}

export function pendingCloudProjectIds() {
  return new Set(Object.keys(loadPendingSyncMap()))
}

export function markProjectPendingCloudSync(projectId: string, updatedAt: string) {
  const pending = loadPendingSyncMap()
  pending[projectId] = updatedAt
  savePendingSyncMap(pending)
}

export function clearProjectPendingCloudSync(projectId: string) {
  const pending = loadPendingSyncMap()
  delete pending[projectId]
  savePendingSyncMap(pending)
}

export function replacePendingCloudProjectId(previousId: string, nextId: string, updatedAt: string) {
  const pending = loadPendingSyncMap()
  delete pending[previousId]
  pending[nextId] = updatedAt
  savePendingSyncMap(pending)
}
