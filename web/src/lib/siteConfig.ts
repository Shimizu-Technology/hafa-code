export const PUBLIC_SITE_URL = 'https://code.shimizu-technology.com'
export const LEGACY_SITE_HOST = 'hafa-code.netlify.app'

export function isLegacySiteHost(hostname = window.location.hostname) {
  return hostname === LEGACY_SITE_HOST
}
