# Hafa Code development contract

## Product boundary

Hafa Code is a beginner-first browser coding workspace for Code School of Guam, Father Dueñas students, instructors, mentors, and alumni. Keep the first loop—open, write, run, understand, revise—simple. Rails stores source and classroom records but never executes learner code.

Browser runtimes belong in dedicated workers. Web output belongs in the sandboxed preview. A remote terminal or general server-side execution environment is a separate product and security boundary.

## Repository shape

- `web/`: React, TypeScript, Vite, Monaco, browser runners, learning tools, and PWA assets.
- `api/`: Rails API, Clerk authentication, PostgreSQL persistence, classroom permissions, feedback, sharing, and audit records.
- `docs/`: current product, architecture, security, and launch decisions.

Add project kinds and file-language behavior through `web/src/lib/languageRegistry.ts`. A supported language also needs storage/import validation, runner behavior, a guide, Practice Lab coverage, error coaching, tests, and documentation. Do not add parallel language switches inside UI components.

## Local development

- Frontend: `npm --prefix web run dev -- --host 127.0.0.1 --port 5173 --strictPort`
- Rails API: `(cd api && bin/rails server -b 127.0.0.1 -p 3000)`
- Full gate: `./scripts/gate.sh`
- Frontend-only gate: `npm --prefix web run lint && npm --prefix web test && npm --prefix web run build && npm --prefix web audit --audit-level=high`

Ports are configurable. Use distinct strict ports when another session already owns the defaults. Record and clean only resources started by the current session; never stop a borrowed listener, simulator, browser tab, database, or container.

The app can run without Clerk as a local-only playground. Do not copy real credentials into documentation, tests, commits, or PR descriptions.

## Change rules

- Preserve the focused Learn workspace and its mobile navigation.
- Keep instructor access to student projects read-only unless a separately approved collaboration mode changes that contract.
- Use project language from the registry, deterministic learning checks, and complete starter files.
- Keep new runtime dependencies lazy and measure first-run and warm-run behavior.
- Maintain keyboard access, visible focus, reduced-motion support, non-color status cues, and practical 44px touch targets.
- Test responsive UI at 390x844, 768x1024, 1280x720, and a wide desktop size.
- Never weaken CSP, worker isolation, iframe sandboxing, authorization, or project validation merely to make a runtime easier to add.

## Pull-request gate

Before opening a PR, run the full gate and the affected flow in a real browser. After pushing, require green GitHub checks and a CodeRabbit review of the current head. Verify every review finding against the code, fix valid findings with regression coverage, and request a new review after each pushed fix. Merge only when the current head is clean and the task has explicit merge authorization.
