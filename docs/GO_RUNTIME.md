# Go Runtime

Hafa Code's Go mode is a browser workspace for learning Go's fundamentals: package `main`, explicit types, `for` loops, slices and maps, functions that return errors, structs and methods, and goroutines with channels. It is not a Go development environment. There are no modules, third-party packages, network access, or host files.

Leon Shimizu (Shimizu Technology) owns maintenance of the Go runtime.

## What works

- `main.go` plus helper `.go` files at the top of the project, all in `package main`, built together like `go run .`
- the Go 1.22 language as checked by `go/types`, including generics, closures with per-iteration loop variables, `defer`/`recover`, `select`, goroutines, and channels
- compiler errors with the same `file:line:column: message` wording as `go build`, and the same rejection of unused variables, unused imports, and missing returns
- a curated standard library: `bufio`, `bytes`, `errors`, `fmt`, `io`, `math`, `math/rand`, `os`, `sort`, `strconv`, `strings`, `sync`, `time`, `unicode`, and `unicode/utf8`
- stdout and stderr streaming, and line-oriented stdin through `bufio.Scanner`, `bufio.Reader`, and `fmt.Scan`
- runtime panics that name the panic and the learner's `main.go` lines, `os.Exit` codes, and Go's `exit status N` line
- Go's own deadlock error when every goroutine is blocked
- Stop, the shared three-second execution limit, the shared output limit, local projects, import/export, share snapshots, and signed-in cloud saves

The guide has eight runnable topics: output and comments; variables, types, and zero values; `if`/`else` and `switch`; `for` loops; slices and maps; functions, multiple returns, and errors; structs and methods; and goroutines and channels. Practice has fifteen Go challenges: five Starter, five Builder, and five Stretch. Every challenge scaffold compiles and runs, so a learner starts from working code.

## How a run works

One WebAssembly module, built from Go source in `web/runtimes/go`, contains both halves of the runner:

1. **Check.** The Go compiler's own syntax parser reports syntax errors. `go/parser` and `go/types` then type-check the package against gc export data for the allowlisted packages, embedded at build time. Imports outside the allowlist, Go 1.23+ syntax, and the `min`, `max`, and `clear` built-ins (valid Go the interpreter cannot run yet) are compile errors. A program with any error never runs, and the worker reports the errors as code-validation output.
2. **Interpret.** A program that passes the check runs in [Yaegi](https://github.com/traefik/yaegi), a Go interpreter, with bindings generated for exactly the allowlisted packages.

Each run gets a fresh instance of the compiled module. A program's goroutines, globals, and `os.Exit` therefore end with that run, as they would with `go run`. The worker keeps the compiled module, so warm runs pay only for instantiation, the check, and the program.

Standard streams are real `*os.File` values. The worker gives Go's `wasm_exec.js` a small `fs` replacement: writes to stdout and stderr stream to the terminal, stdin reads wait for terminal input, and every file or directory operation fails as unavailable. The Go WebAssembly runtime never reports deadlocks itself; the worker reports Go's message when the instance goes idle with no pending timer and no pending stdin read, because nothing can wake it again.

## First-run behavior

The Go runtime is lazy and is not part of the service-worker application shell. The first Go run downloads the module; later runs in the same worker reuse the compiled module, and the browser cache and service worker keep the content-hashed file for later visits.

| Measure | Value |
| --- | --- |
| `hafago-<hash>.wasm` | 17.4 MB (16.6 MiB) raw; 4.1 MB gzip; 2.9 MB brotli |
| `goRunner.worker-<hash>.js` | 14 KB raw; 5 KB gzip |
| Embedded export data | 468 KB raw |
| Local development, first run (localhost, cold worker) | about 0.4 s to the starter's output |
| Local development, warm runs | about 70–90 ms |
| Netlify deploy preview, transfer | 3.6 MB with brotli (4.2 MB gzip), served as `application/wasm`, immutable |
| Netlify deploy preview, first run (desktop Chrome, fast connection, empty cache) | about 2.5 s to the starter's output |
| Netlify deploy preview, warm runs | about 50 ms |
| Full-stdlib Yaegi build, for comparison | 37 MB raw; about 7 MB gzip |

Generating Yaegi bindings only for the allowlist, instead of using Yaegi's full standard library, cut the module from 37 MB to about 17 MB. The production-build check fails if the module grows past 24 MiB, so adding packages stays a deliberate decision. Local timings are regression baselines; they do not predict school-device or school-network performance, which still needs to be measured on FDMS hardware.

## Deliberate limits

- one `package main` per project; `.go` files must sit at the top of the project, and `_test.go` files are ignored like `go run .` does
- no `go.mod`, `go.sum`, or `go.work`, no module downloads, and no third-party packages
- no `net`, `net/http`, `os/exec`, `syscall`, `syscall/js`, `unsafe`, `reflect`, `slices`, `maps`, or other packages outside the allowlist
- no host filesystem: `os.ReadFile` and similar calls return errors
- the shared 50-file, 2,000,000-byte source limit, the three-second execution limit after the runtime starts, and the shared 1 MB / 10,000-line output limit
- Stop and timeouts terminate the whole worker

`slices`, `maps`, and `cmp` are excluded because the pinned Yaegi ships only part of their source, so the checker would accept calls such as `slices.Sort` that the interpreter cannot run.

## Differences from real Go

Yaegi is an interpreter, not the Go compiler. The type check catches what `go build` would reject, but some valid programs still behave differently:

- **Panic wording.** Index errors read `panic: reflect: slice index out of range` instead of `panic: runtime error: index out of range [3] with length 1`, and nil-pointer field access can read `reflect: call of reflect.Value.Field on zero Value`. Panic frames name learner functions and `main.go:line:column` positions. The Error Coach recognizes both forms.
- **Interface printing.** `fmt` calls a learner type's `String` method when the value is passed directly, but not always through a learner-defined interface variable or inside a slice.
- **Errors.** `errors.New`, `fmt.Errorf` with `%w`, and `errors.Is` against a sentinel error work. `errors.As` with a learner-defined error type panics, and comparing a learner-defined error with `==` can panic with `comparing uncomparable type interp._error`; a type assertion such as `err.(*NotFound)` works.
- **Generics.** Simple generic functions and types work; some type-inference cases and generic types declared inside functions do not.
- **Speed.** Interpretation is much slower than compiled Go. Beginner exercises finish well inside the time limit; heavy computation may not.

When a program passes the check but Yaegi cannot compile or run it, the terminal shows Yaegi's message.

`npm --prefix web run verify:go-content` guards the content against this drift. It runs every guide example and every challenge's reference solution through the real `go run`, through the Hafa engine built natively, and through the browser WebAssembly module, and requires identical output. It also requires every scaffold to compile and run, and compares the checker's compiler errors with `go build` for a set of common mistakes.

## Build pipeline

`web/scripts/build-go-runtime.mjs` runs before `npm run dev`, `build`, `test`, and `test:e2e`, and skips work when its inputs are unchanged. It requires Go 1.21 or newer on `PATH`, sets `GOTOOLCHAIN` to the release pinned in `web/runtimes/go/go.mod`, and lets Go download that exact toolchain, verified by the Go checksum database. Then it:

1. builds `cmd/hafagen`, which generates the Yaegi bindings and the trimmed gc export data for the allowlist with `GOOS=js GOARCH=wasm`, copies the compiler's syntax parser from the pinned toolchain, and writes a patched copy of Yaegi;
2. builds `cmd/hafago` with `GOOS=js GOARCH=wasm -trimpath -buildvcs=false -ldflags="-s -w"`; and
3. copies `wasm_exec.js` from the same toolchain.

The generated files and outputs are ignored by Git. Vite emits the module as a content-hashed `/assets/hafago-<hash>.wasm` file. Netlify and CI therefore need Go available during the web build.

Yaegi is pinned to commit `fcb76d1ece0c` (`v0.16.2-0.20260209085605-fcb76d1ece0c`) rather than the v0.16.1 tag. The tag predates Go 1.22 loop-variable semantics, range-over-int, and a fix for deferred-argument evaluation, and the content verification failed on it. Hafa Code applies two small patches to the copied `interp/run.go`; `hafagen` fails the build if either no longer applies:

- panic frames track the executing statement, because the fast path shadowed the variable Yaegi's panic reporter reads and every frame pointed at the first line of its function; and
- a panic that escapes a goroutine reaches the runner, which prints learner frames instead of an interpreter-internal Go traceback.

## Security boundary

- Rails stores Go source like other project files and never compiles or runs it.
- The Go worker's CSP allows same-origin scripts, WebAssembly compilation, and same-origin fetches for its own module. It has no `'unsafe-eval'`, nested workers, API, Clerk, or third-party origins.
- The interpreter exposes only generated bindings for the allowlisted packages. `syscall/js`, networking, process control, `unsafe`, and `reflect` are not importable, and the checker rejects any other import before anything runs.
- File and directory operations fail inside the worker; there is no host or browser-persistent filesystem.

## Licensing

- Go standard library, the Go compiler syntax parser, and `wasm_exec.js`: BSD 3-Clause, Copyright 2009 The Go Authors
- Yaegi: Apache License 2.0, Copyright 2019 Containous SAS and 2020 Traefik Labs SAS, with the modifications described above

See [third-party notices](../THIRD_PARTY_NOTICES.md).
