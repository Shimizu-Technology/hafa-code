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
      { path: 'index.html', language: 'html', content: '<main>\n  <h1>Hafa adai!</h1>\n  <p>Edit HTML, CSS, and JS to build a page.</p>\n  <button id="hello">Click me</button>\n</main>\n' },
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

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>${js.replaceAll('</script>', '<\\/script>')}</script>
  </body>
</html>`
}
