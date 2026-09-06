# Classroom operations and incident runbook

Last reviewed: September 6, 2026

## Purpose

This runbook turns the non-code FDMS launch requirements into evidence that a release owner, school contact, or substitute operator can verify. It does not claim that provider backups, monitoring, privacy approval, or support staffing are configured. Those gates stay open until a named person records proof.

Hafa Code is the coding workspace. The school LMS remains the system for grades, due dates, attendance, and official course records.

## Release environments

| Environment | Purpose | Student data | Required evidence |
| --- | --- | --- | --- |
| Local E2E | Deterministic React, Rails, PostgreSQL, browser, accessibility, keyboard, contrast, and responsive checks | Synthetic `.example.test` records only | `npm --prefix web run test:e2e` passes against an `_e2e` database |
| Staging or isolated test tenant | Real Clerk and deployed-service verification | Synthetic school-approved accounts only | URL, owner, expiration date, release SHA, and smoke result recorded below |
| Production | Controlled pilot and classroom use | School-approved accounts and work | School approval, restore evidence, monitoring alert evidence, support owners, and pilot sign-off |

Never copy production student records into local E2E or a general-purpose preview environment.

## Release checklist

The release owner records a link or timestamp beside every item. “Configured” without evidence is not a pass.

- [ ] Required GitHub checks passed for the exact release commit: `frontend`, `backend`, and `classroom-e2e`.
- [ ] CodeRabbit reviewed the exact release commit with no unresolved actionable findings.
- [ ] Netlify serves the expected release and security headers at `https://code.shimizu-technology.com`.
- [ ] Render `/health` is healthy and production CORS accepts only approved app origins.
- [ ] A real Clerk teacher and student can sign in on the staging or isolated test tenant.
- [ ] The student can accept an invitation, save class work, reload it, and see the saved source.
- [ ] The teacher can open that private project, cannot edit it, and can exchange and resolve feedback.
- [ ] A classmate cannot open the private project; Class-visible work remains available.
- [ ] A release-aware synthetic error appears in both Rails and frontend monitoring.
- [ ] A failed health check reaches the primary support owner.
- [ ] The latest non-production restore drill meets the agreed recovery target.
- [ ] The school-approved privacy notice, acceptable-use rules, sharing policy, and support route are published.

## Deployment configuration record

Do not paste secrets into this file, issues, or screenshots. Record provider setting names and evidence links only.

| Setting | Expected boundary | Evidence / last verified | Owner |
| --- | --- | --- | --- |
| Netlify production URL | `https://code.shimizu-technology.com` | _Open_ | _Name required_ |
| `VITE_API_URL` | Production Render API origin | _Open_ | _Name required_ |
| `VITE_CLERK_PUBLISHABLE_KEY` | Production Clerk instance | _Open_ | _Name required_ |
| `FRONTEND_URL` / `ALLOWED_ORIGINS` | Approved production and staging origins only | _Open_ | _Name required_ |
| Clerk issuer, JWKS, and secret | Same production Clerk instance | _Open_ | _Name required_ |
| Invitation email provider | Sender/domain verified; failures monitored | _Open_ | _Name required_ |
| External classroom sharing | Disabled unless the school approves policy and UI labels | _Open_ | _Name required_ |
| Release identifier | Same Git SHA in frontend and Rails monitoring | _Open_ | _Name required_ |

## Backup and restore drill

The database provider's dashboard and current plan are authoritative. Do not assume point-in-time recovery or retention from repository configuration.

1. Name a drill owner and choose an isolated non-production destination database.
2. Record the source backup timestamp, provider plan, retention window, and expected recovery-point objective.
3. Restore through the provider-supported process. Never overwrite production for a drill.
4. Start the Rails API against the restored destination with outbound email disabled.
5. Verify migrations, organization count, membership count, project count, file count, and the newest expected `updated_at` timestamp.
6. Use synthetic accounts to verify session resolution, a private project read, a teacher export, and an archived classroom read.
7. Record elapsed restore time, result, mismatches, screenshots or provider logs, and the release SHA.
8. Remove the temporary destination according to the provider's safe cleanup procedure after evidence is retained.

| Drill date | Backup timestamp | Destination | Result | Restore time | Data checks | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| _Required before pilot_ |  |  | Open |  |  | _Name required_ |  |

## Monitoring and support record

| Responsibility | Primary | Backup | Alert route | Target response |
| --- | --- | --- | --- | --- |
| School-hours support | _Name required_ | _Name required_ | _Email or ticket route_ | _Decision required_ |
| Rails/frontend errors | _Name required_ | _Name required_ | _Monitoring route_ | _Decision required_ |
| Uptime and deployment | _Name required_ | _Name required_ | _Monitoring route_ | _Decision required_ |
| Privacy or account incident | _Name required_ | _Name required_ | _Private escalation route_ | _Decision required_ |

Alerts should distinguish environment and release, avoid source-code payloads, and cover elevated API errors, authentication failures, invitation delivery failures, and repeated cloud-save failures.

## Incident actions

### Application or API outage

1. Confirm the Netlify page and Render `/health` independently.
2. Tell the teacher to keep the page open. Browser-local backups may still contain unsynced work.
3. Pause new invitations and classroom-wide changes until service health is understood.
4. Check provider status, recent deploys, error rate, database connections, and the release SHA.
5. Roll back only to a known compatible frontend/API/database state.
6. Record impact, start/end time, affected classes, decisions, and follow-up work.

### Missing or conflicting work

1. Ask the learner not to clear site data, close the affected tab, or overwrite the project.
2. Record the project name, account, class, browser/device, approximate edit time, and visible save status. Do not request source in a public ticket.
3. Export the local project or complete workspace backup when the UI is responsive.
4. Check cloud project versions, conflict copies, checkpoints, and the latest database backup without editing the original.
5. Restore into a copy first. Get the learner or teacher to confirm the recovered content before replacing anything.

### Compromised account or unexpected access

1. Disable or revoke the affected Clerk session/account through the approved administrator.
2. Preserve relevant Clerk, Rails, and audit evidence; do not include student source in the incident channel.
3. Check organization roles, invitations, exports, private-project access, visibility changes, and snapshot shares.
4. Rotate exposed credentials and notify the school contact according to the approved incident policy.

### Accidental external sharing

1. Disable classroom external sharing at the operator flag if it is enabled.
2. Identify and revoke affected snapshot links where supported; otherwise treat the snapshot as disclosed.
3. Preserve the audit trail and tell the school privacy contact what data the snapshot contained and who could access it.
4. Do not re-enable sharing until the root cause and school policy decision are recorded.

### Deletion or offboarding request

1. Verify requester authority through the approved school process.
2. Export the requested scope before deletion when policy permits.
3. Removing a class member moves their class projects to that user's private Personal workspace; it is not account deletion.
4. Record the request, scope, export location, action, operator, completion time, and retention handling.

## Controlled pilot

Start with one teacher and two to four synthetic or school-approved pilot students. Run at least two lessons and record:

- invitation and sign-in success;
- correct classroom placement and dual-class switching;
- first run and warm run on the actual school network;
- save, reload, offline/reconnect, conflict recovery, and checkpoint restore;
- teacher review, reply, resolution, and classmate isolation;
- mobile/Chromebook keyboard behavior, 200% zoom, screen reader results, and software-keyboard input;
- member removal and export;
- every support question, confusing label, save failure, access failure, and performance problem.

The pilot expands only when no unresolved data-loss, authorization, enrollment, or feedback blocker remains.

## Evidence log

| Date | Environment | Release SHA | Check | Result | Owner | Evidence / follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| September 6, 2026 | Local E2E and PR CI | `98138bb` | Deterministic multi-role browser suite | Pass locally and in required `classroom-e2e` CI | Engineering | [PR #40 checks](https://github.com/Shimizu-Technology/hafa-code/pull/40/checks) |
|  | Staging/test tenant |  | Real Clerk and deployed classroom smoke | Open | _Name required_ |  |
|  | Non-production restore |  | Backup restore drill | Open | _Name required_ |  |
|  | Production |  | Monitoring alert delivery | Open | _Name required_ |  |
|  | FDMS |  | Privacy, acceptable-use, and pilot approval | Open | _Name required_ |  |
