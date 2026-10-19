import { Archive, Copy, DatabaseBackup, Download, Ellipsis, Import, RotateCcw, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProjectVisibility, SavedProject } from '../lib/codeRunner'
import {
  availableVisibilityOptions,
  formatSourceBytes,
  isArchived,
  PROJECT_SOURCE_LIMIT_BYTES,
  projectSourceUsage,
  visibilityDescriptions,
  visibilityLabels,
} from '../lib/workspace'
import { Popover } from './Popover'

type ProjectMenuProps = {
  activeOrganizationId: string | null
  canEditProject: boolean
  exportLabel: string
  exportTitle: string
  project: SavedProject
  projectCount: number
  /** Extra controls shown only in the phone layout (sign-in lives here on small screens). */
  phoneExtras?: ReactNode
  onArchive: () => void
  onDelete: () => void
  onDownload: () => void
  onDuplicate: () => void
  onImport: () => void
  onOpenWorkspaceBackup: () => void
  onRestore: () => void
  onVisibilityChange: (visibility: ProjectVisibility) => void
}

/** The app bar's "More" menu: project actions, visibility, size, and file transfer. */
export function ProjectMenu({
  activeOrganizationId,
  canEditProject,
  exportLabel,
  exportTitle,
  project,
  projectCount,
  phoneExtras,
  onArchive,
  onDelete,
  onDownload,
  onDuplicate,
  onImport,
  onOpenWorkspaceBackup,
  onRestore,
  onVisibilityChange,
}: ProjectMenuProps) {
  const sourceUsage = projectSourceUsage(project)

  return (
    <Popover
      className="project-menu"
      triggerClassName="ghost icon-button app-bar-icon"
      trigger={<Ellipsis size={18} aria-hidden="true" />}
      triggerLabel="More project actions"
      title="More"
      panelLabel="Project actions"
      panelClassName="menu-panel"
    >
      <>
          {phoneExtras && <div className="menu-section menu-phone-only">{phoneExtras}</div>}
          <div className="menu-section">
            <p className="menu-heading">This project</p>
            <button className="menu-item" type="button" data-popover-close onClick={onDuplicate}>
              <Copy size={16} aria-hidden="true" /> Duplicate
            </button>
            {isArchived(project) ? (
              <button className="menu-item" type="button" disabled={!canEditProject} data-popover-close onClick={onRestore}>
                <RotateCcw size={16} aria-hidden="true" /> Restore
              </button>
            ) : (
              <button className="menu-item" type="button" disabled={!canEditProject || projectCount <= 1} data-popover-close onClick={onArchive} title={projectCount <= 1 ? 'Keep at least one active project' : undefined}>
                <Archive size={16} aria-hidden="true" /> Archive
              </button>
            )}
            <button className="menu-item danger-quiet" type="button" disabled={!canEditProject} data-popover-close onClick={onDelete}>
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </div>
          <div className="menu-section">
            <p className="menu-heading" id="project-visibility-heading">Visibility</p>
            <div className="segmented visibility-control" role="group" aria-labelledby="project-visibility-heading">
              {availableVisibilityOptions(activeOrganizationId).map((visibility) => {
                const label = visibility === 'private' && activeOrganizationId ? 'Teacher only' : visibilityLabels[visibility]
                return (
                  <button
                    key={visibility}
                    className={project.visibility === visibility ? 'active' : ''}
                    type="button"
                    aria-pressed={project.visibility === visibility}
                    title={visibilityDescriptions[visibility]}
                    aria-label={`${label}: ${visibilityDescriptions[visibility]}`}
                    disabled={!canEditProject}
                    onClick={() => onVisibilityChange(visibility)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <small className="menu-help">{visibilityDescriptions[project.visibility]}</small>
            <div className="source-usage" data-state={sourceUsage.state}>
              <div className="source-usage-summary">
                <span>Project size</span>
                <strong>{formatSourceBytes(sourceUsage.bytes)} of {formatSourceBytes(PROJECT_SOURCE_LIMIT_BYTES)}</strong>
              </div>
              <meter
                aria-label={`Project source uses ${formatSourceBytes(sourceUsage.bytes)} of the ${formatSourceBytes(PROJECT_SOURCE_LIMIT_BYTES)} limit`}
                min={0}
                max={PROJECT_SOURCE_LIMIT_BYTES}
                low={PROJECT_SOURCE_LIMIT_BYTES * 0.6}
                high={PROJECT_SOURCE_LIMIT_BYTES * 0.8}
                optimum={0}
                value={Math.min(sourceUsage.bytes, PROJECT_SOURCE_LIMIT_BYTES)}
              />
            </div>
          </div>
          <div className="menu-section">
            <p className="menu-heading">Save and move</p>
            <button className="menu-item" type="button" title={exportTitle} data-popover-close onClick={onDownload}>
              <Download size={16} aria-hidden="true" /> {exportLabel}
            </button>
            <button className="menu-item" type="button" data-popover-close onClick={onImport}>
              <Import size={16} aria-hidden="true" /> Import project
            </button>
            <button className="menu-item" type="button" data-popover-close onClick={onOpenWorkspaceBackup}>
              <DatabaseBackup size={16} aria-hidden="true" /> Workspace backup
            </button>
          </div>
      </>
    </Popover>
  )
}
