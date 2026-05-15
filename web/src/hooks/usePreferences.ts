import { useEffect, useState, useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ColorModePreference = 'default' | 'colorblind'

export const THEME_STORAGE_KEY = 'hafa-code-theme-v1'
export const COLOR_MODE_STORAGE_KEY = 'hafa-code-color-mode-v1'

function subscribeSystemTheme(callback: () => void) {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function getSystemThemeSnapshot() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getServerSystemThemeSnapshot() {
  return false
}

export function useSystemDarkMode() {
  return useSyncExternalStore(subscribeSystemTheme, getSystemThemeSnapshot, getServerSystemThemeSnapshot)
}

export function useResponsiveEditorFontSize() {
  const [fontSize, setFontSize] = useState(() => window.matchMedia('(max-width: 640px)').matches ? 16 : 14)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)')
    const updateFontSize = () => setFontSize(query.matches ? 16 : 14)

    updateFontSize()
    query.addEventListener('change', updateFontSize)
    return () => query.removeEventListener('change', updateFontSize)
  }, [])

  return fontSize
}

export function loadThemePreference(): ThemePreference {
  const value = localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function loadColorModePreference(): ColorModePreference {
  return localStorage.getItem(COLOR_MODE_STORAGE_KEY) === 'colorblind' ? 'colorblind' : 'default'
}
