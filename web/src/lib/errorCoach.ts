import type { ProjectKind } from './projectTypes'
import type { RunnerOutcome } from './runnerOutcome'

export interface ErrorCoachAdvice {
  title: string
  explanation: string
  location: string | null
  steps: readonly string[]
  guideTopicId: string
}

export type ErrorCoachContext = {
  advice: ErrorCoachAdvice
  kind: ProjectKind
} | null

export interface ErrorSourceLocation {
  path: string
  line?: number
}

type ErrorRule = {
  pattern: RegExp
  title: string
  explanation: string
  steps: readonly string[]
  topic: string
}

const basicsTopic: Record<ProjectKind, string> = {
  ruby: 'ruby-output-comments',
  javascript: 'javascript-output-variables',
  python: 'python-output-comments',
  java: 'java-output-comments',
  web: 'web-dom-events',
}

const loopsTopic: Record<Exclude<ProjectKind, 'web'>, string> = {
  ruby: 'ruby-loops', javascript: 'javascript-loops', python: 'python-loops', java: 'java-loops',
}

const sharedRules: Partial<Record<ProjectKind, readonly ErrorRule[]>> = {
  java: [
    { pattern: /';' expected|expected ';'/i, title: 'Java is expecting a semicolon', explanation: 'A statement is not clearly finished, often on this line or the line just before it.', steps: ['Check the reported line and the previous line.', 'Add the missing `;` after the statement.', 'Run again to reveal any next compiler message.'], topic: 'java-output-comments' },
    { pattern: /cannot find symbol/i, title: 'Java cannot find that name', explanation: 'The compiler does not see a matching variable, method, or class in this scope.', steps: ['Compare spelling and capitalization with the declaration.', 'Make sure the name is declared before it is used.', 'Check that it is visible inside this method or class.'], topic: 'java-variables-types' },
    { pattern: /incompatible types|cannot be converted/i, title: 'These Java types do not match', explanation: 'A value is being assigned, passed, or returned where Java expects a different type.', steps: ['Read the “found” and “required” types in the terminal.', 'Check the variable or method declaration.', 'Convert the value only if that matches your intent.'], topic: 'java-variables-types' },
    { pattern: /NullPointerException/i, title: 'Java found null instead of an object', explanation: 'Code tried to use a method or field on a value that currently points to nothing.', steps: ['Find the first line in your file named by the stack trace.', 'Identify which value before the dot could be `null`.', 'Initialize it or handle the missing-value case.'], topic: 'java-classes-objects' },
    { pattern: /ArrayIndexOutOfBoundsException/i, title: 'The Java array index is outside the array', explanation: 'The requested position is smaller than zero or at least the array length.', steps: ['Inspect the index shown in the message.', 'Remember that the first item is index 0.', 'Keep loop conditions below `array.length`.'], topic: 'java-arrays-arraylist' },
    { pattern: /InputMismatchException/i, title: 'Scanner received a different kind of input', explanation: 'The entered value does not match the type requested by the Scanner method.', steps: ['Check whether the code expects text, an integer, or a decimal.', 'Enter a value in that format.', 'Use the matching Scanner method.'], topic: 'java-scanner-input' },
  ],
  python: [
    { pattern: /IndentationError|TabError/i, title: 'Python’s indentation does not line up', explanation: 'Python uses indentation to decide which statements belong together.', steps: ['Open the reported line and compare it with the block above.', 'Use consistent spaces for the whole block.', 'Indent code after a line ending in `:`.'], topic: 'python-conditionals' },
    { pattern: /NameError/i, title: 'Python does not know that name', explanation: 'A variable or function is being used before Python can find its definition.', steps: ['Check spelling and capitalization.', 'Define the name before this line runs.', 'Check whether it was created inside a different function.'], topic: 'python-variables-types' },
    { pattern: /TypeError/i, title: 'Python received an incompatible value', explanation: 'An operation or function received a type of value it cannot use this way.', steps: ['Read the last error line for the two types involved.', 'Inspect the values passed into that operation.', 'Convert a value only when that matches your goal.'], topic: 'python-variables-types' },
    { pattern: /IndexError/i, title: 'The Python list index is out of range', explanation: 'The requested position does not exist in the list.', steps: ['Check the list length and requested index.', 'Remember that the first item is index 0.', 'Keep loops within `range(len(items))` when indexes are needed.'], topic: 'python-lists-dictionaries' },
    { pattern: /SyntaxError/i, title: 'Python could not read this syntax', explanation: 'A punctuation mark, keyword, or expression is incomplete near the reported line.', steps: ['Check the reported line and the line above it.', 'Look for a missing colon, quote, or closing bracket.', 'Fix the first syntax error, then run again.'], topic: 'python-output-comments' },
  ],
  ruby: [
    { pattern: /undefined local variable or method|NameError/i, title: 'Ruby does not know that name', explanation: 'Ruby cannot find a matching local variable or method at this point.', steps: ['Check spelling and capitalization.', 'Define the variable before this line runs.', 'Confirm the name is available in this scope.'], topic: 'ruby-variables-types' },
    { pattern: /NoMethodError/i, title: 'That Ruby value does not have this method', explanation: 'The method name may be misspelled, or the value may be a different object than expected.', steps: ['Find the value immediately before the dot.', 'Print or inspect that value and its class.', 'Check the method name in the guide or declaration.'], topic: 'ruby-methods' },
    { pattern: /syntax error|SyntaxError/i, title: 'Ruby could not read this syntax', explanation: 'A keyword, delimiter, or expression is incomplete near the reported line.', steps: ['Check the reported line and the line above it.', 'Look for a missing `end`, quote, bracket, or comma.', 'Fix the first syntax error, then run again.'], topic: 'ruby-output-comments' },
  ],
  javascript: [
    { pattern: /ReferenceError/i, title: 'JavaScript cannot find that name', explanation: 'A variable or function is being used before it is available.', steps: ['Check spelling and capitalization.', 'Declare the name before this line runs.', 'Check whether it only exists inside another block or function.'], topic: 'javascript-output-variables' },
    { pattern: /TypeError/i, title: 'JavaScript cannot use that value this way', explanation: 'A method, property, or operation does not fit the value it received.', steps: ['Find the first line from your file in the error.', 'Inspect the value immediately before the dot or operation.', 'Handle missing values before using them.'], topic: 'javascript-errors' },
    { pattern: /SyntaxError/i, title: 'JavaScript could not read this syntax', explanation: 'A bracket, quote, comma, or expression is incomplete near the error.', steps: ['Check the reported line and the line above it.', 'Match every opening bracket or quote with a closing one.', 'Fix the first syntax error, then run again.'], topic: 'javascript-output-variables' },
  ],
  web: [
    { pattern: /Failed to load/i, title: 'The page could not load a file', explanation: 'A script, stylesheet, image, or other resource points to a path the preview cannot resolve.', steps: ['Compare the path with the file name in the project.', 'Check spelling, capitalization, and relative folders.', 'Refresh the preview after correcting the reference.'], topic: 'web-links-images' },
    { pattern: /ReferenceError/i, title: 'The page script cannot find that name', explanation: 'JavaScript in the preview is using a variable or function that is not available.', steps: ['Check spelling and capitalization.', 'Declare it before the code that uses it.', 'Refresh the preview to run the updated script.'], topic: 'web-dom-events' },
    { pattern: /TypeError|SyntaxError/i, title: 'The page script stopped on an error', explanation: 'The browser could not understand the script or use one of its values.', steps: ['Read the first error in the console.', 'Check the matching script line for syntax or a missing element.', 'Fix that first error, then refresh the preview.'], topic: 'web-dom-events' },
  ],
}

export function errorCoachGuideTopicIds(kind: ProjectKind) {
  const topics = [
    basicsTopic[kind],
    ...(kind === 'web' ? [] : [loopsTopic[kind]]),
    ...(sharedRules[kind] ?? []).map((rule) => rule.topic),
  ]
  return [...new Set(topics)]
}

function errorLocation(message: string, entryPath: string) {
  const candidates = [
    /File ["']([^"']+)["'], line (\d+)/,
    /([^\s():]+\.(?:java|rb|js|py|html)):(\d+)(?::\d+)?/,
    /\(([^\s():]+\.(?:java|rb|js|py|html)):(\d+)(?::\d+)?\)/,
  ]
  for (const pattern of candidates) {
    const match = pattern.exec(message)
    if (match) return `${match[1]} · line ${match[2]}`
  }
  return entryPath || null
}

export function coachRunnerError(kind: ProjectKind, entryPath: string, outcome: RunnerOutcome, source?: ErrorSourceLocation): ErrorCoachAdvice | null {
  if (outcome.status !== 'error' && outcome.status !== 'timeout') return null
  if (outcome.status === 'timeout') {
    const topic = kind === 'web' ? 'web-dom-events' : loopsTopic[kind]
    return { title: 'The program kept running too long', explanation: 'This often means a loop never reaches its stopping condition, or the browser runtime could not finish loading.', location: entryPath || null, steps: ['Check loop conditions and whether their values change.', 'Temporarily add output inside the loop to follow its progress.', 'If the runtime was still loading, check the connection and try once more.'], guideTopicId: topic }
  }

  const message = outcome.stderr.trim()
  if (!message) return null
  const rule = sharedRules[kind]?.find((candidate) => candidate.pattern.test(message))
  return {
    title: rule?.title ?? `Let’s decode this ${kind === 'web' ? 'browser' : kind} error`,
    explanation: rule?.explanation ?? 'Start with the first error and the first line that points into your own file; later messages are often side effects.',
    location: source ? `${source.path}${source.line ? ` · line ${source.line}` : ''}` : errorLocation(message, entryPath),
    steps: rule?.steps ?? ['Read the final error line for the immediate cause.', 'Open the first referenced line in your file.', 'Make one focused change, then run again.'],
    guideTopicId: rule?.topic ?? basicsTopic[kind],
  }
}
