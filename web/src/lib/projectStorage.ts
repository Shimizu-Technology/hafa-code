import { starterProject, type ProjectCheckpoint, type ProjectKind, type ProjectSnapshot, type SavedProject } from './codeRunner'

const STORAGE_KEY = 'hafa-code-projects-v2'
const LEGACY_STORAGE_KEY = 'hafa-code-project-v1'
const CHECKPOINT_STORAGE_KEY = 'hafa-code-checkpoints-v1'
const PROJECT_KINDS = new Set<ProjectKind>(['ruby', 'javascript', 'web'])
const FILE_LANGUAGES = new Set(['ruby', 'javascript', 'html', 'css'])
type FileLanguage = SavedProject['files'][number]['language']
const DEFAULT_WEB_CSS = 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 2rem;\n  background: #0f172a;\n  color: white;\n}\n\nmain {\n  max-width: 680px;\n  margin: auto;\n}\n\nbutton {\n  border: 0;\n  border-radius: 999px;\n  padding: 0.75rem 1rem;\n  background: #ef4444;\n  color: white;\n  font-weight: 700;\n}\n'
const DEFAULT_WEB_JS = 'document.querySelector("#hello")?.addEventListener("click", () => {\n  alert("You shipped your first web interaction!")\n})\n'

export interface ProjectLibrary {
  activeProjectId: string
  projects: SavedProject[]
}

type CheckpointLibrary = Record<string, ProjectCheckpoint[]>

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

function linkedWebDocument(body: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hafa Code Page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    ${body.trim()}
    <script src="script.js"></script>
  </body>
</html>
`
}

function normalizeWebHtml(content: string) {
  if (!/<html[\s>]/i.test(content)) return linkedWebDocument(content)

  let next = content
  if (!/<link\b[^>]*\bhref=["']\.?\/?style\.css["'][^>]*>/i.test(next)) {
    next = /<\/head>/i.test(next)
      ? next.replace(/<\/head>/i, '    <link rel="stylesheet" href="style.css" />\n  </head>')
      : next.replace(/<html([^>]*)>/i, '<html$1>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <link rel="stylesheet" href="style.css" />\n  </head>')
  }
  if (!/<script\b[^>]*\bsrc=["']\.?\/?script\.js["'][^>]*>\s*<\/script>/i.test(next)) {
    next = /<\/body>/i.test(next)
      ? next.replace(/<\/body>/i, '    <script src="script.js"></script>\n  </body>')
      : `${next}\n<script src="script.js"></script>\n`
  }

  return next
}

function normalizeWebFiles(files: SavedProject['files']) {
  const next = files.map((file) => ({ ...file }))
  let htmlIndex = next.findIndex((file) => file.path === 'index.html')
  if (htmlIndex === -1) htmlIndex = next.findIndex((file) => file.language === 'html')

  if (htmlIndex === -1) {
    next.unshift({
      path: 'index.html',
      language: 'html',
      content: linkedWebDocument('<main>\n      <h1>Hafa adai!</h1>\n      <p>Edit HTML, CSS, and JS to build a page.</p>\n      <button id="hello">Click me</button>\n    </main>'),
    })
    htmlIndex = 0
  } else {
    next[htmlIndex] = {
      ...next[htmlIndex],
      path: next[htmlIndex].path || 'index.html',
      language: 'html',
      content: normalizeWebHtml(next[htmlIndex].content),
    }
  }

  if (!next.some((file) => file.path === 'style.css')) {
    next.splice(htmlIndex + 1, 0, { path: 'style.css', language: 'css', content: DEFAULT_WEB_CSS })
  }
  if (!next.some((file) => file.path === 'script.js')) {
    next.splice(htmlIndex + 2, 0, { path: 'script.js', language: 'javascript', content: DEFAULT_WEB_JS })
  }

  return next
}

export function normalizeProject(candidate: Partial<SavedProject> | null | undefined): SavedProject | null {
  if (!candidate?.id || !candidate.title || !isProjectKind(candidate.kind) || !Array.isArray(candidate.files)) {
    return null
  }

  let files = candidate.files
    .filter((file) => typeof file?.path === 'string')
    .map((file) => ({
      path: file.path.trim() || 'main.txt',
      language: isFileLanguage(file.language) ? file.language : inferFileLanguage(file.path, candidate.kind as ProjectKind),
      content: String(file.content ?? ''),
    }))

  if (files.length === 0) return null
  if (candidate.kind === 'web') files = normalizeWebFiles(files)

  const now = new Date().toISOString()
  return {
    id: String(candidate.id),
    title: String(candidate.title),
    kind: candidate.kind,
    files,
    createdAt: String(candidate.createdAt || now),
    updatedAt: String(candidate.updatedAt || now),
    archivedAt: candidate.archivedAt ? String(candidate.archivedAt) : null,
  }
}

function normalizeSnapshot(candidate: Partial<ProjectSnapshot> | null | undefined): ProjectSnapshot | null {
  const project = normalizeProject({
    id: 'snapshot',
    title: candidate?.title,
    kind: candidate?.kind,
    files: candidate?.files,
  })
  if (!project) return null
  return { title: project.title, kind: project.kind, files: project.files }
}

function normalizeCheckpoint(candidate: Partial<ProjectCheckpoint> | null | undefined): ProjectCheckpoint | null {
  const snapshot = normalizeSnapshot(candidate?.snapshot)
  if (!candidate?.id || !candidate.title || !candidate.createdAt || !snapshot) return null
  return {
    id: String(candidate.id),
    title: String(candidate.title),
    createdAt: String(candidate.createdAt),
    snapshot,
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

function loadCheckpointLibrary(): CheckpointLibrary {
  const parsed = safeParse<CheckpointLibrary>(localStorage.getItem(CHECKPOINT_STORAGE_KEY))
  if (!parsed || typeof parsed !== 'object') return {}
  return parsed
}

function saveCheckpointLibrary(library: CheckpointLibrary) {
  localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(library))
}

export function projectSnapshot(project: SavedProject): ProjectSnapshot {
  return {
    title: project.title,
    kind: project.kind,
    files: project.files.map((file) => ({ ...file })),
  }
}

export function loadLocalCheckpoints(projectId: string): ProjectCheckpoint[] {
  const checkpoints = loadCheckpointLibrary()[projectId] ?? []
  return checkpoints
    .map((checkpoint) => normalizeCheckpoint(checkpoint))
    .filter((checkpoint): checkpoint is ProjectCheckpoint => Boolean(checkpoint))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 30)
}

export function createLocalCheckpoint(project: SavedProject, title = 'Checkpoint'): ProjectCheckpoint {
  const checkpoint = {
    id: crypto.randomUUID(),
    title: title.trim() || 'Checkpoint',
    createdAt: new Date().toISOString(),
    snapshot: projectSnapshot(project),
  }
  const library = loadCheckpointLibrary()
  library[project.id] = [checkpoint, ...(library[project.id] ?? [])].slice(0, 30)
  saveCheckpointLibrary(library)
  return checkpoint
}

export function snapshotToProject(project: SavedProject, snapshot: ProjectSnapshot): SavedProject {
  return {
    ...project,
    title: snapshot.title,
    kind: snapshot.kind,
    files: snapshot.files.map((file) => ({ ...file })),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  }
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
    archivedAt: null,
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
    archivedAt: null,
  })

  if (!normalized) {
    throw new Error('That file is not a valid Hafa Code project.')
  }

  return normalized
}

export function encodeProjectForShare(project: SavedProject) {
  const json = JSON.stringify({ ...project, archivedAt: null })
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
