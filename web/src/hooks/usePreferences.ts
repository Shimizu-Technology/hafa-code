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

/**
 * Phones and touch-first devices (including a phone turned sideways, wider than 640px)
 * get 16px code so iOS does not zoom into the editor; desktops get 14px.
 */
export const LARGE_CODE_QUERY = '(max-width: 640px), (pointer: coarse)'
export const CODE_SIZE_DESKTOP = 14
export const CODE_SIZE_TOUCH = 16

export function codeSizeFor(matchesLargeCode: boolean) {
  return matchesLargeCode ? CODE_SIZE_TOUCH : CODE_SIZE_DESKTOP
}

export function useResponsiveEditorFontSize() {
  const [fontSize, setFontSize] = useState(() => codeSizeFor(window.matchMedia(LARGE_CODE_QUERY).matches))

  useEffect(() => {
    const query = window.matchMedia(LARGE_CODE_QUERY)
    const updateFontSize = () => setFontSize(codeSizeFor(query.matches))

    updateFontSize()
    query.addEventListener('change', updateFontSize)
    return () => query.removeEventListener('change', updateFontSize)
  }, [])

  return fontSize
}

export function loadThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function loadColorModePreference(): ColorModePreference {
  try {
    return localStorage.getItem(COLOR_MODE_STORAGE_KEY) === 'colorblind' ? 'colorblind' : 'default'
  } catch {
    return 'default'
  }
}
