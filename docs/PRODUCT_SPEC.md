# Hafa Code Product Spec

## Goal

Create a small, open-source coding playground for students and alumni to practice Ruby, JavaScript, HTML, and CSS without installing a local dev environment.

## Primary Users

- CSG current students
- CSG alumni
- Father Dueñas students
- Instructors and mentors creating starter exercises
- Alumni contributors improving templates/runners/docs

## Core User Stories

### Student

- I can open a browser and immediately write Ruby or JavaScript.
- I can press Run and see output/errors.
- I can create an HTML/CSS/JS page and see it update live.
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

3. Web page
   - HTML editor
   - CSS editor
   - JS editor
   - sandboxed iframe preview

### Saving

Phase 1:

- localStorage saves projects anonymously
- project dashboard/list
- create, rename, duplicate, and delete projects
- import/export JSON
- copy share link that imports a local copy via URL hash

Phase 2:

- user auth
- cloud projects
- share links
- forks/remixes

## Non-Goals for MVP

- Server-side arbitrary code execution
- Package installation
- Multiplayer editing
- Full terminal/linux containers
- AI assistant
- Autograding

These can come later, but only after the simple learning loop is excellent.

## Recommended Stack

- React + TypeScript + Vite
- Monaco editor
- Tailwind later, but keep MVP CSS simple if it ships faster
- Ruby WASM for Ruby
- QuickJS WASM for JavaScript
- Sandboxed iframe for HTML/CSS/JS
- Future persistence: Supabase or Convex

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

