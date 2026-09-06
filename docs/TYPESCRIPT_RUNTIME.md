# TypeScript Runtime

Hafa Code's TypeScript mode is a focused browser workspace for learning how types, functions, objects, generics, narrowing, and modules fit together. It is not a Node development environment or a browser-app bundler.

## What learners can use

- `.ts` source files and `.d.ts` declarations
- relative imports between project files
- strict semantic diagnostics across the whole project
- ES2020 language and standard-library types
- `console.log`, `console.info`, `console.warn`, `console.error`, and `print`
- stdout/stderr, Stop, compiler locations, error coaching, guides, and practice challenges

The starter deliberately demonstrates typed values and a relative helper import without requiring setup.

The TypeScript guide has eight runnable topics covering annotations, inference and unions, functions, interfaces, narrowing, generics, modules, and safe error handling. Practice adds fifteen TypeScript challenges: five Starter, five Builder, and five Stretch. Each guide example or challenge opens as a separate practice project, leaving the learner's current project unchanged.

## Run pipeline

1. The UI sends one immutable snapshot of the project's files and configured entry path to a dedicated worker.
2. The worker validates the entry, paths, file count, and total UTF-8 source size.
3. The official TypeScript compiler API creates one in-memory program from all `.ts` and `.d.ts` files plus the embedded ES2020 declarations.
4. Strict pre-emit diagnostics are returned with project-relative file, line, column, and `TS` code. `noEmitOnError` prevents execution when any diagnostic exists.
5. Successful CommonJS output is placed in an in-memory module map. Bare package imports are rejected.
6. A small trusted relative-module loader and the emitted modules execute inside QuickJS—not directly in the browser worker.

The compiler, declaration libraries, QuickJS bridge, and worker load only when a learner runs TypeScript. They are not part of the service worker's install-time application shell.

## Limits

- 50 project files per run
- 2,000,000 UTF-8 source bytes per run
- 8 MiB QuickJS memory limit
- 512 KiB QuickJS stack limit
- 256 KiB combined output limit
- the shared three-second run deadline after worker startup, covering compilation and execution

Stop or timeout terminates the worker. A new run receives the latest project snapshot and does not retain learner module state.

## Intentional non-goals

- npm packages or package installation
- Node globals or modules such as `process`, `fs`, and `path`
- DOM and browser APIs such as `document`, `window`, and `fetch`
- JSX/TSX, React application bundling, source maps, or an application server
- arbitrary filesystem or network access

These boundaries keep the mode predictable on school devices and preserve Hafa Code's rule that Rails stores student source but never executes it. Learners who need packages, a framework, or a server should move that project to a suitable local or remote development environment.

## Release checks

The TypeScript mode is covered at three levels:

- compiler and module-loader unit tests for multi-file success, diagnostics, declarations, path/source limits, package rejection, and actual bundle execution;
- production-build checks for one generated worker, its restrictive CSP, lazy service-worker behavior, and the absence of E2E authentication code;
- a real Chromium flow that creates the starter, runs its relative import, edits the source into a type error, verifies the exact diagnostic location, and opens the matching Coach guidance.

School-device first-run and warm-run timings still need to be recorded on the actual FDMS hardware and network. Local development timing is useful for regressions, but it is not a substitute for that launch evidence.

The audited production build emits the lazy TypeScript runner as approximately 3.97 MB minified (1.03 MB with gzip) before its separate QuickJS WebAssembly asset. This number is a bundle regression baseline, not a prediction of school-network transfer time.
