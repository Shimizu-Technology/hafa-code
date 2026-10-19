import { describe, expect, it, vi } from 'vitest'
import type { RunnerResponse } from './runnerProtocol'
import { createRunOutput, OUTPUT_LIMIT_MESSAGE } from './runOutput'

function harness(options: Parameters<typeof createRunOutput>[2] = {}) {
  const posted: RunnerResponse[] = []
  let now = 0
  const scheduled: (() => void)[] = []
  const output = createRunOutput('run-1', (message) => posted.push(message), {
    now: () => now,
    schedule: (callback) => { scheduled.push(callback) },
    ...options,
  })
  return { output, posted, advance: (ms: number) => { now += ms }, runScheduled: () => scheduled.splice(0).forEach((callback) => callback()) }
}

describe('createRunOutput', () => {
  it('batches many small writes into a few page messages without losing order', () => {
    const { output, posted, advance } = harness()
    for (let index = 0; index < 1_000; index += 1) {
      output.write('stdout', `${index}\n`)
      if (index % 100 === 0) advance(60)
    }
    output.write('stderr', 'warning\n')
    output.write('stdout', 'after\n')
    output.flush()

    const outputs = posted.filter((message) => message.type === 'output')
    expect(outputs.length).toBeLessThan(20)
    expect(outputs.map((message) => message.text).join('')).toBe(`${Array.from({ length: 1_000 }, (_, index) => `${index}\n`).join('')}warning\nafter\n`)
    expect(outputs.at(-2)).toMatchObject({ stream: 'stderr', text: 'warning\n' })
    expect(output.stdout()).toContain('999\nafter\n')
  })

  it('delivers trailing output once the runtime yields', () => {
    const { output, posted, runScheduled } = harness()
    output.write('stdout', 'Name? ')
    expect(posted).toHaveLength(0)
    runScheduled()
    expect(posted).toEqual([{ id: 'run-1', type: 'output', stream: 'stdout', text: 'Name? ' }])
  })

  it('stops at the line limit, keeps the allowed lines, and reports the limit once', () => {
    const { output, posted } = harness({ maxLines: 3 })
    expect(output.write('stdout', 'a\nb\n')).toBe(true)
    expect(output.write('stdout', 'c\nd\ne\n')).toBe(false)
    expect(output.write('stdout', 'f\n')).toBe(false)
    expect(output.limited).toBe(true)
    expect(output.stdout()).toBe('a\nb\nc\n')
    expect(posted.filter((message) => message.type === 'output_limit')).toEqual([{ id: 'run-1', type: 'output_limit', text: OUTPUT_LIMIT_MESSAGE }])
  })

  it('stops output without newlines at the character limit', () => {
    const { output } = harness({ maxChars: 10 })
    for (let index = 0; index < 20 && output.write('stdout', 'ab'); index += 1) { /* flood */ }
    expect(output.limited).toBe(true)
    expect(output.stdout()).toBe('ababababab')
  })

  it('uses real timers by default', () => {
    vi.useFakeTimers()
    const posted: RunnerResponse[] = []
    const output = createRunOutput('run-2', (message) => posted.push(message))
    output.write('stdout', 'hi\n')
    vi.advanceTimersByTime(60)
    expect(posted).toHaveLength(1)
    vi.useRealTimers()
  })
})
