import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PYTHON_STARTUP_TIMEOUT_MS, RUNNER_STARTUP_TIMEOUT_MS, RUNNER_TIMEOUT_MS, projectKindDefinition } from '../lib/codeRunner'
import { resetRunnerWorkerPool } from '../lib/runnerWorkerPool'
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

  fail(message: string) {
    this.onerror?.({ message } as ErrorEvent)
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
    resetRunnerWorkerPool()
    localStorage.clear()
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: vi.fn(), configurable: true })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reuses a warm worker and offers a touch-friendly input submit action', async () => {
    const user = userEvent.setup()
    const onRunComplete = vi.fn()
    const { unmount } = render(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} />)

    await user.click(screen.getByRole('button', { name: 'Run Python' }))
    expect(screen.getByText('Downloading Python (first time only)')).toBeTruthy()
    expect(FakeWorker.instances).toHaveLength(1)

    const worker = FakeWorker.instances.at(-1)!
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
    expect(onRunComplete).toHaveBeenCalledWith({ status: 'success', stdout: 'Hello Leon\n', stderr: '', durationMs: 25 })
    await user.click(await screen.findByRole('button', { name: 'Run again' }))

    expect(FakeWorker.instances).toHaveLength(1)
    expect(worker.messages.filter((message) => message.type === 'run')).toHaveLength(2)

    unmount()
    await waitFor(() => expect(worker.terminated).toBe(true))
  })

  it('cancels an overlapping run without leaving a timer that can stop its replacement', () => {
    vi.useFakeTimers()
    const onRunCancel = vi.fn()
    const onRunComplete = vi.fn()
    const { unmount } = render(<RunnerPanel project={project} entryFile={project.files[0]} onRunCancel={onRunCancel} onRunComplete={onRunComplete} />)

    act(() => {
      window.dispatchEvent(new Event('hafa-code-run-active-project'))
      window.dispatchEvent(new Event('hafa-code-run-active-project'))
    })

    expect(FakeWorker.instances).toHaveLength(2)
    expect(onRunCancel).toHaveBeenCalledOnce()
    const [replacedWorker, currentWorker] = FakeWorker.instances
    const replacedRun = replacedWorker.messages.find((message) => message.type === 'run')
    if (!replacedRun || replacedRun.type !== 'run') throw new Error('Expected the replaced run request')
    act(() => vi.advanceTimersByTime(0))
    expect(replacedWorker.terminated).toBe(true)
    act(() => replacedWorker.respond({ id: replacedRun.id, type: 'result', stdout: 'Stale run\n', stderr: '', durationMs: 5 }))
    expect(onRunComplete).not.toHaveBeenCalled()

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
    expect(onRunComplete).toHaveBeenCalledOnce()

    unmount()
    act(() => vi.advanceTimersByTime(0))
  })

  it('cancels the active run before an external workflow starts its replacement', () => {
    const onRunCancel = vi.fn()
    const onRunComplete = vi.fn()
    render(<RunnerPanel project={project} entryFile={project.files[0]} onRunCancel={onRunCancel} onRunComplete={onRunComplete} />)

    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    const worker = FakeWorker.instances[0]
    const run = worker.messages.find((message) => message.type === 'run')
    if (!run || run.type !== 'run') throw new Error('Expected a run request')

    act(() => window.dispatchEvent(new Event('hafa-code-cancel-active-run')))

    expect(onRunCancel).toHaveBeenCalledOnce()
    expect(worker.messages).toContainEqual({ id: run.id, type: 'abort' })
    expect(worker.onmessage).toBeNull()
    expect(worker.onerror).toBeNull()
    act(() => worker.respond({ id: run.id, type: 'result', stdout: 'Stale run\n', stderr: '', durationMs: 5 }))
    expect(onRunComplete).not.toHaveBeenCalled()
  })

  it('uses Java-specific timing and trusts its exit code instead of treating stderr as failure', () => {
    vi.useFakeTimers()
    render(<RunnerPanel project={javaProject} entryFile={javaProject.files[0]} />)

    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    expect(screen.getByText(/first Java run downloads the browser compiler/i)).toBeTruthy()

    const worker = FakeWorker.instances.at(-1)!
    const run = worker.messages.find((message) => message.type === 'run')
    if (!run || run.type !== 'run') throw new Error('Expected a Java run request')
    expect(run.startupTimeoutMs).toBe(120_000)

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
    expect(screen.getByText('Ran in 40 ms')).toBeTruthy()
    expect(document.querySelector('.output-panel')?.getAttribute('data-run-status')).toBe('success')
  })

  it('terminates a running Java worker when the user presses Stop', async () => {
    const user = userEvent.setup()
    const onRunComplete = vi.fn()
    render(<RunnerPanel project={javaProject} entryFile={javaProject.files[0]} onRunComplete={onRunComplete} />)

    await user.click(screen.getByRole('button', { name: 'Run Java' }))
    const worker = FakeWorker.instances[0]
    const run = worker.messages.find((message) => message.type === 'run')
    if (!run || run.type !== 'run') throw new Error('Expected a Java run request')

    act(() => {
      worker.respond({ id: run.id, type: 'started' })
      worker.respond({ id: run.id, type: 'output', stream: 'stdout', text: 'Halfway\n' })
    })
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    await waitFor(() => expect(worker.terminated).toBe(true))
    expect(worker.messages).toContainEqual({ id: run.id, type: 'abort' })
    expect(worker.onmessage).toBeNull()
    expect(worker.onerror).toBeNull()
    expect(screen.getByText('Execution stopped.')).toBeTruthy()
    expect(onRunComplete).toHaveBeenCalledOnce()
    expect(onRunComplete).toHaveBeenCalledWith({
      status: 'stopped',
      stdout: 'Halfway\n',
      stderr: 'Execution stopped.',
      durationMs: expect.any(Number),
    })
  })

  it('reports a startup timeout exactly once', () => {
    vi.useFakeTimers()
    const onRunComplete = vi.fn()
    const onErrorAdviceChange = vi.fn()
    render(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} onErrorAdviceChange={onErrorAdviceChange} />)

    act(() => {
      window.dispatchEvent(new Event('hafa-code-run-active-project'))
      vi.advanceTimersByTime(PYTHON_STARTUP_TIMEOUT_MS)
    })

    const worker = FakeWorker.instances.at(-1)!
    expect(worker.onmessage).toBeNull()
    expect(worker.onerror).toBeNull()
    expect(onRunComplete).toHaveBeenCalledOnce()
    expect(onRunComplete).toHaveBeenCalledWith({
      status: 'timeout',
      stdout: '',
      stderr: 'The browser runtime took too long to load. Check your connection, then try again.',
      failurePhase: 'startup',
      durationMs: PYTHON_STARTUP_TIMEOUT_MS,
    })
    expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'python',
      advice: expect.objectContaining({ title: 'The browser runtime could not start', location: null, guideTopicId: 'python-output-comments' }),
    }))
  })

  it('lets a cold Python runtime finish after the default startup limit without extending execution time', () => {
    vi.useFakeTimers()
    const onRunComplete = vi.fn()
    render(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} />)

    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    const worker = FakeWorker.instances.at(-1)!
    const run = worker.messages.find((message) => message.type === 'run')
    if (!run || run.type !== 'run') throw new Error('Expected a Python run request')
    expect(run.startupTimeoutMs).toBe(PYTHON_STARTUP_TIMEOUT_MS)
    expect(screen.getByText(/first Python run downloads a larger browser runtime/i)).toBeTruthy()

    act(() => vi.advanceTimersByTime(RUNNER_STARTUP_TIMEOUT_MS + 1_000))
    expect(worker.terminated).toBe(false)
    expect(screen.getByText('Loading runtime')).toBeTruthy()
    expect(onRunComplete).not.toHaveBeenCalled()

    act(() => {
      worker.respond({ id: run.id, type: 'started' })
      worker.respond({ id: run.id, type: 'result', stdout: 'Ready\n', stderr: '', exitCode: 0, durationMs: 25 })
      vi.advanceTimersByTime(PYTHON_STARTUP_TIMEOUT_MS)
    })
    expect(screen.getByText('Ready')).toBeTruthy()
    expect(worker.terminated).toBe(false)
    expect(onRunComplete).toHaveBeenCalledOnce()
  })

  it('reports an execution timeout with streamed output exactly once', () => {
    vi.useFakeTimers()
    const onRunComplete = vi.fn()
    render(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} />)

    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    const worker = FakeWorker.instances.at(-1)!
    const run = worker.messages.find((message) => message.type === 'run')
    if (!run || run.type !== 'run') throw new Error('Expected a run request')
    act(() => {
      worker.respond({ id: run.id, type: 'started' })
      worker.respond({ id: run.id, type: 'output', stream: 'stdout', text: 'Before timeout\n' })
      vi.advanceTimersByTime(RUNNER_TIMEOUT_MS + 250)
    })

    expect(onRunComplete).toHaveBeenCalledOnce()
    expect(onRunComplete).toHaveBeenCalledWith({
      status: 'timeout',
      stdout: 'Before timeout\n',
      stderr: `Execution stopped after ${RUNNER_TIMEOUT_MS}ms.`,
      failurePhase: 'execution',
      durationMs: RUNNER_TIMEOUT_MS + 250,
    })
    expect(worker.onmessage).toBeNull()
    expect(worker.onerror).toBeNull()
  })

  it('preserves streamed output when the final result omits its payload', () => {
    const onRunComplete = vi.fn()
    render(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} />)

    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    const worker = FakeWorker.instances.at(-1)!
    const run = worker.messages.find((message) => message.type === 'run')
    if (!run || run.type !== 'run') throw new Error('Expected a run request')
    act(() => {
      worker.respond({ id: run.id, type: 'started' })
      worker.respond({ id: run.id, type: 'output', stream: 'stdout', text: 'Streamed result\n' })
      worker.respond({ id: run.id, type: 'result', stdout: '', stderr: '', exitCode: 0, durationMs: 18 })
    })

    expect(screen.getAllByText('Streamed result')).toHaveLength(1)
    expect(onRunComplete).toHaveBeenCalledOnce()
    expect(onRunComplete).toHaveBeenCalledWith({
      status: 'success',
      stdout: 'Streamed result\n',
      stderr: '',
      durationMs: 18,
    })
  })

  it('reports an active run to the latest completion callback', () => {
    const firstCompletion = vi.fn()
    const latestCompletion = vi.fn()
    const view = render(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={firstCompletion} />)

    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    const worker = FakeWorker.instances.at(-1)!
    const run = worker.messages.find((message) => message.type === 'run')
    if (!run || run.type !== 'run') throw new Error('Expected a run request')

    view.rerender(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={latestCompletion} />)
    act(() => worker.respond({ id: run.id, type: 'result', stdout: 'Done\n', stderr: '', exitCode: 0, durationMs: 8 }))

    expect(firstCompletion).not.toHaveBeenCalled()
    expect(latestCompletion).toHaveBeenCalledOnce()
  })

  it('reports an unexpected worker error exactly once and opens its guide topic', () => {
    const onRunComplete = vi.fn()
    const onErrorAdviceChange = vi.fn()
    render(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} onErrorAdviceChange={onErrorAdviceChange} />)

    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    const worker = FakeWorker.instances.at(-1)!
    act(() => worker.fail('Runtime broke'))

    expect(worker.onmessage).toBeNull()
    expect(worker.onerror).toBeNull()
    expect(onRunComplete).toHaveBeenCalledOnce()
    expect(onRunComplete).toHaveBeenCalledWith({
      status: 'error',
      stdout: '',
      stderr: 'Runtime broke',
      failurePhase: 'startup',
      durationMs: expect.any(Number),
    })
    expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'python',
      advice: expect.objectContaining({
        title: 'The browser runtime could not start',
        guideTopicId: 'python-output-comments',
      }),
    }))
  })

  it('gives startup recovery when the loader returns a failure before started', () => {
    const onErrorAdviceChange = vi.fn()
    const onRunComplete = vi.fn()
    render(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} onErrorAdviceChange={onErrorAdviceChange} />)
    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    const worker = FakeWorker.instances[0]
    const request = worker.messages.find((message) => message.type === 'run')!
    act(() => worker.respond({ id: request.id, type: 'result', stdout: '', stderr: 'Failed to fetch runtime', exitCode: 1 }))
    expect(onRunComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', failurePhase: 'startup' }))
    expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({ advice: expect.objectContaining({ title: 'The browser runtime could not start', location: null }) }))
  })

  it('keeps pre-start Java project validation in code-error coaching', () => {
    const onErrorAdviceChange = vi.fn()
    const onRunComplete = vi.fn()
    render(<RunnerPanel project={javaProject} entryFile={javaProject.files[0]} onRunComplete={onRunComplete} onErrorAdviceChange={onErrorAdviceChange} />)
    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    const worker = FakeWorker.instances[0]
    const request = worker.messages.find((message) => message.type === 'run')!
    act(() => worker.respond({ id: request.id, type: 'result', stdout: '', stderr: 'Java packages are not supported yet.', exitCode: 1, errorKind: 'validation' }))
    expect(onRunComplete).toHaveBeenCalledWith(expect.objectContaining({ failurePhase: 'validation', stderr: 'Java packages are not supported yet.' }))
    expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({ advice: expect.objectContaining({ location: 'Main.java', title: 'Let’s decode this java error' }) }))
  })

  it('keeps learner-code advice after the worker reports started', () => {
    const onErrorAdviceChange = vi.fn()
    render(<RunnerPanel project={project} entryFile={project.files[0]} onErrorAdviceChange={onErrorAdviceChange} />)
    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
    const worker = FakeWorker.instances[0]
    const request = worker.messages.find((message) => message.type === 'run')!
    act(() => {
      worker.respond({ id: request.id, type: 'started' })
      worker.respond({ id: request.id, type: 'result', stdout: '', stderr: 'NameError: missing is not defined', exitCode: 1 })
    })
    expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({ advice: expect.objectContaining({ title: 'Python does not know that name', location: 'main.py' }) }))
  })

  it('notifies the owner when an active run is cancelled by unmounting', () => {
    const onRunCancel = vi.fn()
    const { unmount } = render(<RunnerPanel project={project} entryFile={project.files[0]} onRunCancel={onRunCancel} />)
    act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))

    unmount()

    expect(onRunCancel).toHaveBeenCalledOnce()
  })

  describe('learner trust', () => {
    function startPythonRun() {
      render(<RunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} />)
      act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
      const worker = FakeWorker.instances.at(-1)!
      const run = worker.messages.find((message) => message.type === 'run')
      if (!run || run.type !== 'run') throw new Error('Expected a run request')
      act(() => worker.respond({ id: run.id, type: 'started' }))
      return { worker, run }
    }
    let onRunComplete = vi.fn()
    beforeEach(() => { onRunComplete = vi.fn() })

    it('stops a flooding program with a friendly limit message and terminates the worker', () => {
      vi.useFakeTimers()
      const { worker, run } = startPythonRun()
      act(() => {
        worker.respond({ id: run.id, type: 'output', stream: 'stdout', text: '0\n1\n2\n' })
        worker.respond({ id: run.id, type: 'output_limit', text: 'limit' })
        vi.advanceTimersByTime(20)
      })
      expect(document.querySelector('.run-error-headline')?.textContent).toContain('Output limit reached — check your loop')
      expect(screen.getByTestId('run-announcement').textContent).toContain('Error: Output limit reached — check your loop')
      expect(screen.getByText(/stopped this program because it printed more than 10,000 lines/)).toBeTruthy()
      expect(worker.terminated).toBe(true)
      expect(onRunComplete).toHaveBeenCalledOnce()
      expect(onRunComplete.mock.calls[0][0]).toMatchObject({ status: 'error', outputLimited: true, stdout: '0\n1\n2\n' })
      act(() => worker.respond({ id: run.id, type: 'result', stdout: '', stderr: 'late', exitCode: 1 }))
      expect(onRunComplete).toHaveBeenCalledOnce()
    })

    it('enforces the output cap on the page even when a runtime does not', () => {
      vi.useFakeTimers()
      const { worker, run } = startPythonRun()
      const chunk = 'line\n'.repeat(1_000)
      act(() => {
        for (let index = 0; index < 11; index += 1) worker.respond({ id: run.id, type: 'output', stream: 'stdout', text: chunk })
        vi.advanceTimersByTime(20)
      })
      expect(onRunComplete.mock.calls[0][0]).toMatchObject({ outputLimited: true })
      expect(worker.terminated).toBe(true)
      expect(screen.getByText(/earlier lines are hidden to keep the page fast/)).toBeTruthy()
    })

    it('headlines the final Python error and keeps the full traceback behind a disclosure', () => {
      const { worker, run } = startPythonRun()
      act(() => worker.respond({
        id: run.id,
        type: 'result',
        stdout: '',
        stderr: 'Traceback (most recent call last):\n  File "main.py", line 2, in <module>\n    print(totl)\nNameError: name \'totl\' is not defined. Did you mean: \'total\'?\n',
        exitCode: 1,
        fullTraceback: 'Traceback (most recent call last):\n  File "/lib/python314.zip/_pyodide/_base.py", line 597\nNameError: …',
      }))
      const headline = document.querySelector<HTMLElement>('.run-error-headline')!
      // Announced once, politely: the headline and where, never the whole traceback.
      const announcement = screen.getByTestId('run-announcement').textContent ?? ''
      expect(announcement).toContain("Error: NameError: name 'totl' is not defined")
      expect(announcement).toContain('main.py · line 2')
      expect(announcement).not.toContain('Traceback')
      expect(headline.textContent).toContain("NameError: name 'totl' is not defined. Did you mean: 'total'?")
      expect(headline.textContent).toContain('main.py · line 2')
      expect(screen.getByText(/Show full traceback/)).toBeTruthy()
      expect(document.querySelector('.terminal-full-traceback pre')?.textContent).toContain('_pyodide')
    })

    it('copies the whole output transcript and explains a blocked clipboard', async () => {
      const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('blocked'))
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const { worker, run } = startPythonRun()
      act(() => {
        worker.respond({ id: run.id, type: 'output', stream: 'stdout', text: 'Total: 12\n' })
        worker.respond({ id: run.id, type: 'result', stdout: 'Total: 12\n', stderr: '', exitCode: 0 })
      })
      await act(async () => { screen.getByRole('button', { name: 'Copy output' }).click() })
      expect(writeText).toHaveBeenCalledWith('Total: 12\n')
      expect(screen.getByRole('button', { name: 'Output copied' })).toBeTruthy()
      await act(async () => { screen.getByRole('button', { name: 'Output copied' }).click() })
      expect(screen.getByRole('alert').textContent).toContain('Copy was blocked')
    })

    it('starts Python in the background and reuses that runtime for the first run', async () => {
      vi.useFakeTimers()
      render(<RunnerPanel project={project} entryFile={project.files[0]} />)
      expect(screen.getByText('3s run limit')).toBeTruthy()
      await act(async () => { await vi.advanceTimersByTimeAsync(700) })
      expect(FakeWorker.instances).toHaveLength(1)
      expect(FakeWorker.instances[0].messages[0]).toMatchObject({ type: 'warmup' })
      act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
      expect(FakeWorker.instances).toHaveLength(1)
      expect(FakeWorker.instances[0].messages.at(-1)).toMatchObject({ type: 'run' })
    })

    it('says when Python is downloading for the first time and counts the wait', () => {
      vi.useFakeTimers()
      render(<RunnerPanel project={project} entryFile={project.files[0]} />)
      act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
      expect(screen.getByText('Downloading Python (first time only)')).toBeTruthy()
      act(() => vi.advanceTimersByTime(3_100))
      expect(screen.getByText('3s')).toBeTruthy()
      expect(screen.getByText(/startup limit 90s/)).toBeTruthy()
      const worker = FakeWorker.instances.at(-1)!
      const run = worker.messages.find((message) => message.type === 'run')!
      act(() => worker.respond({ id: run.id, type: 'started' }))
      expect(localStorage.getItem('hafa-code-runtime-ready:python')).toBe('1')
    })
  })

  describe('run states', () => {
    function runOnce(result: { stdout?: string; stderr?: string; exitCode?: number; durationMs?: number }) {
      act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
      const worker = FakeWorker.instances.at(-1)!
      const run = worker.messages.filter((message) => message.type === 'run').at(-1)!
      act(() => worker.respond({ id: run.id, type: 'started' }))
      act(() => worker.respond({ id: run.id, type: 'result', stdout: '', stderr: '', exitCode: 0, durationMs: 12, ...result } as RunnerResponse))
    }

    const panel = () => document.querySelector('.output-panel')!
    const status = () => document.querySelector('.run-status')!

    it('goes idle → running with elapsed time → success with timing and a one-time first-success outline', () => {
      vi.useFakeTimers()
      render(<RunnerPanel project={project} entryFile={project.files[0]} />)
      expect(panel().getAttribute('data-run-status')).toBe('idle')
      expect(status().textContent).toBe('Ready')
      expect(screen.getByRole('button', { name: /Run Python/ }).className).toContain('primary')

      act(() => window.dispatchEvent(new Event('hafa-code-run-active-project')))
      expect(panel().getAttribute('data-run-status')).toBe('running')
      expect(status().getAttribute('data-tone')).toBe('running')
      act(() => vi.advanceTimersByTime(1_250))
      expect(status().textContent).toMatch(/Loading runtime\s*1\.\ds/)

      const worker = FakeWorker.instances.at(-1)!
      const run = worker.messages.find((message) => message.type === 'run')!
      act(() => worker.respond({ id: run.id, type: 'started' }))
      expect(status().textContent).toMatch(/^Running/)
      act(() => worker.respond({ id: run.id, type: 'result', stdout: 'Hafa adai\n', stderr: '', exitCode: 0, durationMs: 140 }))

      expect(panel().getAttribute('data-run-status')).toBe('success')
      expect(status().getAttribute('data-tone')).toBe('success')
      expect(status().textContent).toBe('Ran in 140 ms')
      expect(panel().classList.contains('first-success')).toBe(true)
      act(() => vi.advanceTimersByTime(1_700))
      expect(panel().classList.contains('first-success')).toBe(false)

      // The moment plays once per project, even after a remount.
      runOnce({ durationMs: 20 })
      expect(panel().classList.contains('first-success')).toBe(false)
      expect(status().textContent).toBe('Ran in 20 ms')
    })

    it('says "Fixed. It runs now." when a run succeeds right after an error', () => {
      localStorage.setItem('hafa-code-first-success-v1', JSON.stringify([project.id]))
      render(<RunnerPanel project={project} entryFile={project.files[0]} />)
      runOnce({ stderr: 'NameError: name \'totl\' is not defined\n', exitCode: 1 })
      expect(panel().getAttribute('data-run-status')).toBe('error')
      expect(status().getAttribute('data-tone')).toBe('danger')
      expect(status().textContent).toBe('Error')

      runOnce({ stdout: '5\n', durationMs: 9 })
      expect(status().textContent).toBe('Fixed. It runs now.9 ms')
      expect(panel().classList.contains('first-success')).toBe(false)

      runOnce({ stdout: '5\n', durationMs: 8 })
      expect(status().textContent).toBe('Ran in 8 ms')
    })
  })
})
