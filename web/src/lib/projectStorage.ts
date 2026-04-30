import { starterProject, type ProjectKind, type SavedProject } from './codeRunner'

const STORAGE_KEY = 'hafa-code-projects-v2'
const LEGACY_STORAGE_KEY = 'hafa-code-project-v1'
const PROJECT_KINDS = new Set<ProjectKind>(['ruby', 'javascript', 'web'])
const FILE_LANGUAGES = new Set(['ruby', 'javascript', 'html', 'css'])
type FileLanguage = SavedProject['files'][number]['language']

export interface ProjectLibrary {
  activeProjectId: string
  projects: SavedProject[]
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function isProjectKind(value: unknown): value is ProjectKind {
  return typeof value === 'string' && PROJECT_KINDS.has(value as ProjectKind)
}

function isFileLanguage(value: unknown): value is FileLanguage {
  return typeof value === 'string' && FILE_LANGUAGES.has(value)
}

function inferFileLanguage(path: string, kind: ProjectKind): FileLanguage {
  const extension = path.toLowerCase().split('.').pop()
  if (extension === 'rb') return 'ruby'
  if (extension === 'html' || extension === 'htm') return 'html'
  if (extension === 'css') return 'css'
  if (extension === 'js' || extension === 'mjs' || extension === 'cjs') return 'javascript'
  if (kind === 'ruby') return 'ruby'
  return 'javascript'
}

function normalizeProject(candidate: Partial<SavedProject> | null | undefined): SavedProject | null {
  if (!candidate?.id || !candidate.title || !isProjectKind(candidate.kind) || !Array.isArray(candidate.files)) {
    return null
  }

  const files = candidate.files
    .filter((file) => typeof file?.path === 'string')
    .map((file) => ({
      path: file.path.trim() || 'main.txt',
      language: isFileLanguage(file.language) ? file.language : inferFileLanguage(file.path, candidate.kind as ProjectKind),
      content: String(file.content ?? ''),
    }))

  if (files.length === 0) return null

  const now = new Date().toISOString()
  return {
    id: String(candidate.id),
    title: String(candidate.title),
    kind: candidate.kind,
    files,
    createdAt: String(candidate.createdAt || now),
    updatedAt: String(candidate.updatedAt || now),
  }
}

function normalizeLibrary(candidate: ProjectLibrary | null): ProjectLibrary | null {
  if (!candidate || !Array.isArray(candidate.projects) || candidate.projects.length === 0) return null
  const projects = candidate.projects
    .map((project) => normalizeProject(project))
    .filter((project): project is SavedProject => Boolean(project))
  if (projects.length === 0) return null
  const activeProjectId = projects.some((project) => project.id === candidate.activeProjectId)
    ? candidate.activeProjectId
    : projects[0].id
  return { activeProjectId, projects }
}

export function loadProjectLibrary(): ProjectLibrary {
  const current = normalizeLibrary(safeParse<ProjectLibrary>(localStorage.getItem(STORAGE_KEY)))
  if (current) return current

  const legacyProject = safeParse<SavedProject>(localStorage.getItem(LEGACY_STORAGE_KEY))
  const normalizedLegacyProject = normalizeProject(legacyProject)
  if (normalizedLegacyProject) {
    const migrated = { activeProjectId: normalizedLegacyProject.id, projects: [normalizedLegacyProject] }
    saveProjectLibrary(migrated)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return migrated
  }

  const firstProject = starterProject('ruby')
  const library = { activeProjectId: firstProject.id, projects: [firstProject] }
  saveProjectLibrary(library)
  return library
}

export function saveProjectLibrary(library: ProjectLibrary) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
}

export function createProject(kind: ProjectKind, title?: string): SavedProject {
  const project = starterProject(kind)
  return {
    ...project,
    title: title?.trim() || project.title,
  }
}

export function duplicateProject(project: SavedProject): SavedProject {
  const now = new Date().toISOString()
  return {
    ...project,
    id: crypto.randomUUID(),
    title: `${project.title} Copy`,
    files: project.files.map((file) => ({ ...file })),
    createdAt: now,
    updatedAt: now,
  }
}

export function exportProject(project: SavedProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'hafa-code-project'}.json`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function parseImportedProject(raw: string): SavedProject {
  const parsed = JSON.parse(raw) as Partial<SavedProject>
  const now = new Date().toISOString()
  const normalized = normalizeProject({
    ...parsed,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  })

  if (!normalized) {
    throw new Error('That file is not a valid Hafa Code project.')
  }

  return normalized
}

export function encodeProjectForShare(project: SavedProject) {
  const json = JSON.stringify(project)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

export function decodeSharedProject(encoded: string): SavedProject {
  const binary = atob(encoded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const json = new TextDecoder().decode(bytes)
  return parseImportedProject(json)
}
