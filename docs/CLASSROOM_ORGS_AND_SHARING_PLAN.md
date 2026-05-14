# Classroom, Sharing, Accessibility, and Runner Plan

This document captures the next major product direction for Hafa Code after the personal playground MVP: reliable sharing, organization/classroom support, instructor visibility, an interactive runner terminal, dark mode, color-blind mode, and a future command-shell experience.

The guiding idea is to keep Hafa Code simple for individual learners while adding enough classroom structure for teachers to see student work without turning the app into a full LMS.

## Current State

Hafa Code currently has:

- Personal local projects stored in `localStorage`.
- Signed-in cloud projects stored in Rails and owned by one `User`.
- A global user role enum: `student`, `mentor`, `admin`.
- Project records with `visibility`, but the frontend always saves cloud projects as `private`.
- Snapshot share links through `/api/v1/shares`.
- Browser-side code execution only: Ruby through Ruby WASM, JavaScript through QuickJS, and web projects through a sandboxed iframe.
- Output panels for stdout/stderr/browser console, with Ruby stdin now moving into an interactive terminal-style runner.
- A light visual theme with hard-coded colors in several places and Monaco forced to `vs-dark`.

The current architecture is strong for a personal learning playground. The next step is to add a permission model that supports classrooms without breaking personal accounts.

## Production Share Issue

The production Share failure observed in the browser console was caused by the frontend Content Security Policy blocking API requests to the Render API origin.

The frontend CSP in `web/public/_headers` currently allows:

- `self`
- Bunny fonts
- Clerk domains
- `https://*.shimizutechnology.com`

It does not allow `https://hafa-code.onrender.com`, so fetches to `/api/v1/shares` fail before Rails receives the request.

Fix requirements:

1. Add the production API origin to `connect-src`.
2. Confirm the Rails API `ALLOWED_ORIGINS` includes the production frontend origin.
3. Redeploy frontend and API config together.
4. Improve the Share UI so server-share failure is explicit and copyable rather than only appearing as a transient notice.

This CSP fix should happen before the larger classroom work because it affects all frontend API calls, not just Share.

## Account and Organization Model

Use one user account with multiple project contexts.

Students, instructors, alumni, and free users should not need separate accounts for personal vs classroom work. A user can have:

- Personal projects with no organization.
- Organization projects tied to one organization.
- Memberships in zero or more organizations.

Proposed data model:

```txt
users
  id
  clerk_id
  email
  first_name
  last_name
  role                  # global platform role, kept for owner/admin operations

organizations
  id
  name
  slug
  created_by_id

organization_memberships
  id
  organization_id
  user_id
  role                  # student, instructor, owner
  created_at
  updated_at

organization_invitations
  id
  organization_id
  email
  role                  # student, instructor
  token
  accepted_at
  expires_at
  invited_by_id

projects
  id
  user_id               # project owner
  organization_id       # nullable; null means personal project
  title
  kind
  visibility
  entry_path
  forked_from_id
  archived_at

project_files
  id
  project_id
  path
  language
  content
  position
```

Keep `projects.user_id` as the owner even for organization projects. The organization answers "which classroom/workspace does this belong to?" while `user_id` answers "who created and edits this?"

Organization creation should be controlled at the platform level for the first classroom release. Free users keep personal projects by default. Platform admins and mentors can create organization workspaces, then organization owners and instructors invite students and instructors into that workspace. This avoids public org spam while still supporting real classes, cohorts, and schools.

## Visibility Model

Replace the current practical behavior of "everything is private" with explicit visibility that works in both personal and organization contexts.

Recommended visibility values:

```txt
private
organization
unlisted
public
```

Rules:

- `private` personal project: owner only.
- `private` organization project: owner plus organization instructors/owners.
- `organization`: visible to members of the project organization.
- `unlisted`: visible to anyone with the link, but not listed publicly.
- `public`: visible outside the organization and eligible for public browsing later.

Instructor visibility should be a feature of organization membership, not a global role. A user can be an instructor in one org and a student in another.

## Share Model

There are two different share concepts. They should be named and implemented separately.

### Snapshot Share

Current behavior. A share link creates a copy of the project at the time the link is generated.

Use this for:

- Sending a quick project copy to a friend.
- Sharing starter code.
- Offline fallback when the API is unavailable.

Behavior:

- Token-backed snapshot links expire.
- Offline hash links can still exist as a fallback.
- Imported snapshot becomes a local/personal copy.

### Live Project Link

Future behavior. A link points to the actual project record and respects project visibility.

Use this for:

- Instructors viewing current student work.
- Students sharing a public portfolio project.
- Organization members viewing shared work.

Behavior:

- Read-only unless the viewer is the owner.
- Permission checked on every API request.
- Private organization projects remain visible to instructors/owners.

Do not make snapshot share carry the whole permission model. It is a copy mechanism, not an authorization mechanism.

## Authorization Policy

Centralize project authorization in the Rails API before adding instructor UI.

Recommended project capabilities:

```txt
can_view_project?(user, project)
can_edit_project?(user, project)
can_delete_project?(user, project)
can_manage_org?(user, organization)
can_view_org_roster?(user, organization)
can_invite_org_member?(user, organization)
```

Initial policy:

- Owners can view/edit/delete their own projects.
- Organization instructors/owners can view all organization projects.
- Organization instructors/owners cannot edit student code in the first pass.
- Organization members can view `organization`, `unlisted`, and `public` org projects.
- Anonymous users can view `public`, `unlisted`, and snapshot shares only.
- Platform admins can manage platform-level support tasks, but classroom permissions should still prefer organization membership.

This should be enforced in Rails, not only in React.

## Frontend Product Shape

Add a project context switcher:

```txt
Personal
Code School of Guam
Father Duenas
Another Organization
```

The active context controls:

- Which projects are listed.
- Where new projects are saved.
- Which visibility options are available.
- Whether instructor dashboard navigation appears.

Personal projects:

- Stored with `organization_id = null`.
- Only visible to the owner unless `unlisted` or `public`.
- Continue to support local-only drafts for signed-out users.

Organization projects:

- Stored with `organization_id`.
- Visible according to org membership and project visibility.
- Private org projects are visible to owner and org instructors/owners.

The UI should make the context obvious near project creation and project title controls so students do not accidentally save classroom work into personal space or vice versa.

## Instructor Dashboard

First pass should be deliberately small:

- Organization roster.
- Student list/search.
- Project list per student.
- Read-only project viewer with file tabs.
- Visibility/status labels.
- Last updated timestamps.

Defer:

- Grades.
- Rubrics.
- Comments.
- Autograding.
- Submission windows.
- Assignment objects.

Those can be added later once the view-only classroom workflow is solid.

## Interactive Runner Terminal

Ruby programs that use `gets.chomp` need an interactive bridge that feels like a terminal without exposing a general-purpose shell.

Implemented shape:

1. The existing Run button starts the selected entry file.
2. The output panel renders a terminal transcript.
3. Ruby `Kernel#gets` and `STDIN.gets` call a worker-hosted async stdin bridge.
4. When Ruby requests input, the worker posts an input request, the UI shows an inline terminal input row, and execution resumes after Enter.
5. Stop still terminates the worker, and the execution timeout pauses while the program is waiting for human input.

The worker protocol supports:

```ts
type RunnerMessage =
  | { type: 'started' }
  | { type: 'output'; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'input_request' }
  | { type: 'result'; stdout: string; stderr: string; durationMs: number }
```

This makes beginner Ruby exercises like this work:

```ruby
puts "What is your name?"
name = gets.chomp
puts "Hafa adai, #{name}!"
```

JavaScript can later receive a simple async `input()` helper, but Ruby `gets` is the user-reported blocker.

## Dark Mode and Color-Blind Mode

Add user preferences rather than only relying on media queries.

Recommended preference shape:

```ts
type ThemePreference = 'system' | 'light' | 'dark'
type ColorModePreference = 'default' | 'colorblind'
```

Store these in localStorage and apply them as attributes:

```html
<main data-theme="dark" data-color-mode="colorblind">
```

Implementation notes:

- Replace hard-coded CSS colors with semantic tokens.
- Keep the Monaco/code editor surface dark in every app theme so code stays visually stable between light and dark preference changes.
- Color-blind mode should not rely only on hue; use text, icons, borders, underlines, and state shapes.
- Verify warning/error/success colors in terminal, preview console, buttons, notices, and project cards.
- Keep contrast high enough for classroom projectors and older student devices.

## Implementation Order

1. Production API/CSP hotfix.
2. Share modal and clearer snapshot-share behavior.
3. Persist project visibility end to end.
4. Rails organization data model.
5. Rails authorization helpers and API tests.
6. Organization and membership APIs.
7. Frontend project context switcher.
8. Organization project creation/listing.
9. Instructor dashboard read-only project viewer.
10. Interactive runner terminal for Ruby `gets.chomp`.
11. Dark mode and color-blind mode preferences.
12. Future live project links and public gallery/search.

This order intentionally separates the urgent production fix from the deeper authorization work. It also gets backend authorization in place before building UI that depends on it.

## Testing Plan

Backend tests:

- Personal project owner can view/edit/delete.
- Other signed-in user cannot view private personal project.
- Anonymous user cannot view private personal project.
- Organization instructor can view student private org project.
- Organization instructor cannot edit student project in first pass.
- Organization student can view org-visible projects in the same org.
- Organization student cannot view another student's private org project unless instructor/owner.
- Students cannot create organizations unless the platform explicitly enables open org creation.
- Invitation acceptance upgrades an existing member when invited to a stronger role and does not silently leave them at the old role.
- Anonymous user can view public/unlisted project routes, once live project links exist.
- Invitations can be created, accepted, expired, and cannot be reused.

Frontend tests/manual QA:

- Share modal shows server links and offline fallback correctly.
- CSP/API production config allows all intended API calls.
- Personal and organization project lists stay separate.
- Creating a project in an org stores `organization_id`.
- Visibility selector round-trips through cloud save/load.
- Instructor dashboard cannot edit student files.
- Ruby `gets.chomp` prompts for input and resumes correctly.
- Theme and color mode preferences persist; system theme follows OS changes; Monaco remains dark.

## Future: Command Shell

A command shell is a different feature from the runner terminal. It should be treated as a later advanced runtime tier.

Possible terminal goals:

- Command history.
- File tree commands like `ls`, `cat`, `ruby main.rb`, and `node main.js`.
- Persistent browser-side filesystem for a project.
- Package installation for selected ecosystems, if a safe runtime supports it.
- Long-running dev servers for advanced web projects.

Possible technology options:

- `xterm.js` for the terminal UI.
- WebAssembly runtimes for language-specific execution.
- Sandpack, Nodebox, or WebContainers for advanced JavaScript/web projects.
- A separate sandbox service only if browser-side runtimes are not enough.

Security constraints:

- Do not run arbitrary student code in the Rails API.
- If server-side execution is ever introduced, it must be a separate sandbox service with CPU, memory, filesystem, network, and abuse controls.
- Keep the beginner browser-side runner even if an advanced terminal is added.

Recommended future shape:

```txt
Beginner mode:
  Run button + interactive runner terminal

Advanced mode:
  Browser command shell + virtual filesystem + richer runtime

Server sandbox mode:
  Optional future service, isolated from Rails
```

The current implementation intentionally stops at interactive program I/O. Shell commands should wait until the virtual filesystem and command surface are designed together.
