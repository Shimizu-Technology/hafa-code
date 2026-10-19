import { Code2, FolderOpen, Globe, History, House, Terminal } from 'lucide-react'
import type { ProjectKind } from '../lib/codeRunner'
import type { MobileTab } from '../lib/workspace'

type MobileWorkspaceNavProps = {
  activeTab: MobileTab
  projectKind: ProjectKind
  onChange: (tab: MobileTab) => void
}

/** Keeps the five primary workspace destinations reachable on small screens. */
export function MobileWorkspaceNav({ activeTab, projectKind, onChange }: MobileWorkspaceNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Workspace sections">
      <button className={activeTab === 'home' ? 'active' : ''} aria-current={activeTab === 'home' ? 'page' : undefined} type="button" onClick={() => onChange('home')}>
        <House size={18} aria-hidden="true" />
        <span>Home</span>
      </button>
      <button className={activeTab === 'projects' ? 'active' : ''} aria-current={activeTab === 'projects' ? 'page' : undefined} type="button" onClick={() => onChange('projects')}>
        <FolderOpen size={18} aria-hidden="true" />
        <span>Projects</span>
      </button>
      <button className={activeTab === 'code' ? 'active' : ''} aria-current={activeTab === 'code' ? 'page' : undefined} type="button" onClick={() => onChange('code')}>
        <Code2 size={18} aria-hidden="true" />
        <span>Code</span>
      </button>
      <button className={activeTab === 'output' ? 'active' : ''} aria-current={activeTab === 'output' ? 'page' : undefined} type="button" onClick={() => onChange('output')}>
        {projectKind === 'web' ? <Globe size={18} aria-hidden="true" /> : <Terminal size={18} aria-hidden="true" />}
        <span>{projectKind === 'web' ? 'Preview' : 'Output'}</span>
      </button>
      <button className={activeTab === 'history' ? 'active' : ''} aria-current={activeTab === 'history' ? 'page' : undefined} type="button" onClick={() => onChange('history')}>
        <History size={18} aria-hidden="true" />
        <span>History</span>
      </button>
    </nav>
  )
}
