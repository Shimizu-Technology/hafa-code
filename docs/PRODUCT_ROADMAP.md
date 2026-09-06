# Hafa Code Product Roadmap

Last reviewed: September 6, 2026

## Product direction

Hafa Code is a beginner-first browser coding workspace for Code School of Guam, Father Dueñas students, instructors, mentors, alumni, and other learners. It shortens the path from opening a browser to writing and running code while giving classrooms dependable saving, teacher visibility, and private feedback.

The product is intentionally not a general cloud IDE or a replacement for the school LMS. Its advantage is focus:

- useful without an account or local development setup;
- browser-side execution with no Rails code-execution service;
- classroom roles that let teachers review without editing student source;
- language guides, short practice challenges, and deterministic error coaching in the workspace;
- a Guam and Code School identity rather than a generic enterprise interface;
- usable layouts for school laptops, tablets, and phones;
- an open-source codebase students and alumni can understand and improve.

## Guardrails

1. Keep the first run simple. New power must not turn the workspace into a wall of tools.
2. Improve the learning loop before chasing language count.
3. Students own their code. Teacher review remains read-only.
4. Keep grades, due dates, attendance, and official course records in the school LMS.
5. State security boundaries honestly. Browser execution and remote execution are different products.
6. Treat mobile, keyboard, zoom, reduced motion, and screen-reader use as release criteria.
7. Require school approval before collecting optional analytics or enabling external sharing for classroom work.

## Current baseline

Hafa Code currently supports:

- Ruby through Ruby WebAssembly;
- JavaScript through QuickJS;
- multi-file TypeScript through the browser compiler API and QuickJS;
- multi-file Python through self-hosted Pyodide;
- Java 8 compilation and execution through CheerpJ;
- SQL through a project-scoped, in-memory official SQLite WebAssembly worker;
- HTML/CSS/JavaScript through a sandboxed preview;
- Monaco editing, multiple files, entry-file selection, standard input where supported, stop controls, and bounded execution;
- fifteen practice challenges per project kind across Starter, Builder, and Stretch tiers;
- searchable language guides, safe practice-project creation, a dockable learning sidecar, and contextual error coaching;
- local autosave, workspace backup/restore, project import/export, checkpoints, immutable snapshot links, and optional Rails cloud sync;
- personal and classroom workspaces, invitations, roster roles, class lifecycle controls, feedback, audit events, and read-only teacher review;
- a teacher Review Work surface that loads source-free class metadata, filters by student/status/visibility/time/feedback, and fetches one read-only project only when opened;
- responsive desktop and purpose-built mobile navigation;
- a lightweight PWA shell, CSP boundaries, worker isolation, quotas, validation, rate limits, and dependency scanning.

## P0: classroom launch confidence

Finish these before broad FDMS enrollment:

- [x] Add repeatable local browser coverage for session resolution, invitations, cloud save/reload, role boundaries, class duplication, feedback, archive/removal, export, dual-class switching, and mobile actions.
- [ ] Run a smaller post-deploy suite with real Clerk accounts against staging or a production-safe test tenant, including reconnect recovery.
- [x] Show per-project UTF-8 source usage and recovery guidance before the 2 MB source limit rejects a save.
- [x] Gate core personal/classroom flows on automated WCAG checks, keyboard operation, dark/color-safe contrast, a 200%-zoom-equivalent layout, mobile overflow, and practical 44 px primary targets.
- [ ] Complete hands-on VoiceOver plus a second screen-reader/browser pass and validate the exact school devices, browser versions, content filters, network, and software keyboards.
- publish privacy and acceptable-use information approved by FDMS;
- prove backups with a non-production restore drill;
- configure release-aware error monitoring, uptime checks, alerts, staging/test tenancy, support ownership, and an incident runbook;
- run an authenticated production smoke test followed by a 2–4 student pilot on the actual FDMS network.

Repository changes can make those flows testable and document their operation. They cannot substitute for school approval, named support owners, production-service access, or a completed restore drill.

## Shipped: TypeScript

Add TypeScript as a first-class, beginner-focused project rather than disguising it as JavaScript.

- [x] `.ts` files and TypeScript-aware Monaco editing.
- [x] Semantic diagnostics across project files.
- [x] JavaScript execution in a dedicated worker after compilation.
- [x] Clear separation between type errors and runtime errors.
- [x] No npm packages, DOM application server, or Node APIs.
- [x] A complete guide, fifteen challenges, error coaching, starter projects, import/export support, and mobile coverage.
- [ ] Record first-run and warm-run measurements on the actual FDMS devices and network before treating local development measurements as representative.

## Shipped: SQL

SQL now ships as a focused SQLite learning workspace.

- [x] A dedicated worker using the official SQLite WebAssembly distribution.
- [x] A resettable, project-scoped database seeded from explicit `schema.sql` and `seed.sql` files.
- [x] Query results rendered as an accessible table with row/change counts and clear loading, empty, stopped, success, and error states.
- [x] A deliberate Run/Reset model; changes persist in the project worker, while schema/seed edits rebuild automatically.
- [x] No remote database credentials, network access, extensions, OPFS persistence, or host filesystem access.
- [x] A complete eight-topic guide, fifteen challenges, error coaching, starter data, import/export support, automated browser coverage, and mobile coverage.
- [ ] Record first-run and warm-run measurements on the actual FDMS devices and network before treating local development measurements as representative.

## P2: classroom usability

- Add saved review filters plus explicit unread-feedback and language controls when classroom volume justifies them.
- Convert learners' own editable cloud-project lists to metadata-first loading without weakening pending and offline draft recovery.
- Add student-facing storage usage and recovery guidance.
- Define graduation and account-deletion behavior.
- Improve history with meaningful save/run/check milestones and accessible file diffs.
- Add a curated starter gallery, a reopenable first-project walkthrough, project search/sort, and a compact command palette.
- Add ZIP portability and a clearly labeled public read-only/remix flow only after sharing policy approval.

## P3: strategic possibilities

A remote Advanced workspace may eventually provide terminals, packages, Git, language servers, debuggers, and application servers. It must remain an authenticated, opt-in, desktop-focused system with per-user isolation, quotas, lifecycle controls, persistence, monitoring, backups, and explicit project copy-in/copy-back behavior. It must not replace or weaken the browser-local Learn workspace.

Go, C/C++, Perl, real-time collaboration, unrestricted packages, deployments, databases with remote credentials, and AI tutoring are deferred. Revisit them only when a real course need, maintenance owner, runtime/security design, content plan, and device evidence justify the added surface.

## Definition of done

A roadmap feature is complete only when it has:

- a specific learner or teacher outcome and explicit non-goals;
- authorization and visibility coverage where data is involved;
- loading, empty, success, error, offline, stop, and recovery states as applicable;
- guide and practice content for a new language;
- keyboard, screen-reader, zoom, mobile, tablet, school-laptop, and wide-desktop consideration;
- runtime and bundle measurements for large dependencies;
- updated architecture, security, product, and operations documentation;
- a passing local gate, real-browser validation, green required CI, and a clean current-head CodeRabbit review.

## Measures that matter

Prefer small, privacy-respecting measures tied to real outcomes:

- time from opening Hafa Code to a successful first run;
- successful resume and save-recovery rate;
- practice start, check, and completion funnel;
- teacher time to find the next learner who needs help;
- feedback response and resolution time;
- runtime first-start and warm-start performance on school devices;
- incidents involving lost work, access, confusing sharing, or classroom downtime.

Do not collect source code, keystrokes, or detailed student behavior merely because it is technically possible.
