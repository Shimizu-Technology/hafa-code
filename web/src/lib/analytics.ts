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

const SENSITIVE_PARAMS = new Set(['token', 'invitation_token', 'code', 'state', 'auth', 'email', 'clerk', 'jwt', 'key', 'secret'])

export function sanitizeAnalyticsUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'https://app.invalid')
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]')
      }
    }
    return parsed.origin === 'https://app.invalid'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString()
  } catch {
    return rawUrl
  }
}

export function sanitizeAnalyticsEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event?.properties) return event
  const props = event.properties
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
  return event
}

let posthogPromise: Promise<PostHogClient | null> | null = null
let initialized = false

function getPostHog(): Promise<PostHogClient | null> {
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
  void getPostHog()
}
