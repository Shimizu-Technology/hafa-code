# Hafa Code Security Model

Hafa Code is designed around one rule: untrusted student code should not execute on our servers.

## Current Execution Model

### Ruby

Ruby runs in-browser through `ruby.wasm` inside a Web Worker.

- No backend execution
- Worker can be terminated from the UI
- Runner has a startup guard and execution timeout from the app shell
- Large runtime is loaded only when needed by the worker bundle

### JavaScript

JavaScript runs in QuickJS inside a Web Worker.

- No DOM access
- No browser API access except what the worker explicitly provides
- Memory limit and stack limit are set in the QuickJS runtime
- Interrupt handler stops long-running code

### TypeScript

TypeScript is compiled and executed entirely inside a dedicated Web Worker. Rails stores source but never compiles or runs it.

- The worker accepts at most 50 files and 2,000,000 bytes of UTF-8 source per run
- Hidden, absolute, traversal, backslash, duplicate, missing, and non-`.ts` entry paths are rejected
- The embedded compiler environment exposes ES2020 plus Hafa's `console` and `print` declarations; it deliberately omits DOM, Node, package, and network declarations
- Compilation uses strict checks and `noEmitOnError`, so code with compiler errors is not executed
- Bare package imports are rejected; relative emitted modules are loaded by a small trusted CommonJS loader inside QuickJS
- Emitted JavaScript receives the same 8 MiB QuickJS memory limit, 512 KiB stack limit, execution deadline, and 256 KiB output cap as the focused runner boundary
- Stop or timeout terminates the whole worker
- The worker CSP allows only same-origin loading and WebAssembly compilation; it cannot contact the Hafa API, Clerk, or arbitrary remote origins

### Python

Python runs in-browser through a pinned, self-hosted Pyodide runtime inside a
dedicated Web Worker.

- Project files are copied into an isolated in-memory filesystem per run
- No backend execution
- No automatic package or wheel downloads; the initial release is standard-library-only
- Interactive `input()` is bridged through the existing terminal protocol when the browser supports WebAssembly JSPI
- The worker can be terminated by the UI timeout or Stop button
- Runtime assets load only from the application origin

### Java

Java source is compiled and executed through CheerpJ in a dedicated classic
Web Worker. Rails never compiles or runs Java.

- The worker accepts at most 50 files and exactly 2,000,000 bytes of Java source per run, matching the Rails project limit
- Hidden paths, traversal paths, packages, and duplicate basenames are rejected
- Compiler annotation processing is disabled with `-proc:none`
- Output is capped at 256 KiB
- Runtime startup and project execution have separate time limits
- Stop terminates the worker, including the JVM and the running program
- The worker response CSP can contact only the pinned CheerpJ runtime and JavaFiddle compiler hosts
- The Java worker cannot contact the Hafa API, Clerk, or arbitrary application origins

CheerpJ and the Java 8 compiler are fetched only for Java runs. This is a
third-party runtime dependency; deployment eligibility must continue to be
checked against CheerpJ's current license terms. Hafa provides visible
attribution and does not self-host CheerpJ Core.

### SQL

SQL runs through the official SQLite WebAssembly distribution in a dedicated Web Worker. Rails stores the source files but never receives or executes the database.

- The worker creates only a transient `:memory:` database and does not initialize OPFS or another persistent VFS
- Every new database connection enables SQLite defensive mode before schema or seed SQL runs, preventing learner SQL from writing directly to internal shadow tables while preserving normal virtual-table operations
- `schema.sql` and `seed.sql` are explicit project inputs; no host files, uploaded databases, remote URLs, or credentials are accepted
- SQLite extensions and a remote database protocol are not exposed
- Project validation retains the shared 50-file and 2,000,000-byte source limits
- The visible result is limited to 500 rows, 50 columns, and 256 KiB of transferred values; BLOBs are represented by byte count rather than copied into the UI
- Stop, timeout, or leaving the project terminates the worker and its in-memory database
- The SQL worker CSP permits same-origin scripts, WebAssembly, and the same-origin fetch needed to load the SQLite asset; the runner exposes no API or network bridge to learner SQL, and third-party origins such as Clerk or remote databases remain blocked

### HTML/CSS/JS Preview

Web projects render in a sandboxed iframe.

Current iframe settings:

```tsx
<iframe sandbox="allow-scripts" referrerPolicy="no-referrer" />
```

Intentional restrictions:

- no `allow-same-origin`
- no top navigation
- no forms permission
- no popups permission
- no camera/microphone/geolocation permissions

## Deployment Headers

`public/_headers` defines baseline static-host headers for Netlify-style deployments:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- restrictive `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin`
- Content Security Policy tuned for WASM, workers, local assets, and Bunny fonts

The application document deliberately permits WebAssembly compilation with
`'wasm-unsafe-eval'` but does not permit JavaScript string evaluation. The Ruby
runner is a narrower exception: ruby.wasm's `js` bridge evaluates a small amount
of bridge code while loading, so only the generated `rubyRunner.worker-*.js`
asset receives a worker-specific policy containing `'unsafe-eval'`. The separate
`javascriptRunner.worker-*.js` policy permits WebAssembly compilation without
that broader exception. The TypeScript, SQL, and Python workers follow the same stricter pattern.
Like ruby.wasm, CheerpJ requires `'unsafe-eval'` for its trusted JavaScript
bridge. That exception is limited to the generated Java worker response. The
Java worker also allows the pinned CheerpJ script host and the two exact
runtime/compiler hosts needed for Java; it still excludes the app API and
authentication origins. All worker policies block nested workers and do not
inherit Clerk or other unrelated third-party origins.

`npm run build` verifies that the generated runner filename is covered by the
worker header rule and that the page-level policy remains free of
`'unsafe-eval'`. A deploy-preview smoke test must still run Ruby in a real
browser because Vite's local server does not apply Netlify's `_headers` rules.

## Dependency Audits

The web and Rails dependency audits are launch gates. The Rails bundle is
locked to the 8.1.3.1 security patch, which fixes CVE-2026-66066 in Active
Storage variant processing. `npm audit --audit-level=high` and
`bundle exec bundler-audit check` must both pass before deployment.

## Automated classroom auth

Browser tests use deterministic local personas instead of Clerk. The frontend adapter is enabled only when Vite is in development mode, the mode is exactly `e2e`, and `VITE_E2E_AUTH=true`. Its tokens are accepted only by Rails in the test environment. The fixture reset task also verifies that the active database name ends in `_e2e` before deleting data.

This is a test seam, not an alternate production login. Production and preview builds must continue to use Clerk, and deployment smoke tests must prove real Clerk login and deployed environment configuration separately.

## Known Limitations

- Browser-side execution is appropriate for learning snippets and simple web pages, not production backend apps.
- Ruby WASM is large and first-run startup can be slow on older devices.
- Pyodide adds another sizable first-run download; the UI keeps its startup and execution guardrails separate.
- TypeScript adds a compiler worker and ES2020 declaration libraries on first use; it is intended for focused learning projects, not large application builds.
- Java's first run downloads CheerpJ plus an approximately 18 MiB Java 8 compiler archive; slower connections can take noticeably longer.
- Java is currently a Java 8, default-package learning environment without Maven, Gradle, external JARs, desktop GUIs, or arbitrary networking.
- SQL database state is intentionally memory-only and project-session scoped; a page reload, Stop, or worker failure rebuilds it from `schema.sql` and `seed.sql` on the next run.
- CheerpJ production use must remain within the Community License or move to an appropriate commercial license; technical evaluation alone does not cover normal organizational use.
- Python package installation is intentionally unavailable in the initial release.
- Browsers without WebAssembly JSPI can run Python but receive a clear runtime error when a program calls `input()`.
- The UI timeout can terminate a worker, but Ruby WASM internals may not support as fine-grained interruption as QuickJS.
- Share links encode project source in the URL hash; users should not put secrets in projects.
- Anonymous local storage is device/browser scoped and should not be treated as durable cloud backup.
- Signed-in cloud sync stores source text in Rails/PostgreSQL; users should still avoid storing secrets in playground code.

## Cloud Persistence Rules

Do not run student code on the Rails backend.

Rails should store only:

- users
- project metadata
- project files/source text
- share/fork relationships
- optional classroom/group metadata

If server-side execution is ever added, it needs a separate sandbox service with resource quotas, network isolation, filesystem isolation, and abuse monitoring.
