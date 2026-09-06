import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  clearProjectPendingCloudSync,
  markProjectPendingCloudSync,
  pendingCloudProjectIds,
  replacePendingCloudProjectId,
} from './cloudSyncStorage'

describe('pending cloud sync registry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('persists, replaces, and clears project identities', () => {
    markProjectPendingCloudSync('local-draft', '2026-07-25T01:00:00.000Z')
    expect(pendingCloudProjectIds()).toEqual(new Set(['local-draft']))

    replacePendingCloudProjectId('local-draft', '42', '2026-07-25T01:00:01.000Z')
    expect(pendingCloudProjectIds()).toEqual(new Set(['42']))

    clearProjectPendingCloudSync('42')
    expect(pendingCloudProjectIds()).toEqual(new Set())
  })

  test('recovers safely from malformed local storage', () => {
    localStorage.setItem('hafa-code-pending-cloud-sync-v1', '{not json')
    expect(pendingCloudProjectIds()).toEqual(new Set())
  })

  test('keeps running when browser storage rejects sync markers', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })

    expect(markProjectPendingCloudSync('local-draft', '2026-07-25T01:00:00.000Z')).toBe(false)
    expect(clearProjectPendingCloudSync('local-draft')).toBe(false)
  })
})
