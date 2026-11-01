import { ArrowLeft, Dumbbell, FolderOpen, Import, Plus } from 'lucide-react'
import { challengeById } from './challenges'
import { MAX_PROJECTS, type RustLabProject } from './storage'

type LabProjectsProps = {
  projects: RustLabProject[]
  activeProjectId: string
  busy: boolean
  projectsOpen: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onImport: () => void
  onRename: (title: string) => void
  onRenameDone: (title: string) => void
}

function updatedLabel(project: RustLabProject) {
  const date = new Date(project.updatedAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** The workspace project sidebar, for lab projects (saved in this browser only). */
export function LabProjects({ projects, activeProjectId, busy, projectsOpen, onSelect, onNew, onImport, onRename, onRenameDone }: LabProjectsProps) {
  const active = projects.find((project) => project.id === activeProjectId) ?? projects[0]
  const controls = (
    <>
      <div className="lab-project-actions">
        <button className="secondary compact" type="button" disabled={busy} onClick={onNew}>
          <Plus size={14} aria-hidden="true" /> New
        </button>
        <button className="secondary compact" type="button" disabled={busy} onClick={onImport}>
          <Import size={14} aria-hidden="true" /> Import
        </button>
      </div>
      <div className="project-list" aria-label="Rust Lab projects">
        {projects.map((project) => {
          const challenge = project.challengeId ? challengeById(project.challengeId) : null
          return (
            <button
              key={project.id}
              className={`project-card${project.id === activeProjectId ? ' active' : ''}`}
              type="button"
              aria-current={project.id === activeProjectId ? 'true' : undefined}
              disabled={busy && project.id !== activeProjectId}
              title={project.title}
              onClick={() => onSelect(project.id)}
            >
              <span className="project-card-title">{project.title}</span>
              <small>
                {challenge ? <><Dumbbell size={12} aria-hidden="true" /> Challenge · </> : 'main.rs · '}
                {updatedLabel(project)}
              </small>
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <aside className="panel project-sidebar lab-project-sidebar" aria-label="Projects">
      <div className="sidebar-header">
        <div className="sidebar-heading">
          <p className="sidebar-kicker"><FolderOpen size={14} aria-hidden="true" /> Projects</p>
          <h2>Rust Lab projects</h2>
        </div>
        <div className="sidebar-tools">
          <span className="count-badge" aria-label={`${projects.length} of ${MAX_PROJECTS} projects`}>{projects.length}</span>
        </div>
      </div>
      <details className="mobile-project-menu" open={projectsOpen ? true : undefined}>
        <summary>
          <span>{active.title}</span>
          <small>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</small>
        </summary>
        <div className="mobile-project-content">
          <label className="file-path-field lab-phone-rename" htmlFor="lab-project-title-phone">
            <span>Project name</span>
            <input
              id="lab-project-title-phone"
              value={active.title}
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onRename(event.target.value)}
              onBlur={(event) => onRenameDone(event.target.value)}
            />
          </label>
          {controls}
        </div>
      </details>
      <div className="sidebar-content">
        <p className="sidebar-note">Saved only in this browser, up to {MAX_PROJECTS}. Export a project to keep it.</p>
        {controls}
      </div>
      <a className="lab-back-link" href="/">
        <ArrowLeft size={15} aria-hidden="true" /> Back to Hafa Code
      </a>
    </aside>
  )
}
