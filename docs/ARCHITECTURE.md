# Hafa Code Architecture

## High-Level Shape

```txt
Rails API + React SPA
  ├─ api/ Rails API-only backend
  │   ├─ Clerk JWT authentication
  │   ├─ Users
  │   ├─ Projects
  │   └─ ProjectFiles
  └─ web/ React + Vite frontend
      ├─ Monaco editors
      ├─ Componentized workspace shell
      ├─ Language-specific runner workers
      │   ├─ Ruby WASM
      │   ├─ QuickJS WASM for JavaScript
      │   ├─ TypeScript compiler + QuickJS WASM
      │   ├─ Pyodide Python WASM
      │   ├─ CheerpJ Java runtime
      │   └─ SQLite WASM in-memory database
      ├─ HTML preview iframe
      └─ Project storage adapter
          ├─ localStorage anonymous fallback
          └─ Rails cloud sync when signed in
```

See [Frontend structure](FRONTEND_STRUCTURE.md) for the current React file layout and cleanup rules.

## Why Browser-Side Execution

Running arbitrary student code on a backend is the expensive and dangerous part of Replit. For CSG/FD beginner use cases, browser-side execution is enough and dramatically safer.

Benefits:

- no container fleet
- no server RCE risk
- cheap static hosting
- works well for snippets and web pages
- easy for OSS contributors to run locally

This boundary is also a product decision. Hafa Code is optimized for the short beginner loop, not for packages, shell access, deployment, or arbitrary backend frameworks. A future remote advanced workspace would be a separate authenticated system with its own isolation, cost, and operations model; it must not weaken the Learn workspace.

## Runners

### Ruby

Use `@ruby/3.3-wasm-wasi` with `@ruby/wasm-wasi`.

Caveat: Ruby WASM is large. Lazy-load it only when the Ruby playground is opened.

### JavaScript

Use `quickjs-emscripten` in a Web Worker.

- capture `console.log/info/warn/error`
- set memory limit
- interrupt after timeout

### TypeScript

Use the official TypeScript compiler API and QuickJS in a dedicated Web Worker.

- load only the ES2020 declaration-library closure needed by the configured compiler target
- type-check all project `.ts` and `.d.ts` files together so relative imports receive semantic diagnostics
- reject unsafe paths, missing entries, more than 50 files, or more than 2,000,000 UTF-8 source bytes before compilation
- compile strict Node16-style modules to CommonJS without packages, DOM declarations, Node declarations, or ambient host APIs
- execute only the emitted project modules inside QuickJS with memory, stack, output, and time limits
- keep the compiler and runner worker out of the service-worker application shell so they load only for TypeScript work

The TypeScript worker never executes emitted JavaScript in the browser worker itself. Its small trusted module loader is part of the string evaluated inside QuickJS. See [TypeScript runtime](TYPESCRIPT_RUNTIME.md) for the exact learner-facing boundary.

### Python

Use the pinned Pyodide npm runtime in a Web Worker. Core runtime files are
self-hosted under the app origin so the runner remains compatible with the
production CSP and can be cached after first use.

- mount every project file into an in-memory project directory
- execute the configured entry file with normal local Python imports
- capture stdout and stderr in the browser terminal
- bridge Python `input()` to the terminal on browsers with WebAssembly JSPI support
- include the Python standard library, but do not auto-download packages
- terminate the worker when the UI timeout expires
- retain an idle worker after successful runs so pinned language runtimes can be reused; project files and module state are reset before each run

### Java

Use CheerpJ 4.3 in a classic Web Worker with its Java 8 runtime. On the first
run, the worker downloads the hosted CheerpJ runtime and the JavaFiddle Java 8
compiler archive. The compiler archive is copied into CheerpJ's transient
`/str` filesystem, so Hafa does not need to proxy or redistribute it.

- compile `Main.java` and default-package helper classes with `javac`
- isolate each run's class output in its own browser filesystem directory
- load compiled classes through a run-scoped class loader
- stream stdout and stderr through a small trusted Java-to-JavaScript bridge
- bridge line-oriented `System.in` reads to the browser terminal
- keep the initialized worker warm for repeat runs
- terminate the entire worker for Stop or timeout
- permit only the CheerpJ and JavaFiddle hosts in the Java worker's production CSP

The first release targets Java 8 language and library behavior. It does not
provide packages, Maven/Gradle, external JARs, desktop GUI support, or a general
network client. See [Java runtime](JAVA_RUNTIME.md) for the exact boundary.

### SQL

Use the official `@sqlite.org/sqlite-wasm` distribution and its object-oriented API inside a dedicated Web Worker.

- create only a transient `:memory:` database; do not initialize OPFS or expose database filenames
- execute `schema.sql` and `seed.sql` in that order when the project worker starts, after an explicit Reset database, or when either file changes
- keep query changes in the project worker between Runs so learners can observe `INSERT`, `UPDATE`, and `DELETE`
- render the first result-producing statement as a semantic HTML table, capped at 500 visible rows and 50 columns; report changes and statement counts when no table is returned
- terminate the worker for Stop or the three-second query deadline
- keep SQLite JavaScript and WebAssembly out of the service-worker application shell so other languages do not pay its startup cost

Rails stores SQL source exactly like other project files and never receives or executes the in-memory database. See [SQL runtime](SQL_RUNTIME.md) for the learner-facing lifecycle and limits.

### HTML/CSS/JS

Use a sandboxed iframe with `srcDoc`.

Recommended sandbox flags for MVP:

```html
<iframe sandbox="allow-scripts" />
```

Do not allow same-origin unless there is a specific reason.

## Data Model Draft

```ts
type ProjectKind = 'ruby' | 'javascript' | 'typescript' | 'python' | 'java' | 'sql' | 'web'

type Project = {
  id: string
  ownerId?: string
  title: string
  description?: string
  kind: ProjectKind
  files: ProjectFile[]
  visibility: 'private' | 'organization' | 'unlisted' | 'public'
  forkedFromId?: string
  createdAt: string
  updatedAt: string
}

type ProjectFile = {
  path: string
  language: 'ruby' | 'javascript' | 'typescript' | 'python' | 'java' | 'sql' | 'html' | 'css'
  content: string
}
```

`ProjectKind` and file-language behavior are implemented through the frontend language registry. New language work must extend that registry, runner protocol, guide, Practice Lab, error coaching, storage validation, import/export behavior, and documentation together rather than adding component-specific switches.

## Backend Choice

Hafa Code uses the same broad shape as other Shimizu/CSG apps: Rails API + React frontend.

Why this instead of Supabase/Convex:

- CSG students are already learning Rails + React.
- Alumni can contribute using familiar app patterns.
- The backend remains portable and open-source friendly.
- Rails is a great fit for users, projects, files, forks, visibility, and classroom metadata.

Important: Rails does **not** execute student code. It only stores source files and metadata. Any future server-side execution should be a separate sandbox service with quotas, filesystem isolation, network isolation, and abuse monitoring.

## Current API Shape

```txt
POST   /api/v1/sessions
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id
POST   /api/v1/projects/:id/duplicate
GET    /api/v1/organizations/:id/projects
GET    /api/v1/organizations/:id/students/:student_id/projects
```

The organization project endpoints return paginated metadata summaries, including file and unresolved-feedback counts, but never file contents. The teacher Review Work surface filters those summaries and requests `GET /api/v1/projects/:id` only when an instructor opens one project. Instructor workspace sync also sends `owned_only=true`, so ordinary editor loading does not materialize every student's private source. Reviewed source stays in transient React state rather than the teacher's local workspace backup.

Auth follows the CSG LMS Clerk pattern: frontend gets a Clerk JWT, API verifies it against Clerk JWKS, and Rails finds or creates the local `User`.

## Classroom browser-test boundary

The Playwright suite runs the React application and Rails API together against a dedicated PostgreSQL database ending in `_e2e`. A Vite mode named `e2e` selects a fixed classroom persona and sends Rails' existing `test_token_<user-id>` credential. Both sides reject accidental production use: Vite requires development mode plus `VITE_E2E_AUTH=true`, Rails accepts these tokens only in the test environment, and the reset task exits unless the database name ends in `_e2e`.

These tests exercise the real API client, authorization policies, persistence, classroom UI, and browser behavior. They do not replace a production-safe smoke test with real Clerk accounts, deployed Render/Netlify configuration, and a staging or isolated test tenant.

## Storage and accessibility signals

Rails enforces a 2,000,000-byte combined-source limit per project. The frontend measures the same UTF-8 source bytes and shows usage in the project toolbar before the server rejects a save. At 80%, the interface gives cleanup and workspace-backup guidance. This is a source-code limit, not a promise about total browser, student, or organization storage; those broader quotas remain an operational policy decision.

Local project and checkpoint writes treat browser-storage rejection as a recoverable state. The workspace stops claiming that a local backup or checkpoint succeeded, keeps the in-memory project available, and directs the learner to free browser storage or download a backup before closing the tab.

The Playwright gate runs axe against personal and classroom workspaces in default and dark color-safe modes. It also exercises keyboard activation and focus behavior for sharing, projects, files, history, and classroom tabs; a 640 CSS-pixel viewport as the layout equivalent of a 1280-pixel display at 200% browser zoom; horizontal overflow at mobile sizes; and 44-pixel primary mobile targets. These checks reduce regressions, but they do not replace hands-on VoiceOver/other screen-reader testing or validation on the school's actual devices and network.
