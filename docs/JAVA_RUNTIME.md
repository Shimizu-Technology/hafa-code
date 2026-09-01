# Java Runtime

Hafa Code's Java mode is a browser practice environment for learning the Java
concepts that transfer well to Salesforce Apex: classes, methods, types,
collections, conditionals, loops, exceptions, and object-oriented design. It is
generic Java tooling. It does not contain Bank of Guam code, Salesforce org
metadata, customer data, internal workflows, or employer-specific exercises.

## What works

- Java 8 source in `Main.java`
- Additional `.java` helper files in the default package
- `javac` compiler errors and warnings in the output panel
- stdout and stderr streaming
- line-oriented `System.in`, including common `Scanner` exercises
- explicit loading, running, waiting-for-input, success, error, and timeout states
- Stop by terminating the isolated worker
- local projects, import/export/share snapshots, and signed-in cloud persistence

## First-run behavior

The Java worker lazy-loads CheerpJ 4.3 and a Java 8 compiler archive. The
compiler is fetched from JavaFiddle and copied into CheerpJ's transient browser
filesystem. The first run can therefore take noticeably longer and transfer
tens of megabytes. Later runs in the same warm worker skip runtime setup.

Java source and input stay in the browser runner. When cloud save is enabled,
the existing project-sync feature can store source files in Hafa's Rails API,
but Rails never executes them.

## Deliberate first-release limits

- Java 8 rather than a newer JDK
- no `package` declarations
- no Maven or Gradle
- no third-party JARs or package installation
- no Swing, JavaFX, applets, or other desktop UI
- no general-purpose shell
- no arbitrary network access from student code
- up to 50 Java files, 2 MiB of source, and 256 KiB of output per run

These limits keep the experience understandable, mobile-tolerant, and safer
than adding a remote container service. Apex-specific syntax and curriculum can
come later as a separate product decision; Java coding support does not depend
on that curriculum work.

## Runtime and licensing boundary

CheerpJ is loaded from Leaning Technologies' hosted runtime rather than being
self-hosted or redistributed by Hafa Code. The integration includes visible
attribution. Before Hafa Code is used as an operational tool by a company,
school, public body, or other organization, the owner must confirm that the
deployment fits CheerpJ's current Community License or obtain the appropriate
commercial agreement. See <https://cheerpj.com/docs/licensing>.
