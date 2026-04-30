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

export function buildHtmlPreview(files: ProjectFile[]) {
  const html = files.find((file) => file.language === 'html')?.content ?? ''
  const css = files.find((file) => file.language === 'css')?.content ?? ''
  const js = files.find((file) => file.path === 'script.js')?.content ?? ''
  const cssUrl = dataUrl('text/css', css)
  const jsUrl = dataUrl('text/javascript', js)
  const hasDocumentShell = /<html[\s>]/i.test(html)
  const hasStylesheet = /<link\b[^>]*\bhref=["']\.?\/?style\.css["'][^>]*>/i.test(html)
  const hasScript = /<script\b[^>]*\bsrc=["']\.?\/?script\.js["'][^>]*>\s*<\/script>/i.test(html)
  let preview = html
    .replace(/\bhref=(["'])\.?\/?style\.css\1/gi, `href="${cssUrl}"`)
    .replace(/\bsrc=(["'])\.?\/?script\.js\1/gi, `src="${jsUrl}"`)

  if (!hasDocumentShell) {
    preview = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${cssUrl}" />
  </head>
  <body>
    ${preview}
    <script src="${jsUrl}"></script>
  </body>
</html>`
  } else {
    if (!hasStylesheet && css.trim()) {
      preview = preview.replace(/<\/head>/i, `  <link rel="stylesheet" href="${cssUrl}" />\n  </head>`)
    }
    if (!hasScript && js.trim()) {
      preview = preview.replace(/<\/body>/i, `  <script src="${jsUrl}"></script>\n  </body>`)
    }
  }

  return preview
}

function dataUrl(mimeType: string, content: string) {
  const bytes = new TextEncoder().encode(content)
  const chunks: string[] = []

  for (let index = 0; index < bytes.length; index += 0x8000) {
    chunks.push(String.fromCodePoint(...bytes.slice(index, index + 0x8000)))
  }

  return `data:${mimeType};base64,${btoa(chunks.join(''))}`
}
