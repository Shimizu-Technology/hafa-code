export type RunnerLanguage = 'ruby' | 'javascript'

export type ProjectKind = RunnerLanguage | 'web'

export interface ProjectFile {
  path: string
  language: 'ruby' | 'javascript' | 'html' | 'css' | 'json' | 'plain'
  content: string
}

export interface SavedProject {
  id: string
  title: string
  kind: ProjectKind
  entryPath: string
  files: ProjectFile[]
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}

export interface ProjectSnapshot {
  title: string
  kind: ProjectKind
  entryPath: string
  files: ProjectFile[]
}

export interface ProjectCheckpoint {
  id: string
  title: string
  createdAt: string
  snapshot?: ProjectSnapshot
}

export const RUNNER_TIMEOUT_MS = 3000

export function starterProject(kind: ProjectKind): SavedProject {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  if (kind === 'ruby') {
    return {
      id,
      title: 'Ruby Playground',
      kind,
      entryPath: 'main.rb',
      files: [{ path: 'main.rb', language: 'ruby', content: 'puts "Hafa adai, Ruby!"\n\n3.times do |i|\n  puts "Line #{i + 1}"\nend\n' }],
      createdAt: now,
      updatedAt: now,
    }
  }

  if (kind === 'javascript') {
    return {
      id,
      title: 'JavaScript Playground',
      kind,
      entryPath: 'main.js',
      files: [{ path: 'main.js', language: 'javascript', content: 'console.log("Hafa adai, JavaScript!")\n\nfor (let i = 1; i <= 3; i++) {\n  console.log(`Line ${i}`)\n}\n' }],
      createdAt: now,
      updatedAt: now,
    }
  }

  return {
    id,
    title: 'Web Page Playground',
    kind,
    entryPath: 'index.html',
    files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>Hafa Code Page</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <main>\n      <h1>Hafa adai!</h1>\n      <p>Edit HTML, CSS, and JS to build a page.</p>\n      <button id="hello">Click me</button>\n    </main>\n    <script src="script.js"></script>\n  </body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 2rem;\n  background: #0f172a;\n  color: white;\n}\n\nmain {\n  max-width: 680px;\n  margin: auto;\n}\n\nbutton {\n  border: 0;\n  border-radius: 999px;\n  padding: 0.75rem 1rem;\n  background: #ef4444;\n  color: white;\n  font-weight: 700;\n}\n' },
      { path: 'script.js', language: 'javascript', content: 'document.querySelector("#hello")?.addEventListener("click", () => {\n  alert("You shipped your first web interaction!")\n})\n' },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

export function inferFileLanguage(path: string, kind: ProjectKind): ProjectFile['language'] {
  const extension = path.toLowerCase().split('.').pop()
  if (extension === 'rb') return 'ruby'
  if (extension === 'html' || extension === 'htm') return 'html'
  if (extension === 'css') return 'css'
  if (extension === 'js' || extension === 'mjs' || extension === 'cjs') return 'javascript'
  if (extension === 'json') return 'json'
  if (kind === 'ruby') return 'ruby'
  return 'plain'
}

export function defaultEntryPath(files: ProjectFile[], kind: ProjectKind) {
  const preferred = kind === 'web'
    ? ['index.html', 'main.html']
    : kind === 'ruby'
      ? ['main.rb']
      : ['main.js', 'index.js']
  return preferred.map((path) => files.find((file) => file.path === path)?.path).find(Boolean)
    ?? files.find((file) => file.language === (kind === 'web' ? 'html' : kind))?.path
    ?? files[0]?.path
    ?? ''
}

export function buildHtmlPreview(files: ProjectFile[], entryPath?: string) {
  const htmlFile = files.find((file) => file.path === entryPath && file.language === 'html')
    ?? files.find((file) => file.language === 'html')
  const html = htmlFile?.content ?? ''
  const hasDocumentShell = /<html[\s>]/i.test(html)
  const basePath = htmlFile ? dirname(htmlFile.path) : ''
  let preview = html

  preview = rewriteLocalAssetReferences(preview, files, basePath)
  preview = injectConsoleBridge(preview, hasDocumentShell, files, basePath)

  if (!hasDocumentShell) {
    const cssLinks = files
      .filter((file) => file.language === 'css')
      .map((file) => `<link rel="stylesheet" href="${dataUrlForFile(file, files)}" />`)
      .join('\n    ')
    const jsScripts = files
      .filter((file) => file.language === 'javascript')
      .map((file) => `<script src="${dataUrlForFile(file, files)}"></script>`)
      .join('\n    ')
    preview = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${previewBridge(files, basePath)}
    ${cssLinks}
  </head>
  <body>
    ${preview}
    ${jsScripts}
  </body>
</html>`
  }

  return preview
}

function rewriteLocalAssetReferences(html: string, files: ProjectFile[], basePath: string) {
  const fileMap = new Map(files.map((file) => [file.path, file]))
  const rewrittenWithDom = rewriteLocalAssetReferencesWithDom(html, files, fileMap, basePath)
  if (rewrittenWithDom) return rewrittenWithDom

  const rewrittenHtml = html.replace(/(^|\s)(src|href)=("|')([^"']+)\3/gi, (match, prefix: string, attribute: string, quote: string, rawPath: string) => {
    if (!shouldRewritePath(rawPath)) return match
    const targetPath = normalizeReferencePath(basePath, rawPath)
    const file = fileMap.get(targetPath)
    if (!file) return match
    return `${prefix}${attribute}=${quote}${dataUrlForFile(file, files)}${quote}`
  })
  return rewriteInlineStyleAttributes(rewrittenHtml, files, basePath)
}

function rewriteLocalAssetReferencesWithDom(html: string, files: ProjectFile[], fileMap: Map<string, ProjectFile>, basePath: string) {
  if (typeof document === 'undefined' || typeof DOMParser === 'undefined') return null

  const hasDocumentShell = /<html[\s>]/i.test(html)
  if (!hasDocumentShell) {
    const template = document.createElement('template')
    template.innerHTML = html
    rewriteAssetElements(template.content, files, fileMap, basePath)
    return template.innerHTML
  }

  const documentHtml = new DOMParser().parseFromString(html, 'text/html')
  rewriteAssetElements(documentHtml, files, fileMap, basePath)
  const doctype = documentHtml.doctype ? '<!doctype html>\n' : ''
  return `${doctype}${documentHtml.documentElement.outerHTML}`
}

function rewriteAssetElements(root: ParentNode, files: ProjectFile[], fileMap: Map<string, ProjectFile>, basePath: string) {
  root.querySelectorAll<HTMLElement>('[src], [href], [style]').forEach((element) => {
    for (const attribute of ['src', 'href'] as const) {
      const rawPath = element.getAttribute(attribute)
      if (!rawPath || !shouldRewritePath(rawPath)) continue
      const file = fileMap.get(normalizeReferencePath(basePath, rawPath))
      if (file) element.setAttribute(attribute, dataUrlForFile(file, files))
    }

    const style = element.getAttribute('style')
    if (style) element.setAttribute('style', rewriteCssUrls(style, files, basePath))
  })
}

function shouldRewritePath(path: string) {
  return !/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(path)
}

function normalizeReferencePath(basePath: string, reference: string) {
  const [withoutQuery] = reference.split(/[?#]/)
  const segments = `${basePath ? `${basePath}/` : ''}${withoutQuery.replace(/^\.\//, '')}`.split('/')
  const normalized: string[] = []

  segments.forEach((segment) => {
    if (!segment || segment === '.') return
    if (segment === '..') normalized.pop()
    else normalized.push(segment)
  })

  return normalized.join('/')
}

function dirname(path: string) {
  return path.includes('/') ? path.split('/').slice(0, -1).join('/') : ''
}

function mimeTypeForFile(file: ProjectFile) {
  if (file.language === 'html') return 'text/html'
  if (file.language === 'css') return 'text/css'
  if (file.language === 'javascript') return 'text/javascript'
  if (file.language === 'json') return 'application/json'
  if (file.path.endsWith('.svg')) return 'image/svg+xml'
  return 'text/plain'
}

function dataUrlForFile(file: ProjectFile, files: ProjectFile[], seen = new Set<string>()): string {
  if (file.language !== 'css') return dataUrl(mimeTypeForFile(file), file.content)
  if (seen.has(file.path)) return dataUrl('text/css', file.content)

  const nextSeen = new Set(seen)
  nextSeen.add(file.path)
  const basePath = dirname(file.path)
  const rewrittenCss: string = file.content.replace(/url\((["']?)([^"')]+)\1\)/gi, (match, quote: string, rawPath: string) => {
    if (!shouldRewritePath(rawPath)) return match
    const targetPath = normalizeReferencePath(basePath, rawPath)
    const targetFile = files.find((candidate) => candidate.path === targetPath)
    if (!targetFile) return match
    return `url(${quote}${dataUrlForFile(targetFile, files, nextSeen)}${quote})`
  })

  return dataUrl('text/css', rewrittenCss)
}

function rewriteInlineStyleAttributes(html: string, files: ProjectFile[], basePath: string) {
  return html.replace(/\sstyle=("|')([^"']+)\1/gi, (_match, quote: string, style: string) => {
    const rewrittenStyle = rewriteCssUrls(style, files, basePath)
    return ` style=${quote}${rewrittenStyle}${quote}`
  })
}

function rewriteCssUrls(css: string, files: ProjectFile[], basePath: string, seen = new Set<string>()) {
  return css.replace(/url\((["']?)([^"')]+)\1\)/gi, (match, quote: string, rawPath: string) => {
    if (!shouldRewritePath(rawPath)) return match
    const targetPath = normalizeReferencePath(basePath, rawPath)
    if (seen.has(targetPath)) return match
    const targetFile = files.find((candidate) => candidate.path === targetPath)
    if (!targetFile) return match
    return `url(${quote}${dataUrlForFile(targetFile, files, seen)}${quote})`
  })
}

function injectConsoleBridge(html: string, hasDocumentShell: boolean, files: ProjectFile[], basePath: string) {
  if (!hasDocumentShell) return html
  const bridge = previewBridge(files, basePath)
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n    ${bridge}`)
  }
  return html.replace(/<html([^>]*)>/i, `<html$1>\n  <head>\n    ${bridge}\n  </head>`)
}

function previewBridge(files: ProjectFile[], basePath: string) {
  const assetMap = Object.fromEntries(files.map((file) => [file.path, {
    content: file.content,
    mimeType: mimeTypeForFile(file),
  }]))

  return `<script>
      (() => {
        const __hafaFiles = ${JSON.stringify(assetMap).replace(/</g, '\\u003c')}
        const __hafaBasePath = ${JSON.stringify(basePath)}
        const __hafaResolvePath = (reference) => {
          if (/^(?:[a-z][a-z0-9+.-]*:|#|\\/\\/)/i.test(reference)) return null
          const path = String(reference).split(/[?#]/)[0]
          const parts = ((__hafaBasePath ? __hafaBasePath + '/' : '') + path.replace(/^\\.\\//, '')).split('/')
          const normalized = []
          for (const part of parts) {
            if (!part || part === '.') continue
            if (part === '..') normalized.pop()
            else normalized.push(part)
          }
          return normalized.join('/')
        }
        const __hafaFetchReference = (input) => {
          const raw = typeof input === 'string' ? input : input?.url
          if (!raw) return null
          if (typeof input === 'string' && !/^(?:[a-z][a-z0-9+.-]*:|\\/\\/)/i.test(raw)) return raw
          try {
            const url = new URL(raw, window.location.href)
            if (url.origin === window.location.origin) return url.pathname + url.search + url.hash
          } catch {
            return String(raw)
          }
          return String(raw)
        }
        const __hafaOriginalFetch = window.fetch?.bind(window)
        if (__hafaOriginalFetch) {
          window.fetch = (input, init) => {
            const reference = __hafaFetchReference(input)
            const resolved = reference ? __hafaResolvePath(reference) : null
            const file = resolved ? __hafaFiles[resolved] : null
            if (file) {
              return Promise.resolve(new Response(file.content, {
                headers: { 'Content-Type': file.mimeType }
              }))
            }
            return __hafaOriginalFetch(input, init)
          }
        }
        const consoleChannel = new MessageChannel()
        const consolePort = consoleChannel.port1
        consolePort.start()
        window.parent?.postMessage({ source: 'hafa-code-preview-console-connect' }, '*', [consoleChannel.port2])
        const formatValue = (value) => {
          if (value instanceof Error) return value.stack || value.message
          if (typeof value === 'string') return value
          try { return JSON.stringify(value) } catch { return String(value) }
        }
        const send = (level, values) => {
          consolePort?.postMessage({
            source: 'hafa-code-preview-console',
            level,
            message: values.map(formatValue).join(' ')
          })
        }
        ;['log', 'warn', 'error'].forEach((level) => {
          const original = console[level].bind(console)
          console[level] = (...values) => {
            send(level, values)
            original(...values)
          }
        })
        window.addEventListener('error', (event) => {
          const target = event.target
          if (target && target !== window) {
            const url = target.src || target.href || target.currentSrc || target.tagName
            send('error', ['Failed to load', url])
            return
          }
          send('error', [event.message || 'Runtime error'])
        }, true)
        window.addEventListener('unhandledrejection', (event) => {
          send('error', [event.reason || 'Unhandled promise rejection'])
        })
      })()
    </script>`
}

function dataUrl(mimeType: string, content: string) {
  const bytes = new TextEncoder().encode(content)
  const chunks: string[] = []

  for (let index = 0; index < bytes.length; index += 0x8000) {
    chunks.push(String.fromCodePoint(...bytes.slice(index, index + 0x8000)))
  }

  return `data:${mimeType};base64,${btoa(chunks.join(''))}`
}
