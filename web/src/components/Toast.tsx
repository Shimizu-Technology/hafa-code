import { useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { NOTICE_AUTO_DISMISS_MS, noticeAutoDismisses, noticeTone } from '../lib/notice'

const ICONS = { success: CircleCheck, info: Info, warning: TriangleAlert, danger: CircleAlert } as const

type ToastProps = {
  message: string
  onDismiss: () => void
}

/**
 * One toast at a time, toned by meaning. Info and success leave after a few seconds
 * unless the pointer or keyboard focus is on them; warnings and failures wait for Dismiss.
 */
export function Toast({ message, onDismiss }: ToastProps) {
  const tone = noticeTone(message)
  const Icon = ICONS[tone]
  const [held, setHeld] = useState(false)
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!noticeAutoDismisses(tone) || held) return
    const timer = window.setTimeout(() => onDismissRef.current(), NOTICE_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [message, tone, held])

  return (
    <div
      className="toast"
      data-tone={tone}
      role={tone === 'danger' ? 'alert' : 'status'}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false) }}
    >
      <Icon size={18} aria-hidden="true" className="toast-icon" />
      <span className="toast-message">{message}</span>
      <button className="ghost icon-button toast-dismiss" type="button" aria-label="Dismiss" title="Dismiss" onClick={onDismiss}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
