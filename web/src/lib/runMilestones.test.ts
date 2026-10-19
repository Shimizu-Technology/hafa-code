import { describe, expect, it } from 'vitest'
import { claimFirstSuccess, hasCelebratedFirstSuccess, runMilestone } from './runMilestones'

describe('run milestones', () => {
  it('claims the first success once per project', () => {
    expect(hasCelebratedFirstSuccess('a')).toBe(false)
    expect(claimFirstSuccess('a')).toBe(true)
    expect(claimFirstSuccess('a')).toBe(false)
    expect(hasCelebratedFirstSuccess('a')).toBe(true)
    expect(claimFirstSuccess('b')).toBe(true)
  })

  it('earns "fixed" only for a success right after an error or timeout', () => {
    expect(runMilestone(null, 'success', true)).toBe('first-success')
    expect(runMilestone('error', 'success', false)).toBe('fixed')
    expect(runMilestone('timeout', 'success', false)).toBe('fixed')
    expect(runMilestone('success', 'success', false)).toBeNull()
    expect(runMilestone('error', 'error', false)).toBeNull()
    expect(runMilestone('stopped', 'success', false)).toBeNull()
    expect(runMilestone('error', 'success', true)).toBe('fixed')
  })
})
