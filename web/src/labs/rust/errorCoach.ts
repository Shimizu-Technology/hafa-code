import { primarySpan, type RustDiagnostic } from './diagnostics'
import type { RustGuideTopicId } from './guide'

export interface RustCoaching {
  title: string
  code: string | null
  /** Where rustc pointed, for example "line 4". */
  location: string | null
  /** rustc's own label for the problem, such as "expected `i32`, found `&str`". */
  detail: string | null
  explanation: string
  steps: string[]
  topic: RustGuideTopicId | null
  docsUrl: string | null
}

interface CoachEntry { title: string; explanation: string; steps: string[]; topic: RustGuideTopicId }

const COACH: Record<string, CoachEntry> = {
  E0382: {
    title: 'A value was used after it moved',
    explanation: 'A String or Vec has exactly one owner. Assigning it to another variable or passing it to a function moves it, so the old name can no longer be used.',
    steps: [
      'Find the line rustc marks "value moved here".',
      'If the function or variable only needs to read it, lend it with & instead: takes(&name).',
      'If you really need two independent copies, call .clone() where it moves.',
      'Or keep using the new owner instead of the old name.',
    ],
    topic: 'ownership',
  },
  E0499: {
    title: 'Two mutable borrows at the same time',
    explanation: 'Rust allows only one &mut reference to a value at a time, so two parts of the code cannot change it at once.',
    steps: [
      'Finish using the first &mut reference before you create the second.',
      'Wrap the first use in its own { } block so its borrow ends sooner.',
      'Change the value directly through one reference instead of keeping two.',
    ],
    topic: 'borrowing',
  },
  E0502: {
    title: 'A borrow overlaps a change',
    explanation: 'While a shared reference (&) to a value is still in use, the value cannot be changed through a mutable borrow. For example, holding &v[0] and then calling v.push(...) could leave that reference pointing at moved memory.',
    steps: [
      'Look for the "immutable borrow occurs here" and "later used here" labels.',
      'Use the shared reference before you change the value, or',
      'copy the element out instead of borrowing it: let first = v[0];',
      'then make the change.',
    ],
    topic: 'borrowing',
  },
  E0308: {
    title: 'The types do not match',
    explanation: 'Rust checks every value against the type it expects. rustc tells you what it expected and what it found.',
    steps: [
      'Read the "expected …, found …" note.',
      'Convert the value: "42".parse::<i32>(), number.to_string(), or x as f64.',
      'Or change the type annotation if the annotation is what is wrong.',
      'In a function, a trailing semicolon turns the last expression into (), which can also cause this.',
    ],
    topic: 'variables',
  },
  E0384: {
    title: 'An immutable variable was assigned twice',
    explanation: 'Variables are immutable by default in Rust. A let binding cannot be changed unless it is declared with mut.',
    steps: [
      'Add mut where the variable is created: let mut count = 0;',
      'Or create a new binding with let instead of changing the old one (shadowing).',
    ],
    topic: 'variables',
  },
}

function location(diagnostic: RustDiagnostic) {
  const span = primarySpan(diagnostic)
  return span ? `line ${span.line}` : null
}

export function errorCodeUrl(code: string) {
  return /^E\d{4}$/.test(code) ? `https://doc.rust-lang.org/error_codes/${code}.html` : null
}

/** Plain-language help for the first compile error, or null when there are no errors. */
export function coachCompileError(diagnostics: RustDiagnostic[]): RustCoaching | null {
  const first = diagnostics.find((diagnostic) => diagnostic.level === 'error')
  if (!first) return null
  const entry = first.code ? COACH[first.code] : undefined
  const span = primarySpan(first)
  if (entry) {
    return {
      ...entry,
      code: first.code,
      location: location(first),
      detail: span?.label ?? null,
      docsUrl: first.code ? errorCodeUrl(first.code) : null,
    }
  }
  return {
    title: first.message.charAt(0).toUpperCase() + first.message.slice(1),
    code: first.code,
    location: location(first),
    detail: span?.label ?? null,
    explanation: first.code
      ? 'rustc explains every numbered error in its error index. Read the first error before the others; later errors often follow from it.'
      : 'Fix the first error rustc reports and run again; later errors often disappear with it.',
    steps: [
      'Go to the marked line in the editor.',
      'Read rustc\'s labels under the code; "help:" lines often show the exact fix.',
    ],
    topic: null,
    docsUrl: first.code ? errorCodeUrl(first.code) : null,
  }
}

const PANIC_HINTS: Array<{ pattern: RegExp; title: string; steps: string[] }> = [
  {
    pattern: /index out of bounds/,
    title: 'An index was past the end of a list',
    steps: ['Check the length with .len() before indexing, or', 'use .get(i), which returns an Option instead of panicking.'],
  },
  {
    pattern: /called `Option::unwrap\(\)` on a `None` value/,
    title: 'unwrap() found None',
    steps: ['Handle the missing case with match or if let Some(value) = …', 'or give a default with .unwrap_or(…).'],
  },
  {
    pattern: /called `Result::unwrap\(\)` on an `Err` value/,
    title: 'unwrap() found an Err',
    steps: ['Handle the error with match, or', 'return it to the caller with ? from a function that returns Result.'],
  },
  {
    pattern: /attempt to (divide|calculate the remainder) .* zero/,
    title: 'Division by zero',
    steps: ['Check that the divisor is not 0 before dividing.'],
  },
  {
    pattern: /attempt to (add|subtract|multiply) with overflow/,
    title: 'A number overflowed its type',
    steps: ['Use a wider type such as i64 or u64, or', 'use checked_add / saturating_add to decide what happens at the limit.'],
  },
]

/** Help for a program that compiled but panicked while running. */
export function coachPanic(stderr: string): RustCoaching | null {
  const message = stderr.match(/panicked at [^\n]*\n([^\n]+)/)
  if (!/panicked at/.test(stderr)) return null
  const hint = PANIC_HINTS.find((candidate) => candidate.pattern.test(stderr))
  const where = stderr.match(/panicked at (?:\/?main\.rs|[^:\n]*):(\d+):\d+/)
  return {
    title: hint?.title ?? 'The program panicked',
    code: null,
    location: where ? `line ${where[1]}` : null,
    detail: message?.[1]?.trim() ?? null,
    explanation: 'The code compiled, but it stopped while running because something it assumed was not true. Rust stops instead of continuing with bad data.',
    steps: hint?.steps ?? ['Read the panic message and the line number above.', 'Handle the failing case with match, if let, or a Result.'],
    topic: 'results',
    docsUrl: null,
  }
}
