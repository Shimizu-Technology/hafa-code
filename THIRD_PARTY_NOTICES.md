# Third-Party Notices

## SQLite WebAssembly

Hafa Code includes the official SQLite WebAssembly distribution in its on-demand SQL worker.

- Project: <https://sqlite.org/wasm>
- Package source: <https://github.com/sqlite/sqlite-wasm>
- License: Apache License 2.0

The runtime is used only for transient, in-memory learner databases. Hafa Code does not expose OPFS persistence, extension loading, remote database access, or persistent SQLite storage through this integration.

## TypeScript

Hafa Code includes the TypeScript compiler and a focused set of its standard declaration libraries in the on-demand TypeScript worker.

- Project: <https://www.typescriptlang.org/>
- Source: <https://github.com/microsoft/TypeScript>
- License: Apache License 2.0

The compiler is used in the browser to type-check and emit learner projects. Hafa Code does not provide Microsoft support, npm package access, Node APIs, or DOM APIs through this runtime.

## CheerpJ Core

Hafa Code's Java runner uses CheerpJ Core 4.3 by Leaning Technologies Limited.
CheerpJ is loaded on demand from `https://cjrtnc.leaningtech.com`; it is not
self-hosted or redistributed in this repository.

- Product: <https://cheerpj.com/>
- Documentation: <https://cheerpj.com/docs/>
- Licensing: <https://cheerpj.com/docs/licensing>

CheerpJ is commercial software made available under its own license terms.
Eligibility for the Community License depends on the user and deployment. An
appropriate commercial agreement is required for uses outside that scope.

## JavaFiddle compiler archive

The Java runner downloads the Java 8 `tools.jar` used by Leaning Technologies'
JavaFiddle service from `https://javafiddle.leaningtech.com/tools.jar` and places
it in CheerpJ's transient browser filesystem for compilation. The archive is
not committed to or redistributed by this repository.
