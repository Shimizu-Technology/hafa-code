import { BookOpen, Dumbbell, Share2, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { PROJECT_TITLE_MAX_LENGTH } from '../lib/projectStorage'

type AppBarProps = {
  canEditProject: boolean
  guideLabel: string
  projectTitle: string
  saveLabel: string
  shareDisabled: boolean
  shareDisabledReason?: string
  /** Sign-in or account controls (desktop). */
  account: ReactNode
  /** Checkpoint history control. */
  history: ReactNode
  /** Workspace and display settings popover. */
  settings: ReactNode
  /** Project "More" menu. */
  menu: ReactNode
  classroom?: { open: boolean; onToggle: () => void } | null
  onOpenGuide: () => void
  onOpenPractice: () => void
  onRename: (title: string) => void
  onRenameDone?: () => void
  onShare: () => void
}

/**
 * The compact bar that replaces the large header once a learner has a project:
 * wordmark, the project name, learning tools, and account/share/settings.
 */
export function AppBar({
  canEditProject,
  guideLabel,
  projectTitle,
  saveLabel,
  shareDisabled,
  shareDisabledReason,
  account,
  history,
  settings,
  menu,
  classroom,
  onOpenGuide,
  onOpenPractice,
  onRename,
  onRenameDone,
  onShare,
}: AppBarProps) {
  return (
    <header className="app-bar">
      <h1 className="wordmark"><span aria-hidden="true" className="wordmark-mark" />Hafa Code</h1>
      <div className="app-bar-project">
        <label className="sr-only" htmlFor="project-title">Project name</label>
        <input
          id="project-title"
          className="project-title-input"
          value={projectTitle}
          maxLength={PROJECT_TITLE_MAX_LENGTH}
          title={projectTitle}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onRename(event.target.value)}
          onBlur={onRenameDone}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
          disabled={!canEditProject}
        />
        <small className="save-status" aria-live="polite">{saveLabel}</small>
      </div>
      <nav className="app-bar-learning" aria-label="Learning tools">
        <button className="ghost app-bar-button guide-toolbar-button" type="button" onClick={onOpenGuide} title={guideLabel}>
          <BookOpen size={16} aria-hidden="true" /> <span className="app-bar-label">{guideLabel}</span>
        </button>
        <button className="ghost app-bar-button practice-toolbar-button" type="button" onClick={onOpenPractice} title="Practice">
          <Dumbbell size={16} aria-hidden="true" /> <span className="app-bar-label">Practice</span>
        </button>
        {history}
      </nav>
      <div className="app-bar-actions">
        {classroom && (
          <button
            className={`app-bar-button classroom-toggle${classroom.open ? ' active' : ''}`}
            type="button"
            aria-pressed={classroom.open}
            onClick={classroom.onToggle}
          >
            <ShieldCheck size={16} aria-hidden="true" /> <span className="app-bar-label">Classroom</span>
          </button>
        )}
        <div className="app-bar-account">{account}</div>
        <button
          className="secondary app-bar-button share-button"
          type="button"
          onClick={onShare}
          disabled={shareDisabled}
          title={shareDisabled ? shareDisabledReason : 'Share a copy of this project'}
        >
          <Share2 size={16} aria-hidden="true" /> <span className="app-bar-label">Share</span>
        </button>
        {settings}
        {menu}
      </div>
    </header>
  )
}
