import { describe, expect, it } from 'vitest'
import { runAnnouncement, type RunAnnouncementInput } from './runAnnouncement'

const base: RunAnnouncementInput = {
  status: 'idle',
  phase: 'idle',
  awaitingInput: false,
  fixed: false,
  durationMs: null,
  stdout: '',
  headline: null,
  location: null,
  statusLabel: 'Ready',
  runLabel: 'Python',
  entryPath: 'receipt.py',
  firstLoad: false,
}

describe('runAnnouncement', () => {
  it('says nothing before the first run', () => {
    expect(runAnnouncement(base)).toBe('')
  })

  it('announces loading and running once, without the ticking timer', () => {
    expect(runAnnouncement({ ...base, status: 'running', phase: 'loading', firstLoad: true })).toBe('Loading Python, first time only.')
    expect(runAnnouncement({ ...base, status: 'running', phase: 'executing' })).toBe('Running receipt.py.')
  })

  it('summarizes a success by timing and line count, never the output itself', () => {
    const message = runAnnouncement({ ...base, status: 'success', durationMs: 140, stdout: 'Total: $22.00\nDone\n' })
    expect(message).toBe('Ran in 140 ms. 2 lines of output.')
    expect(message).not.toContain('22.00')
    expect(runAnnouncement({ ...base, status: 'success', durationMs: 9, stdout: 'one\n' })).toBe('Ran in 9 ms. 1 line of output.')
    expect(runAnnouncement({ ...base, status: 'success', durationMs: 9, stdout: '' })).toBe('Ran in 9 ms. No output.')
    expect(runAnnouncement({ ...base, status: 'success', fixed: true, durationMs: 12, stdout: 'ok\n' })).toBe('Fixed. It runs now. Ran in 12 ms. 1 line of output.')
  })

  it('reads the error headline and where it is', () => {
    expect(runAnnouncement({
      ...base,
      status: 'error',
      headline: "NameError: name 'totl' is not defined. Did you mean: 'total'?",
      location: 'receipt.py · line 2',
      statusLabel: 'Error',
    })).toBe("Error: NameError: name 'totl' is not defined. Did you mean: 'total'? receipt.py · line 2.")
    expect(runAnnouncement({ ...base, status: 'error', statusLabel: 'Runtime did not load' })).toBe('Runtime did not load. Details are in the program output.')
  })

  it('covers input, timeouts, and stops', () => {
    expect(runAnnouncement({ ...base, status: 'running', phase: 'input', awaitingInput: true })).toMatch(/waiting for input/)
    expect(runAnnouncement({ ...base, status: 'timeout', statusLabel: 'Stopped at the time limit' })).toBe('Stopped at the time limit.')
    expect(runAnnouncement({ ...base, status: 'stopped', statusLabel: 'Stopped' })).toBe('Stopped.')
  })
})
