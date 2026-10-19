import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type PopoverProps = {
  /** Visible trigger content (icon and/or text). */
  trigger: ReactNode
  /** Accessible name for the trigger when it only shows an icon. */
  triggerLabel?: string
  /** Accessible name for the panel. */
  panelLabel: string
  triggerClassName?: string
  className?: string
  panelClassName?: string
  align?: 'start' | 'end'
  title?: string
  /** Items marked with `data-popover-close` close the panel after their own click runs. */
  children: ReactNode
}

/**
 * A disclosure popover: a button that shows a panel of controls below it.
 * Escape closes and returns focus to the button; clicking outside or tabbing away closes it.
 */
export function Popover({
  trigger,
  triggerLabel,
  panelLabel,
  triggerClassName = 'ghost',
  className = '',
  panelClassName = '',
  align = 'end',
  title,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  const restoreFocusRef = useRef(false)

  // Focus moves back to the trigger after the panel unmounts, before any dialog the
  // chosen item opened records where to return focus (layout effects run first).
  useLayoutEffect(() => {
    if (open || !restoreFocusRef.current) return
    restoreFocusRef.current = false
    buttonRef.current?.focus()
  }, [open])

  const close = () => {
    restoreFocusRef.current = true
    setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className={`popover ${className}`.trim()}
      data-open={open || undefined}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        event.preventDefault()
        event.stopPropagation()
        close()
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null
        // Leaving with Tab closes the panel; clicks inside keep it open.
        if (open && next && !rootRef.current?.contains(next)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={triggerLabel}
        title={title}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          className={`popover-panel popover-${align} ${panelClassName}`.trim()}
          role="group"
          aria-label={panelLabel}
          onClick={(event) => {
            // Bubble phase: the item's own click has already run in this same batch.
            if ((event.target as Element).closest('[data-popover-close]')) close()
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
