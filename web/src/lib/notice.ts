export type NoticeTone = 'success' | 'info' | 'warning' | 'danger'

/** Info and success notices leave on their own; warnings and failures stay until the learner dismisses them. */
export const NOTICE_AUTO_DISMISS_MS = 4_000

const DANGER = /\b(fail(ed|s)?|could not|couldn['’]t|error|unavailable|conflict)\b/i
const WARNING = /\b(blocked|disabled|read-only|archived and|keep at least|can include up to|can only be|ended before|enter (an?|at least)|restore this classroom)\b/i
const SUCCESS = /\b(copied|downloaded|created|saved|restored|duplicated|deleted|renamed|archived|imported|exported|joined|updated|revoked|removed|queued|added|signed in|is now|loaded|opened)\b/i

/**
 * Chooses a toast tone from the notice text so every existing message gets a
 * meaning-appropriate color without threading a tone through each call site.
 */
export function noticeTone(message: string): NoticeTone {
  if (DANGER.test(message)) return 'danger'
  if (WARNING.test(message)) return 'warning'
  if (SUCCESS.test(message)) return 'success'
  return 'info'
}

export function noticeAutoDismisses(tone: NoticeTone) {
  return tone === 'info' || tone === 'success'
}
