import { Archive, BookOpen, Copy, History, MoreHorizontal, RotateCcw, Save, Trash2 } from 'lucide-react'
import type { RefObject } from 'react'
import { projectKindDefinition, type ProjectCheckpoint, type ProjectVisibility, type SavedProject } from '../lib/codeRunner'
import {
  availableVisibilityOptions,
  formatCheckpointTime,
  formatUpdatedAt,
  isArchived,
  visibilityDescriptions,
  visibilityLabels,
} from '../lib/workspace'

type ProjectToolbarProps = {
  activeOrganizationId: string | null
  canEditProject: boolean
  checkpointMenuIsOpen: boolean
  checkpointMenuRef: RefObject<HTMLDetailsElement | null>
  checkpoints: ProjectCheckpoint[]
  cloudSaveLabel: string
  currentProjectOwnerLabel: string
  mobileHistoryOpen: boolean
  project: SavedProject
  projectCount: number
  onArchive: () => void
  onCheckpointMenuChange: (open: boolean) => void
  onDelete: () => void
  onDuplicate: () => void
  onOpenGuide: () => void
  onOpenProjectActions: () => void
  onRename: (title: string) => void
  onRestore: () => void
  onRestoreCheckpoint: (checkpoint: ProjectCheckpoint) => void
  onSaveCheckpoint: () => void
  onVisibilityChange: (visibility: ProjectVisibility) => void
}

/** Presents project metadata and actions while App owns persistence and confirmations. */
export function ProjectToolbar({
  activeOrganizationId,
  canEditProject,
  checkpointMenuIsOpen,
  checkpointMenuRef,
  checkpoints,
  cloudSaveLabel,
  currentProjectOwnerLabel,
  mobileHistoryOpen,
  project,
  projectCount,
  onArchive,
  onCheckpointMenuChange,
  onDelete,
  onDuplicate,
  onOpenGuide,
  onOpenProjectActions,
  onRename,
  onRestore,
  onRestoreCheckpoint,
  onSaveCheckpoint,
  onVisibilityChange,
}: ProjectToolbarProps) {
  return (
    <div className="project-toolbar panel surface-grid">
      <div className="title-field">
        <label htmlFor="project-title">Project name</label>
        <input id="project-title" value={project.title} onChange={(event) => onRename(event.target.value)} disabled={!canEditProject} />
        <small>
          {cloudSaveLabel}
          {activeOrganizationId && currentProjectOwnerLabel ? ` · by ${currentProjectOwnerLabel}` : ''}
          {isArchived(project) ? ' · archived' : ''}
          {!canEditProject ? ' · read-only instructor view' : ''}
          {' · updated '}{formatUpdatedAt(project.updatedAt)}
        </small>
        <div className="visibility-section">
          <div className="visibility-row">
            <span>Visibility</span>
            <div className="visibility-control" aria-label="Project visibility">
              {availableVisibilityOptions(activeOrganizationId).map((visibility) => (
                <button
                  key={visibility}
                  className={project.visibility === visibility ? 'active' : ''}
                  type="button"
                  title={visibilityDescriptions[visibility]}
                  aria-label={`${visibility === 'private' && activeOrganizationId ? 'Teacher only' : visibilityLabels[visibility]}: ${visibilityDescriptions[visibility]}`}
                  disabled={!canEditProject}
                  onClick={() => onVisibilityChange(visibility)}
                >
                  {visibility === 'private' && activeOrganizationId ? 'Teacher only' : visibilityLabels[visibility]}
                </button>
              ))}
            </div>
          </div>
          <small className="visibility-help">{visibilityDescriptions[project.visibility]}</small>
        </div>
      </div>
      <div className="toolbar-actions">
        <button className="secondary guide-toolbar-button" type="button" onClick={onOpenGuide}>
          <BookOpen size={16} /> {projectKindDefinition(project.kind).shortLabel} guide
        </button>
        <details ref={checkpointMenuRef} className="checkpoint-menu" open={checkpointMenuIsOpen} onToggle={(event) => {
          if (!mobileHistoryOpen) onCheckpointMenuChange(event.currentTarget.open)
        }}>
          <summary>
            <History size={16} />
            <span>History</span>
            <small>{checkpoints.length}</small>
          </summary>
          <div className="checkpoint-popover">
            <div className="checkpoint-popover-header">
              <strong>Checkpoints</strong>
              <button className="secondary compact" type="button" onClick={onSaveCheckpoint} disabled={!canEditProject}>
                <Save size={14} /> Save
              </button>
            </div>
            <div className="checkpoint-list">
              {checkpoints.length === 0 ? (
                <p className="empty-project-list">No checkpoints yet.</p>
              ) : checkpoints.slice(0, 5).map((checkpoint) => (
                <button key={checkpoint.id} className="checkpoint-card secondary" type="button" onClick={() => onRestoreCheckpoint(checkpoint)} title={`Restore ${checkpoint.title}`}>
                  <span>{checkpoint.title}</span>
                  <small>{formatCheckpointTime(checkpoint.createdAt)}</small>
                </button>
              ))}
            </div>
          </div>
        </details>
        {isArchived(project) ? (
          <button className="secondary" onClick={onRestore} disabled={!canEditProject}><RotateCcw size={16} /> Restore</button>
        ) : (
          <button className="secondary" onClick={onArchive} disabled={!canEditProject || projectCount <= 1}><Archive size={16} /> Archive</button>
        )}
        <button className="secondary" onClick={onDuplicate}><Copy size={16} /> Duplicate</button>
        <button className="danger" onClick={onDelete} disabled={!canEditProject}><Trash2 size={16} /> Delete</button>
      </div>
      <button className="secondary mobile-project-actions-button" onClick={onOpenProjectActions}>
        <MoreHorizontal size={16} /> Actions
      </button>
    </div>
  )
}
