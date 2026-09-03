import { describe, expect, it } from 'vitest'
import { buildHtmlPreview } from './codeRunner'

describe('web preview generation', () => {
  it('gives identical JavaScript files distinct, path-specific runtime URLs', () => {
    const sharedSource = 'throw new Error("boom")'
    const preview = buildHtmlPreview([
      { path: 'index.html', language: 'html', content: '<!doctype html><html><head></head><body><script src="first.js"></script><script src="second.js"></script></body></html>' },
      { path: 'first.js', language: 'javascript', content: sharedSource },
      { path: 'second.js', language: 'javascript', content: sharedSource },
    ], 'index.html')
    const scriptUrls = [...preview.matchAll(/<script src="(data:text\/javascript;[^"]+;base64,[^"]+)"/g)].map((match) => match[1])

    expect(scriptUrls).toHaveLength(2)
    expect(new Set(scriptUrls).size).toBe(2)
    expect(scriptUrls[0]).toContain(';hafa-code-path=first.js;')
    expect(scriptUrls[1]).toContain(';hafa-code-path=second.js;')
  })
})
