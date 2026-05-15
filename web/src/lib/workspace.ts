import { inferFileLanguage, type ProjectFile, type ProjectKind, type ProjectVisibility, type SavedProject } from './codeRunner'
import { createProject, decodeSharedProject, loadProjectLibrary, saveProjectLibrary, type ProjectLibrary } from './projectStorage'

export type FileDialogMode = 'create' | 'rename' | 'duplicate'

export interface FileDialogState {
  mode: FileDialogMode
  path: string
  sourcePath?: string
}

export type ConfirmAction = 'archive' | 'delete' | 'checkpoint' | null
export type MobileTab = 'home' | 'projects' | 'code' | 'output' | 'history'
export type ClassroomTab = 'people' | 'invitations'

export const PROJECT_FILE_LIMIT = 50

export const kindLabels: Record<ProjectKind, string> = {
  ruby: 'Ruby',
  javascript: 'JavaScript',
  web: 'HTML/CSS/JS',
}

export const visibilityLabels: Record<ProjectVisibility, string> = {
  private: 'Private',
  organization: 'Org',
  unlisted: 'Unlisted',
  public: 'Public',
}

export const visibilityDescriptions: Record<ProjectVisibility, string> = {
  private: 'Only you can edit or list it. In orgs, instructors and owners can view and run it.',
  organization: 'Members of this org can find, view, and run it. Only you can edit it.',
  unlisted: 'Anyone with the direct link can view and run it, but it is hidden from org lists.',
  public: 'Anyone with access to Hafa Code can view and run it, and org members can find it in lists.',
}

export function invitationUrl(token: string) {
  return `${window.location.origin}${window.location.pathname}#invite=${encodeURIComponent(token)}`
}

export function readHashParam(name: string) {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get(name)
}

export function clearHashParam(name: string) {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  params.delete(name)
  const nextHash = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${nextHash ? `#${nextHash}` : ''}`)
}

export function projectOwnerLabel(project: SavedProject, currentUserId?: number) {
  if (!project.owner) return ''
  if (project.owner.id === currentUserId) return 'You'
  return project.owner.fullName
}

export function languageForFile(file: ProjectFile) {
  if (file.language === 'ruby') return 'ruby'
  if (file.language === 'html') return 'html'
  if (file.language === 'css') return 'css'
  if (file.language === 'json') return 'json'
  return 'javascript'
}

export function formatFileLanguage(file: ProjectFile) {
  if (file.language === 'javascript') return 'JS'
  if (file.language === 'plain') return 'Text'
  return file.language.toUpperCase()
}

export function normalizeWorkspacePath(path: string) {
  return path.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/')
}

export function validateWorkspacePath(path: string, project: SavedProject, currentPath?: string) {
  const normalized = normalizeWorkspacePath(path)
  if (!normalized) return 'Enter a file path.'
  if (normalized.length > 160) return 'File paths must be 160 characters or fewer.'
  if (normalized.endsWith('/')) return 'File paths cannot end with a slash.'
  const segments = normalized.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return 'File paths cannot include empty, current, or parent directory segments.'
  }
  if (segments.some((segment) => segment.startsWith('.'))) {
    return 'Hidden files and folders are not supported yet.'
  }
  if (project.files.some((file) => file.path === normalized && file.path !== currentPath)) {
    return 'A file already exists at that path.'
  }
  return ''
}

export function canAddWorkspaceFile(project: SavedProject) {
  return project.files.length < PROJECT_FILE_LIMIT
}

export function nextAvailableCopyPath(path: string, project: SavedProject) {
  const dotIndex = path.lastIndexOf('.')
  const slashIndex = path.lastIndexOf('/')
  const hasExtension = dotIndex > slashIndex
  const base = hasExtension ? path.slice(0, dotIndex) : path
  const extension = hasExtension ? path.slice(dotIndex) : ''

  for (let index = 1; index < 100; index += 1) {
    const candidate = `${base}${index === 1 ? ' copy' : ` copy ${index}`}${extension}`
    if (!project.files.some((file) => file.path === candidate)) return candidate
  }

  return `${base} copy ${crypto.randomUUID().slice(0, 8)}${extension}`
}

export function starterContentForPath(path: string, kind: ProjectKind) {
  const language = inferFileLanguage(path, kind)
  if (language === 'ruby') return '# Write Ruby here\n'
  if (language === 'javascript') return '// Write JavaScript here\n'
  if (language === 'html') return '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>New Page</title>\n  </head>\n  <body>\n    <h1>New page</h1>\n  </body>\n</html>\n'
  if (language === 'css') return '/* Write CSS here */\n'
  if (language === 'json') return '{\n  "message": "Hafa adai"\n}\n'
  return ''
}

export function starterPathForProject(kind: ProjectKind, files: ProjectFile[]) {
  const candidates = kind === 'ruby'
    ? ['helper.rb', 'greeting.rb', 'practice.rb']
    : kind === 'javascript'
      ? ['helper.js', 'utils.js', 'practice.js']
      : ['about.html', 'styles.css', 'app.js']

  return candidates.find((path) => !files.some((file) => file.path === path)) ?? `new-file-${files.length + 1}.${kind === 'ruby' ? 'rb' : kind === 'web' ? 'html' : 'js'}`
}

export function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'just now'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatCheckpointTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'just now'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export function loadInitialLibraryWithSharedProject(): { library: ProjectLibrary; notice: string } {
  const library = loadProjectLibrary()
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const sharedProject = params.get('project')
  if (!sharedProject) return { library, notice: '' }

  try {
    const imported = decodeSharedProject(sharedProject)
    window.history.replaceState(null, '', window.location.pathname)
    return {
      library: { activeProjectId: imported.id, projects: [imported, ...library.projects] },
      notice: 'Shared project imported locally.',
    }
  } catch {
    return { library, notice: 'Could not import the shared project link.' }
  }
}

export function isCloudProjectId(id: string) {
  return /^\d+$/.test(id)
}

export function isArchived(project: SavedProject) {
  return Boolean(project.archivedAt)
}

export async function writeClipboardText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function mergeCloudAndLocalProjects(cloudProjects: SavedProject[], localLibrary: ProjectLibrary, organizationId: string | null): ProjectLibrary {
  const localOnlyProjects = organizationId ? [] : localLibrary.projects.filter((candidate) => !isCloudProjectId(candidate.id))
  const projects = [...cloudProjects, ...localOnlyProjects]
  if (projects.length === 0) return localLibrary
  const activeProjectId = organizationId && cloudProjects.length > 0
    ? cloudProjects[0].id
    : projects.some((candidate) => candidate.id === localLibrary.activeProjectId)
      ? localLibrary.activeProjectId
      : projects[0].id

  return { activeProjectId, projects }
}

export function projectContextMatches(project: SavedProject, organizationId: string | null) {
  return organizationId ? project.organizationId === organizationId : !project.organizationId
}

export function availableVisibilityOptions(organizationId: string | null): ProjectVisibility[] {
  return organizationId ? ['private', 'organization', 'unlisted', 'public'] : ['private', 'unlisted', 'public']
}

export function activateFallbackLibrary(projects: SavedProject[], archivedView: boolean) {
  const preferred = projects.find((candidate) => (archivedView ? isArchived(candidate) : !isArchived(candidate))) ?? projects[0]
  if (preferred) return { library: { activeProjectId: preferred.id, projects }, activePath: preferred.files[0].path }

  const fallback = createProject('ruby')
  saveProjectLibrary({ activeProjectId: fallback.id, projects: [fallback] })
  return { library: { activeProjectId: fallback.id, projects: [fallback] }, activePath: fallback.files[0].path }
}
