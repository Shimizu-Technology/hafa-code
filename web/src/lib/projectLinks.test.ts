import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  PROJECT_LIBRARY_STORAGE_KEY,
  addImportedProject,
  createProject,
  decodeSharedProject,
  encodeProjectForShare,
  importNotice,
  normalizeProjectTitle,
  projectExportFormat,
  projectExportLabel,
  saveProjectLibrary,
  uniqueProjectTitle,
  type ProjectLibrary,
} from './projectStorage'
import { loadInitialLibraryWithSharedProject, requestedStarterKind } from './workspace'

function pythonProject(title: string, content: string) {
  return { ...createProject('python', title), files: [{ path: 'main.py', language: 'python' as const, content }] }
}

function legacyEncode(project: ReturnType<typeof pythonProject>) {
  const bytes = new TextEncoder().encode(JSON.stringify(project))
  return btoa(String.fromCharCode(...bytes))
}

function visit(url: string) {
  window.history.replaceState(null, '', url)
  return loadInitialLibraryWithSharedProject()
}

describe('share links', () => {
  test('are URL-safe and round-trip unicode code', () => {
    const project = pythonProject('Håfa ✓ >>> ???', 'print("Håfa adai 🌺")  # >>> ??? ~~~\n')
    const encoded = encodeProjectForShare(project)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeSharedProject(encoded)).toMatchObject({ title: project.title, files: project.files })
  })

  test('still open older standard base64 links, including ones whose + became a space', () => {
    const project = pythonProject('Legacy >>> ??? link', 'print(">>> ??? ~~~")\n')
    const legacy = legacyEncode(project)
    expect(legacy).toMatch(/[+/]/)
    expect(decodeSharedProject(legacy).files).toEqual(project.files)
    expect(decodeSharedProject(legacy.replace(/\+/g, ' ')).files).toEqual(project.files)
    expect(decodeSharedProject(legacy.replace(/=+$/, '')).files).toEqual(project.files)
  })
})

describe('imports and project names', () => {
  test('reuse an untouched copy and number a new copy when the first was changed', () => {
    const imported = pythonProject('Expense Tracker', 'total = 0\n')
    const library: ProjectLibrary = { activeProjectId: 'other', projects: [{ ...createProject('ruby'), id: 'other' }] }

    const first = addImportedProject(library, imported)
    expect(first.reused).toBe(false)
    expect(importNotice(first, imported)).toBe('Shared project imported locally.')

    const again = addImportedProject(first.library, { ...imported, id: 'second-open' })
    expect(again).toMatchObject({ reused: true, project: { id: imported.id } })
    expect(again.library.projects).toHaveLength(2)
    expect(importNotice(again, imported)).toContain('already in your projects')

    const edited = { ...first.library, projects: first.library.projects.map((project) => project.id === imported.id ? { ...project, files: [{ ...project.files[0], content: 'total = 99\n' }] } : project) }
    const third = addImportedProject(edited, { ...imported, id: 'third-open' })
    expect(third).toMatchObject({ reused: false, project: { title: 'Expense Tracker (2)' } })
    expect(third.library.projects).toHaveLength(3)
    expect(importNotice(third, imported)).toContain('added as “Expense Tracker (2)”')
  })

  test('number duplicate default names and repair empty names', () => {
    expect(uniqueProjectTitle('Python Playground', [{ title: 'Ruby Playground' }])).toBe('Python Playground')
    expect(uniqueProjectTitle('Python Playground', [{ title: 'Python Playground' }, { title: 'Python Playground (2)' }])).toBe('Python Playground (3)')
    expect(normalizeProjectTitle('   ', 'python')).toBe('Python Playground')
    expect(normalizeProjectTitle('  Lab 1  ', 'python')).toBe('Lab 1')
    expect(Array.from(normalizeProjectTitle('x'.repeat(200), 'python'))).toHaveLength(120)
  })

  test('download one-file projects as source and larger projects as importable JSON', () => {
    expect(projectExportFormat(pythonProject('Expense Tracker', ''))).toEqual({ kind: 'source', fileName: 'expense-tracker.py' })
    expect(projectExportFormat({ title: '🌺', files: [{ path: 'main.py', language: 'python', content: '' }] })).toEqual({ kind: 'source', fileName: 'main.py' })
    expect(projectExportFormat(createProject('sql'))).toMatchObject({ kind: 'json', fileName: 'sql-data-playground.json' })
    expect(projectExportLabel(projectExportFormat(pythonProject('Expense Tracker', '')))).toBe('Download code (.py)')
    expect(projectExportLabel(projectExportFormat({ title: 'My Project', files: [{ path: 'Makefile', language: 'python', content: '' }] }))).toBe('Download code (file)')
    expect(projectExportLabel(projectExportFormat(createProject('sql')))).toBe('Export project (.json)')
  })
})

describe('first visit from a Learn or class link', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => window.history.replaceState(null, '', '/'))

  test('?lang=python gives a new visitor a Python project instead of Ruby and lands on the code', () => {
    const initial = visit('/?lang=python')
    expect(initial.library.projects.map((project) => project.kind)).toEqual(['python'])
    expect(initial.openCode).toBe(true)
    expect(window.location.search).toBe('')
    expect(requestedStarterKind({ search: '?lang=COBOL', hash: '' })).toBeNull()
  })

  test('a returning visitor with ?lang=python opens their latest Python project or gets one', () => {
    const ruby = createProject('ruby')
    saveProjectLibrary({ activeProjectId: ruby.id, projects: [ruby] })
    const created = visit('/#lang=python')
    expect(created.library.projects).toHaveLength(2)
    expect(created.library.projects.find((project) => project.id === created.library.activeProjectId)?.kind).toBe('python')

    saveProjectLibrary({ ...created.library, activeProjectId: ruby.id })
    const reopened = visit('/?lang=python')
    expect(reopened.library.projects).toHaveLength(2)
    expect(reopened.notice).toContain('Opened your Python project')
  })

  test('a project link gives a new visitor only that project and opening it twice does not duplicate it', () => {
    const shared = pythonProject('Expense Tracker', 'print("hi")\n')
    const first = visit(`/#project=${encodeProjectForShare(shared)}`)
    expect(first.library.projects).toHaveLength(1)
    expect(first.library.projects[0]).toMatchObject({ kind: 'python', title: 'Expense Tracker' })
    expect(first.openCode).toBe(true)
    expect(window.location.hash).toBe('')

    saveProjectLibrary(first.library)
    const second = visit(`/#project=${encodeProjectForShare(shared)}`)
    expect(second.library.projects).toHaveLength(1)
    expect(second.notice).toContain('already in your projects')
    expect(JSON.parse(localStorage.getItem(PROJECT_LIBRARY_STORAGE_KEY) ?? '{}').projects).toHaveLength(1)
  })

  test('a broken project link is cleared from the URL and ?lang=python still applies', () => {
    const initial = visit('/?lang=python#project=not-a-project')
    expect(initial.notice).toBe('Could not import the shared project link.')
    expect(initial.library.projects.map((project) => project.kind)).toEqual(['python'])
    expect(initial.openCode).toBe(true)
    expect(window.location.search + window.location.hash).toBe('')
  })

  test('an import renamed only because of a same-named project says so plainly', () => {
    const mine = pythonProject('Python Playground', 'print("mine")\n')
    const theirs = pythonProject('Python Playground', 'print("theirs")\n')
    const result = addImportedProject({ activeProjectId: mine.id, projects: [mine] }, theirs)
    expect(importNotice(result, theirs)).toBe('You already have a project named “Python Playground”, so this link was added as “Python Playground (2)”. Your other projects are unchanged.')
  })
})
