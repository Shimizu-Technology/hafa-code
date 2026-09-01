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
that broader exception. The Python worker follows the same stricter pattern.
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

## Known Limitations

- Browser-side execution is appropriate for learning snippets and simple web pages, not production backend apps.
- Ruby WASM is large and first-run startup can be slow on older devices.
- Pyodide adds another sizable first-run download; the UI keeps its startup and execution guardrails separate.
- Java's first run downloads CheerpJ plus an approximately 18 MiB Java 8 compiler archive; slower connections can take noticeably longer.
- Java is currently a Java 8, default-package learning environment without Maven, Gradle, external JARs, desktop GUIs, or arbitrary networking.
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
