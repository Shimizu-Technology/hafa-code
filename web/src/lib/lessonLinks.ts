import { parseReturnUrl, parseStarterKey, sanitizeReturnLabel, type LessonReturn } from './starterLinks'

/**
 * Remembers, per browser, which lesson each imported project came from: the
 * "Back to your lesson" target and the starter key that lets the same lesson link
 * reopen the learner's copy. Kept outside the project itself so it never travels
 * in Share links, server snapshots, or cloud saves.
 */
export const LESSON_LINKS_STORAGE_KEY = 'hafa-code-lesson-links-v1'
const MAX_PROJECT_RECORDS = 200

export interface LessonLinkRecord {
  returnUrl: string | null
  returnLabel: string | null
  starterKey: string | null
  updatedAt: string
}

export interface LessonLinks {
  projects: Record<string, LessonLinkRecord>
  /** starter key → project id */
  starters: Record<string, string>
}

let memoryFallback: LessonLinks | null = null

/** Development builds also accept a local CSG Learn server as a return target. */
export const allowDevReturnOrigins = Boolean(import.meta.env?.DEV)

export function emptyLessonLinks(): LessonLinks {
  return { projects: {}, starters: {} }
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Re-validates everything read from storage, so an edited entry cannot add a non-allowlisted return link. */
export function normalizeLessonLinks(candidate: unknown): LessonLinks {
  if (!isRecordObject(candidate)) return emptyLessonLinks()
  const projects: Record<string, LessonLinkRecord> = {}
  if (isRecordObject(candidate.projects)) {
    for (const [projectId, raw] of Object.entries(candidate.projects)) {
      if (!isRecordObject(raw)) continue
      const returnUrl = parseReturnUrl(raw.returnUrl, { allowDevOrigins: allowDevReturnOrigins })
      const starterKey = parseStarterKey(raw.starterKey)
      if (!returnUrl && !starterKey) continue
      projects[projectId] = {
        returnUrl,
        returnLabel: returnUrl ? sanitizeReturnLabel(raw.returnLabel) : null,
        starterKey,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
      }
    }
  }
  const starters: Record<string, string> = {}
  if (isRecordObject(candidate.starters)) {
    for (const [key, projectId] of Object.entries(candidate.starters)) {
      if (parseStarterKey(key) === key && typeof projectId === 'string' && projectId) starters[key] = projectId
    }
  }
  return { projects, starters }
}

export function loadLessonLinks(): LessonLinks {
  if (memoryFallback) return normalizeLessonLinks(memoryFallback)
  try {
    return normalizeLessonLinks(JSON.parse(localStorage.getItem(LESSON_LINKS_STORAGE_KEY) ?? 'null'))
  } catch {
    return emptyLessonLinks()
  }
}

export function saveLessonLinks(links: LessonLinks) {
  const entries = Object.entries(links.projects)
  const projects = entries.length > MAX_PROJECT_RECORDS
    ? Object.fromEntries(entries.sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt)).slice(0, MAX_PROJECT_RECORDS))
    : links.projects
  const trimmed = { projects, starters: links.starters }
  try {
    localStorage.setItem(LESSON_LINKS_STORAGE_KEY, JSON.stringify(trimmed))
    memoryFallback = null
    return true
  } catch {
    memoryFallback = trimmed
    return false
  }
}

/** Clears the in-memory fallback, primarily for tests that reset storage. */
export function resetLessonLinksCache() {
  memoryFallback = null
}

export function lessonReturnForProject(links: LessonLinks, projectId: string): LessonReturn | null {
  const record = Object.hasOwn(links.projects, projectId) ? links.projects[projectId] : undefined
  return record?.returnUrl ? { url: record.returnUrl, label: record.returnLabel } : null
}

export function projectIdForStarter(links: LessonLinks, starterKey: string) {
  return Object.hasOwn(links.starters, starterKey) ? links.starters[starterKey] : null
}

/**
 * Records where a project came from. A newer link's return target replaces the old
 * one (the lesson URL may change); a link without one keeps what was saved.
 */
export function recordLessonLink(links: LessonLinks, projectId: string, launch: { returnTarget: LessonReturn | null; starterKey: string | null }): LessonLinks {
  if (!launch.returnTarget && !launch.starterKey) return links
  const previous = Object.hasOwn(links.projects, projectId) ? links.projects[projectId] : undefined
  const record: LessonLinkRecord = {
    returnUrl: launch.returnTarget?.url ?? previous?.returnUrl ?? null,
    returnLabel: launch.returnTarget ? launch.returnTarget.label : previous?.returnLabel ?? null,
    starterKey: launch.starterKey ?? previous?.starterKey ?? null,
    updatedAt: new Date().toISOString(),
  }
  return {
    projects: { ...links.projects, [projectId]: record },
    starters: launch.starterKey ? { ...links.starters, [launch.starterKey]: projectId } : links.starters,
  }
}

/** Follows a local project to its cloud id after the first save. */
export function replaceLessonProjectId(links: LessonLinks, fromId: string, toId: string): LessonLinks {
  if (fromId === toId) return links
  const record = links.projects[fromId]
  const pointsAtProject = Object.values(links.starters).includes(fromId)
  if (!record && !pointsAtProject) return links
  const projects = { ...links.projects }
  delete projects[fromId]
  if (record) projects[toId] = record
  const starters = Object.fromEntries(Object.entries(links.starters).map(([key, id]) => [key, id === fromId ? toId : id]))
  return { projects, starters }
}
