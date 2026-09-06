# Hafa Code

A beginner-first, open-source coding workspace for Code School of Guam, Father Dueñas students, alumni, and anyone learning to code.

## Vision

A focused alternative to Replit that removes installation and account friction from the first coding session:

- Ruby snippets powered by `ruby.wasm`
- JavaScript snippets powered by QuickJS in a Web Worker
- TypeScript projects compiled in the browser and executed through QuickJS
- Python projects powered by a self-hosted Pyodide runtime in a Web Worker
- Java 8 projects compiled and run through CheerpJ in a Web Worker
- HTML/CSS/JS projects with a sandboxed live preview
- A dockable learning sidecar with per-language syntax guides, practice challenges, and contextual error coaching
- Save, fork, share, and remix beginner-friendly projects
- Optional Clerk sign-in with Rails-backed cloud projects

Hafa Code intentionally stays smaller than a general cloud IDE. It keeps the first learning loop—open, write, run, understand, revise—fast and approachable, while classroom organizations add teacher visibility and feedback without giving teachers edit access to student source.

Untrusted programs run in isolated browser workers or a sandboxed preview. Rails stores projects and classroom records; it does not execute student code. This keeps the hosted service comparatively inexpensive and avoids placing a general code-execution service beside student data.

## Monorepo

```txt
hafa-code/
  api/    Rails API-only backend for users/projects/files
  web/    React + Vite playground frontend
```

## Planning Docs

- [Product spec](docs/PRODUCT_SPEC.md)
- [Product roadmap](docs/PRODUCT_ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Frontend structure](docs/FRONTEND_STRUCTURE.md)
- [Security model](docs/SECURITY.md)
- [TypeScript runtime](docs/TYPESCRIPT_RUNTIME.md)
- [Multi-file workspace](docs/MULTI_FILE_WORKSPACE.md)
- [Classroom, orgs, sharing, accessibility, and runner plan](docs/CLASSROOM_ORGS_AND_SHARING_PLAN.md)
- [FDMS classroom launch readiness and action plan](docs/FDMS_CLASSROOM_LAUNCH_PLAN.md)
- [Classroom operations and incident runbook](docs/CLASSROOM_OPERATIONS_RUNBOOK.md)

## Security Model

Run untrusted code in the browser, not on Rails.

- Ruby runs in WebAssembly inside a worker.
- JavaScript runs in QuickJS inside a worker with memory/time limits.
- TypeScript is type-checked and compiled in a worker, then the emitted JavaScript runs in QuickJS with the same memory/time boundary.
- Python runs in Pyodide inside a worker with a standard-library-only project filesystem.
- Java runs in CheerpJ inside a dedicated worker. The Java runtime and compiler are downloaded only when Java is first run.
- HTML/CSS/JS preview runs in a sandboxed iframe.
- Rails stores users, project metadata, and source files only.

Java is intentionally a focused practice environment rather than a full desktop JDK. It supports `Main.java`, helper classes in the default package, compiler diagnostics, standard input, stdout/stderr, and stop/time limits. Maven, Gradle, third-party dependencies, packages, GUI apps, and arbitrary network access are not part of the first release. See [Java runtime](docs/JAVA_RUNTIME.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

TypeScript is similarly focused: it supports typed multi-file projects and relative imports, but not npm packages, browser DOM APIs, Node APIs, or an application server. See [TypeScript runtime](docs/TYPESCRIPT_RUNTIME.md).

## Development

The repository contract, ports, architecture boundaries, and complete validation gate are documented in [AGENTS.md](AGENTS.md).

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

The full gate includes an isolated Playwright classroom suite plus automated accessibility, keyboard, zoom-equivalent layout, contrast, and mobile-target checks. It creates and resets only a PostgreSQL database whose name ends in `_e2e`; it refuses to run against any other database. Install Chromium once with `cd web && npx playwright install chromium` if Playwright has not already downloaded it.

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
