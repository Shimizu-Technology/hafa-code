export type RunnerLanguage = 'ruby' | 'javascript' | 'python'

export type ProjectKind = RunnerLanguage | 'web'
export type ProjectVisibility = 'private' | 'organization' | 'unlisted' | 'public'
export type ProjectFileLanguage = 'ruby' | 'javascript' | 'python' | 'html' | 'css' | 'json' | 'plain'

export interface ProjectFile {
  path: string
  language: ProjectFileLanguage
  content: string
}

export interface SavedProject {
  id: string
  title: string
  kind: ProjectKind
  visibility: ProjectVisibility
  organizationId?: string | null
  owner?: {
    id: number
    fullName: string
  } | null
  organization?: {
    id: number
    name: string
    slug: string
  } | null
  entryPath: string
  files: ProjectFile[]
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
  lockVersion?: number
}

export interface ProjectSnapshot {
  title: string
  kind: ProjectKind
  entryPath: string
  files: ProjectFile[]
}

export interface ProjectCheckpoint {
  id: string
  title: string
  createdAt: string
  snapshot?: ProjectSnapshot
}
