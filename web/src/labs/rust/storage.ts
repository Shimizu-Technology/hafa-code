import { STARTER_SOURCE } from './starter'

/**
 * Rust Lab projects live only in this browser (localStorage). Rust is not a Hafa Code cloud
 * project kind yet, so nothing here is sent to the Rails API.
 */
export const RUST_LAB_STORAGE_KEY = 'hafa-code-rust-lab-v1'
export const RUST_LAB_EXPORT_FORMAT = 'hafa-code-rust-lab-project'
export const MAX_PROJECTS = 30
export const MAX_SOURCE_BYTES = 200_000
export const MAX_INPUT_BYTES = 20_000
export const MAX_TITLE_LENGTH = 80

export interface RustLabProject {
  id: string
  title: string
  source: string
  stdin: string
  challengeId: string | null
  updatedAt: string
}

export interface RustLabState {
  activeProjectId: string
  projects: RustLabProject[]
  completedChallenges: string[]
}

const byteLength = (text: string) => new TextEncoder().encode(text).length

export class ProjectImportError extends Error {}

export function newProjectId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `rust-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createProject(fields: Partial<Pick<RustLabProject, 'title' | 'source' | 'stdin' | 'challengeId'>> = {}): RustLabProject {
  return {
    id: newProjectId(),
    title: cleanTitle(fields.title ?? 'My Rust program'),
    source: fields.source ?? STARTER_SOURCE,
    stdin: fields.stdin ?? '',
    challengeId: fields.challengeId ?? null,
    updatedAt: new Date().toISOString(),
  }
}

export function cleanTitle(title: string) {
  // eslint-disable-next-line no-control-regex
  const cleaned = title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH)
  return cleaned || 'Untitled Rust program'
}

function validProject(value: unknown): RustLabProject | null {
  if (!value || typeof value !== 'object') return null
  const project = value as Record<string, unknown>
  if (typeof project.source !== 'string' || byteLength(project.source) > MAX_SOURCE_BYTES) return null
  const stdin = typeof project.stdin === 'string' && byteLength(project.stdin) <= MAX_INPUT_BYTES ? project.stdin : ''
  return {
    id: typeof project.id === 'string' && /^[\w-]{1,80}$/.test(project.id) ? project.id : newProjectId(),
    title: cleanTitle(typeof project.title === 'string' ? project.title : ''),
    source: project.source,
    stdin,
    challengeId: typeof project.challengeId === 'string' && /^[\w-]{1,80}$/.test(project.challengeId) ? project.challengeId : null,
    updatedAt: typeof project.updatedAt === 'string' && !Number.isNaN(Date.parse(project.updatedAt)) ? project.updatedAt : new Date().toISOString(),
  }
}

export function defaultState(): RustLabState {
  const project = createProject({ title: 'Hafa adai, Rust' })
  return { activeProjectId: project.id, projects: [project], completedChallenges: [] }
}

export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): RustLabState {
  try {
    const raw = storage.getItem(RUST_LAB_STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const seen = new Set<string>()
    const projects = (Array.isArray(parsed.projects) ? parsed.projects : [])
      .map(validProject)
      .filter((project): project is RustLabProject => {
        if (!project || seen.has(project.id)) return false
        seen.add(project.id)
        return true
      })
      .slice(0, MAX_PROJECTS)
    if (!projects.length) return defaultState()
    const activeProjectId = projects.some((project) => project.id === parsed.activeProjectId) ? parsed.activeProjectId as string : projects[0].id
    const completedChallenges = Array.isArray(parsed.completedChallenges)
      ? parsed.completedChallenges.filter((id): id is string => typeof id === 'string' && /^[\w-]{1,80}$/.test(id)).slice(0, 100)
      : []
    return { activeProjectId, projects, completedChallenges }
  } catch {
    return defaultState()
  }
}

/** Returns false when the browser refused the write (private mode or full storage). */
export function saveState(state: RustLabState, storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    storage.setItem(RUST_LAB_STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function exportProject(project: RustLabProject) {
  return `${JSON.stringify({
    format: RUST_LAB_EXPORT_FORMAT,
    version: 1,
    project: { title: project.title, source: project.source, stdin: project.stdin, challengeId: project.challengeId, updatedAt: project.updatedAt },
  }, null, 2)}\n`
}

export function exportFileName(project: RustLabProject) {
  const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'rust-program'
  return `${slug}.hafa-rust.json`
}

/** Accepts a Rust Lab export (.hafa-rust.json) or a plain .rs file. Always creates a new project. */
export function importProject(fileName: string, text: string): RustLabProject {
  if (byteLength(text) > MAX_SOURCE_BYTES + MAX_INPUT_BYTES + 10_000) throw new ProjectImportError('That file is too large for the Rust Lab.')
  if (/\.rs$/i.test(fileName)) {
    if (byteLength(text) > MAX_SOURCE_BYTES) throw new ProjectImportError('That Rust file is too large for the Rust Lab.')
    return createProject({ title: fileName.replace(/\.rs$/i, ''), source: text })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProjectImportError('That file is not a Rust Lab project or a .rs file.')
  }
  const envelope = parsed as { format?: unknown; version?: unknown; project?: unknown }
  if (envelope?.format !== RUST_LAB_EXPORT_FORMAT || envelope.version !== 1) {
    throw new ProjectImportError('That file is not a Rust Lab project export.')
  }
  const project = validProject(envelope.project)
  if (!project) throw new ProjectImportError('That Rust Lab project is missing its source or is too large.')
  return { ...project, id: newProjectId() }
}
