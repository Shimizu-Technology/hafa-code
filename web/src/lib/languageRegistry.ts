import type { ProjectFile, ProjectFileLanguage, ProjectKind, RunnerLanguage } from './projectTypes'

interface FileLanguageDefinition {
  label: string
  monacoLanguage: string
  extensions: readonly string[]
  starterContent: string
}

export interface RunnerDefinition {
  language: RunnerLanguage
  runLabel: string
  terminalCommand: (entryPath: string) => string
  createWorker: () => Worker
  startupTimeoutMs?: number
  executionTimeoutMs?: number
  startupNote?: string
}

export interface ProjectKindDefinition {
  kind: ProjectKind
  label: string
  shortLabel: string
  starterTitle: string
  entryPath: string
  starterFiles: readonly ProjectFile[]
  preferredEntryPaths: readonly string[]
  defaultFileLanguage: ProjectFileLanguage
  fallbackFileLanguage: ProjectFileLanguage
  newFileCandidates: readonly string[]
  defaultExtension: string
  runner?: RunnerDefinition
}

export const FILE_LANGUAGE_DEFINITIONS = {
  ruby: {
    label: 'Ruby',
    monacoLanguage: 'ruby',
    extensions: ['rb'],
    starterContent: '# Write Ruby here\n',
  },
  javascript: {
    label: 'JS',
    monacoLanguage: 'javascript',
    extensions: ['js', 'mjs', 'cjs'],
    starterContent: '// Write JavaScript here\n',
  },
  python: {
    label: 'Python',
    monacoLanguage: 'python',
    extensions: ['py', 'pyw'],
    starterContent: '# Write Python here\n',
  },
  java: {
    label: 'Java',
    monacoLanguage: 'java',
    extensions: ['java'],
    starterContent: '// Write Java here\n',
  },
  html: {
    label: 'HTML',
    monacoLanguage: 'html',
    extensions: ['html', 'htm'],
    starterContent: '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>New Page</title>\n  </head>\n  <body>\n    <h1>New page</h1>\n  </body>\n</html>\n',
  },
  css: {
    label: 'CSS',
    monacoLanguage: 'css',
    extensions: ['css'],
    starterContent: '/* Write CSS here */\n',
  },
  json: {
    label: 'JSON',
    monacoLanguage: 'json',
    extensions: ['json'],
    starterContent: '{\n  "message": "Hafa adai"\n}\n',
  },
  plain: {
    label: 'Text',
    monacoLanguage: 'javascript',
    extensions: [],
    starterContent: '',
  },
} as const satisfies Record<ProjectFileLanguage, FileLanguageDefinition>

export const PROJECT_KIND_DEFINITIONS = {
  ruby: {
    kind: 'ruby',
    label: 'Ruby',
    shortLabel: 'Ruby',
    starterTitle: 'Ruby Playground',
    entryPath: 'main.rb',
    starterFiles: [
      { path: 'main.rb', language: 'ruby', content: 'puts "Hafa adai, Ruby!"\n\n3.times do |i|\n  puts "Line #{i + 1}"\nend\n' },
    ],
    preferredEntryPaths: ['main.rb'],
    defaultFileLanguage: 'ruby',
    fallbackFileLanguage: 'ruby',
    newFileCandidates: ['helper.rb', 'greeting.rb', 'practice.rb'],
    defaultExtension: 'rb',
    runner: {
      language: 'ruby',
      runLabel: 'Ruby',
      terminalCommand: (entryPath) => `ruby ${entryPath}`,
      createWorker: () => new Worker(new URL('../workers/rubyRunner.worker.ts', import.meta.url), { type: 'module' }),
    },
  },
  javascript: {
    kind: 'javascript',
    label: 'JavaScript',
    shortLabel: 'JS',
    starterTitle: 'JavaScript Playground',
    entryPath: 'main.js',
    starterFiles: [
      { path: 'main.js', language: 'javascript', content: 'console.log("Hafa adai, JavaScript!")\n\nfor (let i = 1; i <= 3; i++) {\n  console.log(`Line ${i}`)\n}\n' },
    ],
    preferredEntryPaths: ['main.js', 'index.js'],
    defaultFileLanguage: 'javascript',
    fallbackFileLanguage: 'plain',
    newFileCandidates: ['helper.js', 'utils.js', 'practice.js'],
    defaultExtension: 'js',
    runner: {
      language: 'javascript',
      runLabel: 'JS',
      terminalCommand: (entryPath) => `node ${entryPath}`,
      createWorker: () => new Worker(new URL('../workers/javascriptRunner.worker.ts', import.meta.url), { type: 'module' }),
    },
  },
  python: {
    kind: 'python',
    label: 'Python',
    shortLabel: 'Python',
    starterTitle: 'Python Playground',
    entryPath: 'main.py',
    starterFiles: [
      { path: 'main.py', language: 'python', content: 'print("Hafa adai, Python!")\n\nfor line in range(1, 4):\n    print(f"Line {line}")\n' },
    ],
    preferredEntryPaths: ['main.py', 'app.py'],
    defaultFileLanguage: 'python',
    fallbackFileLanguage: 'python',
    newFileCandidates: ['helper.py', 'utils.py', 'practice.py'],
    defaultExtension: 'py',
    runner: {
      language: 'python',
      runLabel: 'Python',
      terminalCommand: (entryPath) => `python ${entryPath}`,
      createWorker: () => new Worker(new URL('../workers/pythonRunner.worker.ts', import.meta.url), { type: 'module' }),
    },
  },
  java: {
    kind: 'java',
    label: 'Java',
    shortLabel: 'Java',
    starterTitle: 'Java Playground',
    entryPath: 'Main.java',
    starterFiles: [
      { path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hafa adai, Java!");\n\n    for (int line = 1; line <= 3; line++) {\n      System.out.println("Line " + line);\n    }\n  }\n}\n' },
    ],
    preferredEntryPaths: ['Main.java'],
    defaultFileLanguage: 'java',
    fallbackFileLanguage: 'java',
    newFileCandidates: ['Helper.java', 'Greeting.java', 'Practice.java'],
    defaultExtension: 'java',
    runner: {
      language: 'java',
      runLabel: 'Java',
      terminalCommand: (entryPath) => `javac ${entryPath} && java ${entryPath.replace(/\.java$/i, '')}`,
      createWorker: () => new Worker(new URL('../workers/javaRunner.worker.ts', import.meta.url)),
      startupTimeoutMs: 120_000,
      executionTimeoutMs: 30_000,
      startupNote: 'The first Java run downloads the browser compiler and may take longer on a mobile connection.',
    },
  },
  web: {
    kind: 'web',
    label: 'HTML/CSS/JS',
    shortLabel: 'Web',
    starterTitle: 'Web Page Playground',
    entryPath: 'index.html',
    starterFiles: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>Hafa Code Page</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <main>\n      <h1>Hafa adai!</h1>\n      <p>Edit HTML, CSS, and JS to build a page.</p>\n      <button id="hello">Click me</button>\n    </main>\n    <script src="script.js"></script>\n  </body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 2rem;\n  background: #0f172a;\n  color: white;\n}\n\nmain {\n  max-width: 680px;\n  margin: auto;\n}\n\nbutton {\n  border: 0;\n  border-radius: 999px;\n  padding: 0.75rem 1rem;\n  background: #ef4444;\n  color: white;\n  font-weight: 700;\n}\n' },
      { path: 'script.js', language: 'javascript', content: 'document.querySelector("#hello")?.addEventListener("click", () => {\n  alert("You shipped your first web interaction!")\n})\n' },
    ],
    preferredEntryPaths: ['index.html', 'main.html'],
    defaultFileLanguage: 'html',
    fallbackFileLanguage: 'plain',
    newFileCandidates: ['about.html', 'styles.css', 'app.js'],
    defaultExtension: 'html',
  },
} as const satisfies Record<ProjectKind, ProjectKindDefinition>

export const PROJECT_KINDS = Object.freeze(Object.keys(PROJECT_KIND_DEFINITIONS)) as readonly ProjectKind[]
export const FILE_LANGUAGES = Object.freeze(Object.keys(FILE_LANGUAGE_DEFINITIONS)) as readonly ProjectFileLanguage[]

export function projectKindDefinition(kind: ProjectKind): ProjectKindDefinition {
  return PROJECT_KIND_DEFINITIONS[kind]
}

export function fileLanguageDefinition(language: ProjectFileLanguage): FileLanguageDefinition {
  return FILE_LANGUAGE_DEFINITIONS[language]
}

export function fileLanguageForPath(path: string): ProjectFileLanguage | null {
  const extension = path.toLowerCase().split('.').pop() ?? ''
  return FILE_LANGUAGES.find((language) => (
    FILE_LANGUAGE_DEFINITIONS[language].extensions as readonly string[]
  ).includes(extension)) ?? null
}

export function isProjectKind(value: unknown): value is ProjectKind {
  return typeof value === 'string' && PROJECT_KINDS.includes(value as ProjectKind)
}

export function isProjectFileLanguage(value: unknown): value is ProjectFileLanguage {
  return typeof value === 'string' && FILE_LANGUAGES.includes(value as ProjectFileLanguage)
}
