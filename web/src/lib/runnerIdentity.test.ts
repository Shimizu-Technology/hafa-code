import { describe, expect, it } from 'vitest'
import { remapRunnerInstanceKey } from './runnerIdentity'

describe('remapRunnerInstanceKey', () => {
  it('keeps an existing runner identity while a local project receives its cloud ID', () => {
    const keys = new Map([['local-project', 'original-runner']])

    const remapped = remapRunnerInstanceKey(keys, 'local-project', '42')

    expect(remapped.get('42')).toBe('original-runner')
    expect(remapped.has('local-project')).toBe(false)
    expect(keys.get('local-project')).toBe('original-runner')
  })

  it('uses the local project ID when no earlier runner identity was recorded', () => {
    const keys = new Map<string, string>()

    const remapped = remapRunnerInstanceKey(keys, 'local-project', '42')

    expect(remapped.get('42')).toBe('local-project')
  })
})
