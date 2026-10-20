# Lesson starter links (CSG Learn → Hafa Code)

A lesson starter link opens Hafa Code with the lesson's starter code already in a project, shows "Back to your lesson", and gives the learner a "Copy code for Learn" button for the submission box. Opening the same link again brings back the learner's own copy instead of replacing it.

This page is for CSG Learn content authors and anyone generating links for a course.

## Build a link

Use the script; do not hand-encode links.

```sh
npm --prefix web run starter-link -- \
  --title "Expense summary project" \
  --lang python \
  --file expense_summary.py=path/to/expense_summary_starter.py \
  --key csg-python-pilot:project \
  --return https://learn.codeschoolofguam.com/lessons/123 \
  --label "Independent expense-summary project"
```

The script prints the link and warns on stderr when the link is long or the label was cleaned. For a whole course, write a manifest and get JSON back:

```sh
npm --prefix web run starter-link -- --manifest web/scripts/examples/csg-python-pilot-starters.json
```

The manifest has `baseUrl` (optional) and `starters`, each with `key`, `title`, `kind`, `files` (`path` plus `content`, or `source` as a path relative to the manifest), and optional `entryPath`, `returnUrl`, and `returnLabel`. Any other fields, such as `lesson` or `lessonTitle`, are copied to the output so you can match links to lessons. The pilot example uses `https://learn.codeschoolofguam.com/lessons/LESSON_ID`; after the course is imported into Learn, replace `LESSON_ID` in each link with the lesson's real id.

In code, `buildStarterLink()` in `web/src/lib/starterLinks.ts` does the same thing and throws `StarterLinkError` for input the app would reject.

## Link format

```
https://code.shimizu-technology.com/?lang=python#project=<payload>&starter=<key>&return=<lesson URL>&returnLabel=<lesson title>
```

| Part | Meaning |
|---|---|
| `?lang=python` | The language to fall back to if the project payload is damaged. Without a payload, it opens the learner's latest Python project or a new one. |
| `project` | UTF-8 JSON `{"title", "kind", "entryPath"?, "files": [{"path", "content", "language"?}]}`, either as URL-safe base64 (RFC 4648 §5, no padding) or, when shorter, `z.` followed by URL-safe base64 of the raw-DEFLATE-compressed JSON. The builder picks the shorter form. Ids, timestamps, and visibility are filled in by the app. Compressed payloads that inflate past 2.5 MB are refused. |
| `starter` | A stable key for this lesson's starter, such as `csg-python-pilot:project`. 1–80 letters, digits, `.`, `_`, `:`, or `-`, starting with a letter or digit. Keep it the same when you fix a typo in the starter. |
| `return` | The lesson URL for "Back to your lesson". Must be on an allowed origin (below). |
| `returnLabel` | The lesson title shown next to the button. Optional. |

`starter`, `return`, and `returnLabel` may also be in the query string; the builder puts them in the hash so the lesson URL is not sent to the server or logged. Hafa Code removes all of these parameters from the address bar after reading them.

Links without `starter` or `return` still work. They behave like a Share link from before this feature.

## What the learner sees

- **First open:** a new project with the starter, opened on the code with Run ready. Above the code, a bar shows a quiet "Code School of Guam" badge, the lesson title, "Copy code for Learn", and "Back to your lesson". On desktops 1280px and wider, the bar also says "Paste it into the lesson's submission box."
- **Copy code for Learn:** copies the project's code (one file as-is; several files separated by `----- path -----` lines) and confirms "Code copied. Paste it into the lesson's submission box." If the browser blocks the clipboard, the learner is told to select and copy the code by hand.
- **Back to your lesson:** a normal link to the lesson in the same tab. Work is already saved in the browser (and to their account when signed in). Learn opens external links in a new tab, so the lesson tab is usually still open too.
- **Reload or come back later:** the bar returns whenever that project is open in this browser. It does not appear on other projects.
- **Opening the lesson link again:**
  - If the learner has not changed the copy, it opens: "Opened “…” from your lesson."
  - If they changed it, their work opens unchanged: "Welcome back. Your saved work on “…” is open." The message has a **Start over** button that adds a fresh copy of the starter as "Title (2)" and keeps the earlier work in Projects. Nothing is overwritten.
  - Renaming the project does not break this; the starter key identifies it.
  - If the learner deleted their copy, a new one is created.
  - A newer link replaces the saved lesson URL, so a moved lesson still gets the right Back link.
- **Damaged link** (for example cut off when copied): "Could not import the shared project link. It may have been cut off when it was copied; go back and open the full link again." With `?lang=python`, a Python project still opens.
- **Oversized link** (payload over 3,000,000 characters): "This project link is too large to open…" and nothing is imported.

## Allowed return origins

Hafa Code shows "Back to your lesson" only for these origins. Anything else is ignored silently, so the feature cannot be used as an open redirect.

- `https://learn.codeschoolofguam.com`
- CSG Learn Netlify deploy previews: `https://deploy-preview-<number>--csg-learn.netlify.app`
- `http://localhost:<port>` and `http://127.0.0.1:<port>`, in development builds only

The URL must be an absolute `https:` (or dev `http:`) URL without a username or password, backslashes, or control characters, and no longer than 2,048 characters. `javascript:` and `data:` URLs, protocol-relative (`//host`) and relative URLs, look-alike hosts such as `learn.codeschoolofguam.com.evil.com`, other ports, and still-encoded URLs are rejected. Saved targets are checked again every time they are read from browser storage.

The label is plain text. Control characters and direction-override characters are removed, whitespace is collapsed, and it is cut to 80 characters with an ellipsis.

To allow another origin, change `isAllowedLearnOrigin` in `web/src/lib/starterLinks.ts` and its tests.

## Privacy and sharing

The lesson URL, label, and starter key are kept in this browser's storage (`hafa-code-lesson-links-v1`), not in the project. They are never included in Share links, server snapshots, single-project exports, or cloud saves. When a signed-in learner's project first syncs and gets its cloud id, the record moves with it.

A complete **Workspace backup** does include the records for the projects it contains, so restoring it on a new browser brings back "Back to your lesson" and reopening by link. Restoring re-checks every record against the allowlist above, drops records for projects that are not in the backup, and keeps this browser's own record when both have one. Backups made before this change restore without lesson records.

## Length limits

| | Characters |
|---|---|
| Orientation starter (one line, with return) | about 370 |
| Lesson 2 starter (6 lines, with return) | about 460 |
| Expense-summary project starter (1.5 KB, with return; compressed) | about 1,200 |
| Builder warning: may be cut off on iPhone when opened from another app | over 2,000 |
| Builder warning: may break in chat apps, email, QR codes | over 8,000 |
| Builder refuses | over 64,000 |
| App refuses the `project` payload | over 3,000,000 |

Base64 makes the payload about a third longer than its bytes, and the return URL is percent-encoded; compression usually more than makes up for that on real starter code. Tapping a link inside a Learn lesson in a browser keeps long links intact (a 5,000-character link arrived whole in iOS Safari). When iOS hands a link from another app to Safari (Messages, Mail, the CSG Learn app), the simulator cut it at 2,047 characters, so keep links under 2,000. Over 8,000 characters, links also break when pasted into chat apps, email, or SMS, and they are too dense for QR codes. For anything that large, share a file (More → Import) or a Share snapshot instead.

## Phones

The link opens straight to the code with Run reachable, in portrait and landscape. The lesson bar sits above the code and the output: on phones it shows the lesson title on one line and two 44px buttons, "Back to your lesson" and "Copy code for Learn" (shortened to "Lesson" under 380px wide). A phone turned sideways moves the navigation to a rail on the left and keeps the bar to one 44px row ("Lesson", the lesson title, "Copy for Learn"), so the editor gets most of the height (about 267px of a 390px-tall screen).

The copy button uses the system clipboard, which needs a tap; in-app browsers that block clipboard access get the select-and-copy message instead.

## Limits

- The starter-to-project record is per browser. A learner who opens the same lesson link on a second device gets a new copy there; signed-in learners also see their first copy in Projects after it syncs.
