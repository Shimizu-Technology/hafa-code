import { ArrowLeft, Check, ClipboardCopy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LessonReturn } from '../lib/starterLinks'

type LessonBarProps = {
  lesson: LessonReturn
  /** Copies the project's code; resolves false when the clipboard is blocked. */
  onCopyForLearn: () => Promise<boolean>
}

const COPIED_RESET_MS = 2_000

/**
 * Shown above the code when the project came from a CSG Learn lesson link:
 * a quiet school badge, the lesson name, "Copy code for Learn", and "Back to your lesson".
 * Run stays the only primary action in the workspace.
 */
export function LessonBar({ lesson, onCopyForLearn }: LessonBarProps) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
  }, [])

  const copy = async () => {
    const ok = await onCopyForLearn()
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    setCopied(ok)
    if (ok) resetTimerRef.current = window.setTimeout(() => setCopied(false), COPIED_RESET_MS)
  }

  const lessonName = lesson.label ?? 'Your lesson'

  return (
    <section className="lesson-bar" aria-label="Lesson">
      <a className="lesson-back" href={lesson.url} title={`Back to ${lessonName}`}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span className="lesson-label-long">Back to your lesson</span>
        <span className="lesson-label-short">Lesson</span>
      </a>
      <p className="lesson-context">
        <span className="school-badge">Code School of Guam</span>
        <span className="lesson-name" title={lessonName}>{lessonName}</span>
      </p>
      <div className="lesson-submit">
        <small className="lesson-hint" id="lesson-copy-hint">Paste it into the lesson’s submission box.</small>
        <button className="secondary lesson-copy" type="button" onClick={copy} aria-describedby="lesson-copy-hint">
          {copied ? <Check size={16} aria-hidden="true" /> : <ClipboardCopy size={16} aria-hidden="true" />}
          <span>{copied ? 'Copied' : 'Copy code for Learn'}</span>
        </button>
      </div>
    </section>
  )
}
