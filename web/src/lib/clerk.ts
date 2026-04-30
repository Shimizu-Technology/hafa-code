const CLERK_PUBLISHABLE_KEY_PATTERN = /^pk_(test|live)_[A-Za-z0-9_-]+$/

export function hasClerkPublishableKey(value: unknown) {
  return typeof value === 'string' && CLERK_PUBLISHABLE_KEY_PATTERN.test(value)
}
