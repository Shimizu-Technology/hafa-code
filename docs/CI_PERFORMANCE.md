# CI performance

## November 22, 2026 change

Hafa Code is a browser coding workspace with Rails classroom persistence. Browser tests cover the learner editor, language runtimes, classroom permissions and mutations, lesson handoff, accessibility, and deferred sign-in. This change alters CI scheduling and setup, not product behavior.

The task baseline was a 12.6-minute median PR run, with `classroom-e2e` around 17 minutes. A fresh sample of 15 successful PR runs among the latest 30 CI runs had an 11.48-minute median (created-to-updated time, including queue/setup; this is a different sample). The latest successful main run, [44644255138](https://github.com/Shimizu-Technology/hafa-code/actions/runs/44644255138), took 17.3 minutes:

- Browser installation: 8.1 minutes, from 00:15:33 to 00:23:37 UTC. The apt transaction installed fallback fonts and upgraded Mesa; Chromium's required shared libraries were already present.
- Browser suite: 93 tests passed in 8.1 minutes with one worker.
- Backend and frontend jobs: approximately 38 and 86 seconds.

CI now downloads/caches Playwright's pinned Chromium and uses the libraries already supplied by `ubuntu-24.04`. It does not run an apt update/upgrade through `playwright install --with-deps`. Playwright still validates browser libraries at launch; a future runner image missing a required library must fail rather than skip browser tests. Application fonts remain self-hosted.

Two browser workers share one job. Tests that use seeded classroom personas remain sequential on one worker, in their existing file order. Anonymous files (`learner-polish`, `pilot-readiness`, and `rust-lab`) can overlap that worker; their state is browser-local or creates independent anonymous shares. Deferred sign-in waits for the classroom project because its returning-user case uses a seeded persona. Local serial behavior and WebKit selection remain unchanged.

Historical test-start timestamps estimate 4.7 minutes for the seeded-persona group and 3.2 minutes for the anonymous group, versus 8 minutes sequentially. Allowing for setup and runner contention, the expected whole-run duration is **6–9 minutes**, not yet a measured GitHub result. No shards or additional browser jobs are needed. At most three jobs run concurrently after the short change-detection job.

## Coverage and gates

Run `cd web && node scripts/verify-e2e-coverage.mjs`. It enumerates the serial and parallel configurations and compares browser/file/title identities, rejecting duplicates, omissions, additions, or an empty suite. At the implementation baseline (`a5fcae7`), both select **93 tests exactly once**. Normal failure retries remain enabled; “exactly once” describes planned selection, not retry attempts. The coverage verifier runs in CI before the full browser suite.

The active Protect Main ruleset requires `backend`, `frontend`, and `classroom-e2e`. All names are unchanged; no protection settings changed. Documentation-only diffs skip these expensive jobs successfully. A filter failure or uncertain comparison runs them all. Rename detection is disabled in the filter so renaming source into documentation still runs the gate. All jobs have explicit timeouts. Superseded PR runs are cancelled by the existing workflow concurrency group. Ruby, npm, and Go caches remain enabled; Chromium now has a lockfile/OS/architecture-specific cache.

## Acceptance and measurement

Required acceptance: the same browser inventory, all tests passing with two workers, unchanged required checks, code changes running the full gate, docs-only changes skipping expensive jobs, and no more than eight concurrent jobs. The first GitHub run must confirm the hosted runner libraries and measure actual wall time. The lead should compare several successful PR runs before declaring the median target achieved.

No frontend source or deployment configuration changed. No production frontend build is needed for this CI-only change. Deployment previews remain unchanged.

## Local verification

On the Mac mini, the implementation passed all **93 Chromium tests in 3.5 minutes with two workers**, against the dedicated `hafa_code_ci_speed_e2e` database and ports 3114/5290/5292. No tests failed or retried. The database and task-owned servers were cleaned afterward; the borrowed PostgreSQL service remained running. This is a macOS verification, not an after-measurement of GitHub's Linux runners. Web lint, the production build and its security/asset verification, actionlint, the inventory proof, and four filter tests passed. The filter integration test covers committed docs, a source-to-Markdown rename, missing history, and an initial push. Unchanged backend/unit suites are left to full CI under the task's affected-tests-only local instruction. WebKit is not run on this host.

### Contention fix verification (November 22)

The two-worker CI failures included unsettled display controls, WCAG scans after a fixed 300 ms delay, and transient Monaco widget visibility failures. The browser projects now request `prefers-reduced-motion: reduce`, using the app’s existing reduced-motion CSS to test settled accessible states. The accessibility suite does not assert motion. Worker scheduling, check names, timeouts, and test selection are unchanged.

The full CI-parallel Chromium suite passed twice on macOS: **93/93 in 3.6 minutes**, then **93/93 in 3.5 minutes** with one CPU-busy Python process running throughout. Neither run retried a test. The inventory verifier still reports 93 serial = 93 parallel, without duplicates or omissions. Runs used the throwaway `hafa_code_pr77_fix_e2e` database and ports 3514/5590/5592. This supports the motion fix but does not reproduce the exact four-vCPU Linux runner; final GitHub verification belongs to the lead.
