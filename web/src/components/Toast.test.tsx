import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast'

describe('Toast', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('lets success leave on its own but keeps a failure until dismissed', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const { rerender } = render(<Toast message="Python Playground created." onDismiss={onDismiss} />)
    act(() => { vi.advanceTimersByTime(4_100) })
    expect(onDismiss).toHaveBeenCalledOnce()

    onDismiss.mockClear()
    rerender(<Toast message="Cloud save failed: offline." onDismiss={onDismiss} />)
    expect(screen.getByRole('alert').getAttribute('data-tone')).toBe('danger')
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('waits while the pointer or keyboard focus is on it', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<Toast message="Share snapshot link is ready to copy." onDismiss={onDismiss} />)
    const toast = screen.getByRole('status')
    fireEvent.pointerEnter(toast)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.pointerLeave(toast)
    fireEvent.focus(screen.getByRole('button', { name: 'Dismiss' }))
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.blur(screen.getByRole('button', { name: 'Dismiss' }))
    act(() => { vi.advanceTimersByTime(4_100) })
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
