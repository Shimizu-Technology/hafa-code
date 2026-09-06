# SQL Runtime

Hafa Code's SQL mode is a focused SQLite learning workspace. It is designed for writing schemas, loading small starter datasets, asking questions with queries, and practicing deliberate data changes. It is not a connection tool for production or remote databases.

## Project Files

- `schema.sql` defines tables, keys, and constraints.
- `seed.sql` inserts the predictable starting rows.
- `main.sql` is the default entry file run from the editor.
- Other `.sql` files can be created and selected as the entry file. They are not executed automatically.

The starter opens on a useful three-row result instead of an empty database. Guide examples and all fifteen challenges create separate practice projects, so trying them never replaces current work.

## Run and Reset Lifecycle

The first Run lazily starts a dedicated worker, creates a `:memory:` SQLite database, executes `schema.sql`, then `seed.sql`, and finally executes the selected entry file. Later queries reuse that project worker, so `INSERT`, `UPDATE`, and `DELETE` changes remain visible.

Reset database discards that in-memory database and immediately rebuilds it from the current schema and seed files. Editing either bootstrap file also triggers a rebuild before the next Run. This avoids the confusing state where a learner fixes a table definition but continues querying the old schema.

A page reload, Stop, timeout, project switch that unmounts the runner, or worker failure also discards database state. Source files remain saved through the normal local/cloud project flow.

## Results

- The first statement that returns columns is shown as a semantic HTML table with column headers and an accessible caption.
- A successful query with no matching rows keeps its headers and clearly reports 0 rows.
- Statements without a result table report changed rows and the number of executed statements.
- Up to 500 result rows and 50 columns are displayed. The full row count is reported when a larger result is truncated.
- `NULL` is labeled explicitly. BLOB values are represented as a byte count rather than copied into the interface.
- SQLite errors remain visible beside a plain-language Error Coach explanation.

## Security and Resource Boundary

- Official `@sqlite.org/sqlite-wasm` object-oriented API in a dedicated worker
- in-memory database only; no OPFS persistence, imported database files, remote connection strings, or credentials
- SQLite defensive mode enabled before bootstrap, so normal FTS5 operations work but direct writes to internal shadow tables are rejected
- no exposed extension-loading or network database mechanism
- shared maximum of 50 project files and 2,000,000 UTF-8 source bytes
- 500 displayed rows, 50 columns, 256 KiB of transferred result values, and the shared three-second execution deadline after runtime startup
- Stop and timeout terminate the whole worker
- same-origin worker script/WebAssembly policy with no API, Clerk, or remote database origin

SQLite JavaScript, worker support files, and the WebAssembly binary stay outside the service-worker application shell and load only for SQL work. The audited production build emits an approximately 215 KB SQL runner and an approximately 865 KB SQLite WebAssembly asset before compression. These are regression baselines, not school-network performance claims.

## Release Evidence Still Required

Automated coverage verifies seeded queries, persistent changes, reset behavior, errors, accessible table structure, and mobile overflow. First-run and warm-run timings still need to be recorded on the actual FDMS devices, browser versions, content filters, and network. Local timing cannot substitute for that classroom launch evidence.
