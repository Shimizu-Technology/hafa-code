import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useModalFocus } from './useModalFocus'

function ModalHarness() {
  const [open, setOpen] = useState(false)
  const dialogRef = useModalFocus<HTMLElement>(open, () => setOpen(false))

  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <section ref={dialogRef} tabIndex={-1} role="dialog" aria-label="Test dialog">
          <button>First action</button>
          <button>Last action</button>
        </section>
      )}
    </>
  )
}

describe('useModalFocus', () => {
  it('moves focus inside, traps Tab, closes with Escape, and returns focus', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })

    render(<ModalHarness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()
    fireEvent.click(trigger)

    const first = screen.getByRole('button', { name: 'First action' })
    const last = screen.getByRole('button', { name: 'Last action' })
    expect(document.activeElement).toBe(first)

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
