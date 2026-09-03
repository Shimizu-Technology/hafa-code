# Hafa Code

A simple open-source coding playground for Code School of Guam, Father Dueñas students, alumni, and anyone learning to code.

## Vision

A lightweight alternative to Replit focused on the languages CSG actually teaches first:

- Ruby snippets powered by `ruby.wasm`
- JavaScript snippets powered by QuickJS in a Web Worker
- Python projects powered by a self-hosted Pyodide runtime in a Web Worker
- Java 8 projects compiled and run through CheerpJ in a Web Worker
- HTML/CSS/JS projects with a sandboxed live preview
- A dockable learning sidecar with per-language syntax guides, practice challenges, and contextual error coaching
- Save, fork, share, and remix beginner-friendly projects
- Optional Clerk sign-in with Rails-backed cloud projects

This project intentionally starts smaller than Replit. The first version should be fast, safe, cheap to host, and approachable for students to contribute to.

## Monorepo

```txt
hafa-code/
  api/    Rails API-only backend for users/projects/files
  web/    React + Vite playground frontend
```

## Planning Docs

- [Product spec](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Frontend structure](docs/FRONTEND_STRUCTURE.md)
- [Security model](docs/SECURITY.md)
- [Multi-file workspace plan](docs/MULTI_FILE_WORKSPACE.md)
- [Classroom, orgs, sharing, accessibility, and runner plan](docs/CLASSROOM_ORGS_AND_SHARING_PLAN.md)
- [FDMS classroom launch readiness and action plan](docs/FDMS_CLASSROOM_LAUNCH_PLAN.md)

## Security Model

Run untrusted code in the browser, not on Rails.

- Ruby runs in WebAssembly inside a worker.
- JavaScript runs in QuickJS inside a worker with memory/time limits.
- Python runs in Pyodide inside a worker with a standard-library-only project filesystem.
- Java runs in CheerpJ inside a dedicated worker. The Java runtime and compiler are downloaded only when Java is first run.
- HTML/CSS/JS preview runs in a sandboxed iframe.
- Rails stores users, project metadata, and source files only.

Java is intentionally a focused practice environment rather than a full desktop JDK. It supports `Main.java`, helper classes in the default package, compiler diagnostics, standard input, stdout/stderr, and stop/time limits. Maven, Gradle, third-party dependencies, packages, GUI apps, and arbitrary network access are not part of the first release. See [Java runtime](docs/JAVA_RUNTIME.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

## Development

```bash
# frontend
npm --prefix web install
npm --prefix web run dev

# backend
cd api
bundle install
bin/rails db:prepare
bin/rails server -p 3000

# full gate
./scripts/gate.sh
```

## Clerk Setup

Frontend env: `web/.env`

```bash
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Backend env: `api/.env`

```bash
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
CLERK_ISSUER=https://your-clerk-instance.clerk.accounts.dev
CLERK_JWKS_URL=https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
CLERK_SECRET_KEY=sk_test_...
OWNER_ADMIN_EMAILS=you@example.com
ALLOW_OPEN_SIGNUPS=true
```

Without Clerk env vars, the frontend still works as a local-only playground.
