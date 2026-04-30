# Hafa Code

A simple open-source coding playground for Code School of Guam, Father Dueñas students, alumni, and anyone learning to code.

## Vision

A lightweight alternative to Replit focused on the languages CSG actually teaches first:

- Ruby snippets powered by `ruby.wasm`
- JavaScript snippets powered by QuickJS in a Web Worker
- HTML/CSS/JS projects with a sandboxed live preview
- Save, fork, share, and remix beginner-friendly projects

This project intentionally starts smaller than Replit. The first version should be fast, safe, cheap to host, and approachable for students to contribute to.

## MVP Scope

1. Browser code editor
2. Ruby runner
3. JavaScript runner
4. HTML/CSS/JS live preview
5. Local project saving first
6. Cloud accounts/projects after the playground loop feels good

## Security Model

Run untrusted code in the browser, not on our server.

- Ruby runs in WebAssembly inside a worker.
- JavaScript runs in QuickJS inside a worker with memory/time limits.
- HTML/CSS/JS preview runs in a sandboxed iframe.
- Backend, when added, stores projects and metadata only.

## Development

```bash
npm install
npm run dev
npm run build
```
