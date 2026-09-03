import { BookOpen, Files, Globe, History, Layers3, Terminal } from 'lucide-react'
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
        <Layers3 size={18} />
        <span>Home</span>
      </button>
      <button className={activeTab === 'projects' ? 'active' : ''} aria-current={activeTab === 'projects' ? 'page' : undefined} type="button" onClick={() => onChange('projects')}>
        <Files size={18} />
        <span>Projects</span>
      </button>
      <button className={activeTab === 'code' ? 'active' : ''} aria-current={activeTab === 'code' ? 'page' : undefined} type="button" onClick={() => onChange('code')}>
        <BookOpen size={18} />
        <span>Code</span>
      </button>
      <button className={activeTab === 'output' ? 'active' : ''} aria-current={activeTab === 'output' ? 'page' : undefined} type="button" onClick={() => onChange('output')}>
        {projectKind === 'web' ? <Globe size={18} /> : <Terminal size={18} />}
        <span>{projectKind === 'web' ? 'Preview' : 'Output'}</span>
      </button>
      <button className={activeTab === 'history' ? 'active' : ''} aria-current={activeTab === 'history' ? 'page' : undefined} type="button" onClick={() => onChange('history')}>
        <History size={18} />
        <span>History</span>
      </button>
    </nav>
  )
}
