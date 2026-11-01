import { useEffect, useLayoutEffect, useState } from 'react'
import {
  COLOR_MODE_STORAGE_KEY,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  loadColorModePreference,
  loadThemePreference,
  useSystemDarkMode,
  type ColorModePreference,
  type ThemePreference,
} from '../../hooks/usePreferences'

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage may be blocked; the choice still applies to this page.
  }
}

/**
 * The workspace's Theme and Color-safe preferences, shared through the same storage keys, so
 * the lab looks like the workspace the learner came from and a change here carries back.
 */
export function useLabPreferences() {
  const [theme, setThemeState] = useState<ThemePreference>(loadThemePreference)
  const [colorMode, setColorModeState] = useState<ColorModePreference>(loadColorModePreference)
  const systemDark = useSystemDarkMode()
  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // Another tab (the workspace) changed a preference.
  useEffect(() => {
    const update = (event: StorageEvent) => {
      // A null key means another tab cleared storage.
      if (event.key === null || event.key === THEME_STORAGE_KEY) setThemeState(loadThemePreference())
      if (event.key === null || event.key === COLOR_MODE_STORAGE_KEY) setColorModeState(loadColorModePreference())
    }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  }, [])

  // Before paint, so a dark-theme visitor never sees a light first frame.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.dataset.colorMode = colorMode
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', THEME_COLORS[resolvedTheme])
    })
  }, [colorMode, resolvedTheme])

  return {
    theme,
    colorMode,
    resolvedTheme,
    setTheme: (next: ThemePreference) => { setThemeState(next); save(THEME_STORAGE_KEY, next) },
    setColorMode: (next: ColorModePreference) => { setColorModeState(next); save(COLOR_MODE_STORAGE_KEY, next) },
  }
}
