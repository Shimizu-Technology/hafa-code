# Frontend Structure

Hafa Code is intentionally open-source friendly: a student should be able to start at the app shell, follow the data flow, and make a small contribution without reading the whole codebase first.

## Current Shape

```txt
web/src/
  App.tsx                     Main workspace orchestration and page composition
  App.css                     App-level styling for the workspace UI
  components/
    AuthControls.tsx          Clerk/local cloud-sync controls
    EditorWorkspace.tsx       File navigation, Monaco editor, and runner/preview composition
    LanguageGuide.tsx         Searchable, project-aware syntax reference and practice launcher
    MobileWorkspaceNav.tsx    Touch-friendly navigation between mobile workspace sections
    PracticeLab.tsx           All-language challenge browser and progress overview
    PracticeSessionPanel.tsx  Active challenge instructions, hints, and check results
    ProjectSidebar.tsx        Desktop and mobile project navigation
    ProjectToolbar.tsx        Project metadata, visibility, history, and primary actions
    RunnerPanel.tsx           Ruby/JavaScript/Python/Java terminal runner UI
    WebPreview.tsx            Sandboxed HTML/CSS/JS preview UI
    WorkspaceDialogs.tsx      Controlled file, share, organization, action, and confirmation dialogs
  contexts/
    AuthContext.tsx           Clerk session sync into Rails
  hooks/
    usePreferences.ts         Theme, color mode, and editor-size hooks
  lib/
    api.ts                    Rails API client and cloud/local data mapping
    clerk.ts                  Clerk env validation
    codeRunner.ts             Starter-project and web-preview helpers
    languageGuides.ts         Guide topics and complete practice projects for every project kind
    languageRegistry.ts       Supported languages, starters, editor and runner metadata
    practiceLab.ts            Challenge catalog and deterministic source/output checks
    practiceProgress.ts       Local challenge completion and project-to-challenge links
    projectTypes.ts           Shared project, file, and language types
    projectStorage.ts         localStorage, import/export, checkpoints
    runnerOutcome.ts          Shared runner completion contract for learning tools
    workspace.ts              Workspace labels, guards, formatting, path helpers
  workers/
    runnerProtocol.ts         Typed worker request/response contract
    rubyRunner.worker.ts      Browser-side ruby.wasm execution
    javascriptRunner.worker.ts Browser-side QuickJS execution
    pythonRunner.worker.ts    Browser-side Pyodide execution
    javaRunner.worker.ts      Browser-side CheerpJ compiler and runtime bridge
```

`web/public/javaRunner.bootstrap.js` is the small classic-worker entry point that loads CheerpJ before importing the bundled Java runner module. It exists because CheerpJ's worker API uses `importScripts`, while the application code is bundled as ES modules.

## Organization Rules

- Add project kinds and file-language behavior through `lib/languageRegistry.ts`; do not add parallel language switches in components.
- Add syntax-reference content through `lib/languageGuides.ts`; every topic needs a stable ID and a complete practice project.
- Add short exercises through `lib/practiceLab.ts`; each supported project kind should keep a Starter, Builder, and Stretch progression.
- Keep pure project rules in `lib/workspace.ts` or `lib/codeRunner.ts`.
- Keep Rails request/response mapping in `lib/api.ts`; UI components should not know API payload casing.
- Keep browser storage and import/export behavior in `lib/projectStorage.ts`.
- Keep reusable visual panes in `components/`.
- Keep hooks that own browser subscriptions or persisted preferences in `hooks/`.
- Let `App.tsx` remain the composition root, but avoid adding new large panels directly to it.

## Next Cleanup Targets

`App.tsx` remains the workspace state machine and composition root. Project navigation, editor/output composition, metadata actions, mobile navigation, and dialogs are controlled presentation components. The next safe extraction steps are:

1. Move the classroom roster/invitation panel into `components/ClassroomPanel.tsx` once that workflow changes again.
2. Extract stateful cloud-sync orchestration into a dedicated hook with focused conflict/retry tests.
3. Split `App.css` by feature after the remaining classroom JSX is split, keeping shared tokens and base controls in one stylesheet.

Keep presentation components controlled: persistence, permissions, and destructive confirmations stay in `App.tsx` or focused state hooks. Each extraction should keep behavior unchanged and pass lint/build before the next step.
