import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { projectKindDefinition } from '../lib/codeRunner'
import type { RunnerRequest, RunnerResponse } from '../workers/runnerProtocol'
import { RunnerPanel } from './RunnerPanel'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<RunnerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  messages: RunnerRequest[] = []
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: RunnerRequest) {
    this.messages.push(message)
  }

  terminate() {
    this.terminated = true
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') this.onmessage = listener as (event: MessageEvent<RunnerResponse>) => void
    if (type === 'error') this.onerror = listener as (event: ErrorEvent) => void
  }

  removeEventListener(type: string, listener: EventListener) {
    if (type === 'message' && this.onmessage === listener) this.onmessage = null
    if (type === 'error' && this.onerror === listener) this.onerror = null
  }

  respond(message: RunnerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<RunnerResponse>)
  }
}

const project = {
  id: 'python-project',
  title: 'Python Playground',
  kind: 'python' as const,
  visibility: 'private' as const,
  organizationId: null,
  entryPath: 'main.py',
  files: [{ path: 'main.py', language: 'python' as const, content: 'print("Hafa adai")' }],
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
}

const javaProject = {
  ...project,
  id: 'java-project',
  title: 'Java Playground',
  kind: 'java' as const,
  entryPath: projectKindDefinition('java').entryPath,
  files: [{ path: 'Main.java', language: 'java' as const, content: 'public class Main {}' }],
}

describe('RunnerPanel', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: vi.fn(), configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reuses a warm worker and offers a touch-friendly input submit action', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<RunnerPanel project={project} entryFile={project.files[0]} />)

    await user.click(screen.getByRole('button', { name: 'Run Python' }))
    expect(screen.getByText('Preparing Python…')).toBeTruthy()
    expect(FakeWorker.instances).toHaveLength(1)

    const worker = FakeWorker.instances[0]
    const firstRun = worker.messages.find((message) => message.type === 'run')
    expect(firstRun?.type).toBe('run')
    if (!firstRun || firstRun.type !== 'run') throw new Error('Expected a run request')

    act(() => worker.respond({ id: firstRun.id, type: 'started' }))
    expect(screen.getByText('Running main.py…')).toBeTruthy()
    act(() => worker.respond({ id: firstRun.id, type: 'input_request' }))

    await user.type(screen.getByLabelText('Program input'), 'Leon')
    await user.click(screen.getByRole('button', { name: 'Submit program input' }))
    expect(worker.messages.at(-1)).toEqual({ id: firstRun.id, type: 'stdin', value: 'Leon' })

    act(() => worker.respond({ id: firstRun.id, type: 'result', stdout: 'Hello Leon\n', stderr: '', durationMs: 25 }))
    await user.click(await screen.findByRole('button', { name: 'Run again' }))

    expect(FakeWorker.instances).toHaveLength(1)
    expect(worker.messages.filter((message) => message.type === 'run')).toHaveLength(2)

    unmount()
    await waitFor(() => expect(worker.terminated).toBe(true))
  })

  it('cancels an overlapping run without leaving a timer that can stop its replacement', () => {
    vi.useFakeTimers()
    const { unmount } = render(<RunnerPanel project={project} entryFile={project.files[0]} />)

    act(() => {
      window.dispatchEvent(new Event('hafa-code-run-active-project'))
      window.dispatchEvent(new Event('hafa-code-run-active-project'))
    })

    expect(FakeWorker.instances).toHaveLength(2)
    const [replacedWorker, currentWorker] = FakeWorker.instances
    act(() => vi.advanceTimersByTime(0))
    expect(replacedWorker.terminated).toBe(true)

    const currentRun = currentWorker.messages.find((message) => message.type === 'run')
    if (!currentRun || currentRun.type !== 'run') throw new Error('Expected the replacement run request')
    act(() => {
      currentWorker.respond({ id: currentRun.id, type: 'started' })
      currentWorker.respond({ id: currentRun.id, type: 'result', stdout: 'Current run\n', stderr: '', durationMs: 10 })
      vi.advanceTimersByTime(30_000)
    })

    expect(currentWorker.terminated).toBe(false)
    expect(screen.getByText('Current run')).toBeTruthy()
    expect(screen.queryByText(/took too long to load/)).toBeNull()

    unmount()
    act(() => vi.advanceTimersByTime(0))
  })

  it('uses Java-specific timing and trusts its exit code instead of treating stderr as failure', () => {
    vi.useFakeTimers()
    render(<RunnerPanel project={javaProject} entryFile={javaProject.files[0]} />)

    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    expect(screen.getByText(/first Java run downloads the browser compiler/i)).toBeTruthy()

    const worker = FakeWorker.instances[0]
    const run = worker.messages.find((message) => message.type === 'run')
    if (!run || run.type !== 'run') throw new Error('Expected a Java run request')

    act(() => vi.advanceTimersByTime(4_000))
    expect(screen.getByText('Loading runtime')).toBeTruthy()
    expect(screen.queryByText(/took too long to load/i)).toBeNull()

    act(() => {
      worker.respond({ id: run.id, type: 'started' })
      vi.advanceTimersByTime(4_000)
    })
    expect(screen.getByText('Running')).toBeTruthy()
    expect(screen.queryByText(/execution stopped/i)).toBeNull()

    act(() => {
      worker.respond({ id: run.id, type: 'result', stdout: 'Done\n', stderr: 'Diagnostic\n', exitCode: 0, durationMs: 40 })
    })

    expect(screen.getByText('Diagnostic')).toBeTruthy()
    expect(screen.getByText('success')).toBeTruthy()
  })

  it('terminates a running Java worker when the user presses Stop', async () => {
    const user = userEvent.setup()
    render(<RunnerPanel project={javaProject} entryFile={javaProject.files[0]} />)

    await user.click(screen.getByRole('button', { name: 'Run Java' }))
    const worker = FakeWorker.instances[0]
    const run = worker.messages.find((message) => message.type === 'run')
    if (!run || run.type !== 'run') throw new Error('Expected a Java run request')

    act(() => worker.respond({ id: run.id, type: 'started' }))
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    await waitFor(() => expect(worker.terminated).toBe(true))
    expect(worker.messages).toContainEqual({ id: run.id, type: 'abort' })
    expect(screen.getByText('Execution stopped.')).toBeTruthy()
  })
})
