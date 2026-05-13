import type { ProjectCheckpoint, ProjectFile, ProjectKind, ProjectSnapshot, ProjectVisibility, SavedProject } from './codeRunner'
import { normalizeProject } from './projectStorage'

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

export interface CloudOrganization {
  id: number
  name: string
  slug: string
  role: 'student' | 'instructor' | 'owner'
}

export interface CloudOrgMember extends CloudUser {
  membership_id: number
  organization_role: 'student' | 'instructor' | 'owner'
  joined_at: string
}

export interface CloudOrgInvitation {
  id?: number
  token: string
  email: string
  role: 'student' | 'instructor'
  invitation_url?: string
  email_sent?: boolean
  accepted_at?: string | null
  expires_at: string
  created_at?: string
  organization?: {
    id: number
    name: string
    slug: string
  }
}

interface ApiProjectFile {
  path: string
  language: ProjectFile['language']
  content: string
  position?: number
}

type ApiProjectSnapshot = Omit<ProjectSnapshot, 'entryPath'> & {
  entryPath?: string
  entry_path?: string
}

interface ApiProject {
  id: number
  title: string
  kind: ProjectKind
  entry_path: string | null
  visibility: ProjectVisibility
  organization_id: number | null
  owner?: { id: number; full_name: string; email?: string } | null
  organization?: { id: number; name: string; slug: string } | null
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
  snapshot?: ApiProjectSnapshot
}

interface ApiShare {
  token: string
  title: string
  kind: ProjectKind
  created_at: string
  snapshot: ApiProjectSnapshot
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
  const files = project.files
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((file) => ({ path: file.path, language: file.language, content: file.content }))
  const normalized = normalizeProject({
    id: String(project.id),
    title: project.title,
    kind: project.kind,
    visibility: project.visibility,
    organizationId: project.organization_id ? String(project.organization_id) : null,
    owner: project.owner ? { id: project.owner.id, fullName: project.owner.full_name } : null,
    organization: project.organization ?? null,
    entryPath: project.entry_path ?? undefined,
    files,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    archivedAt: project.archived_at,
  })

  if (!normalized) throw new Error('Cloud project was not valid.')
  return normalized
}

function savedProjectPayload(project: SavedProject) {
  return {
    title: project.title,
    kind: project.kind,
    entry_path: project.entryPath,
    visibility: project.visibility,
    organization_id: project.organizationId,
    files: project.files.map((file, index) => ({ ...file, position: index })),
  }
}

function apiCheckpointToProjectCheckpoint(checkpoint: ApiCheckpoint): ProjectCheckpoint {
  return {
    id: String(checkpoint.id),
    title: checkpoint.title,
    createdAt: checkpoint.created_at,
    snapshot: checkpoint.snapshot
      ? {
          title: checkpoint.snapshot.title,
          kind: checkpoint.snapshot.kind,
          entryPath: checkpoint.snapshot.entryPath ?? checkpoint.snapshot.entry_path ?? '',
          files: checkpoint.snapshot.files,
        }
      : undefined,
  }
}

function shareSnapshotToSavedProject(share: ApiShare): SavedProject {
  const now = new Date().toISOString()
  const normalized = normalizeProject({
    id: crypto.randomUUID(),
    title: share.snapshot.title || share.title,
    kind: share.snapshot.kind || share.kind,
    visibility: 'private',
    organizationId: null,
    entryPath: share.snapshot.entryPath ?? share.snapshot.entry_path ?? undefined,
    files: share.snapshot.files.map((file) => ({ path: file.path, language: file.language, content: file.content })),
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  })

  if (!normalized) throw new Error('Shared project was not valid.')
  return normalized
}

export const api = {
  createSession: () => fetchApi<{ user: CloudUser; organizations: CloudOrganization[] }>('/api/v1/sessions', { method: 'POST' }),
  getOrganizations: async () => {
    const res = await fetchApi<{ organizations: CloudOrganization[] }>('/api/v1/organizations')
    return res.error ? { data: null, error: res.error } : { data: res.data?.organizations ?? [], error: null }
  },
  createOrganization: async (name: string) => {
    const res = await fetchApi<{ organization: CloudOrganization }>('/api/v1/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    return res.error ? { data: null, error: res.error } : { data: res.data?.organization ?? null, error: null }
  },
  getOrgMembers: async (organizationId: string) => {
    const res = await fetchApi<{ members: CloudOrgMember[] }>(`/api/v1/organizations/${organizationId}/members`)
    return res.error ? { data: null, error: res.error } : { data: res.data?.members ?? [], error: null }
  },
  getOrgInvitations: async (organizationId: string) => {
    const res = await fetchApi<{ invitations: CloudOrgInvitation[] }>(`/api/v1/organizations/${organizationId}/invitations`)
    return res.error ? { data: null, error: res.error } : { data: res.data?.invitations ?? [], error: null }
  },
  createOrgInvitation: async (organizationId: string, email: string, role: CloudOrgInvitation['role']) => {
    const res = await fetchApi<{ invitation: CloudOrgInvitation }>(`/api/v1/organizations/${organizationId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
    return res.error ? { data: null, error: res.error } : { data: res.data?.invitation ?? null, error: null }
  },
  getInvitation: async (token: string) => {
    const res = await fetchApi<{ invitation: CloudOrgInvitation }>(`/api/v1/invitations/${encodeURIComponent(token)}`)
    return res.error ? { data: null, error: res.error } : { data: res.data?.invitation ?? null, error: null }
  },
  acceptInvitation: async (token: string) => {
    const res = await fetchApi<{ organization: CloudOrganization }>(`/api/v1/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' })
    return res.error ? { data: null, error: res.error } : { data: res.data?.organization ?? null, error: null }
  },
  getProjects: async (organizationId?: string | null) => {
    const endpoint = organizationId ? `/api/v1/projects?organization_id=${encodeURIComponent(organizationId)}` : '/api/v1/projects'
    const res = await fetchApi<{ projects: ApiProject[] }>(endpoint)
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
    if (res.error) return { data: null, error: res.error }

    try {
      return { data: res.data ? shareSnapshotToSavedProject(res.data.share) : null, error: null }
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Shared project was not valid.' }
    }
  },
}
