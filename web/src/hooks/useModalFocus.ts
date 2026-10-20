import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * `returnFocusTo` names the element that opened the dialog when it is no longer focused at
 * open time, for example when a loading placeholder held focus before this dialog replaced it.
 */
export function useModalFocus<T extends HTMLElement>(open: boolean, onClose: () => void, returnFocusTo?: HTMLElement | null): RefObject<T | null> {
  const dialogRef = useRef<T | null>(null)
  const closeRef = useRef(onClose)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const returnFocusToRef = useRef(returnFocusTo)

  useEffect(() => {
    closeRef.current = onClose
    returnFocusToRef.current = returnFocusTo
  }, [onClose, returnFocusTo])

  useEffect(() => {
    if (!open) return

    const opener = returnFocusToRef.current
    returnFocusRef.current = opener?.isConnected
      ? opener
      : document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
    const initialFocus = dialog?.querySelector<HTMLElement>('[data-modal-initial-focus]') ?? focusable[0]
    window.requestAnimationFrame(() => (initialFocus ?? dialog)?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const currentFocusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (currentFocusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = currentFocusable[0]
      const last = currentFocusable[currentFocusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.requestAnimationFrame(() => returnFocusRef.current?.focus())
    }
  }, [open])

  return dialogRef
}
