import type { RefObject } from 'react'
import { Download, Import, X } from 'lucide-react'
import { LEGACY_SITE_HOST, PUBLIC_SITE_URL } from '../lib/siteConfig'

type WorkspaceTransferDialogProps = {
  dialogRef: RefObject<HTMLElement | null>
  isLegacyHost: boolean
  restoreInputRef: RefObject<HTMLInputElement | null>
  onClose: () => void
  onDownloadBackup: () => void
  onRestoreFile: (file: File | undefined) => void
}

export function WorkspaceTransferDialog({
  dialogRef,
  isLegacyHost,
  restoreInputRef,
  onClose,
  onDownloadBackup,
  onRestoreFile,
}: WorkspaceTransferDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="modal-sheet workspace-transfer-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-transfer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Workspace backup</p>
            <h2 id="workspace-transfer-title">Move or protect your work</h2>
          </div>
          <button className="ghost icon-button" type="button" aria-label="Close workspace backup" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="helper-text">
          One backup includes every project saved in this browser, local checkpoints, Practice Lab progress, and display preferences. Cloud projects remain in your account too.
        </p>
        {isLegacyHost ? (
          <div className="domain-move-instructions">
            <strong>Moving from {LEGACY_SITE_HOST}?</strong>
            <ol>
              <li>Download your complete backup here.</li>
              <li>Open <a href={PUBLIC_SITE_URL}>{PUBLIC_SITE_URL.replace('https://', '')}</a>.</li>
              <li>Choose Workspace backup there and restore this file.</li>
            </ol>
          </div>
        ) : (
          <p className="transfer-callout">Coming from the old Netlify address? Download a backup there first, then restore it here.</p>
        )}
        <div className="workspace-transfer-actions">
          <button type="button" onClick={onDownloadBackup}><Download size={17} /> Download complete backup</button>
          <button className="secondary" type="button" onClick={() => restoreInputRef.current?.click()}><Import size={17} /> Restore a backup</button>
        </div>
        <input
          ref={restoreInputRef}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(event) => onRestoreFile(event.target.files?.[0])}
        />
        <p className="helper-text">Restore merges the backup with anything already in this browser. Matching project and checkpoint IDs are updated instead of duplicated.</p>
      </section>
    </div>
  )
}
