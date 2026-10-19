/**
 * Lesson starter links: CSG Learn (or any content author) links to Hafa Code with a
 * starter project, a stable starter key, and an optional "Back to your lesson" target.
 *
 *   https://code.shimizu-technology.com/?lang=python#project=<base64url JSON>&starter=<key>&return=<lesson URL>&returnLabel=<lesson title>
 *
 * This module has no browser or bundler imports so `scripts/build-starter-link.ts`
 * can run it directly with Node's type stripping.
 */
import { Inflate, deflateSync } from 'fflate'

export const HAFA_CODE_ORIGIN = 'https://code.shimizu-technology.com'
export const LEARN_PRODUCTION_ORIGIN = 'https://learn.codeschoolofguam.com'
/** Netlify deploy previews of CSG Learn (site name `csg-learn`). */
const LEARN_DEPLOY_PREVIEW_ORIGIN = /^https:\/\/deploy-preview-\d{1,6}--csg-learn\.netlify\.app$/
/** Local Learn development servers; only accepted by development builds. */
const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/

export const RETURN_URL_MAX_LENGTH = 2_048
export const RETURN_LABEL_MAX_LENGTH = 80
const STARTER_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/
/** iOS can cut off longer links when another app (Messages, Mail, the Learn app) opens them in Safari. */
export const STARTER_LINK_IOS_SAFE_LENGTH = 2_000
/** Links longer than this can break in chat apps, email clients, and QR codes. */
export const STARTER_LINK_RECOMMENDED_MAX_LENGTH = 8_000
/** The builder refuses anything longer; share a file or a server snapshot instead. */
export const STARTER_LINK_MAX_LENGTH = 64_000
/** The app refuses a `#project=` payload longer than this (about the 2 MB project source limit, base64 encoded). */
export const PROJECT_LINK_MAX_LENGTH = 3_000_000

/** Mirrors PROJECT_KINDS in languageRegistry.ts (a unit test keeps them in sync). */
export const STARTER_KINDS = ['ruby', 'javascript', 'typescript', 'python', 'java', 'sql', 'web'] as const
export type StarterKind = typeof STARTER_KINDS[number]

export interface ReturnOriginOptions {
  /** Accept http://localhost and http://127.0.0.1 (development builds only). */
  allowDevOrigins?: boolean
}

export interface LessonReturn {
  url: string
  label: string | null
}

export function isAllowedLearnOrigin(origin: string, options: ReturnOriginOptions = {}) {
  if (origin === LEARN_PRODUCTION_ORIGIN) return true
  if (LEARN_DEPLOY_PREVIEW_ORIGIN.test(origin)) return true
  return Boolean(options.allowDevOrigins && LOCAL_DEV_ORIGIN.test(origin))
}

function hasControlCharacter(value: string) {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

/**
 * Returns a normalized lesson URL when it is an absolute http(s) URL on an allowlisted
 * CSG Learn origin, otherwise null. Rejects `javascript:` and other schemes,
 * protocol-relative and relative URLs, credentials, backslashes, control characters,
 * and look-alike hosts such as `learn.codeschoolofguam.com.evil.com`.
 */
export function parseReturnUrl(raw: unknown, options: ReturnOriginOptions = {}): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value || value.length > RETURN_URL_MAX_LENGTH) return null
  if (hasControlCharacter(value) || value.includes('\\')) return null
  if (!/^https?:\/\/[^/]/i.test(value)) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (!isAllowedLearnOrigin(url.origin, options)) return null
  return url.href
}

const INVISIBLE_FORMATTING = new Set([0x200b, 0x200e, 0x200f, 0x2028, 0x2029, 0xfeff])

function isInvisibleFormatting(code: number) {
  return INVISIBLE_FORMATTING.has(code) || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)
}

/**
 * Makes a lesson title safe to show: no control or direction-override characters,
 * collapsed whitespace, and at most 80 characters (with an ellipsis). Returns null
 * when nothing readable is left.
 */
export function sanitizeReturnLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = Array.from(raw.normalize('NFC'))
    .map((char) => {
      const code = char.codePointAt(0) ?? 0
      return code < 0x20 || (code >= 0x7f && code <= 0x9f) || isInvisibleFormatting(code) ? ' ' : char
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  const chars = Array.from(cleaned)
  if (chars.length <= RETURN_LABEL_MAX_LENGTH) return cleaned
  return `${chars.slice(0, RETURN_LABEL_MAX_LENGTH - 1).join('').trimEnd()}…`
}

/** A stable lesson identity such as `csg-python-pilot:project`; letters, digits, `.`, `_`, `:`, `-`. */
export function parseStarterKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  return STARTER_KEY_PATTERN.test(value) ? value : null
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** UTF-8 text to URL-safe base64 (RFC 4648 §5) without padding. */
export function encodeBase64Url(text: string) {
  return bytesToBase64Url(new TextEncoder().encode(text))
}

/** Marks a raw-DEFLATE payload. `.` never appears in base64 or base64url, so older links stay unambiguous. */
export const COMPRESSED_PAYLOAD_PREFIX = 'z.'
/** Inflated payloads larger than this are refused (the project source limit is 2 MB). */
export const MAX_INFLATED_PAYLOAD_BYTES = 2_500_000
const INFLATE_INPUT_SLICE = 512

/**
 * Encodes project JSON for a link, compressed when that is shorter. Compression keeps the
 * pilot's expense starter under 2,000 characters, which iOS can pass intact between apps.
 */
export function encodeProjectPayload(json: string) {
  const plain = encodeBase64Url(json)
  const compressed = `${COMPRESSED_PAYLOAD_PREFIX}${bytesToBase64Url(deflateSync(new TextEncoder().encode(json), { level: 9 }))}`
  return compressed.length < plain.length ? compressed : plain
}

/** Decodes a `z.` payload back to JSON text, refusing malformed data and decompression bombs. */
export function decodeCompressedPayload(encoded: string) {
  const body = encoded.slice(COMPRESSED_PAYLOAD_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*$/.test(body)) throw new Error('Invalid compressed project link.')
  const binary = atob(body.padEnd(body.length + ((4 - (body.length % 4)) % 4), '='))
  const input = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const chunks: Uint8Array[] = []
  let total = 0
  let finished = false
  const inflate = new Inflate((chunk, final) => {
    total += chunk.length
    if (total > MAX_INFLATED_PAYLOAD_BYTES) throw new Error('Project link is too large.')
    chunks.push(chunk)
    if (final) finished = true
  })
  // Small input slices bound how much one push can expand before the size check runs.
  for (let offset = 0; offset < input.length; offset += INFLATE_INPUT_SLICE) {
    inflate.push(input.subarray(offset, offset + INFLATE_INPUT_SLICE), offset + INFLATE_INPUT_SLICE >= input.length)
  }
  if (!finished) throw new Error('Incomplete compressed project link.')
  const bytes = new Uint8Array(total)
  let position = 0
  for (const chunk of chunks) {
    bytes.set(chunk, position)
    position += chunk.length
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export interface StarterFile {
  path: string
  content: string
  /** Optional; Hafa Code infers it from the file extension. */
  language?: string
}

export interface StarterLinkInput {
  title: string
  kind: StarterKind | string
  files: StarterFile[]
  /** Stable per lesson so reopening the link brings back the learner's copy. */
  starterKey: string
  entryPath?: string
  returnUrl?: string
  returnLabel?: string
  /** Defaults to https://code.shimizu-technology.com */
  baseUrl?: string
  allowDevOrigins?: boolean
}

export interface StarterLink {
  url: string
  length: number
  warnings: string[]
}

export class StarterLinkError extends Error {}

function isStarterKind(value: string): value is StarterKind {
  return (STARTER_KINDS as readonly string[]).includes(value)
}

/** Builds a lesson starter link and refuses inputs the app would reject. */
export function buildStarterLink(input: StarterLinkInput): StarterLink {
  const title = input.title.trim()
  if (!title) throw new StarterLinkError('A starter needs a title.')
  if (Array.from(title).length > 120) throw new StarterLinkError('Starter titles must be 120 characters or fewer.')
  const kind = input.kind.trim().toLowerCase()
  if (!isStarterKind(kind)) throw new StarterLinkError(`Unknown language “${input.kind}”. Use one of: ${STARTER_KINDS.join(', ')}.`)
  if (input.files.length === 0) throw new StarterLinkError('A starter needs at least one file.')
  const paths = new Set<string>()
  for (const file of input.files) {
    if (!file.path.trim()) throw new StarterLinkError('Every starter file needs a path.')
    if (paths.has(file.path)) throw new StarterLinkError(`Duplicate file path “${file.path}”.`)
    paths.add(file.path)
  }
  if (input.entryPath && !paths.has(input.entryPath)) throw new StarterLinkError(`Entry file “${input.entryPath}” is not one of the starter files.`)
  const starterKey = parseStarterKey(input.starterKey)
  if (!starterKey) throw new StarterLinkError('Starter keys use 1–80 letters, digits, “.”, “_”, “:”, or “-”, starting with a letter or digit.')

  const warnings: string[] = []
  let returnUrl: string | null = null
  if (input.returnUrl) {
    returnUrl = parseReturnUrl(input.returnUrl, { allowDevOrigins: input.allowDevOrigins })
    if (!returnUrl) throw new StarterLinkError(`Return URL must be on ${LEARN_PRODUCTION_ORIGIN} or a CSG Learn deploy preview. Hafa Code ignores any other return link.`)
  }
  const returnLabel = input.returnLabel ? sanitizeReturnLabel(input.returnLabel) : null
  if (input.returnLabel && returnLabel !== input.returnLabel.trim()) warnings.push(`The lesson label was shortened or cleaned to “${returnLabel ?? ''}”.`)
  if (returnLabel && !returnUrl) warnings.push('A lesson label without a return URL is ignored.')

  const payload = {
    title,
    kind,
    ...(input.entryPath ? { entryPath: input.entryPath } : {}),
    files: input.files.map((file) => ({ path: file.path, ...(file.language ? { language: file.language } : {}), content: file.content })),
  }
  const hash = new URLSearchParams()
  const json = JSON.stringify(payload)
  // Repetitive code can compress into a short link that the app would still refuse to inflate.
  if (new TextEncoder().encode(json).byteLength > MAX_INFLATED_PAYLOAD_BYTES) {
    throw new StarterLinkError(`This starter is larger than Hafa Code opens from a link (${(MAX_INFLATED_PAYLOAD_BYTES / 1_000_000).toFixed(1)} MB). Trim it or share it as a file.`)
  }
  hash.set('project', encodeProjectPayload(json))
  hash.set('starter', starterKey)
  if (returnUrl) {
    hash.set('return', returnUrl)
    if (returnLabel) hash.set('returnLabel', returnLabel)
  }
  const base = new URL(input.baseUrl ?? HAFA_CODE_ORIGIN)
  const url = `${base.origin}/?lang=${kind}#${hash.toString()}`
  if (url.length > STARTER_LINK_MAX_LENGTH) {
    throw new StarterLinkError(`This starter link would be ${url.length.toLocaleString('en-US')} characters (limit ${STARTER_LINK_MAX_LENGTH.toLocaleString('en-US')}). Trim the starter or share it as a file.`)
  }
  if (url.length > STARTER_LINK_IOS_SAFE_LENGTH && url.length <= STARTER_LINK_RECOMMENDED_MAX_LENGTH) {
    warnings.push(`This link is ${url.length.toLocaleString('en-US')} characters. On iPhone, links over ${STARTER_LINK_IOS_SAFE_LENGTH.toLocaleString('en-US')} can be cut off when opened from another app such as Messages; tapping it inside a Learn lesson in Safari works.`)
  }
  if (url.length > STARTER_LINK_RECOMMENDED_MAX_LENGTH) {
    warnings.push(`This link is ${url.length.toLocaleString('en-US')} characters. Links over ${STARTER_LINK_RECOMMENDED_MAX_LENGTH.toLocaleString('en-US')} can break in chat apps, email, and QR codes; keep it inside the Learn lesson.`)
  }
  return { url, length: url.length, warnings }
}
