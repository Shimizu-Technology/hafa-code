import { FolderOpen, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { PROJECT_KINDS, projectKindDefinition, type ProjectKind, type SavedProject } from '../lib/codeRunner'
import { formatCheckpointTime, kindLabels, projectOwnerLabel } from '../lib/workspace'

type ProjectSidebarProps = {
  activeOrganizationId: string | null
  activeProjectCount: number
  archivedProjectCount: number
  currentProjectId: string
  currentProjectTitle: string
  isSignedIn: boolean
  mobileProjectsOpen: boolean
  projects: SavedProject[]
  showArchived: boolean
  userId?: number
  userName?: string | null
  workspaceName: string
  workspaceNote?: string
  onAddProject: (kind: ProjectKind) => void
  onCollapse: () => void
  onExpand: () => void
  onSelectProject: (projectId: string) => void
  onShowArchivedChange: (showArchived: boolean) => void
}

/** Presents project navigation while App retains project and persistence state. */
export function ProjectSidebar({
  activeOrganizationId,
  activeProjectCount,
  archivedProjectCount,
  currentProjectId,
  currentProjectTitle,
  isSignedIn,
  mobileProjectsOpen,
  projects,
  showArchived,
  userId,
  userName,
  workspaceName,
  workspaceNote,
  onAddProject,
  onCollapse,
  onExpand,
  onSelectProject,
  onShowArchivedChange,
}: ProjectSidebarProps) {
  const projectCount = showArchived ? archivedProjectCount : activeProjectCount

  const projectControls = (
    <>
      <div className="project-view-toggle" aria-label="Project view">
        <button className={!showArchived ? 'active' : ''} type="button" onClick={() => onShowArchivedChange(false)}>
          Active <span>{activeProjectCount}</span>
        </button>
        <button className={showArchived ? 'active' : ''} type="button" onClick={() => onShowArchivedChange(true)}>
          Archived <span>{archivedProjectCount}</span>
        </button>
      </div>
      <div className="new-project-grid">
        {PROJECT_KINDS.map((kind) => (
          <button key={kind} className="secondary compact" onClick={() => onAddProject(kind)}>
            <Plus size={14} /> {projectKindDefinition(kind).shortLabel}
          </button>
        ))}
      </div>
      <div className="project-list">
        {projects.length === 0 && (
          <p className="empty-project-list">{showArchived ? 'No archived projects yet.' : 'No active projects yet.'}</p>
        )}
        {projects.map((candidate) => {
          const ownerLabel = activeOrganizationId ? projectOwnerLabel(candidate, userId) : ''
          return (
            <button
              key={candidate.id}
              className={`project-card ${candidate.id === currentProjectId ? 'active' : ''}`}
              onClick={() => onSelectProject(candidate.id)}
              title={candidate.title || 'Untitled Project'}
            >
              <span className="project-card-title">{candidate.title || 'Untitled Project'}</span>
              <small>{kindLabels[candidate.kind]}{ownerLabel ? ` · ${ownerLabel}` : ''} · {formatCheckpointTime(candidate.updatedAt)}</small>
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <aside className="panel project-sidebar surface-grid">
      <div className="sidebar-header">
        <div className="sidebar-heading">
          <p className="sidebar-kicker"><FolderOpen size={14} aria-hidden="true" /> Projects</p>
          <h2 title={workspaceName}>{workspaceName}</h2>
        </div>
        <div className="sidebar-tools">
          <span className="count-badge" aria-label={`${projectCount} ${showArchived ? 'archived' : 'active'} projects`}>{projectCount}</span>
          <button className="ghost icon-button desktop-only" type="button" aria-label="Collapse project sidebar" onClick={onCollapse}>
            <PanelLeftClose size={17} />
          </button>
        </div>
      </div>
      <button className="ghost collapsed-sidebar-button" type="button" aria-label="Expand project sidebar" onClick={onExpand}>
        <PanelLeftOpen size={18} />
      </button>
      <details className="mobile-project-menu" open={mobileProjectsOpen ? true : undefined}>
        <summary>
          <span>{currentProjectTitle || 'Untitled Project'}</span>
          <small>{showArchived ? `${archivedProjectCount} archived` : `${activeProjectCount} active`}</small>
        </summary>
        <div className="mobile-project-content">{projectControls}</div>
      </details>
      <div className="sidebar-content">
        <p className="sidebar-note">
          {workspaceNote ?? (isSignedIn
            ? `Signed in${userName ? ` as ${userName}` : ''}. Projects sync to your account.`
            : 'Everything is private to this browser until you export, share, or sign in.')}
        </p>
        {projectControls}
      </div>
    </aside>
  )
}
