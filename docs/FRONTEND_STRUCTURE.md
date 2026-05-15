# Frontend Structure

Hafa Code is intentionally open-source friendly: a student should be able to start at the app shell, follow the data flow, and make a small contribution without reading the whole codebase first.

## Current Shape

```txt
web/src/
  App.tsx                     Main workspace orchestration and page composition
  App.css                     App-level styling for the workspace UI
  components/
    AuthControls.tsx          Clerk/local cloud-sync controls
    RunnerPanel.tsx           Ruby/JavaScript terminal runner UI
    WebPreview.tsx            Sandboxed HTML/CSS/JS preview UI
  contexts/
    AuthContext.tsx           Clerk session sync into Rails
  hooks/
    usePreferences.ts         Theme, color mode, and editor-size hooks
  lib/
    api.ts                    Rails API client and cloud/local data mapping
    clerk.ts                  Clerk env validation
    codeRunner.ts             Project types, starter projects, preview builder
    projectStorage.ts         localStorage, import/export, checkpoints
    workspace.ts              Workspace labels, guards, formatting, path helpers
  workers/
    codeRunner.worker.ts      Browser-side Ruby and JavaScript execution
```

## Organization Rules

- Keep pure project rules in `lib/workspace.ts` or `lib/codeRunner.ts`.
- Keep Rails request/response mapping in `lib/api.ts`; UI components should not know API payload casing.
- Keep browser storage and import/export behavior in `lib/projectStorage.ts`.
- Keep reusable visual panes in `components/`.
- Keep hooks that own browser subscriptions or persisted preferences in `hooks/`.
- Let `App.tsx` remain the composition root, but avoid adding new large panels directly to it.

## Next Cleanup Targets

`App.tsx` is still the largest file because it owns the workspace state machine and several panels. The next safe extraction steps are:

1. Move the project sidebar and mobile project menu into `components/ProjectSidebar.tsx`.
2. Move the editor/file browser area into `components/EditorWorkspace.tsx`.
3. Move the classroom roster/invitation panel into `components/ClassroomPanel.tsx`.
4. Move modal sheets into small dialog components once their props settle.
5. Split `App.css` by feature after the JSX is split, keeping shared tokens and base controls in one stylesheet.

Avoid doing all five at once. Each extraction should keep behavior unchanged and pass lint/build before the next step.
