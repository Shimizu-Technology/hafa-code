import type { ColorModePreference, ThemePreference } from '../hooks/usePreferences'

type DisplaySettingsProps = {
  colorMode: ColorModePreference
  theme: ThemePreference
  onColorModeChange: (mode: ColorModePreference) => void
  onThemeChange: (theme: ThemePreference) => void
}

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** The Theme and Color-safe controls, shared by the workspace settings and the labs. */
export function DisplaySettings({ colorMode, theme, onColorModeChange, onThemeChange }: DisplaySettingsProps) {
  return (
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
  )
}
