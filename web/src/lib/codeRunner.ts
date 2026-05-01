export type RunnerLanguage = 'ruby' | 'javascript'

export type ProjectKind = RunnerLanguage | 'web'

export interface ProjectFile {
  path: string
  language: 'ruby' | 'javascript' | 'html' | 'css'
  content: string
}

export interface SavedProject {
  id: string
  title: string
  kind: ProjectKind
  files: ProjectFile[]
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}

export interface ProjectSnapshot {
  title: string
  kind: ProjectKind
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
      files: [{ path: 'main.js', language: 'javascript', content: 'console.log("Hafa adai, JavaScript!")\n\nfor (let i = 1; i <= 3; i++) {\n  console.log(`Line ${i}`)\n}\n' }],
      createdAt: now,
      updatedAt: now,
    }
  }

  return {
    id,
    title: 'Web Page Playground',
    kind,
    files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>Hafa Code Page</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <main>\n      <h1>Hafa adai!</h1>\n      <p>Edit HTML, CSS, and JS to build a page.</p>\n      <button id="hello">Click me</button>\n    </main>\n    <script src="script.js"></script>\n  </body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 2rem;\n  background: #0f172a;\n  color: white;\n}\n\nmain {\n  max-width: 680px;\n  margin: auto;\n}\n\nbutton {\n  border: 0;\n  border-radius: 999px;\n  padding: 0.75rem 1rem;\n  background: #ef4444;\n  color: white;\n  font-weight: 700;\n}\n' },
      { path: 'script.js', language: 'javascript', content: 'document.querySelector("#hello")?.addEventListener("click", () => {\n  alert("You shipped your first web interaction!")\n})\n' },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

export function buildHtmlPreview(files: ProjectFile[], parentOrigin: string) {
  const html = files.find((file) => file.language === 'html')?.content ?? ''
  const cssFile = files.find((file) => file.path === 'style.css')
  const jsFile = files.find((file) => file.path === 'script.js')
  const cssUrl = cssFile ? dataUrl('text/css', cssFile.content) : null
  const jsUrl = jsFile ? dataUrl('text/javascript', jsFile.content) : null
  const hasDocumentShell = /<html[\s>]/i.test(html)
  let preview = html

  if (cssUrl) {
    preview = preview.replace(/\bhref=(["'])\.?\/?style\.css\1/gi, `href="${cssUrl}"`)
  }
  if (jsUrl) {
    preview = preview.replace(/\bsrc=(["'])\.?\/?script\.js\1/gi, `src="${jsUrl}"`)
  }

  preview = injectConsoleBridge(preview, hasDocumentShell, parentOrigin)

  if (!hasDocumentShell) {
    preview = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${consoleBridge(parentOrigin)}
    ${cssUrl ? `<link rel="stylesheet" href="${cssUrl}" />` : ''}
  </head>
  <body>
    ${preview}
    ${jsUrl ? `<script src="${jsUrl}"></script>` : ''}
  </body>
</html>`
  }

  return preview
}

function injectConsoleBridge(html: string, hasDocumentShell: boolean, parentOrigin: string) {
  if (!hasDocumentShell) return html
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n    ${consoleBridge(parentOrigin)}`)
  }
  return html.replace(/<html([^>]*)>/i, `<html$1>\n  <head>\n    ${consoleBridge(parentOrigin)}\n  </head>`)
}

function consoleBridge(parentOrigin: string) {
  const targetOrigin = JSON.stringify(parentOrigin)

  return `<script>
      (() => {
        const formatValue = (value) => {
          if (value instanceof Error) return value.stack || value.message
          if (typeof value === 'string') return value
          try { return JSON.stringify(value) } catch { return String(value) }
        }
        const parentOrigin = ${targetOrigin}
        const send = (level, values) => {
          window.parent?.postMessage({
            source: 'hafa-code-preview-console',
            level,
            message: values.map(formatValue).join(' ')
          }, parentOrigin)
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
