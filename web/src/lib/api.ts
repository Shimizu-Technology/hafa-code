import type { ProjectCheckpoint, ProjectFile, ProjectKind, ProjectSnapshot, SavedProject } from './codeRunner'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
let getAuthToken: (() => Promise<string | null>) | null = null

export interface CloudUser {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string
  role: string
}

interface ApiProjectFile {
  path: string
  language: ProjectFile['language']
  content: string
  position?: number
}

interface ApiProject {
  id: number
  title: string
  kind: ProjectKind
  visibility: 'private' | 'unlisted' | 'public'
  archived_at: string | null
  created_at: string
  updated_at: string
  files: ApiProjectFile[]
}

interface ApiResponse<T> {
  data: T | null
  error: string | null
}

interface ApiCheckpoint {
  id: number
  title: string
  created_at: string
  snapshot?: ProjectSnapshot
}

interface ApiShare {
  token: string
  title: string
  kind: ProjectKind
  created_at: string
  snapshot: ProjectSnapshot
}

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (getAuthToken) {
    const token = await getAuthToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers })
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      return {
        data: null,
        error: errorBody.error || (Array.isArray(errorBody.errors) ? errorBody.errors.join(', ') : null) || `Request failed with status ${response.status}`,
      }
    }
    if (response.status === 204) return { data: null, error: null }
    return { data: await response.json() as T, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Network error' }
  }
}

function apiProjectToSavedProject(project: ApiProject): SavedProject {
  return {
    id: String(project.id),
    title: project.title,
    kind: project.kind,
    files: project.files
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((file) => ({ path: file.path, language: file.language, content: file.content })),
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    archivedAt: project.archived_at,
  }
}

function savedProjectPayload(project: SavedProject) {
  return {
    title: project.title,
    kind: project.kind,
    visibility: 'private',
    files: project.files.map((file, index) => ({ ...file, position: index })),
  }
}

function apiCheckpointToProjectCheckpoint(checkpoint: ApiCheckpoint): ProjectCheckpoint {
  return {
    id: String(checkpoint.id),
    title: checkpoint.title,
    createdAt: checkpoint.created_at,
    snapshot: checkpoint.snapshot,
  }
}

function shareSnapshotToSavedProject(share: ApiShare): SavedProject {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: share.snapshot.title || share.title,
    kind: share.snapshot.kind || share.kind,
    files: share.snapshot.files.map((file) => ({ path: file.path, language: file.language, content: file.content })),
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  }
}

export const api = {
  createSession: () => fetchApi<{ user: CloudUser }>('/api/v1/sessions', { method: 'POST' }),
  getProjects: async () => {
    const res = await fetchApi<{ projects: ApiProject[] }>('/api/v1/projects')
    return res.error ? { data: null, error: res.error } : { data: res.data?.projects.map(apiProjectToSavedProject) ?? [], error: null }
  },
  createProject: async (project: SavedProject) => {
    const res = await fetchApi<{ project: ApiProject }>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(savedProjectPayload(project)),
    })
    return res.error ? { data: null, error: res.error } : { data: res.data ? apiProjectToSavedProject(res.data.project) : null, error: null }
  },
  updateProject: async (project: SavedProject) => {
    const res = await fetchApi<{ project: ApiProject }>(`/api/v1/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify(savedProjectPayload(project)),
    })
    return res.error ? { data: null, error: res.error } : { data: res.data ? apiProjectToSavedProject(res.data.project) : null, error: null }
  },
  archiveProject: async (id: string) => {
    const res = await fetchApi<{ project: ApiProject }>(`/api/v1/projects/${id}/archive`, { method: 'PATCH' })
    return res.error ? { data: null, error: res.error } : { data: res.data ? apiProjectToSavedProject(res.data.project) : null, error: null }
  },
  deleteProject: (id: string) => fetchApi<null>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
  unarchiveProject: async (id: string) => {
    const res = await fetchApi<{ project: ApiProject }>(`/api/v1/projects/${id}/unarchive`, { method: 'PATCH' })
    return res.error ? { data: null, error: res.error } : { data: res.data ? apiProjectToSavedProject(res.data.project) : null, error: null }
  },
  getCheckpoints: async (projectId: string) => {
    const res = await fetchApi<{ checkpoints: ApiCheckpoint[] }>(`/api/v1/projects/${projectId}/checkpoints`)
    return res.error ? { data: null, error: res.error } : { data: res.data?.checkpoints.map(apiCheckpointToProjectCheckpoint) ?? [], error: null }
  },
  createCheckpoint: async (projectId: string, title: string) => {
    const res = await fetchApi<{ checkpoint: ApiCheckpoint }>(`/api/v1/projects/${projectId}/checkpoints`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
    return res.error ? { data: null, error: res.error } : { data: res.data ? apiCheckpointToProjectCheckpoint(res.data.checkpoint) : null, error: null }
  },
  restoreCheckpoint: async (projectId: string, checkpointId: string) => {
    const res = await fetchApi<{ project: ApiProject; checkpoint: ApiCheckpoint }>(`/api/v1/projects/${projectId}/checkpoints/${checkpointId}/restore`, { method: 'POST' })
    return res.error ? { data: null, error: res.error } : { data: res.data ? apiProjectToSavedProject(res.data.project) : null, error: null }
  },
  createShare: async (project: SavedProject) => {
    const res = await fetchApi<{ share: ApiShare }>('/api/v1/shares', {
      method: 'POST',
      body: JSON.stringify(savedProjectPayload(project)),
    })
    return res.error ? { data: null, error: res.error } : { data: res.data?.share ?? null, error: null }
  },
  getShare: async (token: string) => {
    const res = await fetchApi<{ share: ApiShare }>(`/api/v1/shares/${encodeURIComponent(token)}`)
    return res.error ? { data: null, error: res.error } : { data: res.data ? shareSnapshotToSavedProject(res.data.share) : null, error: null }
  },
}
