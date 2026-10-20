import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LEARNING_SIDECAR_OVERLAY_QUERY } from './hooks/useOverlaySidecar'
import { RUNNER_STARTUP_TIMEOUT_MS, RUNNER_TIMEOUT_MS } from './lib/codeRunner'
import type { ErrorCoachContext } from './lib/errorCoach'
import { languageGuideFor } from './lib/languageGuides'
import { practiceChallengeById, practiceChallengesFor } from './lib/practiceLab'
import { completePracticeChallenge, completedPracticeChallengeIds, practiceChallengeIdForProject, preservePracticeConflictLinks } from './lib/practiceProgress'
import { createConflictCopy, createProject } from './lib/projectStorage'
import type { ProjectLibrary } from './lib/projectStorage'
import type { RunnerOutcome } from './lib/runnerOutcome'
import { api } from './lib/api'
import type { useAuthContext } from './contexts/AuthContext'
import { createWorkspaceBackup, serializeWorkspaceBackup } from './lib/workspaceBackup'
import { buildStarterLink } from './lib/starterLinks'
import { resetLessonLinksCache } from './lib/lessonLinks'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="Code editor" value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
  ),
}))

const runnerHarness = vi.hoisted(() => ({
  onErrorAdviceChange: undefined as undefined | ((context: ErrorCoachContext) => void),
  onRunCancel: undefined as undefined | (() => void),
  onRunComplete: undefined as undefined | ((outcome: RunnerOutcome) => void),
  mountCount: 0,
  unmountCount: 0,
}))

type AppAuthContext = ReturnType<typeof useAuthContext>

const authHarness = vi.hoisted(() => ({
  value: null as unknown as AppAuthContext,
}))

vi.mock('./contexts/AuthContext', () => ({
  useAuthContext: () => authHarness.value,
}))

vi.mock('./components/RunnerPanel', async () => {
  const { useEffect, useState } = await import('react')

  return { RunnerPanel: ({ onErrorAdviceChange, onRunCancel, onRunComplete }: {
    onErrorAdviceChange?: typeof runnerHarness.onErrorAdviceChange
    onRunCancel?: typeof runnerHarness.onRunCancel
    onRunComplete?: typeof runnerHarness.onRunComplete
  }) => {
    const [active, setActive] = useState(false)
    runnerHarness.onErrorAdviceChange = onErrorAdviceChange
    runnerHarness.onRunCancel = onRunCancel
    runnerHarness.onRunComplete = onRunComplete
    useEffect(() => {
      runnerHarness.mountCount += 1
      return () => { runnerHarness.unmountCount += 1 }
    }, [])
    return (
      <section aria-label="Test runner">
        <button type="button" onClick={() => setActive(true)}>{active ? 'Test run active' : 'Start test run'}</button>
      </section>
    )
  } }
})

const STORAGE_KEY = 'hafa-code-projects-v2'
const TEST_CLOUD_AUTH: AppAuthContext['cloudAuth'] = { status: 'ready', openSignIn: () => {}, openSignUp: () => {}, mountUserButton: null }

async function openProjectMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'More project actions' }))
  return screen.getByRole('group', { name: 'Project actions' })
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Workspace and display settings' }))
  return screen.getByRole('group', { name: 'Workspace and display settings' })
}

function storedLibrary() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ProjectLibrary
}

describe('App language guide practice projects', () => {
  beforeEach(() => {
    localStorage.clear()
    authHarness.value = {
      isSignedIn: false,
      isLoading: true,
      user: null,
      organizations: [],
      syncSession: async () => {},
      cloudAuth: TEST_CLOUD_AUTH,
    }
    runnerHarness.onErrorAdviceChange = undefined
    runnerHarness.onRunCancel = undefined
    runnerHarness.onRunComplete = undefined
    runnerHarness.mountCount = 0
    runnerHarness.unmountCount = 0
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('opens a complete example in a new private project without changing the original', async () => {
    const user = userEvent.setup()
    render(<App />)

    const initialLibrary = storedLibrary()
    const originalProject = initialLibrary.projects[0]
    const topic = languageGuideFor('ruby').topics.find((candidate) => candidate.id === 'ruby-variables-types')!

    await user.click(screen.getAllByRole('button', { name: 'Ruby guide' })[0])
    const learningSidecar = screen.getByRole('complementary', { name: 'Ruby learning' })
    expect(document.querySelector('.layout-grid')?.contains(learningSidecar)).toBe(false)
    await user.type(await screen.findByRole('searchbox'), 'variables')
    await user.click(screen.getByRole('button', { name: /variables and data types/i }))
    await user.click(screen.getByRole('button', { name: 'Try example' }))

    await waitFor(() => expect(storedLibrary().projects).toHaveLength(2))
    const updatedLibrary = storedLibrary()
    const practiceProject = updatedLibrary.projects.find((candidate) => candidate.id === updatedLibrary.activeProjectId)!

    expect(updatedLibrary.projects.find((candidate) => candidate.id === originalProject.id)).toEqual(originalProject)
    expect(practiceProject).toMatchObject({
      title: topic.practiceProject.title,
      kind: 'ruby',
      visibility: 'private',
      entryPath: topic.practiceProject.entryPath,
      files: topic.practiceProject.files,
    })
    expect(screen.getByLabelText('Project name')).toHaveProperty('value', topic.practiceProject.title)
    expect(screen.getByLabelText('Code editor')).toHaveProperty('value', topic.practiceProject.files[0].content)
    expect(screen.getByRole('status').textContent).toMatch(/previous project is unchanged/i)
  })

  it('shows storage recovery guidance and clears it after a successful workspace restore', async () => {
    const user = userEvent.setup()
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    render(<App />)

    expect((await screen.findByRole('alert')).textContent).toMatch(/local backup is unavailable/i)

    getItem.mockRestore()
    setItem.mockRestore()
    const recoveredProject = createProject('python', 'Recovered workspace')
    const backup = serializeWorkspaceBackup(createWorkspaceBackup({
      library: { activeProjectId: recoveredProject.id, projects: [recoveredProject] },
      theme: 'light',
      colorMode: 'default',
    }))
    await user.click(within(await openProjectMenu(user)).getByRole('button', { name: 'Workspace backup' }))
    fireEvent.change(document.querySelector('.workspace-transfer-sheet input[type="file"]')!, {
      target: { files: [{ text: async () => backup }] },
    })

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(await screen.findByText(/Workspace restored: 1 project/)).toBeTruthy()
  })

  it('restores a backed-up lesson project with its Back to your lesson link', async () => {
    const user = userEvent.setup()
    render(<App />)
    const lessonProject = createProject('python', 'Lesson 2 — values')
    const otherBrowserLinks = {
      projects: { [lessonProject.id]: { returnUrl: 'https://learn.codeschoolofguam.com/lessons/42', returnLabel: 'Lesson 2', starterKey: 'csg:lesson-2', updatedAt: '2026-10-20T00:00:00.000Z' } },
      starters: { 'csg:lesson-2': lessonProject.id },
    }
    const backup = JSON.parse(serializeWorkspaceBackup(createWorkspaceBackup({
      library: { activeProjectId: lessonProject.id, projects: [lessonProject] },
      theme: 'light',
      colorMode: 'default',
    })))
    backup.data.lessonLinks = otherBrowserLinks
    await user.click(within(await openProjectMenu(user)).getByRole('button', { name: 'Workspace backup' }))
    fireEvent.change(document.querySelector('.workspace-transfer-sheet input[type="file"]')!, {
      target: { files: [{ text: async () => JSON.stringify(backup) }] },
    })

    expect(await screen.findByText(/Workspace restored: 1 project/)).toBeTruthy()
    const bar = screen.getByRole('region', { name: 'Lesson' })
    expect(within(bar).getByRole('link', { name: /Back to your lesson/ }).getAttribute('href')).toBe('https://learn.codeschoolofguam.com/lessons/42')
    expect(JSON.parse(localStorage.getItem('hafa-code-lesson-links-v1')!).starters).toEqual({ 'csg:lesson-2': lessonProject.id })
  })

  it('does not claim an unconfirmed cloud save when local storage is unavailable', async () => {
    authHarness.value = {
      isSignedIn: true,
      isLoading: false,
      user: { id: 7, email: 'student@example.com', first_name: 'Student', last_name: 'One', full_name: 'Student One', role: 'user' },
      organizations: [],
      syncSession: vi.fn(),
      cloudAuth: TEST_CLOUD_AUTH,
    }
    vi.spyOn(api, 'getProjects').mockResolvedValue({ data: null, error: 'offline' })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    render(<App />)

    await screen.findByRole('alert')
    await waitFor(() => expect(
      [...document.querySelectorAll('.save-status')]
        .some((element) => element.textContent?.includes('Checking cloud save · local backup unavailable')),
    ).toBe(true))
  })

  it('keeps the active runner mounted when a local project receives its cloud id', async () => {
    const user = userEvent.setup()
    authHarness.value = {
      isSignedIn: true,
      isLoading: false,
      user: { id: 7, email: 'student@example.com', first_name: 'Student', last_name: 'One', full_name: 'Student One', role: 'user' },
      organizations: [],
      syncSession: vi.fn(),
      cloudAuth: TEST_CLOUD_AUTH,
    }
    vi.spyOn(api, 'getProjects').mockResolvedValue({ data: [], error: null })
    vi.spyOn(api, 'getProjectComments').mockResolvedValue({ data: { comments: [], unread_count: 0 }, error: null })
    let resolveCreate!: (result: Awaited<ReturnType<typeof api.createProject>>) => void
    const createResult = new Promise<Awaited<ReturnType<typeof api.createProject>>>((resolve) => {
      resolveCreate = resolve
    })
    const createCloudProject = vi.spyOn(api, 'createProject').mockReturnValue(createResult)

    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start test run' }))
    expect(screen.getByRole('button', { name: 'Test run active' })).toBeTruthy()
    expect(runnerHarness.mountCount).toBe(1)

    await waitFor(() => expect(createCloudProject).toHaveBeenCalledTimes(1), { timeout: 2_000 })
    const localProject = createCloudProject.mock.calls[0][0]
    await act(async () => {
      resolveCreate({
        data: {
          ...localProject,
          id: '42',
          owner: { id: 7, fullName: 'Student One' },
          lockVersion: 0,
        },
        error: null,
        status: 201,
        code: null,
        conflictProject: null,
      })
      await createResult
    })

    await waitFor(() => expect(storedLibrary().activeProjectId).toBe('42'))
    expect(screen.getByRole('button', { name: 'Test run active' })).toBeTruthy()
    expect(runnerHarness.mountCount).toBe(1)
    expect(runnerHarness.unmountCount).toBe(0)
  })

  it('opens desktop error advice directly in the docked Coach', () => {
    render(<App />)

    act(() => runnerHarness.onErrorAdviceChange?.({
      kind: 'ruby',
      advice: {
        title: 'Ruby cannot find that name',
        explanation: 'Ruby does not know this name yet.',
        location: 'main.rb · line 2',
        steps: ['Check spelling.', 'Assign the value.', 'Run again.'],
        guideTopicId: 'ruby-variables-types',
      },
    }))

    expect(screen.getByRole('complementary', { name: 'Ruby learning' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Coach/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Ruby cannot find that name' })).toBeTruthy()
  })

  it('keeps compact error advice behind the non-disruptive Coach launcher', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === LEARNING_SIDECAR_OVERLAY_QUERY,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    render(<App />)

    act(() => runnerHarness.onErrorAdviceChange?.({
      kind: 'ruby',
      advice: {
        title: 'Ruby cannot find that name',
        explanation: 'Ruby does not know this name yet.',
        location: 'main.rb · line 2',
        steps: ['Check spelling.', 'Assign the value.', 'Run again.'],
        guideTopicId: 'ruby-variables-types',
      },
    }))

    expect(screen.queryByRole('dialog', { name: 'Ruby learning' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Fix this error' }))
    expect(screen.getByRole('dialog', { name: 'Ruby learning' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Coach/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('creates a practice project with the retained Coach guide language', async () => {
    const user = userEvent.setup()
    render(<App />)

    act(() => runnerHarness.onErrorAdviceChange?.({
      kind: 'java',
      advice: {
        title: 'Java cannot find that name',
        explanation: 'The compiler cannot see it.',
        location: 'Main.java · line 4',
        steps: ['Check spelling.', 'Declare the name.', 'Run again.'],
        guideTopicId: 'java-variables-types',
      },
    }))
    await user.click(screen.getByRole('button', { name: 'Review Variables and types' }))
    await user.click(screen.getByRole('button', { name: 'Try example' }))

    const updatedLibrary = storedLibrary()
    const practiceProject = updatedLibrary.projects.find((candidate) => candidate.id === updatedLibrary.activeProjectId)!
    const topic = languageGuideFor('java').topics.find((candidate) => candidate.id === 'java-variables-types')!
    expect(practiceProject).toMatchObject({
      kind: 'java',
      entryPath: topic.practiceProject.entryPath,
      files: topic.practiceProject.files,
    })
    expect(screen.getByLabelText('Project name')).toHaveProperty('value', topic.practiceProject.title)
  })

  it('starts an all-language lab challenge as a separate private project', async () => {
    const user = userEvent.setup()
    render(<App />)

    const originalProject = storedLibrary().projects[0]
    const challenge = practiceChallengeById('java-variables-greeting')!
    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(within(screen.getByRole('navigation', { name: 'Practice languages' })).getByRole('button', { name: 'Java' }))
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])

    await waitFor(() => expect(storedLibrary().projects).toHaveLength(2))
    const updatedLibrary = storedLibrary()
    const practiceProject = updatedLibrary.projects.find((candidate) => candidate.id === updatedLibrary.activeProjectId)!

    expect(updatedLibrary.projects.find((candidate) => candidate.id === originalProject.id)).toEqual(originalProject)
    expect(practiceProject).toMatchObject({
      title: challenge.project.title,
      kind: 'java',
      visibility: 'private',
      entryPath: challenge.project.entryPath,
      files: challenge.project.files,
    })
    expect(practiceChallengeIdForProject(practiceProject.id)).toBe(challenge.id)
    expect(screen.getByRole('heading', { name: challenge.title })).toBeTruthy()
  })

  it('starts the next unfinished challenge directly after a passing result', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])
    fireEvent.change(screen.getByLabelText('Code editor'), {
      target: { value: 'name = "Lina"\nlessons = 4\nputs "Hafa adai, #{name}!"\nputs "Lessons: #{lessons}"\n' },
    })
    await user.click(screen.getByRole('button', { name: 'Check my work' }))
    act(() => runnerHarness.onRunComplete?.({
      status: 'success',
      stdout: 'Hafa adai, Lina!\nLessons: 4\n',
      stderr: '',
      durationMs: 12,
    }))

    expect(screen.getByText('Up next · Starter')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Next challenge' }))

    await waitFor(() => expect(storedLibrary().projects).toHaveLength(3))
    expect(screen.getByLabelText('Project name')).toHaveProperty('value', 'Practice · Ruby Order Total')
    expect(screen.getByRole('heading', { name: 'Calculate an order total' })).toBeTruthy()
  })

  it('skips completed challenges and returns to the highlighted recommendation in the lab', async () => {
    const user = userEvent.setup()
    completePracticeChallenge('ruby-arithmetic-total')
    const { container } = render(<App />)

    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])
    fireEvent.change(screen.getByLabelText('Code editor'), {
      target: { value: 'name = "Lina"\nlessons = 4\nputs "Hafa adai, #{name}!"\nputs "Lessons: #{lessons}"\n' },
    })
    await user.click(screen.getByRole('button', { name: 'Check my work' }))
    act(() => runnerHarness.onRunComplete?.({
      status: 'success', stdout: 'Hafa adai, Lina!\nLessons: 4\n', stderr: '', durationMs: 12,
    }))

    expect(screen.getByText('Up next · Starter')).toBeTruthy()
    expect(screen.getByText('Choose an access message')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back to Practice Lab' }))

    const practicePanel = screen.getByRole('tabpanel', { name: 'Practice lab' })
    expect(within(practicePanel).getByRole('button', { name: /Ruby 2\/15/ }).getAttribute('aria-current')).toBe('page')
    expect(within(practicePanel).getByText('Your place')).toBeTruthy()
    expect(container.querySelector('[data-practice-challenge-id="ruby-conditional-access"]')?.classList.contains('current')).toBe(true)
  })

  it('wraps from the last challenge to an unfinished earlier challenge', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(within(screen.getByLabelText('Challenge filters')).getByRole('button', { name: 'Stretch' }))
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' }).at(-1)!)
    fireEvent.change(screen.getByLabelText('Code editor'), {
      target: { value: 'requests = [{ name: "Card question", priority: 1 }, { name: "Password reset", priority: 3 }, { name: "Address update", priority: 2 }]\nranked = requests.sort_by { |request| -request[:priority] }\nputs ranked.map { |request| request[:name] }.join(" > ")\n' },
    })
    await user.click(screen.getByRole('button', { name: 'Check my work' }))
    act(() => runnerHarness.onRunComplete?.({
      status: 'success', stdout: 'Password reset > Address update > Card question\n', stderr: '', durationMs: 12,
    }))

    expect(screen.getByText('Up next · Starter')).toBeTruthy()
    expect(screen.getByText('Build a greeting')).toBeTruthy()
  })

  it('shows the language-complete fallback after the final unfinished challenge', async () => {
    const user = userEvent.setup()
    practiceChallengesFor('ruby').slice(1).forEach((challenge) => completePracticeChallenge(challenge.id))
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])
    fireEvent.change(screen.getByLabelText('Code editor'), {
      target: { value: 'name = "Lina"\nlessons = 4\nputs "Hafa adai, #{name}!"\nputs "Lessons: #{lessons}"\n' },
    })
    await user.click(screen.getByRole('button', { name: 'Check my work' }))
    act(() => runnerHarness.onRunComplete?.({
      status: 'success', stdout: 'Hafa adai, Lina!\nLessons: 4\n', stderr: '', durationMs: 12,
    }))

    expect(screen.getByText('Language complete')).toBeTruthy()
    expect(screen.getByText('You finished every ruby challenge.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Next challenge' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Explore Practice Lab' })).toBeTruthy()
  })

  it('ignores a delayed practice result after the learner switches projects', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])
    await user.click(screen.getByRole('button', { name: 'Check my work' }))
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: /^Ruby Playground Ruby/ })[0])
    act(() => runnerHarness.onRunComplete?.({
      status: 'success',
      stdout: 'Hafa adai, Lina!\nLessons: 4\n',
      stderr: '',
      durationMs: 12,
    }))

    expect(screen.getByLabelText('Project name')).toHaveProperty('value', 'Ruby Playground')
    expect(screen.queryByText('Challenge complete')).toBeNull()
    expect(completedPracticeChallengeIds()).toEqual([])
  })

  it('checks the code snapshot that was sent to the runner', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])
    fireEvent.change(screen.getByLabelText('Code editor'), {
      target: { value: 'name = "Lina"\nlessons = 4\nputs "Hafa adai, #{name}!"\nputs "Lessons: #{lessons}"\n' },
    })
    await user.click(screen.getByRole('button', { name: 'Check my work' }))

    fireEvent.change(screen.getByLabelText('Code editor'), { target: { value: 'puts "edited while running"\n' } })
    act(() => runnerHarness.onRunComplete?.({
      status: 'success',
      stdout: 'Hafa adai, Lina!\nLessons: 4\n',
      stderr: '',
      durationMs: 12,
    }))

    expect(screen.getByText('Challenge complete')).toBeTruthy()
  })

  it('keeps a new practice check pending after cancelling an older run', async () => {
    const user = userEvent.setup()
    const relayRunnerCancellation = () => runnerHarness.onRunCancel?.()
    window.addEventListener('hafa-code-cancel-active-run', relayRunnerCancellation)

    try {
      render(<App />)
      await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
      await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])
      fireEvent.change(screen.getByLabelText('Code editor'), {
        target: { value: 'name = "Lina"\nlessons = 4\nputs "Hafa adai, #{name}!"\nputs "Lessons: #{lessons}"\n' },
      })

      await user.click(screen.getByRole('button', { name: 'Check my work' }))
      act(() => runnerHarness.onRunComplete?.({
        status: 'success',
        stdout: 'Hafa adai, Lina!\nLessons: 4\n',
        stderr: '',
        durationMs: 12,
      }))

      expect(screen.getByText('Challenge complete')).toBeTruthy()
    } finally {
      window.removeEventListener('hafa-code-cancel-active-run', relayRunnerCancellation)
    }
  })

  it('restores the challenge panel for a practice conflict copy', async () => {
    const user = userEvent.setup()
    const view = render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])

    const currentLibrary = storedLibrary()
    const practiceProject = currentLibrary.projects.find((candidate) => candidate.id === currentLibrary.activeProjectId)!
    const conflictCopy = createConflictCopy(practiceProject)
    preservePracticeConflictLinks(practiceProject.id, conflictCopy.id, practiceProject.id)
    view.unmount()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeProjectId: conflictCopy.id,
      projects: [conflictCopy, ...currentLibrary.projects],
    }))

    render(<App />)

    expect(practiceChallengeIdForProject(conflictCopy.id)).toBe('ruby-variables-greeting')
    expect(screen.getByRole('heading', { name: 'Build a greeting' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Check my work' })).toBeTruthy()
  })

  it('lets the learner retry after manually stopping a practice run', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])
    await user.click(screen.getByRole('button', { name: 'Check my work' }))

    act(() => runnerHarness.onRunComplete?.({
      status: 'stopped',
      stdout: '',
      stderr: 'Execution stopped.',
      durationMs: 5,
    }))

    expect(screen.getByRole('button', { name: 'Check my work' })).toBeTruthy()
    expect(screen.queryByText(/almost there/i)).toBeNull()
  })

  it('recovers if a practice runner never reports an outcome', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Check my work' }))

    act(() => vi.advanceTimersByTime(RUNNER_STARTUP_TIMEOUT_MS + RUNNER_TIMEOUT_MS + 2_000))

    expect(screen.getByRole('button', { name: 'Check my work' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/ended before a result arrived/i)
  })

  it('shows and confirms the destination before duplicating a project', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(storedLibrary().projects).toHaveLength(1)

    await user.click(within(await openProjectMenu(user)).getByRole('button', { name: 'Duplicate' }))

    const dialog = screen.getByRole('dialog', { name: 'Where should the copy live?' })
    expect(within(dialog).getByRole('radio', { name: /Personal projects/ })).toHaveProperty('checked', true)
    expect(storedLibrary().projects).toHaveLength(1)

    await user.click(within(dialog).getByRole('button', { name: 'Duplicate here' }))

    await waitFor(() => expect(storedLibrary().projects).toHaveLength(2))
    expect(screen.getByRole('status').textContent).toMatch(/duplicated into Personal projects/i)
    expect(screen.queryByRole('dialog', { name: 'Where should the copy live?' })).toBeNull()
  })

  it('keeps a failed cloud copy retryable and sends the selected classroom', async () => {
    const user = userEvent.setup()
    const cloudProject = {
      ...createConflictCopy(createProject('ruby')),
      id: '42',
      title: 'Cloud starter',
      owner: { id: 7, fullName: 'Student One' },
      organizationId: null,
      organization: null,
      lockVersion: 3,
    }
    const cloudCopy = {
      ...cloudProject,
      id: '43',
      title: 'Cloud starter Copy',
      organizationId: '20',
      organization: { id: 20, name: 'Robotics', slug: 'robotics' },
      lockVersion: 0,
    }
    authHarness.value = {
      isSignedIn: true,
      isLoading: false,
      user: { id: 7, email: 'student@example.com', first_name: 'Student', last_name: 'One', full_name: 'Student One', role: 'user' },
      organizations: [{ id: 20, name: 'Robotics', slug: 'robotics', role: 'student' }],
      syncSession: vi.fn(),
      cloudAuth: TEST_CLOUD_AUTH,
    }
    vi.spyOn(api, 'getProjects').mockResolvedValue({ data: [cloudProject], error: null })
    vi.spyOn(api, 'getProjectComments').mockResolvedValue({ data: { comments: [], unread_count: 0 }, error: null })
    const updateProject = vi.spyOn(api, 'updateProject').mockResolvedValue({
      data: cloudProject,
      error: null,
      status: 200,
      code: null,
      conflictProject: null,
    })
    // The unsynced local starter also saves to the cloud; keep that quiet so it cannot replace the copy notice.
    vi.spyOn(api, 'createProject').mockImplementation(async (localProject) => ({ data: { ...localProject, id: '99' }, error: null, status: 201, code: null, conflictProject: null }) as never)
    const duplicateCloudProject = vi.spyOn(api, 'duplicateProject')
      .mockResolvedValueOnce({ data: null, error: 'Classroom service unavailable' })
      .mockResolvedValueOnce({ data: cloudCopy, error: null })

    render(<App />)
    await user.click((await screen.findAllByRole('button', { name: /^Cloud starter Ruby/ }))[0])
    expect(screen.getByLabelText('Project name')).toHaveProperty('value', 'Cloud starter')
    await user.click(within(await openProjectMenu(user)).getByRole('button', { name: 'Duplicate' }))
    const dialog = screen.getByRole('dialog', { name: 'Where should the copy live?' })
    await user.click(within(dialog).getByRole('radio', { name: /Robotics/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Duplicate here' }))

    // A failed copy is an error toast, announced as an alert.
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Classroom service unavailable/i))
    expect(duplicateCloudProject).toHaveBeenLastCalledWith('42', '20')
    expect(within(dialog).getByRole('button', { name: 'Duplicate here' })).toHaveProperty('disabled', false)
    expect(updateProject).toHaveBeenCalledWith(expect.objectContaining({ id: '42' }))

    await user.click(within(dialog).getByRole('button', { name: 'Duplicate here' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Where should the copy live?' })).toBeNull())
    expect(duplicateCloudProject).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status').textContent).toMatch(/duplicated into Robotics/i)
  })

  it('keeps the selected cloud copy when another autosave completes in the same turn', async () => {
    const user = userEvent.setup()
    const source = { ...createProject('ruby'), id: '42', title: 'Cloud starter', owner: { id: 7, fullName: 'Student One' }, lockVersion: 0 }
    const copy = { ...source, id: '43', title: 'Cloud starter Copy' }
    authHarness.value = {
      isSignedIn: true, isLoading: false,
      user: { id: 7, email: 'student@example.com', first_name: 'Student', last_name: 'One', full_name: 'Student One', role: 'user' },
      organizations: [], syncSession: vi.fn(), cloudAuth: TEST_CLOUD_AUTH,
    }
    vi.spyOn(api, 'getProjects').mockResolvedValue({ data: [source], error: null })
    vi.spyOn(api, 'getProjectComments').mockResolvedValue({ data: { comments: [], unread_count: 0 }, error: null })
    vi.spyOn(api, 'getCheckpoints').mockResolvedValue({ data: [], error: null })
    vi.spyOn(api, 'updateProject').mockResolvedValue({ data: source, error: null, status: 200, code: null, conflictProject: null })
    let resolveCreate!: (result: Awaited<ReturnType<typeof api.createProject>>) => void
    const createResult = new Promise<Awaited<ReturnType<typeof api.createProject>>>((resolve) => { resolveCreate = resolve })
    const create = vi.spyOn(api, 'createProject').mockReturnValue(createResult)
    let resolveDuplicate!: (result: Awaited<ReturnType<typeof api.duplicateProject>>) => void
    const duplicateResult = new Promise<Awaited<ReturnType<typeof api.duplicateProject>>>((resolve) => { resolveDuplicate = resolve })
    const duplicate = vi.spyOn(api, 'duplicateProject').mockReturnValue(duplicateResult)

    render(<App />)
    await waitFor(() => expect(create).toHaveBeenCalled(), { timeout: 2_000 })
    const autosavingProject = create.mock.calls[0][0]
    await user.click(screen.getAllByRole('button', { name: /^Cloud starter Ruby/ })[0])
    await user.click(within(await openProjectMenu(user)).getByRole('button', { name: 'Duplicate' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Where should the copy live?' })).getByRole('button', { name: 'Duplicate here' }))
    await waitFor(() => expect(duplicate).toHaveBeenCalled())
    await act(async () => {
      resolveDuplicate({ data: copy, error: null })
      resolveCreate({ data: { ...autosavingProject, id: '44', owner: source.owner, lockVersion: 0 }, error: null, status: 201, code: null, conflictProject: null })
      await Promise.all([duplicateResult, createResult])
    })
    expect(screen.getByLabelText('Project name')).toHaveProperty('value', 'Cloud starter Copy')
    expect(storedLibrary().activeProjectId).toBe('43')
    expect(storedLibrary().projects.some((candidate) => candidate.id === '43')).toBe(true)
    expect(storedLibrary().projects.some((candidate) => candidate.id === '44')).toBe(true)
  })

  it('keeps student source out of teacher workspace storage until a review is opened', async () => {
    const user = userEvent.setup()
    const organization = { id: 20, name: 'Robotics', slug: 'robotics', role: 'instructor' as const }
    const student = {
      id: 8,
      membership_id: 18,
      email: 'student@example.com',
      first_name: 'Student',
      last_name: 'One',
      full_name: 'Student One',
      role: 'user',
      organization_role: 'student' as const,
      joined_at: '2026-09-01T00:00:00Z',
    }
    const summary = {
      id: '42',
      title: 'Student loops',
      kind: 'ruby' as const,
      entryPath: 'main.rb',
      visibility: 'private' as const,
      organizationId: '20',
      owner: { id: 8, fullName: 'Student One' },
      organization: { id: 20, name: 'Robotics', slug: 'robotics' },
      archivedAt: null,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-05T00:00:00Z',
      fileCount: 1,
      unresolvedFeedbackCount: 1,
    }
    const reviewedProject = {
      ...createProject('ruby'),
      id: '42',
      title: 'Student loops',
      organizationId: '20',
      organization,
      owner: { id: 8, fullName: 'Student One' },
      files: [{ path: 'main.rb', language: 'ruby' as const, content: 'puts "student secret"' }],
    }
    authHarness.value = {
      isSignedIn: true,
      isLoading: false,
      user: { id: 7, email: 'teacher@example.com', first_name: 'Tess', last_name: 'Teacher', full_name: 'Tess Teacher', role: 'user' },
      organizations: [organization],
      syncSession: vi.fn(),
      cloudAuth: TEST_CLOUD_AUTH,
    }
    const getProjects = vi.spyOn(api, 'getProjects').mockResolvedValue({ data: [], error: null })
    vi.spyOn(api, 'getOrgMembers').mockResolvedValue({ data: [student], error: null })
    vi.spyOn(api, 'getOrgInvitations').mockResolvedValue({ data: [], error: null })
    vi.spyOn(api, 'getOrganizationProjects').mockResolvedValue({ data: [summary], error: null })
    const getProject = vi.spyOn(api, 'getProject').mockResolvedValue({ data: reviewedProject, error: null })
    vi.spyOn(api, 'getProjectComments').mockResolvedValue({ data: { comments: [], unread_count: 0 }, error: null })
    vi.spyOn(api, 'getCheckpoints').mockResolvedValue({ data: [], error: null })

    render(<App />)
    await user.selectOptions(within(await openSettings(user)).getByLabelText('Switch workspace'), '20')
    await waitFor(() => expect(getProjects).toHaveBeenCalledWith('20', { ownedOnly: true }))
    await user.click(screen.getByRole('button', { name: 'Classroom' }))
    expect(await screen.findByText('Student loops')).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('student secret')

    await user.click(screen.getByRole('button', { name: 'Open review' }))
    await waitFor(() => expect(getProject).toHaveBeenCalledWith('42'))
    expect(screen.getByLabelText('Project name')).toHaveProperty('value', 'Student loops')
    expect(screen.getByLabelText('Project name')).toHaveProperty('disabled', true)
    expect(screen.getByLabelText('Code editor')).toHaveProperty('value', 'puts "student secret"')
    const actions = await openProjectMenu(user)
    expect(within(actions).getByRole('button', { name: 'Archive' })).toHaveProperty('disabled', true)
    expect(within(actions).getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', true)
    expect(within(actions).getByRole('button', { name: 'Duplicate' })).toHaveProperty('disabled', false)
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('student secret')
  })

  describe('pilot learner trust', () => {
    it('shows the guide for the open project language, not the language the page started with', async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getAllByRole('button', { name: 'Python' })[0])
      await user.click(screen.getAllByRole('button', { name: /practice lab/i })[0])
      await user.click(screen.getByRole('tab', { name: /Guide/ }))
      expect(screen.getByRole('complementary', { name: 'Python learning' })).toBeTruthy()
      expect(screen.queryByRole('complementary', { name: 'Ruby learning' })).toBeNull()
    })

    it('numbers a second default project instead of repeating its name', async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getAllByRole('button', { name: 'Python' })[0])
      await user.click(screen.getAllByRole('button', { name: 'Python' })[0])
      expect(storedLibrary().projects.map((project) => project.title)).toEqual(['Python Playground (2)', 'Python Playground', 'Ruby Playground'])
      expect(screen.getAllByText('1 file · entry main.py').length).toBeGreaterThan(0)
    })

    it('restores a default name when the project name is cleared', async () => {
      const user = userEvent.setup()
      render(<App />)
      const name = screen.getByLabelText('Project name')
      await user.clear(name)
      await user.type(name, '   {Enter}')
      expect(name).toHaveProperty('value', 'Ruby Playground')
      expect(name.getAttribute('maxlength')).toBe('120')
    })

    it('asks before Share creates a server snapshot', async () => {
      const user = userEvent.setup()
      const createShare = vi.spyOn(api, 'createShare').mockResolvedValue({ data: { token: 'abc' } as never, error: null })
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
      render(<App />)
      await user.click(screen.getAllByRole('button', { name: 'Share' })[0])
      expect(screen.getByRole('dialog', { name: 'Share a copy of this project?' }).textContent).toContain('Anyone with the link can open and copy this snapshot for 30 days')
      expect(createShare).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(createShare).not.toHaveBeenCalled()

      await user.click(screen.getAllByRole('button', { name: 'Share' })[0])
      await user.click(screen.getByRole('button', { name: 'Create share link' }))
      await waitFor(() => expect(createShare).toHaveBeenCalledOnce())
      expect(await screen.findByRole('dialog', { name: 'Copy project link' })).toBeTruthy()
      expect((screen.getByLabelText('Share URL') as HTMLInputElement).value).toMatch(/#share=abc$/)
    })

    it('asks again before falling back to an offline link when the server share fails', async () => {
      const user = userEvent.setup()
      const createShare = vi.spyOn(api, 'createShare').mockResolvedValue({ data: null, error: 'Service unavailable' })
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      render(<App />)
      await user.click(screen.getAllByRole('button', { name: 'Share' })[0])
      await user.click(screen.getByRole('button', { name: 'Create share link' }))
      const failed = await screen.findByRole('dialog', { name: 'The share link could not be created' })
      expect(failed.textContent).toContain('It does not expire')
      expect(writeText).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      await waitFor(() => expect(createShare).toHaveBeenCalledTimes(2))
      await user.click(await screen.findByRole('button', { name: 'Create offline link' }))
      expect(await screen.findByRole('dialog', { name: 'Copy project link' })).toBeTruthy()
      expect((screen.getByLabelText('Share URL') as HTMLInputElement).value).toMatch(/#project=[A-Za-z0-9_-]+$/)
      expect(writeText).toHaveBeenCalledOnce()
    })

    it('ignores a share link that finishes after the learner closed Share', async () => {
      const user = userEvent.setup()
      let finish: (value: Awaited<ReturnType<typeof api.createShare>>) => void = () => {}
      vi.spyOn(api, 'createShare').mockImplementation(() => new Promise((resolve) => { finish = resolve }))
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      render(<App />)
      await user.click(screen.getAllByRole('button', { name: 'Share' })[0])
      await user.click(screen.getByRole('button', { name: 'Create share link' }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await user.click(screen.getAllByRole('button', { name: 'Share' })[0])
      await act(async () => { finish({ data: { token: 'stale' } as never, error: null }) })
      expect(writeText).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Share a copy of this project?' })).toBeTruthy()
    })

    it('copies the code in the open file from the editor header', async () => {
      const user = userEvent.setup()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      render(<App />)
      await user.click(screen.getByRole('button', { name: 'Copy code' }))
      expect(writeText).toHaveBeenCalledWith(storedLibrary().projects[0].files[0].content)
      expect(screen.getByRole('button', { name: 'Code copied' })).toBeTruthy()
    })

    it('downloads a one-file project as source code', async () => {
      const user = userEvent.setup()
      const createObjectURL = vi.fn(() => 'blob:hafa')
      Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
      Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      render(<App />)
      await user.click(within(await openProjectMenu(user)).getByRole('button', { name: 'Download code (.rb)' }))
      expect(click).toHaveBeenCalled()
      expect(screen.getByText(/Downloaded ruby-playground.rb/)).toBeTruthy()
    })
  
  describe('lesson handoff', () => {
    const LESSON_URL = 'https://learn.codeschoolofguam.com/lessons/42'
    const starterCode = 'def total(items):\n    pass\n'
    const lessonLink = () => {
      const url = new URL(buildStarterLink({
        title: 'Expense summary project',
        kind: 'python',
        files: [{ path: 'expense_summary.py', content: starterCode }],
        starterKey: 'csg-python-pilot:project',
        returnUrl: LESSON_URL,
        returnLabel: 'Independent expense-summary project',
      }).url)
      return `${url.pathname}${url.search}${url.hash}`
    }

    beforeEach(() => resetLessonLinksCache())
    afterEach(() => window.history.replaceState(null, '', '/'))

    it('shows Back to your lesson, the school badge, and Copy code for Learn, with Run still the only primary', async () => {
      const user = userEvent.setup()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      window.history.replaceState(null, '', lessonLink())
      render(<App />)

      const bar = screen.getByRole('region', { name: 'Lesson' })
      const back = within(bar).getByRole('link', { name: /Back to your lesson/ })
      expect(back.getAttribute('href')).toBe(LESSON_URL)
      expect(back.getAttribute('target')).toBeNull()
      expect(within(bar).getByText('Code School of Guam')).toBeTruthy()
      expect(within(bar).getByText('Independent expense-summary project')).toBeTruthy()
      const primaries = [...document.querySelectorAll('.coding-stage button.primary, .app-bar button.primary')]
      expect(primaries.every((button) => button.hasAttribute('data-hafa-run-button'))).toBe(true)

      await user.click(within(bar).getByRole('button', { name: /Copy code for Learn/ }))
      expect(writeText).toHaveBeenCalledWith(starterCode)
      expect(screen.getByText('Code copied. Paste it into the lesson’s submission box.')).toBeTruthy()
      expect(within(bar).getByRole('button', { name: 'Copied' })).toBeTruthy()
    })

    it('explains how to copy by hand when the clipboard is blocked', async () => {
      const user = userEvent.setup()
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
      window.history.replaceState(null, '', lessonLink())
      render(<App />)
      await user.click(screen.getByRole('button', { name: /Copy code for Learn/ }))
      expect(screen.getByText(/Clipboard blocked. Select the code in the editor/)).toBeTruthy()
    })

    it('keeps the lesson bar after a reload and only on the project that came from the lesson', async () => {
      const user = userEvent.setup()
      window.history.replaceState(null, '', lessonLink())
      const first = render(<App />)
      expect(screen.getByRole('region', { name: 'Lesson' })).toBeTruthy()
      first.unmount()

      window.history.replaceState(null, '', '/')
      render(<App />)
      expect(screen.getByRole('region', { name: 'Lesson' })).toBeTruthy()
      await user.click(screen.getAllByRole('button', { name: 'Python' })[0])
      expect(screen.queryByRole('region', { name: 'Lesson' })).toBeNull()
    })

    it('leaves the lesson target out of offline Share links', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'createShare').mockResolvedValue({ data: null, error: 'Service unavailable' })
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
      window.history.replaceState(null, '', lessonLink())
      render(<App />)
      await user.click(screen.getAllByRole('button', { name: 'Share' })[0])
      await user.click(screen.getByRole('button', { name: 'Create share link' }))
      await user.click(await screen.findByRole('button', { name: 'Create offline link' }))
      const shareUrl = (await screen.findByLabelText('Share URL') as HTMLInputElement).value
      expect(shareUrl).not.toMatch(/return|starter|codeschoolofguam/)
    })

    it('reopens edited work from the lesson link and offers a non-destructive Start over', async () => {
      const user = userEvent.setup()
      window.history.replaceState(null, '', lessonLink())
      const first = render(<App />)
      fireEvent.change(screen.getByLabelText('Code editor'), { target: { value: 'print("my work")\n' } })
      await waitFor(() => expect(storedLibrary().projects[0].files[0].content).toBe('print("my work")\n'))
      first.unmount()

      window.history.replaceState(null, '', lessonLink())
      render(<App />)
      expect(screen.getByLabelText('Code editor')).toHaveProperty('value', 'print("my work")\n')
      // Another tab opens a different lesson link meanwhile; Start over must not drop its record.
      const stored = JSON.parse(localStorage.getItem('hafa-code-lesson-links-v1')!)
      stored.projects['other-tab-project'] = { returnUrl: 'https://learn.codeschoolofguam.com/lessons/7', returnLabel: 'Lesson 7', starterKey: 'csg:lesson-7', updatedAt: new Date().toISOString() }
      stored.starters['csg:lesson-7'] = 'other-tab-project'
      localStorage.setItem('hafa-code-lesson-links-v1', JSON.stringify(stored))
      const toast = screen.getByText('Welcome back. Your saved work on “Expense summary project” is open.').closest('.toast') as HTMLElement
      await user.click(within(toast).getByRole('button', { name: 'Start over' }))
      expect(JSON.parse(localStorage.getItem('hafa-code-lesson-links-v1')!).starters).toMatchObject({ 'csg:lesson-7': 'other-tab-project' })

      await waitFor(() => expect(storedLibrary().projects).toHaveLength(2))
      expect(screen.getByLabelText('Code editor')).toHaveProperty('value', starterCode)
      expect(screen.getByLabelText('Project name')).toHaveProperty('value', 'Expense summary project (2)')
      expect(storedLibrary().projects.find((project) => project.title === 'Expense summary project')?.files[0].content).toBe('print("my work")\n')
      expect(screen.getByText(/Your earlier work is still in Projects/)).toBeTruthy()
      expect(screen.getByRole('region', { name: 'Lesson' })).toBeTruthy()
    })
  })

  describe('learner-first hierarchy', () => {
    it('welcomes a first visit, then collapses to the app bar once a Python project exists', async () => {
      const user = userEvent.setup()
      render(<App />)
      expect(screen.getByRole('heading', { level: 1, name: 'Hafa Code' })).toBeTruthy()
      const welcome = document.querySelector<HTMLElement>('.welcome-hero')!
      expect(welcome.getAttribute('aria-labelledby')).toBe('welcome-title')
      await user.click(within(welcome).getByRole('button', { name: 'New Python project' }))
      expect(document.querySelector('.welcome-hero')).toBeNull()
      expect(screen.getByLabelText('Project name')).toHaveProperty('value', 'Python Playground')
      expect(document.querySelector('.app-bar')).toBeTruthy()
    })

    it('shows only the compact app bar to a returning learner', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeProjectId: 'p1', projects: [{ ...createProject('python', 'Expenses'), id: 'p1' }] }))
      render(<App />)
      expect(document.querySelector('.welcome-hero')).toBeNull()
      expect(screen.getByLabelText('Project name')).toHaveProperty('value', 'Expenses')
      // Share is a secondary action; Archive and Delete wait in the More menu.
      expect(screen.getByRole('button', { name: 'Share' }).className).not.toContain('primary')
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    })

    it('keeps Run as the only primary action in the workspace', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeProjectId: 'p1', projects: [{ ...createProject('python', 'Expenses'), id: 'p1' }] }))
      render(<App />)
      const primaries = [...document.querySelectorAll('.coding-stage button.primary, .app-bar button.primary')]
      expect(primaries.length).toBeGreaterThan(0)
      expect(primaries.every((button) => button.hasAttribute('data-hafa-run-button'))).toBe(true)
    })

    it('tones toasts by meaning and lets info leave on its own', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await user.click(screen.getAllByRole('button', { name: 'Python' })[0])
      const toast = document.querySelector('.floating-dock .toast')!
      expect(toast.getAttribute('data-tone')).toBe('success')
      expect(toast.getAttribute('role')).toBe('status')
      act(() => { vi.advanceTimersByTime(4_100) })
      expect(document.querySelector('.floating-dock .toast')).toBeNull()
    })
  })
})
})
