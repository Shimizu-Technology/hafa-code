# Hafa Code Architecture

## High-Level Shape

```txt
React SPA
  ├─ Monaco editors
  ├─ Runner worker
  │   ├─ Ruby WASM
  │   └─ QuickJS WASM
  ├─ HTML preview iframe
  └─ Project storage adapter
      ├─ localStorage initially
      └─ cloud backend later
```

## Why Browser-Side Execution

Running arbitrary student code on a backend is the expensive and dangerous part of Replit. For CSG/FD beginner use cases, browser-side execution is enough and dramatically safer.

Benefits:

- no container fleet
- no server RCE risk
- cheap static hosting
- works well for snippets and web pages
- easy for OSS contributors to run locally

## Runners

### Ruby

Use `@ruby/3.3-wasm-wasi` with `@ruby/wasm-wasi`.

Caveat: Ruby WASM is large. Lazy-load it only when the Ruby playground is opened.

### JavaScript

Use `quickjs-emscripten` in a Web Worker.

- capture `console.log/info/warn/error`
- set memory limit
- interrupt after timeout

### HTML/CSS/JS

Use a sandboxed iframe with `srcDoc`.

Recommended sandbox flags for MVP:

```html
<iframe sandbox="allow-scripts" />
```

Do not allow same-origin unless there is a specific reason.

## Data Model Draft

```ts
type ProjectKind = 'ruby' | 'javascript' | 'web'

type Project = {
  id: string
  ownerId?: string
  title: string
  description?: string
  kind: ProjectKind
  files: ProjectFile[]
  visibility: 'private' | 'unlisted' | 'public'
  forkedFromId?: string
  createdAt: string
  updatedAt: string
}

type ProjectFile = {
  path: string
  language: 'ruby' | 'javascript' | 'html' | 'css'
  content: string
}
```

## First Backend Choice

Recommendation: start frontend-only with localStorage. Once UX is validated, add Supabase for:

- Auth
- Postgres projects table
- Row-level security
- public/unlisted share links

Convex would also be good for fast iteration, but Supabase is easier for students/alumni to understand and contribute to as open source.
