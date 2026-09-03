import type { RefObject } from 'react'
import { Archive, Copy, RotateCcw, Trash2, X } from 'lucide-react'
import type { ProjectCheckpoint, SavedProject } from '../lib/codeRunner'
import { isArchived, isCloudProjectId, type ConfirmAction, type FileDialogState } from '../lib/workspace'

export type ShareDialogState = {
  url: string
  mode: 'server' | 'offline'
  copied: boolean
  error?: string | null
} | null

type WorkspaceDialogsProps = {
  activeProjectCount: number
  confirmAction: ConfirmAction
  confirmDialogRef: RefObject<HTMLElement | null>
  fileDialog: FileDialogState | null
  fileDialogError: string
  fileDialogRef: RefObject<HTMLElement | null>
  isSignedIn: boolean
  orgCreateOpen: boolean
  orgDialogRef: RefObject<HTMLElement | null>
  orgNameDraft: string
  pendingCheckpoint: ProjectCheckpoint | null
  project: SavedProject
  projectActionsDialogRef: RefObject<HTMLElement | null>
  projectActionsOpen: boolean
  shareDialog: ShareDialogState
  shareDialogRef: RefObject<HTMLElement | null>
  onArchiveProject: () => void
  onCloseConfirm: () => void
  onCloseFileDialog: () => void
  onCloseOrganizationDialog: () => void
  onCloseProjectActions: () => void
  onCloseShareDialog: () => void
  onConfirmProjectAction: () => void
  onCopyShareLink: () => void
  onCreateOrganization: () => void
  onDuplicateProject: () => void
  onFilePathChange: (path: string) => void
  onOrganizationNameChange: (name: string) => void
  onRequestDeleteProject: () => void
  onRestoreProject: () => void
  onSubmitFileDialog: () => void
}

/** Collects workspace dialogs so App remains focused on state and orchestration. */
export function WorkspaceDialogs({
  activeProjectCount,
  confirmAction,
  confirmDialogRef,
  fileDialog,
  fileDialogError,
  fileDialogRef,
  isSignedIn,
  orgCreateOpen,
  orgDialogRef,
  orgNameDraft,
  pendingCheckpoint,
  project,
  projectActionsDialogRef,
  projectActionsOpen,
  shareDialog,
  shareDialogRef,
  onArchiveProject,
  onCloseConfirm,
  onCloseFileDialog,
  onCloseOrganizationDialog,
  onCloseProjectActions,
  onCloseShareDialog,
  onConfirmProjectAction,
  onCopyShareLink,
  onCreateOrganization,
  onDuplicateProject,
  onFilePathChange,
  onOrganizationNameChange,
  onRequestDeleteProject,
  onRestoreProject,
  onSubmitFileDialog,
}: WorkspaceDialogsProps) {
  return (
    <>
      {fileDialog && (
        <div className="modal-backdrop" role="presentation" onClick={onCloseFileDialog}>
          <section ref={fileDialogRef} tabIndex={-1} className="modal-sheet file-dialog-sheet" role="dialog" aria-modal="true" aria-labelledby="file-dialog-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Workspace file</p>
                <h2 id="file-dialog-title">{fileDialog.mode === 'create' ? 'Create file' : fileDialog.mode === 'rename' ? 'Rename file' : 'Duplicate file'}</h2>
              </div>
              <button className="ghost icon-button" aria-label="Close file dialog" onClick={onCloseFileDialog}><X size={18} /></button>
            </div>
            <label className="file-path-field" htmlFor="file-path-input">
              <span>Path</span>
              <input
                id="file-path-input"
                value={fileDialog.path}
                autoFocus
                onChange={(event) => onFilePathChange(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') onSubmitFileDialog() }}
                placeholder="lib/helper.rb"
              />
            </label>
            {fileDialogError && <p className="form-error" role="alert">{fileDialogError}</p>}
            <p className="helper-text">Use a simple filename like `helper.rb`, `about.html`, or `styles.css`. Add folders later with paths like `assets/logo.svg`.</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={onCloseFileDialog}>Cancel</button>
              <button onClick={onSubmitFileDialog}>{fileDialog.mode === 'create' ? 'Create file' : fileDialog.mode === 'rename' ? 'Rename file' : 'Duplicate file'}</button>
            </div>
          </section>
        </div>
      )}

      {shareDialog && (
        <div className="modal-backdrop" role="presentation" onClick={onCloseShareDialog}>
          <section ref={shareDialogRef} tabIndex={-1} className="modal-sheet share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">Snapshot share</p><h2 id="share-dialog-title">Copy project link</h2></div>
              <button className="ghost icon-button" aria-label="Close share dialog" onClick={onCloseShareDialog}><X size={18} /></button>
            </div>
            <p className="helper-text">{shareDialog.mode === 'server' ? 'This link imports a server snapshot of the project.' : 'The server share could not be created, so this offline link carries a copy in the URL.'}</p>
            {shareDialog.error && <p className="form-error">Server share failed: {shareDialog.error}</p>}
            <label className="file-path-field" htmlFor="share-url">
              <span>Share URL</span>
              <input id="share-url" readOnly value={shareDialog.url} onFocus={(event) => event.currentTarget.select()} />
            </label>
            <div className="confirm-actions">
              <button className="secondary" type="button" onClick={onCloseShareDialog}>Done</button>
              <button type="button" onClick={onCopyShareLink}><Copy size={16} /> {shareDialog.copied ? 'Copied' : 'Copy link'}</button>
            </div>
          </section>
        </div>
      )}

      {orgCreateOpen && (
        <div className="modal-backdrop" role="presentation" onClick={onCloseOrganizationDialog}>
          <section ref={orgDialogRef} tabIndex={-1} className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="org-dialog-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">Organization</p><h2 id="org-dialog-title">Create workspace</h2></div>
              <button className="ghost icon-button" aria-label="Close organization dialog" onClick={onCloseOrganizationDialog}><X size={18} /></button>
            </div>
            <label className="file-path-field" htmlFor="org-name">
              <span>Name</span>
              <input id="org-name" value={orgNameDraft} autoFocus onChange={(event) => onOrganizationNameChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onCreateOrganization() }} placeholder="Code School of Guam" />
            </label>
            <p className="helper-text">Platform admins and mentors create organization workspaces, then invite instructors and students.</p>
            <div className="confirm-actions">
              <button className="secondary" type="button" onClick={onCloseOrganizationDialog}>Cancel</button>
              <button type="button" onClick={onCreateOrganization}>Create workspace</button>
            </div>
          </section>
        </div>
      )}

      {projectActionsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={onCloseProjectActions}>
          <section ref={projectActionsDialogRef} tabIndex={-1} className="modal-sheet project-actions-sheet" role="dialog" aria-modal="true" aria-labelledby="project-actions-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">Project</p><h2 id="project-actions-title">Actions</h2></div>
              <button className="ghost icon-button" aria-label="Close project actions" onClick={onCloseProjectActions}><X size={18} /></button>
            </div>
            <div className="modal-action-grid">
              {isArchived(project) ? (
                <button className="secondary" onClick={onRestoreProject}><RotateCcw size={16} /> Restore</button>
              ) : (
                <button className="secondary" onClick={onArchiveProject} disabled={activeProjectCount <= 1}><Archive size={16} /> Archive</button>
              )}
              <button className="secondary" onClick={onDuplicateProject}><Copy size={16} /> Duplicate</button>
              <button className="danger" onClick={onRequestDeleteProject}><Trash2 size={16} /> Delete</button>
            </div>
          </section>
        </div>
      )}

      {confirmAction && (
        <div className="modal-backdrop" role="presentation" onClick={onCloseConfirm}>
          <section ref={confirmDialogRef} tabIndex={-1} className="modal-sheet confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">{confirmAction === 'delete' ? 'Delete project' : confirmAction === 'checkpoint' ? 'Restore checkpoint' : 'Archive project'}</p>
                <h2 id="confirm-title">{confirmAction === 'delete' ? 'Delete this project?' : confirmAction === 'checkpoint' ? 'Restore this checkpoint?' : 'Archive this project?'}</h2>
              </div>
              <button className="ghost icon-button" aria-label="Cancel" onClick={onCloseConfirm}><X size={18} /></button>
            </div>
            <p id="confirm-description" className="confirm-copy">
              {confirmAction === 'delete'
                ? `"${project.title || 'Untitled Project'}" will be removed from this browser${isSignedIn && isCloudProjectId(project.id) ? ' and your cloud account' : ''}.`
                : confirmAction === 'checkpoint'
                  ? `Your current code will be replaced with "${pendingCheckpoint?.title || 'this checkpoint'}". Save a checkpoint first if you want to keep the current version.`
                  : `"${project.title || 'Untitled Project'}" will move out of your active project list. You can restore it from Archived.`}
            </p>
            <div className="confirm-actions">
              <button className="secondary" onClick={onCloseConfirm}>Cancel</button>
              <button className={confirmAction === 'delete' ? 'danger' : ''} onClick={onConfirmProjectAction}>
                {confirmAction === 'delete' ? <Trash2 size={16} /> : confirmAction === 'checkpoint' ? <RotateCcw size={16} /> : <Archive size={16} />}
                {confirmAction === 'delete' ? 'Delete project' : confirmAction === 'checkpoint' ? 'Restore checkpoint' : 'Archive project'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
