import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LEARNING_SIDECAR_OVERLAY_QUERY } from './components/LearningSidecar'
import { RUNNER_STARTUP_TIMEOUT_MS, RUNNER_TIMEOUT_MS } from './lib/codeRunner'
import type { ErrorCoachContext } from './lib/errorCoach'
import { languageGuideFor } from './lib/languageGuides'
import { practiceChallengeById } from './lib/practiceLab'
import { completedPracticeChallengeIds, practiceChallengeIdForProject, preservePracticeConflictLinks } from './lib/practiceProgress'
import { createConflictCopy } from './lib/projectStorage'
import type { ProjectLibrary } from './lib/projectStorage'
import type { RunnerOutcome } from './lib/runnerOutcome'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="Code editor" value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
  ),
}))

const runnerHarness = vi.hoisted(() => ({
  onErrorAdviceChange: undefined as undefined | ((context: ErrorCoachContext) => void),
  onRunCancel: undefined as undefined | (() => void),
  onRunComplete: undefined as undefined | ((outcome: RunnerOutcome) => void),
}))

vi.mock('./components/RunnerPanel', () => ({
  RunnerPanel: ({ onErrorAdviceChange, onRunCancel, onRunComplete }: {
    onErrorAdviceChange?: typeof runnerHarness.onErrorAdviceChange
    onRunCancel?: typeof runnerHarness.onRunCancel
    onRunComplete?: typeof runnerHarness.onRunComplete
  }) => {
    runnerHarness.onErrorAdviceChange = onErrorAdviceChange
    runnerHarness.onRunCancel = onRunCancel
    runnerHarness.onRunComplete = onRunComplete
    return <section aria-label="Test runner" />
  },
}))

const STORAGE_KEY = 'hafa-code-projects-v2'

function storedLibrary() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ProjectLibrary
}

describe('App language guide practice projects', () => {
  beforeEach(() => {
    localStorage.clear()
    runnerHarness.onErrorAdviceChange = undefined
    runnerHarness.onRunCancel = undefined
    runnerHarness.onRunComplete = undefined
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
    await user.type(screen.getByRole('searchbox'), 'variables')
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

  it('ignores a delayed practice result after the learner switches projects', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: 'Practice' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Start challenge' })[0])
    await user.click(screen.getByRole('button', { name: 'Check my work' }))
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: 'Ruby Playground Ruby' })[0])
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
})
