import { FlaskConical, Plus, Settings2 } from 'lucide-react'
import type { ColorModePreference, ThemePreference } from '../hooks/usePreferences'
import { LAB_DESTINATIONS } from '../lib/labDestinations'
import { DisplaySettings } from './DisplaySettings'
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
          <DisplaySettings colorMode={colorMode} theme={theme} onColorModeChange={onColorModeChange} onThemeChange={onThemeChange} />
          <div className="menu-section">
            <p className="menu-heading">Labs</p>
            {LAB_DESTINATIONS.map((destination) => (
              <a key={destination.id} className="menu-link" href={destination.href} aria-describedby={`${destination.id}-lab-help`}>
                <FlaskConical size={16} aria-hidden="true" /> {destination.shortLabel} (experimental)
              </a>
            ))}
            {LAB_DESTINATIONS.map((destination) => (
              <small key={destination.id} className="menu-help" id={`${destination.id}-lab-help`}>{destination.description}</small>
            ))}
          </div>
      </>
    </Popover>
  )
}
