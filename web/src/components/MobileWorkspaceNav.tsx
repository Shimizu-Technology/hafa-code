import { Code2, FolderOpen, Globe, History, House, Terminal } from 'lucide-react'
import type { ProjectKind } from '../lib/codeRunner'
import type { MobileTab } from '../lib/workspace'
import { BottomNav } from './BottomNav'

type MobileWorkspaceNavProps = {
  activeTab: MobileTab
  projectKind: ProjectKind
  onChange: (tab: MobileTab) => void
}

/** Keeps the five primary workspace destinations reachable on small screens. */
export function MobileWorkspaceNav({ activeTab, projectKind, onChange }: MobileWorkspaceNavProps) {
  return (
    <BottomNav
      label="Workspace sections"
      onSelect={onChange}
      items={[
        { id: 'home', label: 'Home', icon: House, current: activeTab === 'home' },
        { id: 'projects', label: 'Projects', icon: FolderOpen, current: activeTab === 'projects' },
        { id: 'code', label: 'Code', icon: Code2, current: activeTab === 'code' },
        {
          id: 'output',
          label: projectKind === 'web' ? 'Preview' : 'Output',
          icon: projectKind === 'web' ? Globe : Terminal,
          current: activeTab === 'output',
        },
        { id: 'history', label: 'History', icon: History, current: activeTab === 'history' },
      ]}
    />
  )
}
