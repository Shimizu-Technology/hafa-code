import { describe, expect, test } from 'vitest'
import {
  clearProjectPendingCloudSync,
  markProjectPendingCloudSync,
  pendingCloudProjectIds,
  replacePendingCloudProjectId,
} from './cloudSyncStorage'

describe('pending cloud sync registry', () => {
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
})
