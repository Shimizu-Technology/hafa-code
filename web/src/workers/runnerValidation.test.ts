import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installRunner, RunnerValidationError, type RunRequest } from './runnerProtocol'
import { validateJavaProject } from './javaRunnerCore'

vi.mock('pyodide', () => ({ loadPyodide: vi.fn(() => { throw new Error('Runtime should not load for invalid entry path') }) }))

const originalHandler = self.onmessage
const request: RunRequest = { id: 'validation-test', type: 'run', code: '', files: [], entryPath: 'Main.java', timeoutMs: 3_000, startupTimeoutMs: 30_000 }

function send(data: RunRequest) {
  self.onmessage?.call(self, new MessageEvent('message', { data }))
}

describe('worker validation error transport', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => {
    self.onmessage = originalHandler
    vi.restoreAllMocks()
  })

  it('preserves typed validation from a handler result', async () => {
    const post = vi.spyOn(self, 'postMessage').mockImplementation(() => {})
    installRunner(async () => ({ stdout: '', stderr: 'Compiler diagnostic', exitCode: 1, errorKind: 'validation' }))
    send(request)
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'result', errorKind: 'validation', stderr: 'Compiler diagnostic' })))
  })

  it('preserves typed thrown validation while leaving runtime failures unclassified', async () => {
    const post = vi.spyOn(self, 'postMessage').mockImplementation(() => {})
    installRunner(async () => { throw new RunnerValidationError('Invalid input') })
    send(request)
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ errorKind: 'validation', stderr: 'Invalid input' })))
    post.mockClear()
    installRunner(async () => { throw new Error('Runtime download failed') })
    send(request)
    await vi.waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][0]).not.toHaveProperty('errorKind')
  })

  it('marks real Java pre-start validation without initializing its runtime', async () => {
    expect(() => validateJavaProject({ ...request, code: 'package workshop; public class Main {}', files: [{ path: 'Main.java', language: 'java', content: '' }] })).toThrow(RunnerValidationError)
    const post = vi.spyOn(self, 'postMessage').mockImplementation(() => {})
    await import('./javaRunner.worker')
    send({ ...request, code: 'package workshop; public class Main {}', files: [{ path: 'Main.java', language: 'java', content: '' }] })
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'result', errorKind: 'validation', stderr: expect.stringContaining('packages are not supported') })))
    expect(post.mock.calls.some(([message]) => message.type === 'started')).toBe(false)
  })

  it('marks real Python unsafe entry paths before loading Pyodide', async () => {
    const post = vi.spyOn(self, 'postMessage').mockImplementation(() => {})
    await import('./pythonRunner.worker')
    send({ ...request, entryPath: '../main.py' })
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'result', errorKind: 'validation', stderr: 'Unsupported project path: ../main.py' })))
    expect(post.mock.calls.some(([message]) => message.type === 'started')).toBe(false)
  })
})
