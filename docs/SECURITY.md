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
- The worker can be terminated by the UI timeout or Stop button
- Runtime assets load only from the application origin

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
All worker policies permit same-origin WASM fetches, block nested workers, and
do not inherit Clerk or other third-party origins.

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
- Python package installation is intentionally unavailable in the initial release.
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
