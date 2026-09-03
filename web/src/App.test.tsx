import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { languageGuideFor } from './lib/languageGuides'
import { practiceChallengeById } from './lib/practiceLab'
import { practiceChallengeIdForProject } from './lib/practiceProgress'
import type { ProjectLibrary } from './lib/projectStorage'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value?: string }) => (
    <textarea aria-label="Code editor" readOnly value={value ?? ''} />
  ),
}))

const runnerHarness = vi.hoisted(() => ({
  onRunComplete: undefined as undefined | ((outcome: { status: 'success'; stdout: string; stderr: string; durationMs: number }) => void),
}))

vi.mock('./components/RunnerPanel', () => ({
  RunnerPanel: ({ onRunComplete }: { onRunComplete?: typeof runnerHarness.onRunComplete }) => {
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

  afterEach(cleanup)

  it('opens a complete example in a new private project without changing the original', async () => {
    const user = userEvent.setup()
    render(<App />)

    const initialLibrary = storedLibrary()
    const originalProject = initialLibrary.projects[0]
    const topic = languageGuideFor('ruby').topics.find((candidate) => candidate.id === 'ruby-variables-types')!

    await user.click(screen.getAllByRole('button', { name: 'Ruby guide' })[0])
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
  })
})
