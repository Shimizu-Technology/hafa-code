import { afterEach, describe, expect, test, vi } from 'vitest'
import { loadColorModePreference, loadThemePreference } from './usePreferences'

describe('display preference storage fallbacks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('uses safe defaults when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })

    expect(loadThemePreference()).toBe('system')
    expect(loadColorModePreference()).toBe('default')
  })
})
