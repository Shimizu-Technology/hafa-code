import { createRef } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceTransferDialog } from './WorkspaceTransferDialog'

describe('WorkspaceTransferDialog', () => {
  afterEach(cleanup)

  it('explains the cross-domain transfer and exposes both backup actions', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onDownloadBackup = vi.fn()
    render(
      <WorkspaceTransferDialog
        dialogRef={createRef<HTMLElement>()}
        isLegacyHost
        restoreInputRef={createRef<HTMLInputElement>()}
        onClose={onClose}
        onDownloadBackup={onDownloadBackup}
        onRestoreFile={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Move or protect your work' })).toBeTruthy()
    expect(screen.getByText(/download your complete backup here/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'code.shimizu-technology.com' }).getAttribute('href')).toBe('https://code.shimizu-technology.com')

    await user.click(screen.getByRole('button', { name: 'Download complete backup' }))
    expect(onDownloadBackup).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Close workspace backup' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('uses concise recovery guidance on the canonical domain', () => {
    render(
      <WorkspaceTransferDialog
        dialogRef={createRef<HTMLElement>()}
        isLegacyHost={false}
        restoreInputRef={createRef<HTMLInputElement>()}
        onClose={vi.fn()}
        onDownloadBackup={vi.fn()}
        onRestoreFile={vi.fn()}
      />,
    )

    expect(screen.getByText(/coming from the old Netlify address/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'code.shimizu-technology.com' })).toBeNull()
  })
})
