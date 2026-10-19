import { deflateSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import pilotManifest from '../../scripts/examples/csg-python-pilot-starters.json'
import { PROJECT_KINDS } from './languageRegistry'
import {
  LESSON_LINKS_STORAGE_KEY,
  emptyLessonLinks,
  lessonReturnForProject,
  loadLessonLinks,
  normalizeLessonLinks,
  recordLessonLink,
  replaceLessonProjectId,
  resetLessonLinksCache,
} from './lessonLinks'
import {
  PROJECT_LIBRARY_STORAGE_KEY,
  createProject,
  decodeSharedProject,
  encodeProjectForShare,
  saveProjectLibrary,
  type ProjectLibrary,
} from './projectStorage'
import {
  STARTER_KINDS,
  STARTER_LINK_IOS_SAFE_LENGTH,
  STARTER_LINK_MAX_LENGTH,
  STARTER_LINK_RECOMMENDED_MAX_LENGTH,
  StarterLinkError,
  buildStarterLink,
  decodeCompressedPayload,
  encodeBase64Url,
  encodeProjectPayload,
  parseReturnUrl,
  parseStarterKey,
  sanitizeReturnLabel,
} from './starterLinks'
import {
  PROJECT_LINK_BROKEN_NOTICE,
  PROJECT_LINK_TOO_LARGE_NOTICE,
  loadInitialLibraryWithSharedProject,
  readLessonLaunch,
} from './workspace'

const LESSON_URL = 'https://learn.codeschoolofguam.com/lessons/42?cohort_id=7'
const expenseStarter = pilotManifest.starters.find((starter) => starter.key === 'csg-python-pilot:project')!

function visit(url: string) {
  window.history.replaceState(null, '', url)
  return loadInitialLibraryWithSharedProject()
}

function relative(url: string) {
  const parsed = new URL(url)
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

function expenseLink(overrides: Partial<Parameters<typeof buildStarterLink>[0]> = {}) {
  return buildStarterLink({
    title: expenseStarter.title,
    kind: expenseStarter.kind,
    files: expenseStarter.files,
    starterKey: expenseStarter.key,
    returnUrl: LESSON_URL,
    returnLabel: expenseStarter.returnLabel,
    ...overrides,
  })
}

function activeProject(library: ProjectLibrary) {
  return library.projects.find((project) => project.id === library.activeProjectId)!
}

describe('return URL allowlist', () => {
  test('accepts CSG Learn production and its Netlify deploy previews', () => {
    expect(parseReturnUrl('https://learn.codeschoolofguam.com/lessons/42')).toBe('https://learn.codeschoolofguam.com/lessons/42')
    expect(parseReturnUrl('  https://LEARN.codeschoolofguam.com:443/lessons/42#block  ')).toBe('https://learn.codeschoolofguam.com/lessons/42#block')
    expect(parseReturnUrl('https://deploy-preview-181--csg-learn.netlify.app/lessons/9')).toBe('https://deploy-preview-181--csg-learn.netlify.app/lessons/9')
  })

  test.each([
    ['look-alike suffix', 'https://learn.codeschoolofguam.com.evil.com/lessons/1'],
    ['look-alike prefix', 'https://evil-learn.codeschoolofguam.com/'],
    ['credentials pointing elsewhere', 'https://learn.codeschoolofguam.com@evil.com/'],
    ['credentials on Learn', 'https://user:pass@learn.codeschoolofguam.com/'],
    ['plain http', 'http://learn.codeschoolofguam.com/lessons/1'],
    ['other port', 'https://learn.codeschoolofguam.com:8443/'],
    ['javascript scheme', 'javascript:alert(document.cookie)'],
    ['javascript disguised with case and whitespace', ' JaVaScRiPt:alert(1)//https://learn.codeschoolofguam.com'],
    ['data URL', 'data:text/html,<script>alert(1)</script>'],
    ['protocol-relative', '//learn.codeschoolofguam.com/lessons/1'],
    ['protocol-relative to evil', '//evil.com'],
    ['relative path', '/lessons/1'],
    ['triple slash', 'https:///evil.com'],
    ['backslash trick', 'https://learn.codeschoolofguam.com\\@evil.com'],
    ['tab inside scheme', 'java\tscript:alert(1)'],
    ['newline', 'https://learn.codeschoolofguam.com/\nlessons'],
    ['still percent-encoded', 'https%3A%2F%2Flearn.codeschoolofguam.com%2Flessons%2F1'],
    ['double-encoded evil', 'https%253A%252F%252Fevil.com'],
    ['other Netlify site', 'https://deploy-preview-1--evil.netlify.app/'],
    ['branch deploy', 'https://main--csg-learn.netlify.app/'],
    ['localhost in a production build', 'http://localhost:5173/lessons/1'],
    ['too long', `https://learn.codeschoolofguam.com/${'a'.repeat(2_100)}`],
  ])('rejects %s', (_label, url) => {
    expect(parseReturnUrl(url)).toBeNull()
  })

  test('accepts localhost only when a development build allows it', () => {
    expect(parseReturnUrl('http://localhost:5173/lessons/1', { allowDevOrigins: true })).toBe('http://localhost:5173/lessons/1')
    expect(parseReturnUrl('http://127.0.0.1:5173/lessons/1', { allowDevOrigins: true })).toBe('http://127.0.0.1:5173/lessons/1')
    expect(parseReturnUrl('http://localhost.evil.com/', { allowDevOrigins: true })).toBeNull()
  })

  test('reads an encoded return from the hash and drops a disallowed one silently', () => {
    const encoded = encodeURIComponent(LESSON_URL)
    expect(readLessonLaunch({ search: '', hash: `#return=${encoded}&returnLabel=Lesson+2` }, false)).toEqual({ returnTarget: { url: LESSON_URL, label: 'Lesson 2' }, starterKey: null })
    expect(readLessonLaunch({ search: `?return=${encoded}`, hash: '' }, false).returnTarget?.url).toBe(LESSON_URL)
    expect(readLessonLaunch({ search: '', hash: `#return=${encodeURIComponent('javascript:alert(1)')}&returnLabel=Click` }, false)).toEqual({ returnTarget: null, starterKey: null })
  })
})

describe('lesson labels and starter keys', () => {
  test('strip control and direction-override characters, collapse whitespace, and cap the length', () => {
    expect(sanitizeReturnLabel('  Lesson 2 —\n values\t and   variables ')).toBe('Lesson 2 — values and variables')
    expect(sanitizeReturnLabel('Pay‮gnp.exe\u0000​')).toBe('Pay gnp.exe')
    expect(sanitizeReturnLabel('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>')
    expect(sanitizeReturnLabel('Håfa adai 👋🏽 👨‍👩‍👧')).toBe('Håfa adai 👋🏽 👨‍👩‍👧')
    const long = sanitizeReturnLabel('Lesson '.repeat(30))!
    expect(Array.from(long)).toHaveLength(80)
    expect(long.endsWith('…')).toBe(true)
    expect(sanitizeReturnLabel(' ‮\u0007 ')).toBeNull()
    expect(sanitizeReturnLabel(undefined)).toBeNull()
  })

  test('accept only short, simple starter keys', () => {
    expect(parseStarterKey('csg-python-pilot:project')).toBe('csg-python-pilot:project')
    expect(parseStarterKey('-starts-with-dash')).toBeNull()
    expect(parseStarterKey('has space')).toBeNull()
    expect(parseStarterKey('k'.repeat(81))).toBeNull()
    expect(parseStarterKey('__proto__')).toBeNull()
  })
})

describe('starter link builder', () => {
  test('knows every project kind the app supports', () => {
    expect([...STARTER_KINDS].sort()).toEqual([...PROJECT_KINDS].sort())
  })

  test('round-trips the pilot expense starter through the app import', () => {
    const link = expenseLink()
    expect(link.warnings).toEqual([])
    expect(link.url.startsWith('https://code.shimizu-technology.com/?lang=python#project=')).toBe(true)
    const hash = new URLSearchParams(new URL(link.url).hash.slice(1))
    expect(hash.get('project')).toMatch(/^z\.[A-Za-z0-9_-]+$/)
    expect(hash.get('starter')).toBe('csg-python-pilot:project')
    expect(hash.get('return')).toBe(LESSON_URL)
    expect(hash.get('returnLabel')).toBe('Independent expense-summary project')

    const imported = decodeSharedProject(hash.get('project')!)
    expect(imported).toMatchObject({ title: 'Expense summary project', kind: 'python', entryPath: 'expense_summary.py' })
    expect(imported.files).toEqual([{ path: 'expense_summary.py', language: 'python', content: expenseStarter.files[0].content }])
  })

  test('keeps every pilot starter, with its return target, under the iOS-safe length', () => {
    for (const starter of pilotManifest.starters) {
      const link = buildStarterLink({ ...starter, starterKey: starter.key })
      expect(link.length).toBeLessThan(STARTER_LINK_IOS_SAFE_LENGTH)
      expect(link.warnings).toEqual([])
    }
    // Compression takes the 1.5 KB expense starter from about 2,600 characters to about 1,200.
    expect(expenseLink().length).toBeLessThan(1_400)
  })

  test('warns above the iOS-safe and recommended lengths and refuses links over the limit', () => {
    const noisy = (length: number) => {
      // Seeded pseudo-random text so compression cannot shrink it much.
      let seed = 42
      return Array.from({ length }, () => {
        seed ^= seed << 13
        seed ^= seed >>> 17
        seed ^= seed << 5
        return String.fromCharCode(33 + ((seed >>> 0) % 94))
      }).join('')
    }
    const ios = expenseLink({ files: [{ path: 'main.py', content: noisy(1_500) }] })
    expect(ios.length).toBeGreaterThan(STARTER_LINK_IOS_SAFE_LENGTH)
    expect(ios.warnings.join(' ')).toContain('opened from another app')
    const medium = expenseLink({ files: [{ path: 'main.py', content: noisy(7_000) }] })
    expect(medium.length).toBeGreaterThan(STARTER_LINK_RECOMMENDED_MAX_LENGTH)
    expect(medium.warnings.join(' ')).toContain('can break in chat apps')
    expect(() => expenseLink({ files: [{ path: 'main.py', content: noisy(STARTER_LINK_MAX_LENGTH) }] })).toThrow(StarterLinkError)
  })

  test('refuses a starter too large to open even when it would compress into a short link', () => {
    const repetitive = 'a'.repeat(3_000_000)
    expect(encodeProjectPayload(JSON.stringify({ content: repetitive })).length).toBeLessThan(STARTER_LINK_MAX_LENGTH)
    expect(() => expenseLink({ files: [{ path: 'main.py', content: repetitive }] })).toThrow(/larger than Hafa Code opens from a link/)
  })

  test('uses the uncompressed form when compression would not help', () => {
    expect(encodeProjectPayload('{"a":1}')).toBe(encodeBase64Url('{"a":1}'))
    expect(encodeProjectPayload(JSON.stringify({ code: 'print(1)\n'.repeat(50) })).startsWith('z.')).toBe(true)
  })

  test('refuses damaged, cut-off, and oversized compressed payloads', () => {
    const payload = new URLSearchParams(new URL(expenseLink().url).hash.slice(1)).get('project')!
    expect(() => decodeSharedProject(payload.slice(0, 400))).toThrow()
    expect(() => decodeSharedProject('z.!!!')).toThrow()
    const bomb = `z.${Buffer.from(deflateSync(new Uint8Array(20_000_000), { level: 9 })).toString('base64url')}`
    expect(bomb.length).toBeLessThan(40_000)
    expect(() => decodeCompressedPayload(bomb)).toThrow('Project link is too large.')
  })

  test('refuses a return URL the app would ignore, an unknown language, and a bad key', () => {
    expect(() => expenseLink({ returnUrl: 'https://learn.codeschoolofguam.com.evil.com/' })).toThrow(/Return URL must be on/)
    expect(() => expenseLink({ kind: 'cobol' })).toThrow(/Unknown language/)
    expect(() => expenseLink({ starterKey: 'has space' })).toThrow(/Starter keys/)
    expect(() => expenseLink({ files: [] })).toThrow(/at least one file/)
    expect(() => expenseLink({ entryPath: 'missing.py' })).toThrow(/Entry file/)
  })

  test('builds a link without a return target that still reuses the learner copy', () => {
    const link = expenseLink({ returnUrl: undefined, returnLabel: undefined })
    const hash = new URLSearchParams(new URL(link.url).hash.slice(1))
    expect(hash.has('return')).toBe(false)
    expect(hash.get('starter')).toBe('csg-python-pilot:project')
  })
})

describe('opening a lesson link', () => {
  beforeEach(() => {
    localStorage.clear()
    resetLessonLinksCache()
  })
  afterEach(() => window.history.replaceState(null, '', '/'))

  test('remembers the return target for the imported project across reloads and cleans the URL', () => {
    const first = visit(relative(expenseLink().url))
    const project = activeProject(first.library)
    expect(project.title).toBe('Expense summary project')
    expect(first.openCode).toBe(true)
    expect(window.location.hash).toBe('')
    expect(window.location.search).toBe('')
    saveProjectLibrary(first.library)

    const reload = visit('/')
    expect(reload.library.activeProjectId).toBe(project.id)
    expect(lessonReturnForProject(loadLessonLinks(), project.id)).toEqual({ url: LESSON_URL, label: 'Independent expense-summary project' })
  })

  test('ignores a disallowed return target without a message', () => {
    const link = expenseLink({ returnUrl: undefined, returnLabel: undefined }).url
    const initial = visit(relative(`${link}&return=${encodeURIComponent('https://evil.example/phish')}&returnLabel=Back`))
    expect(initial.notice).toBe('Shared project imported locally.')
    expect(lessonReturnForProject(loadLessonLinks(), initial.library.activeProjectId)).toBeNull()
  })

  test('reopening the same link brings back the untouched copy without a duplicate', () => {
    const first = visit(relative(expenseLink().url))
    saveProjectLibrary(first.library)
    const again = visit(relative(expenseLink().url))
    expect(again.library.projects).toHaveLength(1)
    expect(again.library.activeProjectId).toBe(first.library.activeProjectId)
    expect(again.notice).toBe('Opened “Expense summary project” from your lesson.')
    expect(again.lessonReopen).toBeNull()
  })

  test('reopening after editing opens the edited copy and never overwrites it', () => {
    const first = visit(relative(expenseLink().url))
    const projectId = first.library.activeProjectId
    const edited: ProjectLibrary = {
      ...first.library,
      projects: first.library.projects.map((project) => ({ ...project, files: [{ ...project.files[0], content: 'print("my work")\n' }] })),
    }
    saveProjectLibrary(edited)

    const again = visit(relative(expenseLink({ returnUrl: 'https://learn.codeschoolofguam.com/lessons/43' }).url))
    expect(again.library.projects).toHaveLength(1)
    expect(again.library.activeProjectId).toBe(projectId)
    expect(activeProject(again.library).files[0].content).toBe('print("my work")\n')
    expect(again.notice).toBe('Welcome back. Your saved work on “Expense summary project” is open.')
    expect(again.lessonReopen).toMatchObject({ projectId, starter: { title: 'Expense summary project' } })
    expect(again.lessonReopen?.starter.files[0].content).toBe(expenseStarter.files[0].content)
    // A newer link's return target replaces the old one.
    expect(lessonReturnForProject(loadLessonLinks(), projectId)?.url).toBe('https://learn.codeschoolofguam.com/lessons/43')
    expect(JSON.parse(localStorage.getItem(PROJECT_LIBRARY_STORAGE_KEY)!).projects[0].files[0].content).toBe('print("my work")\n')
  })

  test('a renamed copy is still found by its starter key', () => {
    const first = visit(relative(expenseLink().url))
    saveProjectLibrary({ ...first.library, projects: first.library.projects.map((project) => ({ ...project, title: 'My budget tool' })) })
    const again = visit(relative(expenseLink().url))
    expect(again.library.projects).toHaveLength(1)
    expect(activeProject(again.library).title).toBe('My budget tool')
  })

  test('imports a fresh copy when the learner deleted theirs', () => {
    const other = createProject('ruby')
    const first = visit(relative(expenseLink().url))
    saveProjectLibrary({ activeProjectId: other.id, projects: [other] })
    const again = visit(relative(expenseLink().url))
    expect(again.library.projects.map((project) => project.title)).toEqual(['Expense summary project', 'Ruby Playground'])
    expect(again.library.activeProjectId).not.toBe(first.library.activeProjectId)
    expect(loadLessonLinks().starters['csg-python-pilot:project']).toBe(again.library.activeProjectId)
  })

  test('gives friendly messages for oversized and cut-off links', () => {
    expect(visit(`/?lang=python#project=${'A'.repeat(3_000_001)}`).notice).toBe(PROJECT_LINK_TOO_LARGE_NOTICE)
    const cut = expenseLink().url
    const project = new URLSearchParams(new URL(cut).hash.slice(1)).get('project')!
    const truncated = visit(`/?lang=python#project=${project.slice(0, 700)}`)
    expect(truncated.notice).toBe(PROJECT_LINK_BROKEN_NOTICE)
    expect(activeProject(truncated.library).kind).toBe('python')
    expect(window.location.hash).toBe('')
  })

  test('never puts the lesson target in a Share link', () => {
    const first = visit(relative(expenseLink().url))
    const project = activeProject(first.library)
    expect(lessonReturnForProject(loadLessonLinks(), project.id)).not.toBeNull()
    const shared = encodeProjectForShare(project)
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(shared.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0)))
    expect(decoded).not.toContain('codeschoolofguam')
    expect(decoded).not.toContain('csg-python-pilot')
    expect(Object.keys(decodeSharedProject(shared))).not.toContain('returnUrl')
  })
})

describe('lesson link storage', () => {
  test('re-validates stored targets so an edited entry cannot add an open redirect', () => {
    localStorage.setItem(LESSON_LINKS_STORAGE_KEY, JSON.stringify({
      projects: {
        good: { returnUrl: LESSON_URL, returnLabel: 'Lesson‮ 2', starterKey: 'k', updatedAt: '2026-10-19T00:00:00Z' },
        evil: { returnUrl: 'javascript:alert(1)', returnLabel: 'x', updatedAt: '2026-10-19T00:00:00Z' },
        alsoEvil: { returnUrl: 'https://evil.example/', starterKey: 'bad key' },
      },
      starters: { k: 'good', 'bad key': 'evil', ok: 42 },
    }))
    const links = loadLessonLinks()
    expect(Object.keys(links.projects)).toEqual(['good'])
    expect(links.projects.good.returnLabel).toBe('Lesson 2')
    expect(links.starters).toEqual({ k: 'good' })
    expect(normalizeLessonLinks('nonsense')).toEqual(emptyLessonLinks())
  })

  test('follows a project to its cloud id after the first save', () => {
    const links = recordLessonLink(emptyLessonLinks(), 'local-uuid', { returnTarget: { url: LESSON_URL, label: 'Lesson' }, starterKey: 'csg:lesson' })
    const moved = replaceLessonProjectId(links, 'local-uuid', '123')
    expect(moved.projects['local-uuid']).toBeUndefined()
    expect(lessonReturnForProject(moved, '123')).toEqual({ url: LESSON_URL, label: 'Lesson' })
    expect(moved.starters['csg:lesson']).toBe('123')
    expect(replaceLessonProjectId(moved, 'unrelated', '456')).toBe(moved)
  })

  test('a link without a return keeps the saved one', () => {
    const links = recordLessonLink(emptyLessonLinks(), 'p', { returnTarget: { url: LESSON_URL, label: 'Lesson' }, starterKey: 'k' })
    const again = recordLessonLink(links, 'p', { returnTarget: null, starterKey: 'k' })
    expect(lessonReturnForProject(again, 'p')).toEqual({ url: LESSON_URL, label: 'Lesson' })
  })
})
