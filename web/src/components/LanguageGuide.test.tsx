import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageGuide } from './LanguageGuide'

describe('LanguageGuide', () => {
  afterEach(cleanup)

  it('follows the project language, searches topics, copies code, and hands off a safe example', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onTryExample = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<LanguageGuide kind="java" open onClose={onClose} onTryExample={onTryExample} />)

    expect(screen.getByRole('dialog', { name: 'Java Language Guide' })).toBeTruthy()
    expect(screen.getByText(/bridge toward Salesforce Apex/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /variables and types/i })).toBeTruthy()

    await user.type(screen.getByRole('searchbox'), 'scanner')
    await user.click(screen.getByRole('button', { name: /scanner input/i }))
    expect(screen.getByRole('heading', { name: 'Scanner input' })).toBeTruthy()
    expect(screen.getByText(/current code stays untouched/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('new Scanner(System.in)'))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Try example' }))
    expect(onTryExample).toHaveBeenCalledWith(expect.objectContaining({ id: 'java-scanner-input' }))
  })

  it('shows a useful empty search state and closes with Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<LanguageGuide kind="ruby" open onClose={onClose} onTryExample={vi.fn()} />)

    const search = screen.getByRole('searchbox')
    await waitFor(() => expect(document.activeElement).toBe(search))
    await user.type(search, 'not-a-real-topic')
    expect(screen.getByRole('heading', { name: /no topics match/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByRole('button', { name: /output and comments/i })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
