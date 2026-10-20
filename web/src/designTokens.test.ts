/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest runs from web/; read the stylesheet as text (CSS imports are stubbed in tests).
const css = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The body of a top-level rule for exactly this selector (not one nested in a media query). */
function blockFor(selector: string) {
  let depth = 0
  for (let index = 0; index < css.length; index += 1) {
    const atLineStart = index === 0 || css[index - 1] === '\n'
    if (depth === 0 && atLineStart && css.startsWith(`${selector} {`, index)) {
      const open = index + selector.length + 1
      let inner = 0
      for (let end = open; end < css.length; end += 1) {
        if (css[end] === '{') inner += 1
        if (css[end] === '}' && --inner === 0) return css.slice(open + 1, end)
      }
      return ''
    }
    if (css[index] === '{') depth += 1
    if (css[index] === '}') depth -= 1
  }
  return ''
}

const ROLE_TOKENS = [
  '--surface-page', '--surface-panel', '--surface-sunken', '--surface-code',
  '--text-strong', '--text-body', '--text-muted', '--text-faint',
  '--border-subtle', '--border-strong',
  '--action-primary', '--action-primary-hover', '--action-primary-ink',
  '--focus-ring',
  '--status-success', '--status-success-surface', '--status-danger', '--status-danger-surface',
  '--status-warning', '--status-warning-surface', '--status-info', '--status-info-surface',
  '--accent-gold',
]

describe('design tokens', () => {
  it('defines every role token for light and swaps each one for dark', () => {
    const light = blockFor(':root')
    const dark = blockFor('[data-theme="dark"]')
    for (const token of ROLE_TOKENS) {
      expect(light, `${token} in :root`).toContain(`${token}:`)
      expect(dark, `${token} in dark`).toContain(`${token}:`)
    }
  })

  it('defines the type, space, radius, shadow, and motion scales', () => {
    const light = blockFor(':root')
    for (const token of [
      '--text-2xs', '--text-xs', '--text-sm', '--text-base', '--text-lg', '--text-xl', '--text-display', '--code-size',
      '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7', '--space-8',
      '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-pill',
      '--shadow-panel', '--shadow-overlay', '--shadow-signature',
      '--ease-out', '--duration-press', '--duration-ui', '--duration-panel',
    ]) expect(light, token).toContain(`${token}:`)
    expect(light).toContain('--text-faint: #7d7064')
    expect(light).toContain('--code-size: 14px')
  })

  it('keeps color-safe mode as a token swap', () => {
    expect(blockFor('[data-color-mode="colorblind"]')).toContain('--action-primary: #0072b2')
  })

  it('never uses a custom property that is not defined', () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]))
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]))
    expect([...used].filter((token) => !defined.has(token))).toEqual([])
  })

  it('keeps raw colors inside token definitions', () => {
    const offenders = css.split('\n').filter((line) => /#[0-9a-f]{3,8}\b/i.test(line) && !/^\s*--[\w-]+\s*:/.test(line))
    expect(offenders).toEqual([])
  })

  it('uses one focus ring, gated hover, a press scale, and no transition-all or panel blur', () => {
    expect(css).toMatch(/:focus-visible \{\s*outline: 2px solid var\(--focus-ring\);\s*outline-offset: 2px;/)
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/)
    expect(css).toMatch(/transform: scale\(0\.97\)/)
    expect(css).not.toMatch(/transition:\s*all/)
    expect(css).not.toMatch(/backdrop-filter/)
    expect(css).not.toMatch(/translateY\(-2px\)/)
  })

  it('limits weights to 400–700 and keeps Space Grotesk for the wordmark and display text', () => {
    const weights = new Set([...css.matchAll(/font-weight:\s*(\d+)/g)].map((match) => Number(match[1])))
    expect([...weights].every((weight) => weight >= 400 && weight <= 700)).toBe(true)
    expect(css.match(/var\(--font-display\)/g)?.length ?? 0).toBeLessThanOrEqual(3)
  })

  it('gates every hover rule behind a fine pointer so taps never leave sticky hover', () => {
    const ungated: string[] = []
    const stack: string[] = []
    let selector = ''
    for (const character of css) {
      if (character === '{') {
        const current = selector.trim()
        stack.push(current)
        if (current.includes(':hover') && !stack.some((entry) => /@media[^{]*hover:\s*hover/.test(entry))) ungated.push(current)
        selector = ''
      } else if (character === '}') {
        stack.pop()
        selector = ''
      } else if (character === ';') {
        selector = ''
      } else {
        selector += character
      }
    }
    expect(ungated).toEqual([])
  })
})
