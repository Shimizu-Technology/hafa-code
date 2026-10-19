import { Plus, Settings2 } from 'lucide-react'
import type { ColorModePreference, ThemePreference } from '../hooks/usePreferences'
import { Popover } from './Popover'

type WorkspaceOption = { id: string; label: string }

type WorkspaceSettingsProps = {
  activeWorkspaceId: string | null
  canCreateOrganization: boolean
  colorMode: ColorModePreference
  theme: ThemePreference
  workspaceDescription: string
  workspaceIsSettling: boolean
  workspaces: WorkspaceOption[]
  onColorModeChange: (mode: ColorModePreference) => void
  onCreateOrganization: () => void
  onThemeChange: (theme: ThemePreference) => void
  onWorkspaceChange: (workspaceId: string | null) => void
}

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** App bar settings: which workspace is open and how Hafa Code looks. */
export function WorkspaceSettings({
  activeWorkspaceId,
  canCreateOrganization,
  colorMode,
  theme,
  workspaceDescription,
  workspaceIsSettling,
  workspaces,
  onColorModeChange,
  onCreateOrganization,
  onThemeChange,
  onWorkspaceChange,
}: WorkspaceSettingsProps) {
  return (
    <Popover
      className="settings-menu"
      triggerClassName="ghost icon-button app-bar-icon"
      trigger={<Settings2 size={18} aria-hidden="true" />}
      triggerLabel="Workspace and display settings"
      title="Settings"
      panelLabel="Workspace and display settings"
      panelClassName="menu-panel settings-panel"
    >
      <>
          <div className="menu-section">
            <label className="menu-field" htmlFor="workspace-select">
              <span className="menu-heading">Switch workspace</span>
              <select
                id="workspace-select"
                className="workspace-select"
                disabled={workspaceIsSettling}
                value={activeWorkspaceId ?? 'personal'}
                onChange={(event) => onWorkspaceChange(event.target.value === 'personal' ? null : event.target.value)}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>{workspace.label}</option>
                ))}
              </select>
            </label>
            <small className="menu-help">{workspaceDescription}</small>
            {canCreateOrganization && (
              <button className="menu-item" type="button" data-popover-close onClick={onCreateOrganization}>
                <Plus size={16} aria-hidden="true" /> New organization workspace
              </button>
            )}
          </div>
          <div className="menu-section">
            <p className="menu-heading" id="theme-heading">Theme</p>
            <div className="segmented" role="group" aria-labelledby="theme-heading">
              {THEMES.map((option) => (
                <button
                  key={option.value}
                  className={theme === option.value ? 'active' : ''}
                  type="button"
                  aria-pressed={theme === option.value}
                  onClick={() => onThemeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              className={`menu-toggle${colorMode === 'colorblind' ? ' active' : ''}`}
              type="button"
              aria-pressed={colorMode === 'colorblind'}
              aria-describedby="color-safe-help"
              onClick={() => onColorModeChange(colorMode === 'colorblind' ? 'default' : 'colorblind')}
            >
              Color-safe
            </button>
            <small className="menu-help" id="color-safe-help">Blue and orange instead of red and green, with underlined selections.</small>
          </div>
      </>
    </Popover>
  )
}
