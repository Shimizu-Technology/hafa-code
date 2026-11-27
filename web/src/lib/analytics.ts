import type { CaptureResult } from 'posthog-js'

type PostHogClient = typeof import('posthog-js').default

const PLACEHOLDER_KEYS = new Set(['', 'YOUR_POSTHOG_KEY', 'phc_xxxxxxxxxxxxx'])
const POSTHOG_KEY = (import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined)?.trim()
const POSTHOG_HOST =
  (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined)?.trim() ||
  'https://us.i.posthog.com'
const ENABLE_IN_DEV = import.meta.env.VITE_ENABLE_ANALYTICS_IN_DEV === 'true'

export const isAnalyticsEnabled =
  Boolean(POSTHOG_KEY && !PLACEHOLDER_KEYS.has(POSTHOG_KEY)) &&
  (import.meta.env.PROD || ENABLE_IN_DEV)

const SENSITIVE_PARAMS = new Set([
  'token',
  'invitation_token',
  'code',
  'state',
  'auth',
  'email',
  'clerk',
  'jwt',
  'key',
  'secret',
])
const NESTED_URL_KEYS = new Set(['href', 'url', 'name'])

export function sanitizeAnalyticsUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'https://app.invalid')
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]')
      }
    }
    // Strip fragments because classroom invitation links carry #invite=TOKEN.
    parsed.hash = ''
    return parsed.origin === 'https://app.invalid'
      ? `${parsed.pathname}${parsed.search}`
      : parsed.toString()
  } catch {
    return rawUrl
  }
}

function sanitizeNestedReplayValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (
      key &&
      NESTED_URL_KEYS.has(key) &&
      (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/'))
    ) {
      return sanitizeAnalyticsUrl(value)
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeNestedReplayValue(item))
  }
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {}
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      copy[childKey] = sanitizeNestedReplayValue(childValue, childKey)
    }
    return copy
  }
  return value
}

export function sanitizeAnalyticsEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event?.properties) return event
  const props = { ...event.properties }
  for (const key of [
    '$current_url',
    '$referrer',
    '$initial_current_url',
    '$initial_referrer',
    '$session_entry_url',
    '$session_entry_referrer',
  ]) {
    if (typeof props[key] === 'string') {
      props[key] = sanitizeAnalyticsUrl(props[key] as string)
    }
  }
  if ('$snapshot_data' in props && props.$snapshot_data) {
    props.$snapshot_data = sanitizeNestedReplayValue(props.$snapshot_data)
  }
  return { ...event, properties: props }
}

export function maskReplayNetworkRequest<T extends { name?: string }>(request: T): T {
  if (!request?.name) return request
  return {
    ...request,
    name: sanitizeAnalyticsUrl(request.name),
  }
}

let posthogPromise: Promise<PostHogClient | null> | null = null
let initialized = false

export function loadPostHog(): Promise<PostHogClient | null> {
  if (!isAnalyticsEnabled || !POSTHOG_KEY || typeof window === 'undefined') {
    return Promise.resolve(null)
  }
  posthogPromise ||= import('posthog-js')
    .then(({ default: posthog }) => {
      if (!initialized) {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          person_profiles: 'identified_only',
          capture_pageview: 'history_change',
          capture_pageleave: true,
          autocapture: true,
          disable_session_recording: false,
          session_recording: {
            maskAllInputs: true,
            maskTextSelector: '.monaco-editor',
            recordHeaders: false,
            recordBody: false,
            maskCapturedNetworkRequestFn: maskReplayNetworkRequest,
          },
          before_send: sanitizeAnalyticsEvent,
        })
        initialized = true
      }
      return posthog
    })
    .catch(() => {
      posthogPromise = null
      return null
    })
  return posthogPromise
}

export function initAnalytics() {
  if (!isAnalyticsEnabled || typeof window === 'undefined') return
  // Defer analytics loading until after load + idle so it never competes with editor startup.
  const start = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        void loadPostHog()
      }, { timeout: 3000 })
    } else {
      globalThis.setTimeout(() => {
        void loadPostHog()
      }, 1500)
    }
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
