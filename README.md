# Hafa Code

A beginner-first, open-source coding workspace for Code School of Guam, Father Dueñas students, alumni, and anyone learning to code.

## Vision

A focused alternative to Replit that removes installation and account friction from the first coding session:

- Ruby snippets powered by `ruby.wasm`
- JavaScript snippets powered by QuickJS in a Web Worker
- TypeScript projects compiled in the browser and executed through QuickJS
- Python projects powered by a self-hosted Pyodide runtime in a Web Worker
- Java 8 projects compiled and run through CheerpJ in a Web Worker
- Go projects type-checked like `go build` and interpreted in a self-hosted WebAssembly worker
- SQL projects powered by official SQLite WebAssembly in a Web Worker
- HTML/CSS/JS projects with a sandboxed live preview
- A dockable learning sidecar with per-language syntax guides, practice challenges, and contextual error coaching
- Save, fork, share, and remix beginner-friendly projects
- Optional Clerk sign-in with Rails-backed cloud projects
- An experimental Rust Lab at `/labs/rust/` that compiles Rust in desktop browsers (separate page, local projects only)

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
- [Go runtime](docs/GO_RUNTIME.md)
- [SQL runtime](docs/SQL_RUNTIME.md)
- [Multi-file workspace](docs/MULTI_FILE_WORKSPACE.md)
- [Classroom, orgs, sharing, accessibility, and runner plan](docs/CLASSROOM_ORGS_AND_SHARING_PLAN.md)
- [FDMS classroom launch readiness and action plan](docs/FDMS_CLASSROOM_LAUNCH_PLAN.md)
- [Classroom operations and incident runbook](docs/CLASSROOM_OPERATIONS_RUNBOOK.md)
- [Lesson starter links (CSG Learn → Hafa Code)](docs/LEARN_STARTER_LINKS.md)
- [Rust Lab (experimental)](docs/RUST_LAB.md)

## Security Model

Run untrusted code in the browser, not on Rails.

- Ruby runs in WebAssembly inside a worker.
- JavaScript runs in QuickJS inside a worker with memory/time limits.
- TypeScript is type-checked and compiled in a worker, then the emitted JavaScript runs in QuickJS with the same memory/time boundary.
- Python runs in Pyodide inside a worker with a standard-library-only project filesystem.
- Java runs in CheerpJ inside a dedicated worker. The Java runtime and compiler are downloaded only when Java is first run.
- Go is type-checked with `go/types` and interpreted by Yaegi in one self-hosted WebAssembly module inside a dedicated worker, downloaded only when Go is first run.
- SQL runs in an in-memory SQLite database inside a dedicated worker, with explicit schema/seed files and an accessible results table.
- HTML/CSS/JS preview runs in a sandboxed iframe.
- The experimental Rust Lab compiles with rustc in WebAssembly workers on its own cross-origin-isolated page; the compiler (38.7 MB) downloads only after the learner agrees, and the compiled program runs in a separate worker.
- Rails stores users, project metadata, and source files only.

Java is intentionally a focused practice environment rather than a full desktop JDK. It supports `Main.java`, helper classes in the default package, compiler diagnostics, standard input, stdout/stderr, and stop/time limits. Maven, Gradle, third-party dependencies, packages, GUI apps, and arbitrary network access are not part of the first release. See [Java runtime](docs/JAVA_RUNTIME.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

TypeScript is similarly focused: it supports typed multi-file projects and relative imports, but not npm packages, browser DOM APIs, Node APIs, or an application server. See [TypeScript runtime](docs/TYPESCRIPT_RUNTIME.md).

Go is a focused fundamentals workspace: `package main` files at the top of the project, a curated standard library, compiler errors with `go build` wording, standard input, panics that point at the learner's lines, and Go's deadlock error. Modules, third-party packages, networking, and host files are not available. The interpreter differs from compiled Go in a few documented ways. See [Go runtime](docs/GO_RUNTIME.md).

SQL is a focused data-learning workspace rather than a remote database console. `schema.sql` and `seed.sql` create a project-scoped in-memory database; queries and changes persist only while that project's worker stays alive. Reset database, Stop, a timeout, worker termination, or edits to `schema.sql` or `seed.sql` rebuild the database from those files, so unexported database changes are lost. There are no credentials, extensions, OPFS persistence, or host filesystem/network connections. See [SQL runtime](docs/SQL_RUNTIME.md).

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

The web build, dev server, and tests also build the Go runtime, so they need Go 1.21 or newer on `PATH`; the build downloads the exact toolchain pinned in `web/runtimes/go/go.mod`. `npm --prefix web run verify:go-content` checks every Go guide example and challenge solution against the real `go run`.

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
