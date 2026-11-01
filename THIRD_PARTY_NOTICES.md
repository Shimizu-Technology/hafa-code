# Third-Party Notices

## Fonts

Hafa Code self-hosts the Latin and Latin Extended subsets of three typefaces from
Fontsource 5.3.0 in `web/public/fonts/`, with each license file alongside them.

- Outfit (variable): Copyright 2021 The Outfit Project Authors
- JetBrains Mono (variable): Copyright 2020 The JetBrains Mono Project Authors
- Space Grotesk (700): Copyright 2020 The Space Grotesk Project Authors
- License: SIL Open Font License 1.1

## SQLite WebAssembly

Hafa Code includes the official SQLite WebAssembly distribution in its on-demand SQL worker.

- Project: <https://sqlite.org/wasm>
- Package source: <https://github.com/sqlite/sqlite-wasm>
- License: Apache License 2.0

The runtime is used only for transient, in-memory learner databases. Hafa Code does not expose OPFS persistence, extension loading, remote database access, or persistent SQLite storage through this integration.

## TypeScript

Hafa Code includes the TypeScript compiler and a focused set of its standard declaration libraries in the on-demand TypeScript worker.

- Project: <https://www.typescriptlang.org/>
- Source: <https://github.com/microsoft/TypeScript>
- License: Apache License 2.0

The compiler is used in the browser to type-check and emit learner projects. Hafa Code does not provide Microsoft support, npm package access, Node APIs, or DOM APIs through this runtime.

## Go

Hafa Code's on-demand Go runner (`/assets/hafago-<hash>.wasm` and its worker) is built from the Go toolchain pinned in `web/runtimes/go/go.mod`. It contains compiled Go standard-library code, including `go/parser` and `go/types`, a copy of the Go compiler's syntax parser (`cmd/compile/internal/syntax`), gc export data for the allowlisted standard-library packages, and the toolchain's `wasm_exec.js` support file.

- Project: <https://go.dev/>
- Source: <https://go.googlesource.com/go>
- License: BSD 3-Clause

```text
Copyright 2009 The Go Authors.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * Neither the name of Google LLC nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Yaegi

The Go runner interprets learner programs with Yaegi, built into the same WebAssembly module from commit `fcb76d1ece0c` with symbol bindings generated for the allowlisted standard-library packages. Hafa Code modifies `interp/run.go` at build time so panic frames report the executing statement and goroutine panics reach the runner; the patch is in `web/runtimes/go/cmd/hafagen/main.go`. `web/runtimes/go/symbols/maptypes.go` adapts Yaegi's `stdlib/maptypes.go`.

- Project: <https://github.com/traefik/yaegi>
- Copyright 2019 Containous SAS; Copyright 2020 Traefik Labs SAS
- License: Apache License 2.0 (<https://www.apache.org/licenses/LICENSE-2.0>)

## CheerpJ Core

Hafa Code's Java runner uses CheerpJ Core 4.3 by Leaning Technologies Limited.
CheerpJ is loaded on demand from `https://cjrtnc.leaningtech.com`; it is not
self-hosted or redistributed in this repository.

- Product: <https://cheerpj.com/>
- Documentation: <https://cheerpj.com/docs/>
- Licensing: <https://cheerpj.com/docs/licensing>

CheerpJ is commercial software made available under its own license terms.
Eligibility for the Community License depends on the user and deployment. An
appropriate commercial agreement is required for uses outside that scope.

## JavaFiddle compiler archive

The Java runner downloads the Java 8 `tools.jar` used by Leaning Technologies'
JavaFiddle service from `https://javafiddle.leaningtech.com/tools.jar` and places
it in CheerpJ's transient browser filesystem for compilation. The archive is
not committed to or redistributed by this repository.

## Rust Lab toolchain (experimental)

The Rust Lab (`/labs/rust/`) self-hosts, unmodified, two files from the
[oligamiq/rust_wasm](https://github.com/oligamiq/rust_wasm) `v0.2.0-release`:
`rustc_opt.wasm.br` (rustc 1.83.0-dev with lld, built for WebAssembly) and
`wasm32-wasip1.tar.br` (the Rust standard library for `wasm32-wasip1`, including
wasi-libc). They are downloaded at build time, pinned by SHA-256, and not
committed to this repository.

- Rust compiler and standard library: <https://github.com/rust-lang/rust>, MIT OR Apache-2.0
- LLVM and lld: <https://llvm.org/>, Apache-2.0 WITH LLVM-exception
- wasi-libc: <https://github.com/WebAssembly/wasi-libc>, Apache-2.0 WITH LLVM-exception, MIT, and other permissive licenses
- Toolchain builds: <https://github.com/oligamiq/rust_wasm> and <https://github.com/oligamiq/rubrc> by oligami (rubrc: MIT OR Apache-2.0)

The lab's browser runtime includes `@oligami/browser_wasi_shim-threads`,
`@bjorn3/browser_wasi_shim`, and `brotli-dec-wasm`, each MIT OR Apache-2.0.
