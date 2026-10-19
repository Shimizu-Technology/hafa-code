import { History, Save } from 'lucide-react'
import type { RefObject } from 'react'
import type { ProjectCheckpoint } from '../lib/codeRunner'
import { formatCheckpointTime } from '../lib/workspace'

type CheckpointListProps = {
  canEditProject: boolean
  checkpoints: ProjectCheckpoint[]
  onRestoreCheckpoint: (checkpoint: ProjectCheckpoint) => void
  onSaveCheckpoint: () => void
}

function CheckpointList({ canEditProject, checkpoints, onRestoreCheckpoint, onSaveCheckpoint }: CheckpointListProps) {
  return (
    <>
      <div className="checkpoint-popover-header">
        <strong>Checkpoints</strong>
        <button className="secondary compact" type="button" onClick={onSaveCheckpoint} disabled={!canEditProject}>
          <Save size={14} /> Save
        </button>
      </div>
      <div className="checkpoint-list">
        {checkpoints.length === 0 ? (
          <p className="empty-project-list">No checkpoints yet. Save one before a big change so you can come back to it.</p>
        ) : checkpoints.slice(0, 5).map((checkpoint) => (
          <button key={checkpoint.id} className="checkpoint-card" type="button" onClick={() => onRestoreCheckpoint(checkpoint)} title={`Restore ${checkpoint.title}`} disabled={!canEditProject}>
            <span>{checkpoint.title}</span>
            <small>{formatCheckpointTime(checkpoint.createdAt)}</small>
          </button>
        ))}
      </div>
    </>
  )
}

type CheckpointMenuProps = CheckpointListProps & {
  checkpointMenuIsOpen: boolean
  checkpointMenuRef: RefObject<HTMLDetailsElement | null>
  onCheckpointMenuChange: (open: boolean) => void
}

/** Desktop History control: a disclosure in the app bar with the latest checkpoints. */
export function CheckpointMenu({ checkpointMenuIsOpen, checkpointMenuRef, onCheckpointMenuChange, ...listProps }: CheckpointMenuProps) {
  return (
    <details
      ref={checkpointMenuRef}
      className="checkpoint-menu"
      open={checkpointMenuIsOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !event.currentTarget.open) return
        event.preventDefault()
        event.currentTarget.open = false
        onCheckpointMenuChange(false)
        event.currentTarget.querySelector('summary')?.focus()
      }}
      onToggle={(event) => {
        onCheckpointMenuChange(event.currentTarget.open)
      }}
    >
      <summary title="Checkpoints">
        <History size={16} aria-hidden="true" />
        <span className="app-bar-label">History</span>
        <small>{listProps.checkpoints.length}</small>
      </summary>
      <div className="checkpoint-popover popover-panel popover-end">
        <CheckpointList {...listProps} />
      </div>
    </details>
  )
}

/** Phone History tab: the same checkpoints as a full page section. */
export function CheckpointPage(props: CheckpointListProps) {
  return (
    <section className="panel checkpoint-page" aria-labelledby="checkpoint-page-title">
      <h2 id="checkpoint-page-title"><History size={18} aria-hidden="true" /> History</h2>
      <p className="helper-text">Save a checkpoint before a big change. Restoring one replaces the code in this project.</p>
      <CheckpointList {...props} />
    </section>
  )
}
