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
      ├─ Runner worker
      │   ├─ Ruby WASM
      │   └─ QuickJS WASM
      ├─ HTML preview iframe
      └─ Project storage adapter
          ├─ localStorage anonymous fallback
          └─ Rails cloud sync when signed in
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
```

Auth follows the CSG LMS Clerk pattern: frontend gets a Clerk JWT, API verifies it against Clerk JWKS, and Rails finds or creates the local `User`.
