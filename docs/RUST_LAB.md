# Rust Lab (experimental)

The Rust Lab at `/labs/rust/` compiles and runs small Rust programs entirely in the
browser. It is a separate page from the Learn workspace, labeled **Experimental**, and
reached from **Settings → Labs → Rust (experimental)**. Rust is not a Hafa Code project
kind: it is not in `languageRegistry.ts`, Rails `Project::KINDS`, or cloud sync.

## What works

- One `main.rs`, edition 2021, standard library only
- Compile with rustc 1.83.0-dev for `wasm32-wasip1`, then run the program in its own worker
- stdout and stderr, with a 256 KB output limit
- Standard input typed before the run (Program input); interactive prompts are not supported
- rustc's diagnostics as rustc prints them, error codes included (`error[E0382]`), plus a
  clickable error list and editor markers
- Error coaching for E0382, E0499, E0502, E0308, and E0384, general help for other codes
  (with a link to rustc's error index), and coaching for common panics
- Stop at any time, a 10-second run limit, and a 90-second compile limit
- Five guide topics (println! and variables; ownership and moves; borrowing and references;
  structs, enums, and match; Result and `?`), each with a complete example program
- Five practice challenges checked against expected output, with progress kept locally
- Up to 30 local projects in `localStorage`, export as `.hafa-rust.json`, and import of an
  export or a plain `.rs` file

Not supported: crates and Cargo, proc macros, multiple files, threads in learner programs,
networking, files, edition 2024, and anything after rustc 1.83.

## How it runs

```txt
/labs/rust/ (COOP + COEP: cross-origin isolated)
  ├─ rustLabToolchain.worker   downloads and verifies chunks, keeps them in Cache Storage,
  │                            unpacks the standard library into an in-memory WASI filesystem,
  │                            compiles rustc.wasm, and serves rustc's file reads
  ├─ rustLabCompiler.worker    runs rustc (wasi-threads) against that filesystem;
  │   ├─ rustLabBackground.worker   thread coordinator for the WASI threads runtime
  │   └─ rustLabThread.worker × n   rustc's threads
  ├─ rustLabProgram.worker     runs the compiled program with WASI stdin/stdout/stderr only;
  │                            Stop and the time limit terminate it
  └─ rustLabEditor.worker      Monaco's editor worker under a lab name (it needs COEP too)
```

rustc needs `SharedArrayBuffer` for its threads, so the page must be cross-origin isolated.
The lab uses the toolchain from [oligamiq/rust_wasm](https://github.com/oligamiq/rust_wasm)
(the compiler behind [rubrc](https://github.com/oligamiq/rubrc)): rustc with lld linked in,
so no separate linker download is needed. The WASI runtime is
`@oligami/browser_wasi_shim-threads` on top of `@bjorn3/browser_wasi_shim`; the toolchain
files are brotli-compressed and unpacked with `brotli-dec-wasm`. Each compile gets a fresh
WASI instance because the threads runtime cannot reuse one after rustc exits.

## Downloads and hosting

| File (oligamiq/rust_wasm `v0.2.0-release`) | Download | Unpacked |
| --- | --- | --- |
| `rustc_opt.wasm.br` (rustc + lld) | 19.8 MB | 95.4 MB |
| `wasm32-wasip1.tar.br` (standard library) | 18.9 MB | 74.1 MB |
| **Total** | **38.7 MB** | **169.5 MB** |

Nothing heavy downloads until the learner presses **Download compiler** or **Download and
run**; the size comes from the manifest, not from a hard-coded label.

The files are self-hosted on Hafa Code's origin and are not committed to git:

1. `web/scripts/rustToolchain.mjs` pins both files by SHA-256. A build downloads them once
   (GitHub release, falling back to the project's Cloudflare mirror) into
   `web/node_modules/.cache/hafa-rust-toolchain/` and rejects any mismatch.
2. The build splits each file into 4 MiB chunks named by their own SHA-256
   (`/assets/rust-toolchain/<sha256-prefix>.bin`). Netlify serves files over about 5 MB from
   origin instead of the edge (per Netlify support), so small chunks can stay edge-cached. Ten
   chunks are published.
3. `web/src/labs/rust/toolchainManifest.json` (committed) lists every chunk's hash and size.
   The lab checks each chunk with SHA-256 again before use and stores verified chunks in Cache
   Storage (`hafa-rust-lab-toolchain-v1`), skipping the HTTP cache so they are not stored twice.
   **Remove download** deletes them.
4. `npm run build` runs the lab as a second Vite build (`vite.lab.config.ts`) into the same
   `dist/`, so the workspace's chunks, entry budget, and offline app shell are byte-for-byte
   what they would be without the lab. `verify-production-build.mjs` checks the chunks
   against the manifest.

Deploy impact: each build downloads 38.7 MB once per cache directory (Netlify and CI reuse
`node_modules` caches; a cold CI job downloads it again) and each deploy contains 38.7 MB more
files. Netlify uploads only files whose content changed, so an unchanged toolchain is not
uploaded again. If the download fails, the build fails instead of publishing a broken lab.

To change the toolchain, update `PINNED_FILES` (name, file, SHA-256) and the release in
`rustToolchain.mjs`, run `node scripts/rustToolchain.mjs --manifest`, check that `rustcArguments()`
still fits, and run the `@rust-toolchain` Playwright tests.

## Measurements

Measured on an Apple M1 Max (64 GB) with Chrome 156 against a local production build that
applies `dist/_headers`, so download time here is not network time.

| Step | Time |
| --- | --- |
| Verify, unpack, and start rustc after the chunks arrive | about 1.0–1.2 s |
| First compile of the starter program | 0.9–1.1 s |
| Later compiles | 0.35–0.45 s |
| Running the compiled starter | under 10 ms |
| First Run press to output, including the local download | about 2.4 s |

Memory (process RSS above the browser's own baseline): about 0.7 GB once the toolchain is
loaded and 1.2–1.5 GB while compiling, steady over six compiles. The lab warns when
`navigator.deviceMemory` reports less than 4 GB. Over a real connection the 38.7 MB download
dominates the first run (for example, about 6 s at 50 Mbps); later visits load from Cache Storage.

## Browsers and devices

The lab checks for cross-origin isolation, `SharedArrayBuffer`, `Atomics`, WebAssembly
streaming compilation, and workers. Without them it explains what is missing and downloads
nothing. Phones, tablets (a coarse primary pointer), and windows narrower than 900px get a
desktop-only explanation with **Back to Hafa Code**; **Open the lab anyway** is offered because
the check can misjudge a tablet with a keyboard, and the download still needs consent.

Tested: desktop Chrome on macOS. The threads runtime's authors report Chrome works and
Firefox has had problems; Edge should behave like Chrome. Safari and Firefox are untested.

## Security

- Learner code and input never leave the browser. Rails, the Rust Playground, and any other
  server do not compile or run anything.
- COEP (`require-corp`) is sent only for `/labs/rust/*` and the six `rustLab*.worker-*.js`
  files. The workspace keeps its existing headers: COEP site-wide would block Clerk and CheerpJ.
  COOP comes from the site-wide rule only, so isolation does not depend on how the host
  combines a header that two matching rules both name.
- The lab page's CSP allows only same-origin scripts, workers, and connections, plus
  WebAssembly compilation. Where two matching rules name the same header, Netlify serves the
  specific rule's value (production does this for `/javaRunner.bootstrap.js`), so this CSP
  replaces the workspace CSP on the lab page; the build verifier checks both rules.
  The lab workers allow same-origin scripts and connections; only the toolchain, compiler, and
  background workers may start workers, and only from this origin (no `blob:` workers).
- The compiled program runs in a separate worker with WASI's in-memory stdin/stdout/stderr and
  no filesystem, network, or Hafa API access. Stop and the time limit terminate that worker.
- The service worker ignores `/labs/` and `/assets/rust-toolchain/`, so the lab cannot replace the
  workspace's cached page and its files are not precached for every visitor.

## Licensing

- rustc, the Rust standard library, and lld/LLVM are MIT OR Apache-2.0 (Rust) and Apache-2.0
  WITH LLVM-exception (LLVM); the sysroot's `libc.a` and startup objects come from wasi-libc
  (Apache-2.0 WITH LLVM-exception, MIT, and other permissive licenses).
- `@oligami/browser_wasi_shim-threads`, `@bjorn3/browser_wasi_shim`, `brotli-dec-wasm`, and
  rubrc are MIT OR Apache-2.0.
- The oligamiq/rust_wasm build repository does not state a license for its build scripts. The
  published binaries are builds of the permissively licensed projects above, and Hafa Code
  redistributes them unmodified with attribution in the lab footer and
  [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Confirming this with the maintainer, or
  building the toolchain ourselves, is a graduation requirement.

## Why it is experimental

- The toolchain is a single maintainer's pre-release work (rubrc describes itself as "not yet
  ready for general production use"), pinned to a rustc 1.83 fork from late 2024.
- The download (38.7 MB) and memory (up to about 1.5 GB) are too heavy for phones, tablets, and
  many school Chromebooks.
- It depends on cross-origin isolation and wasi-threads support that only some browsers handle
  reliably.
- Projects are browser-local, with no classroom review, sharing, or cloud backup.

## Graduation criteria (to a full Hafa Code language)

1. A toolchain we can rebuild and update (current stable rustc, edition 2024), with clear
   licensing confirmed, and a reproducible pinned build.
2. Measured on real school devices: first run under about 30 s on school Wi-Fi, warm compile
   under 2 s, and peak memory that school laptops tolerate, or a documented device policy.
3. No compiler crashes across the guide, challenges, and a larger sample of beginner mistakes;
   Firefox and Safari tested and either supported or clearly gated.
4. A classroom need and maintenance owner (see the roadmap guardrails).
5. Then add Rust through the normal language contract: `languageRegistry.ts`, Rails
   `Project::KINDS` and file validation, cloud sync, Learning sidecar guide topics, 15 Practice
   Lab challenges, `errorCoach.ts`, runner tests, and documentation. Cross-origin isolation for
   the workspace would need its own plan (for example, COEP `credentialless` with Clerk and
   CheerpJ verified, or the Rust runner kept on an isolated page).

## Files

- `web/labs/rust/index.html`, `web/vite.lab.config.ts`: the separate page and its build
- `web/src/labs/rust/`: page, editor, client, workers, content, coaching, storage, manifest
- `web/scripts/rustToolchain.mjs`: pinning, download, and chunking
- `web/public/_headers`: `/labs/rust/*` and `rustLab*.worker-*.js` rules
- `web/e2e/rust-lab.spec.ts`: header, gating, and opt-in tests; `@rust-toolchain` tests compile
  and run every guide example and challenge solution with the real compiler (set
  `E2E_SKIP_RUST_TOOLCHAIN=1` to skip them offline)
