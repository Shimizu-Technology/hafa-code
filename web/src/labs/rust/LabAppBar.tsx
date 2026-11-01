import { ArrowLeft, BookOpen, Download, Dumbbell, Ellipsis, FlaskConical, Import, Plus, Settings2, Trash2 } from 'lucide-react'
import { DisplaySettings } from '../../components/DisplaySettings'
import { Popover } from '../../components/Popover'
import type { ColorModePreference, ThemePreference } from '../../hooks/usePreferences'
import { TOOLCHAIN, TOOLCHAIN_DOWNLOAD_BYTES, formatMegabytes, type ToolchainCacheState } from './toolchain'

type LabAppBarProps = {
  projectTitle: string
  saveLabel: string
  busy: boolean
  cacheState: ToolchainCacheState
  colorMode: ColorModePreference
  theme: ThemePreference
  onColorModeChange: (mode: ColorModePreference) => void
  onThemeChange: (theme: ThemePreference) => void
  onRename: (title: string) => void
  onRenameDone: (title: string) => void
  onOpenGuide: () => void
  onOpenPractice: () => void
  onNewProject: () => void
  onDeleteProject: () => void
  onExport: () => void
  onImport: () => void
  onRemoveDownload: () => void
}

const COMPILER_STATUS: Record<ToolchainCacheState, string> = {
  none: 'Not downloaded. Running code asks first.',
  partial: 'Partly downloaded. Running code finishes the download.',
  complete: 'Saved in this browser.',
  unavailable: 'This browser cannot keep it, so each visit downloads it again.',
}

/**
 * The workspace app bar, for the lab: the Hafa Code wordmark leads back to the workspace,
 * then the lab's name, the project, the learning tools, and settings and project menus.
 */
export function LabAppBar({
  projectTitle,
  saveLabel,
  busy,
  cacheState,
  colorMode,
  theme,
  onColorModeChange,
  onThemeChange,
  onRename,
  onRenameDone,
  onOpenGuide,
  onOpenPractice,
  onNewProject,
  onDeleteProject,
  onExport,
  onImport,
  onRemoveDownload,
}: LabAppBarProps) {
  return (
    <header className="app-bar lab-app-bar">
      <a className="wordmark lab-wordmark" href="/" aria-label="Hafa Code: back to your workspace" title="Back to your Hafa Code workspace">
        <span aria-hidden="true" className="wordmark-mark" />
        Hafa Code
      </a>
      <div className="app-bar-project">
        <h1 className="lab-heading">
          <FlaskConical size={16} aria-hidden="true" />
          <span>Rust Lab</span>
          <span className="lab-badge">Experimental</span>
        </h1>
        <label className="sr-only" htmlFor="lab-project-title">Project name</label>
        <input
          id="lab-project-title"
          className="project-title-input lab-title-input"
          value={projectTitle}
          maxLength={80}
          title={projectTitle}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onRename(event.target.value)}
          onBlur={(event) => onRenameDone(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
        <small className="save-status" aria-live="polite">{saveLabel}</small>
      </div>
      <nav className="app-bar-learning" aria-label="Learning tools">
        <button className="ghost app-bar-button" type="button" onClick={onOpenGuide} title="Rust guide">
          <BookOpen size={16} aria-hidden="true" /> <span className="app-bar-label">Rust guide</span>
        </button>
        <button className="ghost app-bar-button" type="button" onClick={onOpenPractice} title="Practice">
          <Dumbbell size={16} aria-hidden="true" /> <span className="app-bar-label">Practice</span>
        </button>
      </nav>
      <div className="app-bar-actions">
        <Popover
          className="settings-menu"
          triggerClassName="ghost icon-button app-bar-icon"
          trigger={<Settings2 size={18} aria-hidden="true" />}
          triggerLabel="Lab and display settings"
          title="Settings"
          panelLabel="Lab and display settings"
          panelClassName="menu-panel settings-panel"
        >
          <>
            <DisplaySettings colorMode={colorMode} theme={theme} onColorModeChange={onColorModeChange} onThemeChange={onThemeChange} />
            <div className="menu-section">
              <p className="menu-heading">Rust compiler</p>
              <small className="menu-help">
                rustc {TOOLCHAIN.rustcVersion}, {formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)}. {COMPILER_STATUS[cacheState]}
              </small>
              {(cacheState === 'partial' || cacheState === 'complete') && (
                <button className="menu-item danger-quiet" type="button" disabled={busy} data-popover-close onClick={onRemoveDownload}>
                  <Trash2 size={16} aria-hidden="true" /> Remove download ({formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)})
                </button>
              )}
            </div>
            <div className="menu-section">
              <a className="menu-link" href="/">
                <ArrowLeft size={16} aria-hidden="true" /> Back to Hafa Code
              </a>
            </div>
          </>
        </Popover>
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
            <div className="menu-section">
              <p className="menu-heading">This project</p>
              <button className="menu-item" type="button" disabled={busy} data-popover-close onClick={onNewProject}>
                <Plus size={16} aria-hidden="true" /> New project
              </button>
              <button className="menu-item danger-quiet" type="button" disabled={busy} data-popover-close onClick={onDeleteProject}>
                <Trash2 size={16} aria-hidden="true" /> Delete
              </button>
            </div>
            <div className="menu-section">
              <p className="menu-heading">Save and move</p>
              <button className="menu-item" type="button" data-popover-close onClick={onExport} title="Download this project as a .hafa-rust.json file">
                <Download size={16} aria-hidden="true" /> Export project
              </button>
              <button className="menu-item" type="button" disabled={busy} data-popover-close onClick={onImport}>
                <Import size={16} aria-hidden="true" /> Import project
              </button>
              <small className="menu-help">Lab projects stay in this browser. Export one to keep it or to run it on a computer.</small>
            </div>
          </>
        </Popover>
      </div>
    </header>
  )
}
