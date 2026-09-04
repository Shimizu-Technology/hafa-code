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

/** Collects rendered descendant text while excluding hidden and non-rendered elements. */
export function visibleTextContent(element: Element): string {
  return Array.from(element.childNodes).map((node) => {
    if (node.nodeType === 3) return node.textContent ?? ''
    if (node.nodeType !== 1) return ''
    const child = node as Element
    if (isObviouslyHidden(child) || /^(SCRIPT|STYLE|TEMPLATE)$/.test(child.tagName)) return ''
    return visibleTextContent(child)
  }).join('')
}
