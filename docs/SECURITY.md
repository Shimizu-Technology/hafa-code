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

## Known Limitations

- Browser-side execution is appropriate for learning snippets and simple web pages, not production backend apps.
- Ruby WASM is large and first-run startup can be slow on older devices.
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
