# FDMS Classroom Launch Readiness and Action Plan

**Version:** 1.1
**Audit date:** July 25, 2026
**Target:** Father Dueñas Memorial School classroom use during the 2026–2027 school year
**Production frontend:** <https://hafa-code.netlify.app/>
**Production API:** <https://hafa-code.onrender.com/>
**Current recommendation:** **Repository-ready after this hardening PR; production launch remains conditional on the deployment, school, backup, monitoring, and pilot gates below**

## 1. Executive Summary

Hafa Code is a Guam-built, open-source browser coding workspace for beginner Ruby, JavaScript, and HTML/CSS/JavaScript projects. It was intentionally built smaller than Replit: students can start coding without installing a development environment, their code runs in browser sandboxes instead of on the Rails server, and signed-in users can save projects to the cloud.

The application already has a credible classroom foundation:

- Organizations can represent classes.
- Organization roles distinguish students, instructors, and owners.
- A teacher can see and run every student's class project without being able to overwrite the student's code.
- Students can keep work teacher-only or expose it to classmates.
- Invitations, role management, project history, multi-file projects, sharing, archiving, and mobile layouts already exist.
- The current lint, TypeScript build, Rails tests, RuboCop, and Brakeman checks pass.

The classroom-hardening branch resolves the verified repository blockers: durable per-project cloud sync, optimistic conflict protection, private feedback threads, class-preserving copies, bulk invitations, durable email jobs, classroom lifecycle/export/audit behavior, quotas and cleanup, accessibility fixes, safer sharing defaults, leaner PWA caching, active root-level CI, and clear dependency audits. Multi-role Rails integration tests and focused React tests cover the most important authorization, saving, feedback, invitation, lifecycle, and accessibility paths.

The remaining launch gates are operational rather than missing application code:

1. Deploy the branch and verify the real Netlify, Render, and Clerk production configuration.
2. Obtain FDMS privacy/acceptable-use approval and confirm the school-domain and external-sharing policies.
3. Verify database backups with a restore drill; configure monitoring, alerts, and support ownership.
4. Run a production-safe multi-role smoke test and a 2–4 student pilot on the actual FDMS devices and network.

The core architecture does not need to be replaced. The next move is to merge and deploy the hardening work, close the external gates, then run the controlled pilot before full enrollment.

## 2. What Hafa Code Is — and Why It Exists

Hafa Code is best understood as a **classroom coding workspace**, not a complete learning management system.

It solves several specific problems:

- Students can write and run beginner code on school devices without installing Ruby, Node, compilers, or an IDE.
- Ruby and JavaScript run in browser workers with time guardrails.
- Web projects render inside nested sandboxed frames.
- Rails stores users, memberships, project metadata, source files, checkpoints, and share snapshots; it does not execute student code.
- The product is small enough to remain understandable and approachable for Code School of Guam and FDMS students who may eventually contribute to it.
- The visual language and copy give the product a local Guam identity instead of presenting students with a generic enterprise coding tool.

For the FDMS launch, Hafa Code should remain focused on:

- writing and running code;
- organizing student work by class;
- teacher visibility and feedback;
- safe sharing;
- dependable saving and recovery.

Assignments, grades, due dates, rubrics, and official course records should remain in the school's existing LMS during the first school year unless FDMS explicitly decides otherwise. Duplicating a full LMS inside Hafa Code would add scope and risk without improving the coding experience.

## 3. Verified Production Baseline

These checks were performed against the production URLs on July 25, 2026, before the hardening branch was deployed. They are baseline evidence, not a claim about the post-merge deployment.

| Check | Result | Meaning |
| --- | --- | --- |
| Netlify homepage | `200 OK` | The current production frontend is online. |
| Rails `/health` | `200 OK` with `{"status":"ok"}` | The API process is reachable. |
| Netlify security headers | Present | CSP, HSTS, no-sniff, referrer, permissions, and frame protections are configured. |
| Netlify-origin API preflight | Missing `Access-Control-Allow-Origin` | Baseline production cannot use the API from the current origin. The branch fixes the application default; redeployment and a production preflight remain required. |
| Localhost API preflight | Allowed | Current Render CORS configuration appears to allow localhost instead of production. |
| Production page rendering | Successful | The signed-out editor, runner controls, project library, visibility UI, and responsive structure load. |
| Canonical and social metadata | Points to `https://hafacode.com/` | Baseline metadata is stale. The branch aligns canonical, social, robots, and sitemap URLs to Netlify. |
| API authentication/class workflows | Not production-verifiable while CORS is blocked | Must be tested after the origin configuration is corrected. |

### Correction to the earlier domain finding

The earlier concern should be stated precisely:

- The application is available at `https://hafa-code.netlify.app/`.
- The Netlify frontend is not down.
- The production Rails API is healthy.
- The baseline break is that the API does not authorize `https://hafa-code.netlify.app` as a CORS origin.
- `hafacode.com` is a stale or future canonical domain in the baseline metadata, not the URL students should use today.
- The hardening branch declares the Netlify URL as the production application origin and always includes it in CORS, while preserving an environment override for a future domain.

That makes the finding more actionable: align Render, Netlify, Clerk, invitation links, and metadata around one declared production origin.

## 4. Recommended FDMS Operating Model

### Classes

Create two organizations:

- `FDMS — [Course/Period 1] — 2026–2027`
- `FDMS — [Course/Period 2] — 2026–2027`

An organization is the current Hafa Code equivalent of a class/workspace. A student can belong to both organizations and switch between them.

### Roles

| Person | Hafa Code role | Why |
| --- | --- | --- |
| Shimizu platform operator | Platform `admin` | Provisioning, support, and emergency access only. |
| Primary teacher | Organization `owner` | Can invite people, manage roles, remove members, and see all class work. |
| Co-teacher or assistant | Organization `instructor` | Can invite students and see all work without changing roles. |
| Student | Organization `student` | Owns and edits their projects. |

The teacher should **not** be made a platform administrator. Platform admin access spans every organization and private project; organization owner is the correctly scoped role.

Only a platform admin, mentor, or an account allowed by environment configuration can create an organization. The practical setup flow is:

1. A platform admin creates both FDMS organizations.
2. The admin invites the teacher as an instructor.
3. The admin promotes the teacher to owner.
4. The teacher invites students into the correct class.
5. Each organization keeps at least one owner.

### Visibility language and behavior

The product should use classroom-friendly labels:

| Recommended label | Current value | Who can see it |
| --- | --- | --- |
| Teacher only | `private` | Student owner, organization instructors/owners, and platform admins |
| Class | `organization` | Everyone in that organization |
| Anyone with link | `unlisted` | Any signed-in Hafa Code user who has or discovers the project ID |
| Public | `public` | Any signed-in Hafa Code user; class members can also find it in class lists |

Important distinctions:

- “Teacher only” is not literally limited to one teacher; other organization owners/instructors and platform admins can also view it.
- Current live `unlisted` and `public` projects still require Hafa Code sign-in.
- Current project IDs are numeric, so `unlisted` is not a strong opaque-link permission.
- The separate snapshot sharing feature creates an anonymous copy that expires after 30 days. It does not create a live view of the original project.

For the initial FDMS launch, default every class project to **Teacher only**, offer **Class** when peer review is intended, and disable or hide Internet-facing sharing until FDMS approves a written policy.

## 5. Current Capability Matrix

| Classroom need | Current state | Launch decision |
| --- | --- | --- |
| Two separate classes | Supported with two organizations | Use as designed. |
| Teacher manages each class | Supported with organization owner | Use owner, not platform admin. |
| Invite students | Supported individually or by pasted roster | Use bulk invitations for each class and review any per-address errors. |
| Student in both classes | Supported | Test context switching with a real dual-enrollment account. |
| Teacher sees all student work | Supported | Teacher receives read/run access to private class projects. |
| Teacher edits student source | Intentionally not supported | Keep read-only; use comments for feedback. |
| Teacher comments on work | Implemented as private project feedback threads | Teacher/student can reply and resolve; classmates cannot read private threads. |
| Student keeps work teacher-only | Supported as `private` in an organization | Rename the label for clarity. |
| Student shares with class | Supported as `organization` | Rename to `Class`. |
| Public/anyone-with-link work | Partially supported with important caveats | Disable for launch or redesign permissions. |
| Starter project copied into class | Implemented | Copies remain in the class and default to Teacher only. |
| Assignment/due date/grade/rubric | Not implemented and explicitly deferred | Use the school LMS in year one. |
| Reliable full-year autosave | Hardened with local pending state, retries, reconnect, visible status, and optimistic locking | Verify again during the production pilot and monitor failures. |
| Recover older version | Up to 30 checkpoints per project | Keep; add quota/retention policy. |
| Remove student at term end | Implemented | Class work moves to the student's private Personal workspace before membership removal. |
| Teacher exports class work | Implemented as a class JSON export | Run and retain an export before term-end offboarding. |
| Classroom activity/audit record | Implemented for sensitive class actions | Owners can review the latest 100 events; source code is excluded. |

## 6. Prioritized Work

### Priority definitions

- **P0 — launch gate:** Complete before students depend on the platform, unless a written temporary operating procedure explicitly covers the gap.
- **P1 — full-class readiness:** Complete before the initial pilot expands to both classes or before the risk is encountered.
- **P2 — first-semester improvement:** Valuable after the core workflow is stable.

## 6.1 P0 — Launch Gates

### FDMS-001 — Align production origins and prove authenticated production access

**Why:** The production UI loads, but the Rails API does not currently return CORS permission for the Netlify origin. A healthy API is not useful if browsers cannot call it.

**Work:**

- [ ] Set Render `ALLOWED_ORIGINS` to include `https://hafa-code.netlify.app`.
- [ ] Set Render `FRONTEND_URL` or `APP_URL` to `https://hafa-code.netlify.app` so invitation links use the live site.
- [ ] Verify Netlify `VITE_API_URL` points to `https://hafa-code.onrender.com`.
- [ ] Verify Clerk production allowed origins and redirect URLs include the Netlify domain.
- [ ] Decide whether `hafacode.com` will be launched now or later.
- [x] Change canonical, Open Graph, Twitter, JSON-LD, robots, sitemap, and share image URLs to the declared production domain.
- [ ] If both a custom domain and Netlify domain remain valid, configure redirects and allow both origins deliberately.

**Acceptance criteria:**

- A preflight from the production origin returns the exact `Access-Control-Allow-Origin`.
- A real production student can sign in, load projects, create a project, edit it, reload, and see it again.
- A teacher can sign in, load both class workspaces, and view a student's private class project.
- A production invitation opens the correct domain and can be accepted.
- There are no unexpected browser console or network errors in those flows.

### FDMS-002 — Make cloud saving durable and honest

**Why:** The current 900 ms debounce is tied to the active project. Switching projects or workspaces cancels the pending timer. More seriously, cloud merge deliberately retains no local-only projects in an organization context, so an unsynced organization draft can disappear when cloud projects load.

**Work:**

- [x] Replace the single active-project timer with a per-project dirty queue.
- [x] Persist dirty state locally until the API confirms a successful save.
- [x] Never discard a local UUID organization project during cloud merge.
- [x] Reconcile a local draft with its new server ID only after creation succeeds.
- [x] Flush or preserve dirty data on project switch, workspace switch, sign-out, and page close.
- [x] Add bounded retry with clear failed state; do not loop indefinitely.
- [x] Show persistent `Saving`, `Saved`, `Offline`, and `Save failed` states near the project title.
- [x] Remove wording that claims cloud backup when the cloud request has not succeeded.
- [x] Add conflict protection using a revision, lock version, or `updated_at` precondition.

**Acceptance criteria:**

- Editing and immediately switching projects does not lose the edit.
- Editing and immediately switching organizations does not lose the edit.
- Going offline, editing, reloading, and reconnecting preserves and eventually syncs the draft.
- A failed create remains visible as a local pending project.
- Two tabs editing the same project do not silently overwrite each other.
- Automated tests cover each failure path.

### FDMS-003 — Keep class copies inside the class

**Why:** The frontend duplication helper explicitly sets `organizationId`, owner, and organization to `null`. If a teacher publishes a starter project and a student clicks Duplicate, the student's copy becomes a personal project and disappears from the teacher's class view.

**Work:**

- [x] When duplicating a class project, default the destination to the active class.
- [ ] Allow a destination chooser only when the user belongs to multiple valid contexts.
- [x] Preserve private visibility for the student's new copy.
- [x] Use the server duplicate endpoint for signed-in cloud projects or make the frontend behavior match it.
- [ ] Clearly show the destination before confirmation.

**Acceptance criteria:**

- A student duplicates a class starter and the new project appears under that class.
- The teacher immediately sees the copy in the student's project list.
- A student can intentionally copy to Personal only when that choice is explicitly available.
- Cross-class copying never happens without a deliberate destination selection.

### FDMS-004 — Add a minimal teacher feedback system

**Why:** Read-only access is useful, but the requested teaching workflow includes commenting. Without feedback, the teacher must move every review conversation into another tool.

**Minimum scope:**

- [x] Add project comments with author, body, timestamp, and resolved state.
- [x] Allow the project owner, organization instructors/owners, and platform admins to read comments.
- [x] Allow those same classroom participants to reply.
- [x] Keep comments private to the student and teaching staff by default, even when the project is Class-visible.
- [x] Support an optional file path and line number, but do not block launch if the first release is project-level only.
- [x] Show unread feedback to the student and unresolved threads to the teacher.
- [x] Record edits/deletions or disallow destructive comment editing after a short window.

**Acceptance criteria:**

- A teacher leaves feedback on a private student project.
- Only that student and authorized teaching staff can see the thread.
- The student replies and marks the thread resolved, or the teacher resolves it.
- Removing a student does not expose the thread to unrelated users.
- Authorization tests cover student, classmate, teacher, outsider, and platform admin.

**Temporary alternative:** If this cannot be completed before the pilot, FDMS must explicitly agree that feedback will stay in its existing LMS for the pilot. It should not be an accidental missing workflow.

### FDMS-005 — Repair CI and clear high-severity dependency advisories

**Why:** The local quality checks are useful, but GitHub does not execute workflows stored under `api/.github/workflows`. Current production dependency audits also report high-severity JavaScript and Ruby advisories.

**Work:**

- [x] Move the workflow to root `.github/workflows/ci.yml`.
- [x] Give Rails jobs `working-directory: api` or equivalent commands.
- [x] Add Node setup, frontend install, lint, build, and production dependency audit.
- [x] Run Rails tests, RuboCop, Brakeman, and Bundler Audit in CI.
- [x] Pin a supported Node version in the repository; the current machine uses Node 22.22.3 and Vite 8 requires a modern Node runtime.
- [x] Update affected frontend dependencies, including the DOMPurify and `js-cookie` dependency chains.
- [x] Update affected Ruby dependencies, prioritizing `jwt`, `puma`, and `websocket-driver`, then the remaining advisories.
- [x] Rebuild and rerun all tests after lockfile updates.
- [ ] Make passing CI required before merging to `main`.

**Acceptance criteria:**

- A pull request produces visible frontend, backend, style, static security, and dependency checks.
- The workflow passes from a clean GitHub runner.
- `npm audit --omit=dev --audit-level=high` passes.
- `bundle exec bundler-audit check` passes or every exception is narrowly documented with applicability, owner, and expiry date.

### FDMS-006 — Add multi-role end-to-end classroom tests

**Why:** Thirty-two Rails integration tests and clean static scans are a good base, but they do not prove that Clerk, React, Render, Netlify, invitations, and role-specific UI work together.

**Test accounts:**

| Account | Purpose |
| --- | --- |
| Platform admin | Provisioning and emergency-access boundaries |
| Teacher owner | Full class management |
| Teacher instructor | Roster and student-work access without owner powers |
| Student A | Private work and feedback |
| Student B | Class visibility and classmate isolation |
| Dual-class student | Context switching |
| Signed-in outsider | Public/unlisted/private boundaries |
| Removed student | Offboarding behavior |

**Automated critical flows:**

- [ ] Sign in and authorization resolution.
- [ ] Create both classes and assign the teacher owner role.
- [ ] Invite, resend, revoke, accept, reject wrong-email acceptance, and handle expiration.
- [ ] Create/edit/reload a private class project.
- [ ] Teacher views but cannot edit a student's project.
- [ ] Classmate cannot view private work but can view Class work.
- [ ] Duplicate a starter into the correct class.
- [ ] Comment/reply/resolve feedback.
- [ ] Archive, restore, checkpoint, and delete.
- [ ] Remove a student and verify the selected lifecycle behavior.
- [ ] Exercise mobile and keyboard-critical paths.

**Acceptance criteria:**

- The suite runs in CI.
- A smaller smoke suite runs against staging or a production-safe test tenant after deployment.
- No launch-critical flow depends only on a developer's manual memory.

### FDMS-007 — Obtain school privacy approval and define sharing rules

**Why:** Student names, email addresses, class membership, source code, teacher comments, and timestamps may become education records. This is an operational and contractual requirement, not just a code feature.

**Work with FDMS:**

- [ ] Confirm the school administration and IT representative approve Hafa Code for classroom use.
- [ ] Document what data is collected, why it is collected, where it is hosted, and which subprocessors are used.
- [ ] Document authorized use, access control, support access, redisclosure limits, retention, deletion, export, and incident notification.
- [ ] Decide whether student public/unlisted projects and anonymous snapshot links are allowed.
- [ ] Decide whether only school-domain accounts may join FDMS classes.
- [ ] Publish a plain-language privacy notice and terms/acceptable-use policy.
- [ ] Define who can request export or deletion and how quickly requests are handled.
- [ ] Document that platform administrators can technically access private class projects and limit that access by policy and audit logging.

U.S. Department of Education guidance says teachers should first check whether a tool is school-approved. When the school-official exception is used, the service must be under the school's direct control for use and maintenance of education-record information, use must match the school's notice, and the data must not be reused or redisclosed for unauthorized purposes. The Department also calls for reasonable controls that restrict records to officials with legitimate educational interests.

References:

- [Classroom application and FERPA FAQ](https://studentprivacy.ed.gov/faq/i-want-use-online-tool-or-application-part-my-course-however-i-am-worried-it-violation-ferpa)
- [Protecting Student Privacy While Using Online Educational Services](https://studentprivacy.ed.gov/resources/protecting-student-privacy-while-using-online-educational-services-requirements-and-best)
- [Legitimate educational interest access controls FAQ](https://studentprivacy.ed.gov/faq/what-must-educational-agencies-or-institutions-do-ensure-only-school-officials-legitimate)

This plan is a product and engineering checklist, not legal advice.

### FDMS-008 — Prove backup, restore, monitoring, and incident ownership

**Why:** A full school year requires recovery and support processes. The repository alone cannot confirm Render database backups, service plan limits, or restore procedures, and no application error-monitoring integration is present in the code.

**Work:**

- [ ] Verify the production database plan, backup frequency, retention, and point-in-time recovery capability.
- [ ] Perform a restore drill into a non-production database.
- [ ] Add application error monitoring for Rails and React with release identifiers.
- [ ] Add uptime checks for the Netlify app and Rails health endpoint.
- [ ] Alert on elevated API errors, authentication failures, email failures, and save failures.
- [ ] Name a primary and backup support owner during school hours.
- [ ] Write a short incident runbook covering outage, lost work, compromised account, accidental public sharing, and data deletion.
- [ ] Establish a staging environment or isolated classroom test tenant.

**Acceptance criteria:**

- A documented restore has succeeded.
- A synthetic error is visible in monitoring with environment and release context.
- A failed health check reaches the named owner.
- The teacher knows where to report an issue and what response time to expect.

## 6.2 P1 — Full-Class Readiness

### FDMS-101 — Improve roster and invitation operations

- [x] Add paste-list or CSV invitations for 15–20 students.
- [x] Prevent duplicate pending invitations for the same organization/email.
- [x] Add optional allowed-domain enforcement.
- [x] Move email delivery out of the request into a durable background job.
- [x] Record provider message ID, delivery state, failure reason, sender, and timestamps.
- [x] Keep resend and revoke controls.
- [x] Stop returning the invitee email from the public invitation-token lookup unless the UI genuinely needs it.
- [x] Verify the invite-only signup policy: a pending organization invitation must be able to create/link the local user even when open signup is disabled.

### FDMS-102 — Paginate project libraries and load source lazily

**Why:** The project and organization list endpoints include every file and its full contents. This is fine for a new 20-person class but will become slow as each student accumulates projects.

- [ ] Return project metadata from list endpoints.
- [x] Add pagination and stable ordering.
- [ ] Fetch full files only when a project is opened.
- [ ] Give the teacher dashboard student, status, visibility, and updated-time filters.
- [ ] Load one student's projects on demand instead of materializing the whole class library in the editor.

### FDMS-103 — Define quotas and cleanup

- [ ] Set total bytes per project, student, and organization.
- [x] Review the current theoretical project maximum of 50 files × 500,000 characters and enforce a 2 MiB combined-source cap.
- [x] Account for up to 30 full project checkpoints and enforce source-size validation.
- [x] Add scheduled deletion of expired anonymous shares.
- [x] Use a durable database-backed rate-limit store.
- [ ] Add storage-usage visibility and warnings before rejecting work.

### FDMS-104 — Complete class lifecycle and offboarding

- [x] Add school year/term metadata and class archive state.
- [x] Define what happens to projects when a student leaves a class.
- [x] Let the teacher export a student's work and an entire class.
- [x] Let students export their own work before access ends.
- [x] Prevent removed students from being stranded with organization-owned projects they can no longer reach.
- [ ] Define ownership and deletion behavior after graduation or account deletion.

### FDMS-105 — Add an audit trail

Record at minimum:

- organization creation and archival;
- invitations, resends, revocations, and acceptance;
- role changes and member removal;
- public/unlisted visibility changes and anonymous share creation;
- project deletion and administrative access to private student work;
- export and deletion requests.

The log should capture actor, action, target, organization, timestamp, and relevant before/after values without copying project source into the log.

**Implementation status:** Complete for the listed application actions, including explicitly enabled classroom snapshot shares. Owners can read the latest 100 class events. Retention and long-term export of the audit log remain an operational policy decision.

### FDMS-106 — Complete accessibility and device QA

- [x] Add Escape-to-close, focus trap, initial focus, and focus return for every modal.
- [ ] Test full keyboard operation of project, file, history, sharing, and classroom controls.
- [ ] Test with VoiceOver and at least one other screen reader/browser combination.
- [ ] Verify 200% zoom and narrow Chromebook/mobile widths.
- [ ] Recheck color-safe mode and all status states without relying on color alone.
- [ ] Confirm touch targets are at least 44 px where practical.
- [ ] Test the exact school devices, browser versions, content filters, and network.

### FDMS-107 — Reduce first-load and PWA cache cost

The baseline production service worker precaches 102 generated assets. The hardening build limits the install-time cache to the lightweight application shell; language workers and the roughly 36 MiB Ruby standard-library WebAssembly asset are fetched on demand.

- [ ] Measure first visit, repeat visit, offline start, and update behavior on the FDMS network.
- [ ] Load language runtimes only when the corresponding project type is opened.
- [ ] Limit Monaco languages and workers to the languages Hafa Code supports.
- [x] Avoid precaching every generated language asset.
- [ ] Display runtime-loading progress and actionable offline errors.
- [ ] Verify service-worker updates do not leave students on mismatched frontend assets.

### FDMS-108 — Harden public and web-preview behavior

- [ ] Replace numeric live-project unlisted access with an opaque capability token if live unlisted links remain.
- [ ] Decide whether Public means authenticated Hafa Code users or the open Internet, and label it accurately.
- [x] Disable classroom Public, Unlisted, and snapshot sharing by default behind an explicit operator flag.
- [ ] Review automatic execution when a teacher opens a student's web project.
- [x] Remove `allow-modals` from the web-preview sandbox.
- [ ] Confirm expected restrictions on fetches, navigation, forms, popups, remote images, and tracking requests.
- [ ] Keep the nested sandbox and strict preview CSP; update security documentation to match the actual sandbox flags.

## 6.3 P2 — First-Semester Improvements

- [ ] Build a dedicated teacher dashboard instead of keeping all classroom controls inside the editor.
- [ ] Add saved filters for “needs feedback,” “recently updated,” and “unresolved.”
- [ ] Add optional notifications for new feedback and replies.
- [ ] Add class starter/template management once class-preserving duplication is reliable.
- [ ] Consider LMS links or lightweight assignment references, not gradebook replacement.
- [ ] Split the 1,842-line `App.tsx` and 2,283-line `App.css` into the component boundaries already identified in the frontend structure plan.
- [ ] Add product analytics only after school privacy approval, with student-safe configuration and no source-code capture.

## 7. Four-Week Launch Sequence

This is an order of operations, not a guaranteed calendar estimate. Each phase must pass its gate before the next one expands the number of real users.

### Week 1 — Production and data foundation

- Complete FDMS-001 production-origin configuration.
- Complete FDMS-002 save durability design and core implementation.
- Complete FDMS-003 class-preserving duplication.
- Repair CI and start dependency updates from FDMS-005.
- Provision a staging/test tenant and the role matrix.

**Gate:** Production student save/reload and teacher private-project view pass end to end.

### Week 2 — Classroom workflow

- Complete the minimum project-level version of FDMS-004 feedback.
- Complete invite-only account/linking fixes and duplicate-invite protection.
- Implement the P0 end-to-end tests.
- Decide labels and public-sharing policy.

**Gate:** Teacher can invite a student, see private work, leave feedback, receive a reply, and never edit the student's source.

### Week 3 — Privacy, operations, and school-device QA

- Complete the FDMS privacy and acceptable-use review.
- Verify backups, run a restore drill, and add monitoring.
- Test on actual FDMS devices and network.
- Resolve P0 accessibility findings.
- Train the teacher with both class workspaces.

**Gate:** Written school approval, successful restore evidence, monitoring alerts, and teacher sign-off.

### Week 4 — Controlled pilot

- Start with the teacher and 2–4 test students.
- Run at least two real coding sessions.
- Exercise offline/reconnect, class switching, starter duplication, feedback, checkpoint restore, and member removal.
- Review support tickets, save failures, performance, and confusing UI.
- Fix launch-critical pilot findings before enrolling both classes.

**Gate:** No unresolved data-loss, authorization, enrollment, or feedback blockers.

## 8. Launch Checklists

### Before the pilot

- [ ] Production origin and invitation URLs are correct.
- [ ] High-severity dependency audits are clear.
- [ ] CI runs on every pull request.
- [ ] Save failure and recovery scenarios pass.
- [ ] Class-preserving duplication passes.
- [ ] Teacher feedback workflow is implemented or FDMS accepts the documented LMS fallback.
- [ ] Public sharing is disabled or governed by an approved policy.
- [ ] Test accounts for every role exist.
- [ ] Backup restore and monitoring checks pass.
- [ ] School administration/IT approval is recorded.
- [ ] Teacher training and support contact are complete.

### Before both classes enroll

- [ ] Pilot findings are closed or explicitly accepted.
- [ ] Actual student roster import/invitation rehearsal passes.
- [ ] Dual-class context switching passes.
- [ ] School Chromebook/browser/network performance is acceptable.
- [ ] Teacher can find every student's recent work without loading the entire class payload.
- [ ] Offboarding/export behavior is documented.
- [ ] Incident and privacy request procedures are available.

### Ongoing during the school year

- [ ] Review failed saves, API errors, and invitation failures weekly during the first month.
- [ ] Review dependency and security alerts at least monthly.
- [ ] Test a database restore on a defined schedule.
- [ ] Review platform-admin access and public-sharing audit events.
- [ ] Export or archive classes at term boundaries.
- [ ] Reconfirm retention and deletion at year end.

## 9. Decisions Leon and FDMS Need to Make

| Decision | Why it matters | Recommended default |
| --- | --- | --- |
| Are 15–20 students total or per class? | Affects roster, payload, and support testing. | Test for 20 per class even if enrollment is lower. |
| What existing LMS does FDMS use? | Determines where assignments, grades, and official feedback live. | Keep grades/due dates in that LMS. |
| Is feedback required inside Hafa Code at launch? | Determines whether FDMS-004 is an absolute gate. | Yes, at least project-level private threads. |
| Can students publish outside the class? | Changes privacy and moderation requirements. | No by default. |
| Are personal projects allowed on school accounts? | Affects visibility, retention, and duplication. | Allow, but make class context unmistakable. |
| Must accounts use an FDMS email domain? | Reduces wrong-account and outsider enrollment risk. | Enforce for FDMS organizations if practical. |
| Is there a co-teacher or substitute? | Prevents a single-owner support problem. | Keep two organization owners where possible. |
| What is the retention period? | Drives archive, export, deletion, and backup policy. | School year plus an agreed grace period. |
| Who handles support during class? | Reduces downtime and teacher uncertainty. | Name a primary and backup Shimizu contact. |
| Which domain is canonical? | Aligns CORS, Clerk, links, SEO, and documentation. | Use the Netlify domain now; move once to a custom domain later. |

## 10. Explicitly Out of Scope for the Initial FDMS Launch

Unless FDMS changes the requirements, do not make these launch blockers:

- a full gradebook;
- rubrics;
- due dates and submission windows;
- autograding;
- real-time multiplayer editing;
- server-side execution of student code;
- package installation or a general-purpose terminal;
- replacing the school's LMS;
- an open public project gallery.

## 11. Audit Evidence

### Code and architecture reviewed

- `README.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/CLASSROOM_ORGS_AND_SHARING_PLAN.md`
- `docs/FRONTEND_STRUCTURE.md`
- Rails routes, models, authorization concerns, controllers, services, migrations, environment configuration, and integration tests
- React application state, storage merge, API client, authentication context, runner, preview sandbox, service worker, headers, manifest, and build configuration

### Checks run on July 25, 2026

| Check | Result |
| --- | --- |
| `npm --prefix web run lint` | Pass |
| `npm --prefix web run build` | Pass, with large-chunk warnings |
| `npm --prefix web test` | Pass: 4 files, 10 tests |
| `bundle exec rails test` | Pass: 50 runs, 402 assertions |
| `bundle exec rubocop` | Pass: 73 files, no offenses |
| `bundle exec brakeman --no-pager` | Pass: 0 warnings |
| `npm audit --audit-level=high` | Pass: 0 vulnerabilities |
| `bundle exec bundler-audit check` | Pass: no vulnerabilities |
| Local multi-role API workflow | Pass: teacher/student/classmate feedback, private isolation, bulk invite, export, archive, audit, CORS, and stale-save conflict |
| Local visible browser smoke test | Pass: editor loads, Ruby runs, and no unexpected console errors |
| Baseline Netlify production page and headers | Reachable; security headers present |
| Baseline Render health endpoint | Healthy |
| Baseline Netlify-origin Render CORS preflight | Fail before deployment; hardening branch adds the production origin by default |
| Hardening-build service worker inventory | 13 application-shell entries; language runtimes and workers load on demand |

### Confidence labels

- **Confirmed fixed and tested in the hardening branch:** permissions, private feedback, durable save/recovery, stale-write conflict copies, class-preserving duplication, invitation operations, archived-class immutability, export/offboarding, audit logging, class sharing defaults, quotas/cleanup, active CI placement, dependency advisories, metadata, PWA cache inventory, and modal keyboard behavior.
- **Confirmed only in the pre-deployment production baseline:** the Netlify app and Render health endpoint are reachable, while the old deployment's CORS and metadata are stale.
- **Requires external configuration verification:** Clerk production settings, Render/Netlify environment variables beyond observable behavior, database plan and backups, restore capability, service billing limits, DNS ownership, email-provider delivery health, school device/network policies, and school approval.
- **Product decision:** public sharing, exact feedback scope, use of an existing LMS, personal projects, retention duration, support service level, and canonical domain.

## 12. Definition of “Solid Enough to Launch”

Hafa Code is ready for the FDMS pilot when:

1. students can reliably sign in, join the correct class, create or duplicate class work, save it, reload it, and recover from an interrupted connection;
2. the teacher can manage the roster, view every student's teacher-only work, and give feedback without receiving edit authority over student source;
3. classmates and outsiders cannot access work beyond the student's chosen and school-approved visibility;
4. automated tests prove the role boundaries and critical workflows;
5. dependency scans and CI are active and passing;
6. backups, restore, monitoring, incident response, privacy, retention, and support ownership are documented and exercised; and
7. a small real-world pilot on FDMS devices completes without unresolved data-loss, access-control, or enrollment defects.

The existing platform is a strong foundation for that outcome. The next month should be spent hardening the classroom workflow and operational guarantees, not rebuilding the editor or expanding into a full LMS.
