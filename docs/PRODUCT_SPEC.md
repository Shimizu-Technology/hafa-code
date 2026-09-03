# Hafa Code Product Spec

## Goal

Create a small, open-source coding playground for students and alumni to practice Ruby, JavaScript, Python, Java, HTML, and CSS without installing a local dev environment.

## Primary Users

- CSG current students
- CSG alumni
- Father Dueñas students
- Instructors and mentors creating starter exercises
- Alumni contributors improving templates/runners/docs

## Core User Stories

### Student

- I can open a browser and immediately write Ruby, JavaScript, Python, or Java.
- I can press Run and see output/errors.
- I can understand common errors in plain language and jump to the relevant guide topic.
- I can create an HTML/CSS/JS page and see it update live.
- I can look up common syntax without leaving my project.
- I can open an example in a separate practice project without replacing my code.
- I can choose a short challenge for any supported language, reveal hints as needed, and check my work without enrolling in a curriculum.
- I can save my work and come back later.
- I can share a link with an instructor or friend.
- I can fork a starter exercise and make it my own.

### Instructor/Mentor

- I can create starter templates.
- I can send students a challenge link.
- I can view student submissions/projects if they share them.

### Contributor

- I can run the project locally with one command.
- I can contribute new templates, bug fixes, docs, and UX improvements.

## MVP Features

### Playground Modes

1. Ruby snippet
   - One editor
   - stdout/stderr panel
   - 3s timeout

2. JavaScript snippet
   - One editor
   - console.log/warn/error capture
   - 3s timeout

3. Python project
   - Multi-file Python editor
   - Standard-library-only Pyodide runtime
   - stdout/stderr panel with interactive `input()` on JSPI-capable browsers
   - explicit loading, running, waiting-for-input, success, error, and timeout states
   - warm repeat runs with fresh project files and module imports
   - 3s execution timeout after runtime startup

4. Java project
   - `Main.java` plus default-package helper classes
   - Java 8 compiler diagnostics, stdout/stderr, and line-oriented standard input
   - explicit startup and execution states with a Stop control
   - warm repeat runs after the first runtime download
   - no packages, build tools, external dependencies, or desktop GUI support

5. Web page
   - HTML editor
   - CSS editor
   - JS editor
   - sandboxed iframe preview

### Language Guides

- One searchable quick reference for each supported project kind: Ruby, JavaScript, Python, Java, and HTML/CSS/JS
- Plain-language explanations, runnable syntax, expected results, and common mistakes
- A safe **Try example** action that creates a complete practice project and leaves the current project untouched
- Responsive presentation: a topic index beside the reference on desktop and a full-screen, touch-friendly guide on mobile
- Stable topic IDs that later curriculum lessons can link to without making the guide itself sequential or graded

### Practice Lab

- Three progressive challenges for every supported project kind: Ruby, JavaScript, Python, Java, and HTML/CSS/JS
- Separate private practice projects so a learner's current work is never overwritten
- Plain-language steps, concept labels, and progressive hints that stay available while coding
- Deterministic checks for required syntax and runtime output, or HTML/CSS/JS file requirements for Web projects
- Unlimited attempts and local completion tracking without scores, deadlines, or a required sequence
- Responsive browsing and in-workspace feedback designed for both desktop and mobile use

### Contextual Error Coach

- Deterministic, private explanations for common Ruby, JavaScript, Python, Java, and Web preview errors
- File and line context when the runtime provides it, followed by three focused next steps
- Direct links into the relevant topic in the project’s language guide
- No generated fixes or hidden code changes; the original terminal/console error remains visible
- Responsive cards with full-width, touch-friendly guide actions on mobile

### Saving

Phase 1:

- localStorage saves projects anonymously
- project dashboard/list
- create, rename, duplicate, and delete projects
- import/export JSON
- copy share link that imports a local copy via URL hash

Phase 2:

- Clerk user auth
- Rails-backed cloud projects
- share links
- forks/remixes

## Non-Goals for MVP

- Server-side arbitrary code execution
- Package installation
- Multiplayer editing
- Full terminal/linux containers
- AI assistant
- Course-style grading, scores, and gradebook workflows

These can come later, but only after the simple learning loop is excellent.

## Recommended Stack

- Rails API-only backend
- Clerk auth, following the CSG LMS pattern
- React + TypeScript + Vite frontend
- Monaco editor
- Ruby WASM for Ruby
- QuickJS WASM for JavaScript
- Pyodide WASM for Python
- CheerpJ for Java 8
- Sandboxed iframe for HTML/CSS/JS
- PostgreSQL for users, projects, files, forks, and share metadata

## Open Source Positioning

Suggested license: MIT.

Suggested repo topics:

- education
- code-school
- ruby-wasm
- javascript
- html-css
- guam
- beginner-friendly
