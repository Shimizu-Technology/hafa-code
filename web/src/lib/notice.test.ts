import { describe, expect, it } from 'vitest'
import { noticeAutoDismisses, noticeTone } from './notice'

describe('notice tones', () => {
  it.each([
    ['Python Playground created.', 'success'],
    ['Downloaded main.py. Use Workspace backup to keep every project.', 'success'],
    ['Share snapshot link copied.', 'success'],
    ['Share snapshot link is ready to copy.', 'info'],
    ['Cloud save failed: offline. Your local copy is safe; retry 1 of 3 is scheduled.', 'danger'],
    ['Could not duplicate project: Classroom service unavailable', 'danger'],
    ['Clipboard blocked. Select the link to copy it.', 'warning'],
    ['Keep at least one active project in the library.', 'warning'],
    ['This classroom is archived and read-only.', 'warning'],
    ['Opened your Python project “Expenses”.', 'success'],
  ])('%s → %s', (message, tone) => {
    expect(noticeTone(message)).toBe(tone)
  })

  it('auto-dismisses only info and success', () => {
    expect(noticeAutoDismisses('info')).toBe(true)
    expect(noticeAutoDismisses('success')).toBe(true)
    expect(noticeAutoDismisses('warning')).toBe(false)
    expect(noticeAutoDismisses('danger')).toBe(false)
  })
})
