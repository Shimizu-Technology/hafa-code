const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isFocusable(element: HTMLElement) {
  return element.getClientRects().length > 0 && !element.closest('[hidden], [inert]')
}

/** Moves keyboard focus to the next or previous focusable element outside a container. */
export function focusOutside(container: HTMLElement, direction: 1 | -1) {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !container.contains(element) && isFocusable(element))
  const target = direction === 1
    ? candidates.find((element) => container.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
    : candidates.reverse().find((element) => container.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING)
  target?.focus()
  return Boolean(target)
}

/** Focuses the visible Run (or preview refresh) control for the active project. */
export function focusRunControl() {
  const target = Array.from(document.querySelectorAll<HTMLElement>('[data-hafa-run-button]'))
    .find((element) => isFocusable(element) && !(element as HTMLButtonElement).disabled)
  target?.focus()
  return Boolean(target)
}

export function isApplePlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
}
