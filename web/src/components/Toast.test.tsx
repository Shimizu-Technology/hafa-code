import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast'

describe('Toast', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('lets success leave on its own but keeps a failure until dismissed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onDismiss = vi.fn()
    const { rerender } = render(<Toast message="Python Playground created." onDismiss={onDismiss} />)
    act(() => { vi.advanceTimersByTime(4_100) })
    expect(onDismiss).toHaveBeenCalledOnce()

    onDismiss.mockClear()
    rerender(<Toast message="Cloud save failed: offline." onDismiss={onDismiss} />)
    expect(screen.getByRole('alert').getAttribute('data-tone')).toBe('danger')
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(onDismiss).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('waits while the pointer or keyboard focus is on it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onDismiss = vi.fn()
    render(
      <>
        <button type="button">Before</button>
        <Toast message="Share snapshot link is ready to copy." onDismiss={onDismiss} />
        <button type="button">After</button>
      </>,
    )
    const toast = screen.getByRole('status')
    await user.hover(toast)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(onDismiss).not.toHaveBeenCalled()
    await user.unhover(toast)

    await user.click(screen.getByRole('button', { name: 'Before' }))
    await user.tab()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBe(document.activeElement)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(onDismiss).not.toHaveBeenCalled()

    // Tabbing out of the toast lets the timer run again.
    await user.tab()
    act(() => { vi.advanceTimersByTime(4_100) })
    expect(onDismiss).toHaveBeenCalledOnce()
  })
  it('waits for the learner when it offers an action', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onDismiss = vi.fn()
    const onAction = vi.fn()
    render(<Toast message="Welcome back. Your saved work on “Expenses” is open." onDismiss={onDismiss} action={{ label: 'Start over', onAction }} />)
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(onDismiss).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    expect(onAction).toHaveBeenCalledOnce()
  })
})
