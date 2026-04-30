import { starterProject, type ProjectKind, type SavedProject } from './codeRunner'

const STORAGE_KEY = 'hafa-code-projects-v2'
const LEGACY_STORAGE_KEY = 'hafa-code-project-v1'

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

function normalizeLibrary(candidate: ProjectLibrary | null): ProjectLibrary | null {
  if (!candidate || !Array.isArray(candidate.projects) || candidate.projects.length === 0) return null
  const projects = candidate.projects.filter((project) => project?.id && project?.kind && Array.isArray(project.files))
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
  if (legacyProject?.id && Array.isArray(legacyProject.files)) {
    const migrated = { activeProjectId: legacyProject.id, projects: [legacyProject] }
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
  if (!parsed.title || !parsed.kind || !Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error('That file is not a valid Hafa Code project.')
  }

  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: String(parsed.title),
    kind: parsed.kind,
    files: parsed.files.map((file) => ({
      path: String(file.path || 'main.txt'),
      language: file.language,
      content: String(file.content ?? ''),
    })),
    createdAt: now,
    updatedAt: now,
  }
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
