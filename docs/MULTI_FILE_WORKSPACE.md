# Multi-File Workspace Plan

## Why This Matters

Hafa Code should stay welcoming for first-time students, but it should not trap growing students in one-file exercises. A better Replit-like experience for this project is a workspace that starts simple and opens up naturally:

- Beginners still get a ready-to-run `main.rb`, `main.js`, or `index.html` project.
- Intermediate users can create helper files, folders, data files, and multiple pages.
- Advanced users can organize real small projects without leaving the browser.
- The backend remains a storage API only; student code still runs in browser sandboxes.

The goal is not to copy Replit's container platform in one step. The goal is to make Hafa Code's browser-native model feel like a real project workspace.

## Product Shape

Each project has:

- A `kind`: `ruby`, `javascript`, or `web`.
- A list of source files with normalized relative paths.
- An `entryPath`, which is the file Run or Preview treats as the project entrypoint.

The default projects remain intentionally small:

- Ruby: `main.rb`
- JavaScript: `main.js`
- Web: `index.html`, `style.css`, `script.js`

The user can then opt into more structure by creating files and folders.
The file creation flow should favor simple filenames first, such as `helper.rb`, `about.html`, `styles.css`, or `app.js`. Folder paths like `assets/logo.svg` or `lib/helper.rb` are supported, but they should feel optional rather than required.

## Non-Goals For This Pass

- Full Linux shells
- Package installation
- Secrets management
- Backend execution of arbitrary code
- Real-time multiplayer editing
- WebContainer-only runtime requirements

Those are separate product tiers. This pass should make multi-file browser execution excellent before adding heavier infrastructure.

## Implementation Principles

1. Keep the beginner path unchanged.
2. Treat project files as a workspace, not editor tabs.
3. Store the entry file explicitly.
4. Validate file paths on both client and server.
5. Make web preview resolve local project files by path.
6. Make Ruby and JavaScript runners execute the configured entry file.
7. Preserve export, import, share, checkpoint, duplicate, archive, and cloud sync behavior.

## Path Rules

Project paths are portable relative paths:

- Use `/` as the separator.
- No leading slash.
- No empty path segments.
- No `.` or `..` segments.
- No hidden config files in this phase unless we intentionally allow them later.
- No duplicate paths within a project.
- Reasonable limits on file count, path length, and content size.

## Runtime Direction

### Web

The preview should build a virtual static site from the project files. Local references like these should resolve:

- `<link rel="stylesheet" href="./styles/theme.css">`
- `<script src="js/app.js"></script>`
- `<script type="module" src="./main.js"></script>`
- `<img src="./assets/logo.svg">`
- `fetch("./data.json")`

The preview remains sandboxed with no same-origin permission.

### Ruby

Run the configured Ruby entry file. Browser Ruby execution stays powered by ruby.wasm. The intended advanced behavior is for project files to be available to Ruby so patterns like `require_relative "./lib/helper"` work when the WASM filesystem support allows it.

If filesystem mounting is incomplete in the current runtime wrapper, the UI should still establish entrypoint behavior and keep future mounting isolated inside the worker.

### JavaScript

Run the configured JavaScript entry file. QuickJS remains the lightweight snippet runner.

For this pass, support a small browser-side module loader for relative project imports such as:

```js
import { greet } from "./greet.js"
console.log(greet("Guam"))
```

This keeps JavaScript useful without introducing a full bundler or package manager yet.

## Future Advanced Runtime

After the browser-native workspace is solid, evaluate an optional advanced web-app mode using Sandpack, Nodebox, or WebContainers. That should be separate because WebContainers require modern browser capabilities such as cross-origin isolation and SharedArrayBuffer, and large projects can be constrained on mobile devices.

## Rollout Checklist

- Add `entry_path` to cloud project persistence.
- Normalize imported/local/cloud project data.
- Add file tree controls: create file, create folder, rename, duplicate, delete, set as entry.
- Add client path validation and user-facing errors.
- Add server path validation and project file count limits.
- Upgrade web preview to resolve arbitrary local paths.
- Upgrade runners to receive project files and entry path.
- Update API tests for entry paths, invalid paths, and multi-file projects.
- Run full gate before merging.
