import type { ProjectFile, ProjectKind, SavedProject } from './codeRunner'

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
  created_at: string
  updated_at: string
  files: ApiProjectFile[]
}

interface ApiResponse<T> {
  data: T | null
  error: string | null
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
  deleteProject: (id: string) => fetchApi<null>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
}
