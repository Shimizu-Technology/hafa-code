# Hafa Code

A simple open-source coding playground for Code School of Guam, Father Dueñas students, alumni, and anyone learning to code.

## Vision

A lightweight alternative to Replit focused on the languages CSG actually teaches first:

- Ruby snippets powered by `ruby.wasm`
- JavaScript snippets powered by QuickJS in a Web Worker
- HTML/CSS/JS projects with a sandboxed live preview
- Save, fork, share, and remix beginner-friendly projects
- Optional Clerk sign-in with Rails-backed cloud projects

This project intentionally starts smaller than Replit. The first version should be fast, safe, cheap to host, and approachable for students to contribute to.

## Monorepo

```txt
hafa-code/
  api/    Rails API-only backend for users/projects/files
  web/    React + Vite playground frontend
```

## Security Model

Run untrusted code in the browser, not on Rails.

- Ruby runs in WebAssembly inside a worker.
- JavaScript runs in QuickJS inside a worker with memory/time limits.
- HTML/CSS/JS preview runs in a sandboxed iframe.
- Rails stores users, project metadata, and source files only.

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
