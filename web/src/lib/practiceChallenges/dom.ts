/** Reports whether an element or one of its ancestors is explicitly hidden. */
export function isObviouslyHidden(element: Element) {
  let current: Element | null = element
  while (current) {
    const inlineStyle = (current as HTMLElement).style
    if (
      current.hasAttribute('hidden')
      || current.getAttribute('aria-hidden')?.toLowerCase() === 'true'
      || inlineStyle?.display.toLowerCase() === 'none'
      || inlineStyle?.visibility.toLowerCase() === 'hidden'
    ) return true
    current = current.parentElement
  }
  return false
}
