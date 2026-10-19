import { COMPRESSED_PAYLOAD_PREFIX, decodeCompressedPayload, encodeBase64Url } from './starterLinks'
import { defaultEntryPath, inferFileLanguage, isProjectFileLanguage, isProjectKind, starterProject, type ProjectCheckpoint, type ProjectKind, type ProjectSnapshot, type ProjectVisibility, type SavedProject } from './codeRunner'

export const PROJECT_LIBRARY_STORAGE_KEY = 'hafa-code-projects-v2'
const LEGACY_STORAGE_KEY = 'hafa-code-project-v1'
export const CHECKPOINT_STORAGE_KEY = 'hafa-code-checkpoints-v1'
const PROJECT_VISIBILITIES = new Set<ProjectVisibility>(['private', 'organization', 'unlisted', 'public'])
type FileLanguage = SavedProject['files'][number]['language']
type StoredProjectSnapshot = Partial<ProjectSnapshot> & {
  entry_path?: string
}

export interface ProjectLibrary {
  activeProjectId: string
  projects: SavedProject[]
}

export type CheckpointLibrary = Record<string, ProjectCheckpoint[]>

function safeParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

type StorageReadResult =
  | { ok: true; value: string | null }
  | { ok: false }

function safeStorageValue(key: string, storage?: Storage) {
  try {
    return { ok: true, value: (storage ?? localStorage).getItem(key) } satisfies StorageReadResult
  } catch {
    return { ok: false } satisfies StorageReadResult
  }
}

function removeStorageValue(key: string, storage?: Storage) {
  try {
    (storage ?? localStorage).removeItem(key)
  } catch {
    // A stale legacy copy is harmless when browser storage is unavailable.
  }
}

function isFileLanguage(value: unknown): value is FileLanguage {
  return isProjectFileLanguage(value)
}

function isProjectVisibility(value: unknown): value is ProjectVisibility {
  return typeof value === 'string' && PROJECT_VISIBILITIES.has(value as ProjectVisibility)
}

export function normalizeProject(candidate: Partial<SavedProject> | null | undefined): SavedProject | null {
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
    visibility: isProjectVisibility(candidate.visibility) ? candidate.visibility : 'private',
    organizationId: candidate.organizationId ? String(candidate.organizationId) : null,
    owner: candidate.owner ?? null,
    organization: candidate.organization ?? null,
    entryPath: files.some((file) => file.path === candidate.entryPath)
      ? String(candidate.entryPath)
      : defaultEntryPath(files, candidate.kind),
    files,
    createdAt: String(candidate.createdAt || now),
    updatedAt: String(candidate.updatedAt || now),
    archivedAt: candidate.archivedAt ? String(candidate.archivedAt) : null,
    lockVersion: Number.isInteger(candidate.lockVersion) ? candidate.lockVersion : undefined,
  }
}

function normalizeSnapshot(candidate: StoredProjectSnapshot | null | undefined): ProjectSnapshot | null {
  const project = normalizeProject({
    id: 'snapshot',
    title: candidate?.title,
    kind: candidate?.kind,
    entryPath: candidate?.entryPath ?? candidate?.entry_path,
    files: candidate?.files,
  })
  if (!project) return null
  return { title: project.title, kind: project.kind, entryPath: project.entryPath, files: project.files }
}

function normalizeCheckpoint(candidate: Partial<ProjectCheckpoint> | null | undefined): ProjectCheckpoint | null {
  const snapshot = normalizeSnapshot(candidate?.snapshot)
  if (!candidate?.id || !candidate.title || !candidate.createdAt || Number.isNaN(Date.parse(candidate.createdAt)) || !snapshot) return null
  return {
    id: String(candidate.id),
    title: String(candidate.title),
    createdAt: String(candidate.createdAt),
    snapshot,
  }
}

export function normalizeProjectLibrary(candidate: ProjectLibrary | null): ProjectLibrary | null {
  if (!candidate || !Array.isArray(candidate.projects) || candidate.projects.length === 0) return null
  const seenProjectIds = new Set<string>()
  const projects = candidate.projects
    .map((project) => normalizeProject(project))
    .filter((project): project is SavedProject => Boolean(project))
    .filter((project) => {
      if (seenProjectIds.has(project.id)) return false
      seenProjectIds.add(project.id)
      return true
    })
  if (projects.length === 0) return null
  const activeProjectId = projects.some((project) => project.id === candidate.activeProjectId)
    ? candidate.activeProjectId
    : projects[0].id
  return { activeProjectId, projects }
}

export const DEFAULT_STARTER_KIND: ProjectKind = 'ruby'

export function loadProjectLibrary(starterKind: ProjectKind = DEFAULT_STARTER_KIND): ProjectLibrary {
  return loadProjectLibraryWithStatus(starterKind).library
}

/** `isNew` means this browser had no saved projects, so the library holds only a fresh starter. */
export function loadProjectLibraryWithStatus(starterKind: ProjectKind = DEFAULT_STARTER_KIND): { library: ProjectLibrary; isNew: boolean } {
  const currentRead = safeStorageValue(PROJECT_LIBRARY_STORAGE_KEY)
  if (!currentRead.ok) return { library: starterProjectLibrary(starterKind), isNew: true }

  const current = normalizeProjectLibrary(safeParse<ProjectLibrary>(currentRead.value))
  if (current) return { library: current, isNew: false }

  const legacyRead = safeStorageValue(LEGACY_STORAGE_KEY)
  if (!legacyRead.ok) return { library: starterProjectLibrary(starterKind), isNew: true }

  const legacyProject = safeParse<SavedProject>(legacyRead.value)
  const normalizedLegacyProject = normalizeProject(legacyProject)
  if (normalizedLegacyProject) {
    const migrated = { activeProjectId: normalizedLegacyProject.id, projects: [normalizedLegacyProject] }
    if (saveProjectLibrary(migrated)) removeStorageValue(LEGACY_STORAGE_KEY)
    return { library: migrated, isNew: false }
  }

  const library = starterProjectLibrary(starterKind)
  saveProjectLibrary(library)
  return { library, isNew: true }
}

function starterProjectLibrary(kind: ProjectKind = DEFAULT_STARTER_KIND): ProjectLibrary {
  const firstProject = starterProject(kind)
  return { activeProjectId: firstProject.id, projects: [firstProject] }
}

export function saveProjectLibrary(library: ProjectLibrary, storage?: Storage) {
  try {
    (storage ?? localStorage).setItem(PROJECT_LIBRARY_STORAGE_KEY, JSON.stringify(library))
    return true
  } catch {
    return false
  }
}

export function normalizeCheckpointLibrary(candidate: unknown): CheckpointLibrary {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {}
  return Object.fromEntries(
    Object.entries(candidate)
      .filter((entry): entry is [string, ProjectCheckpoint[]] => Array.isArray(entry[1]))
      .map(([projectId, checkpoints]) => [
        projectId,
        checkpoints
          .map((checkpoint) => normalizeCheckpoint(checkpoint))
          .filter((checkpoint): checkpoint is ProjectCheckpoint => Boolean(checkpoint))
          .filter((checkpoint, index, normalized) => normalized.findIndex((candidate) => candidate.id === checkpoint.id) === index)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .slice(0, 30),
      ])
      .filter(([, checkpoints]) => checkpoints.length > 0),
  )
}

export function loadCheckpointLibrary(): CheckpointLibrary {
  return readCheckpointLibrary().library
}

function readCheckpointLibrary(): { ok: boolean; library: CheckpointLibrary } {
  const stored = safeStorageValue(CHECKPOINT_STORAGE_KEY)
  if (!stored.ok) return { ok: false, library: {} }
  return { ok: true, library: normalizeCheckpointLibrary(safeParse<CheckpointLibrary>(stored.value)) }
}

export function saveCheckpointLibrary(library: CheckpointLibrary, storage?: Storage) {
  try {
    (storage ?? localStorage).setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(library))
    return true
  } catch {
    return false
  }
}

export function projectSnapshot(project: SavedProject): ProjectSnapshot {
  return {
    title: project.title,
    kind: project.kind,
    entryPath: project.entryPath,
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

export function createLocalCheckpoint(project: SavedProject, title = 'Checkpoint'): ProjectCheckpoint | null {
  const checkpoint = {
    id: crypto.randomUUID(),
    title: title.trim() || 'Checkpoint',
    createdAt: new Date().toISOString(),
    snapshot: projectSnapshot(project),
  }
  const stored = readCheckpointLibrary()
  if (!stored.ok) return null
  const library = stored.library
  library[project.id] = [checkpoint, ...(library[project.id] ?? [])].slice(0, 30)
  return saveCheckpointLibrary(library) ? checkpoint : null
}

export function snapshotToProject(project: SavedProject, snapshot: ProjectSnapshot): SavedProject {
  return {
    ...project,
    title: snapshot.title,
    kind: snapshot.kind,
    entryPath: snapshot.entryPath,
    files: snapshot.files.map((file) => ({ ...file })),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  }
}

export const PROJECT_TITLE_MAX_LENGTH = 120

export function createProject(kind: ProjectKind, title?: string): SavedProject {
  const project = starterProject(kind)
  return {
    ...project,
    title: title?.trim() || project.title,
  }
}

/** Trims a title and falls back to the language's starter name when it is empty. */
export function normalizeProjectTitle(title: string, kind: ProjectKind) {
  const trimmed = Array.from(title.trim()).slice(0, PROJECT_TITLE_MAX_LENGTH).join('')
  return trimmed || starterProject(kind).title
}

/** Returns `title`, or `title (2)`, `title (3)`… when another project already uses it. */
export function uniqueProjectTitle(title: string, projects: readonly Pick<SavedProject, 'title'>[]) {
  const taken = new Set(projects.map((project) => project.title.trim().toLowerCase()))
  if (!taken.has(title.trim().toLowerCase())) return title
  for (let number = 2; ; number += 1) {
    const candidate = titleWithSuffix(title, ` (${number})`)
    if (!taken.has(candidate.trim().toLowerCase())) return candidate
  }
}

export function sameProjectContent(a: SavedProject, b: SavedProject) {
  if (a.kind !== b.kind || a.entryPath !== b.entryPath || a.files.length !== b.files.length) return false
  return a.files.every((file, index) => file.path === b.files[index].path && file.content === b.files[index].content)
}

/**
 * Adds an imported project to the library. Opening the same link again reuses the
 * untouched copy instead of creating a silent duplicate; a changed copy is kept and
 * the new import gets a numbered name.
 */
export function addImportedProject(library: ProjectLibrary, imported: SavedProject): { library: ProjectLibrary; project: SavedProject; reused: boolean } {
  const existing = library.projects.find((candidate) => !candidate.archivedAt
    && !candidate.organizationId
    && (candidate.title === imported.title || candidate.title.startsWith(`${imported.title} (`))
    && sameProjectContent(candidate, imported))
  if (existing) {
    return { library: { ...library, activeProjectId: existing.id }, project: existing, reused: true }
  }

  const project = { ...imported, title: uniqueProjectTitle(imported.title, library.projects) }
  return { library: { activeProjectId: project.id, projects: [project, ...library.projects] }, project, reused: false }
}

export function importNotice(result: { project: SavedProject; reused: boolean }, imported: SavedProject, source: 'link' | 'file' = 'link') {
  if (result.reused) return `“${result.project.title}” is already in your projects, so Hafa Code opened that copy.`
  if (result.project.title !== imported.title) {
    return `You already have a project named “${imported.title}”, so this ${source === 'link' ? 'link' : 'file'} was added as “${result.project.title}”. Your other projects are unchanged.`
  }
  return source === 'link' ? 'Shared project imported locally.' : 'Project imported.'
}

type DuplicateProjectDestination = Pick<SavedProject, 'organizationId' | 'organization'>

function titleWithSuffix(title: string, suffix: string) {
  return `${Array.from(title).slice(0, 120 - Array.from(suffix).length).join('')}${suffix}`
}

export function duplicateProject(project: SavedProject, destination?: DuplicateProjectDestination): SavedProject {
  const now = new Date().toISOString()
  const titleSuffix = ' Copy'
  const organizationId = destination ? destination.organizationId ?? null : project.organizationId ?? null
  const organization = destination ? destination.organization ?? null : project.organization ?? null
  return {
    ...project,
    id: crypto.randomUUID(),
    title: titleWithSuffix(project.title, titleSuffix),
    visibility: 'private',
    organizationId,
    owner: null,
    organization,
    files: project.files.map((file) => ({ ...file })),
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    lockVersion: undefined,
  }
}

export function createConflictCopy(project: SavedProject): SavedProject {
  const suffix = ' Conflict Copy'
  return {
    ...duplicateProject(project),
    title: titleWithSuffix(project.title, suffix),
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function projectSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** A one-file project downloads as its source file (for example `.py`); larger projects use the JSON format Import accepts. */
export function projectExportFormat(project: Pick<SavedProject, 'files' | 'title'>) {
  if (project.files.length !== 1) return { kind: 'json' as const, fileName: `${projectSlug(project.title) || 'hafa-code-project'}.json` }
  const file = project.files[0]
  const baseName = file.path.split('/').pop() ?? file.path
  const extension = baseName.includes('.') ? baseName.slice(baseName.lastIndexOf('.')) : ''
  const slug = projectSlug(project.title)
  return { kind: 'source' as const, fileName: slug ? `${slug}${extension}` : baseName }
}

export function projectExportLabel(format: ReturnType<typeof projectExportFormat>) {
  if (format.kind === 'json') return 'Export project (.json)'
  const extensionIndex = format.fileName.lastIndexOf('.')
  return `Download code (${extensionIndex > 0 ? format.fileName.slice(extensionIndex) : 'file'})`
}

export function exportProject(project: SavedProject) {
  const format = projectExportFormat(project)
  if (format.kind === 'source') {
    downloadBlob(new Blob([project.files[0].content], { type: 'text/plain;charset=utf-8' }), format.fileName)
    return format
  }
  downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), format.fileName)
  return format
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

/** URL-safe base64 (RFC 4648 §5) so `+`, `/`, and `=` never need escaping in a link. */
export function encodeProjectForShare(project: SavedProject) {
  return encodeBase64Url(JSON.stringify({ ...project, archivedAt: null }))
}

/**
 * Accepts URL-safe links and older standard-base64 links, including ones where a
 * hash parser turned `+` into a space.
 */
export function normalizeSharedProjectEncoding(encoded: string) {
  const standard = encoded.trim().replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')
  return standard.padEnd(standard.length + ((4 - (standard.length % 4)) % 4), '=')
}

export function decodeSharedProject(encoded: string): SavedProject {
  if (encoded.trim().startsWith(COMPRESSED_PAYLOAD_PREFIX)) return parseImportedProject(decodeCompressedPayload(encoded.trim()))
  const binary = atob(normalizeSharedProjectEncoding(encoded))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const json = new TextDecoder().decode(bytes)
  return parseImportedProject(json)
}
