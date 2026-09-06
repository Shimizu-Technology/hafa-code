import { describe, expect, it, vi } from 'vitest'
import { bundleCommonJsModules } from './commonJsBundle'

describe('TypeScript CommonJS bundle', () => {
  it('embeds project modules and starts from the configured entry module', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const bundle = bundleCommonJsModules({
      'main.js': 'const greeting = require("./greeting"); console.log(greeting.value);',
      'greeting.js': 'exports.value = "Hafa adai";',
    }, 'main.js')

    new Function(bundle)()
    expect(bundle).toContain('__hafa_require__("main.js")')
    expect(bundle).toContain('greeting.js')
    expect(bundle).toContain('Packages are unavailable in Hafa Code TypeScript')
    expect(log).toHaveBeenCalledWith('Hafa adai')
    log.mockRestore()
  })

  it('escapes HTML-significant source while serializing modules', () => {
    expect(bundleCommonJsModules({ 'main.js': 'console.log("</script>")' }, 'main.js')).not.toContain('</script>')
  })

  it('rejects package imports inside the QuickJS module boundary', () => {
    const bundle = bundleCommonJsModules({ 'main.js': 'require("node:fs");' }, 'main.js')

    expect(() => new Function(bundle)()).toThrow('Packages are unavailable in Hafa Code TypeScript: node:fs')
  })

  it('resolves nested relative modules and caches circular imports', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const bundle = bundleCommonJsModules({
      'main.js': 'const result = require("./lib/result"); console.log(result.value);',
      'lib/result.js': 'exports.value = "before"; const helper = require("./helper"); exports.value += helper.suffix;',
      'lib/helper.js': 'const result = require("./result"); exports.suffix = result.value === "before" ? "-cached" : "-missing";',
    }, 'main.js')

    new Function(bundle)()
    expect(log).toHaveBeenCalledWith('before-cached')
    log.mockRestore()
  })

  it('supports module paths that are special object property names', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const bundle = bundleCommonJsModules({
      'main.js': 'console.log(require("./__proto__").value);',
      '__proto__.js': 'exports.value = "safe";',
    }, 'main.js')

    new Function(bundle)()
    expect(log).toHaveBeenCalledWith('safe')
    log.mockRestore()
  })
})
