import type { ProjectFile, ProjectKind } from './projectTypes'
import type { RunnerOutcome } from './runnerOutcome'

export type PracticeDifficulty = 'Starter' | 'Builder' | 'Stretch'

export interface PracticeFileCheck {
  filePath: string
  label: string
  pattern: RegExp
}

export interface PracticeChallenge {
  id: string
  kind: ProjectKind
  title: string
  summary: string
  difficulty: PracticeDifficulty
  concepts: string[]
  instructions: string[]
  hints: string[]
  project: {
    title: string
    entryPath: string
    files: ProjectFile[]
  }
  checks: PracticeFileCheck[]
  expectedOutput?: string
}

export interface PracticeCheckResult {
  passed: boolean
  checks: Array<{ label: string; passed: boolean }>
  expectedOutput?: string
  actualOutput?: string
}

const runtimeChallenges: PracticeChallenge[] = [
  {
    id: 'ruby-variables-greeting', kind: 'ruby', title: 'Build a greeting', difficulty: 'Starter',
    summary: 'Use variables and string interpolation to introduce a learner.',
    concepts: ['variables', 'strings'],
    instructions: ['Set `name` to "Lina".', 'Set `lessons` to 4.', 'Print the two requested lines using those variables.'],
    hints: ['Ruby assigns a variable with `name = value`.', 'Put `#{name}` inside a double-quoted string.'],
    project: { title: 'Practice · Ruby Greeting', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'name = "friend"\nlessons = 0\n\nputs "Hafa adai, #{name}!"\nputs "Lessons: #{lessons}"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Set the name variable to Lina', pattern: /\bname\s*=\s*["']Lina["']/ },
      { filePath: 'main.rb', label: 'Set the lessons variable to 4', pattern: /\blessons\s*=\s*4\b/ },
    ],
    expectedOutput: 'Hafa adai, Lina!\nLessons: 4',
  },
  {
    id: 'ruby-loop-stops', kind: 'ruby', title: 'Count the stops', difficulty: 'Builder',
    summary: 'Repeat an action with a loop instead of writing the same line three times.',
    concepts: ['loops', 'ranges'],
    instructions: ['Loop from 1 through 3.', 'Print `Stop 1`, `Stop 2`, and `Stop 3` on separate lines.'],
    hints: ['An inclusive Ruby range looks like `1..3`.', 'Call `.each do |stop|` on the range.'],
    project: { title: 'Practice · Ruby Loop', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: '# Replace the repeated line with a loop.\nputs "Stop 1"\n' }] },
    checks: [{ filePath: 'main.rb', label: 'Use a loop', pattern: /\b(?:each|times|for)\b/ }],
    expectedOutput: 'Stop 1\nStop 2\nStop 3',
  },
  {
    id: 'ruby-method-condition', kind: 'ruby', title: 'Make a launch check', difficulty: 'Stretch',
    summary: 'Combine a method and a conditional to make a reusable decision.',
    concepts: ['methods', 'conditionals', 'booleans'],
    instructions: ['Create a method named `launch_status` that accepts `tests_passing`.', 'Return "Ready to ship" when it is true and "Keep working" otherwise.', 'Print the result for `true`.'],
    hints: ['Define it with `def launch_status(tests_passing)`.', 'Use an `if` / `else` expression inside the method.'],
    project: { title: 'Practice · Ruby Launch Check', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'tests_passing = true\n\n# Define launch_status here.\n\nputs "Keep working"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Define launch_status', pattern: /\bdef\s+launch_status\s*\(/ },
      { filePath: 'main.rb', label: 'Use a conditional', pattern: /\bif\b[\s\S]*\belse\b/ },
    ],
    expectedOutput: 'Ready to ship',
  },
  {
    id: 'javascript-variables-greeting', kind: 'javascript', title: 'Build a greeting', difficulty: 'Starter',
    summary: 'Store values in constants and combine them in a template string.',
    concepts: ['variables', 'template strings'],
    instructions: ['Set `name` to "Lina".', 'Set `lessons` to 4.', 'Log the two requested lines using those constants.'],
    hints: ['Declare an unchanged value with `const`.', 'Use backticks and `${name}` for interpolation.'],
    project: { title: 'Practice · JavaScript Greeting', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const name = "friend"\nconst lessons = 0\n\nconsole.log(`Hafa adai, ${name}!`)\nconsole.log(`Lessons: ${lessons}`)\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Set the name constant to Lina', pattern: /\b(?:const|let)\s+name\s*=\s*["']Lina["']/ },
      { filePath: 'main.js', label: 'Set the lessons constant to 4', pattern: /\b(?:const|let)\s+lessons\s*=\s*4\b/ },
    ],
    expectedOutput: 'Hafa adai, Lina!\nLessons: 4',
  },
  {
    id: 'javascript-loop-stops', kind: 'javascript', title: 'Count the stops', difficulty: 'Builder',
    summary: 'Use a loop to generate a short sequence of messages.',
    concepts: ['loops', 'template strings'],
    instructions: ['Loop from 1 through 3.', 'Log `Stop 1`, `Stop 2`, and `Stop 3` on separate lines.'],
    hints: ['Start with `for (let stop = 1; ... )`.', 'Continue while `stop <= 3`, then increment `stop`.'],
    project: { title: 'Practice · JavaScript Loop', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: '// Replace the repeated line with a loop.\nconsole.log("Stop 1")\n' }] },
    checks: [{ filePath: 'main.js', label: 'Use a loop', pattern: /\b(?:for|while)\s*\(/ }],
    expectedOutput: 'Stop 1\nStop 2\nStop 3',
  },
  {
    id: 'javascript-function-condition', kind: 'javascript', title: 'Make a launch check', difficulty: 'Stretch',
    summary: 'Build a function that returns a message based on a condition.',
    concepts: ['functions', 'conditionals', 'booleans'],
    instructions: ['Create `launchStatus(testsPassing)`.', 'Return "Ready to ship" when true and "Keep working" otherwise.', 'Log the result for `true`.'],
    hints: ['Start with `function launchStatus(testsPassing) {`.', 'Use `if` and `else`, then call the function inside `console.log`.'],
    project: { title: 'Practice · JavaScript Launch Check', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const testsPassing = true\n\n// Define launchStatus here.\n\nconsole.log("Keep working")\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Define launchStatus', pattern: /\bfunction\s+launchStatus\s*\(/ },
      { filePath: 'main.js', label: 'Use a conditional', pattern: /\bif\s*\([\s\S]*\belse\b/ },
    ],
    expectedOutput: 'Ready to ship',
  },
  {
    id: 'python-variables-greeting', kind: 'python', title: 'Build a greeting', difficulty: 'Starter',
    summary: 'Use variables and an f-string to introduce a learner.',
    concepts: ['variables', 'f-strings'],
    instructions: ['Set `name` to "Lina".', 'Set `lessons` to 4.', 'Print the two requested lines using those variables.'],
    hints: ['Python assigns with `name = value`.', 'Prefix a string with `f` and place a variable inside `{}`.'],
    project: { title: 'Practice · Python Greeting', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'name = "friend"\nlessons = 0\n\nprint(f"Hafa adai, {name}!")\nprint(f"Lessons: {lessons}")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Set the name variable to Lina', pattern: /\bname\s*=\s*["']Lina["']/ },
      { filePath: 'main.py', label: 'Set the lessons variable to 4', pattern: /\blessons\s*=\s*4\b/ },
    ],
    expectedOutput: 'Hafa adai, Lina!\nLessons: 4',
  },
  {
    id: 'python-loop-stops', kind: 'python', title: 'Count the stops', difficulty: 'Builder',
    summary: 'Use `range` and a loop to generate three messages.',
    concepts: ['loops', 'ranges'],
    instructions: ['Loop from 1 through 3.', 'Print `Stop 1`, `Stop 2`, and `Stop 3` on separate lines.'],
    hints: ['`range(1, 4)` produces 1, 2, and 3.', 'Begin the loop with `for stop in ...:` and indent its body.'],
    project: { title: 'Practice · Python Loop', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: '# Replace the repeated line with a loop.\nprint("Stop 1")\n' }] },
    checks: [{ filePath: 'main.py', label: 'Use a loop with range', pattern: /\bfor\s+\w+\s+in\s+range\s*\(/ }],
    expectedOutput: 'Stop 1\nStop 2\nStop 3',
  },
  {
    id: 'python-function-condition', kind: 'python', title: 'Make a launch check', difficulty: 'Stretch',
    summary: 'Write a function whose answer changes with a boolean.',
    concepts: ['functions', 'conditionals', 'booleans'],
    instructions: ['Create `launch_status(tests_passing)`.', 'Return "Ready to ship" when true and "Keep working" otherwise.', 'Print the result for `True`.'],
    hints: ['Start with `def launch_status(tests_passing):`.', 'Use an indented `if` / `else`, then call the function.'],
    project: { title: 'Practice · Python Launch Check', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'tests_passing = True\n\n# Define launch_status here.\n\nprint("Keep working")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Define launch_status', pattern: /\bdef\s+launch_status\s*\(/ },
      { filePath: 'main.py', label: 'Use a conditional', pattern: /\bif\b[\s\S]*\belse\s*:/ },
    ],
    expectedOutput: 'Ready to ship',
  },
  {
    id: 'java-variables-greeting', kind: 'java', title: 'Build a greeting', difficulty: 'Starter',
    summary: 'Declare typed variables and combine them in printed output.',
    concepts: ['variables', 'types', 'strings'],
    instructions: ['Set `name` to "Lina".', 'Set `lessons` to 4.', 'Print the two requested lines using those variables.'],
    hints: ['Declare text with `String name = ...;`.', 'Declare a whole number with `int lessons = ...;`.'],
    project: { title: 'Practice · Java Greeting', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    String name = "friend";\n    int lessons = 0;\n\n    System.out.println("Hafa adai, " + name + "!");\n    System.out.println("Lessons: " + lessons);\n  }\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Set the name variable to Lina', pattern: /\bString\s+name\s*=\s*"Lina"\s*;/ },
      { filePath: 'Main.java', label: 'Set the lessons variable to 4', pattern: /\bint\s+lessons\s*=\s*4\s*;/ },
    ],
    expectedOutput: 'Hafa adai, Lina!\nLessons: 4',
  },
  {
    id: 'java-loop-stops', kind: 'java', title: 'Count the stops', difficulty: 'Builder',
    summary: 'Use a `for` loop to generate three numbered messages.',
    concepts: ['loops', 'integers'],
    instructions: ['Loop from 1 through 3.', 'Print `Stop 1`, `Stop 2`, and `Stop 3` on separate lines.'],
    hints: ['Start with `for (int stop = 1; ... )`.', 'Continue while `stop <= 3`, then use `stop++`.'],
    project: { title: 'Practice · Java Loop', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    // Replace the repeated line with a loop.\n    System.out.println("Stop 1");\n  }\n}\n' }] },
    checks: [{ filePath: 'Main.java', label: 'Use a for loop', pattern: /\bfor\s*\(/ }],
    expectedOutput: 'Stop 1\nStop 2\nStop 3',
  },
  {
    id: 'java-method-condition', kind: 'java', title: 'Make a launch check', difficulty: 'Stretch',
    summary: 'Create a typed method that chooses a result with a conditional.',
    concepts: ['methods', 'conditionals', 'booleans'],
    instructions: ['Create `static String launchStatus(boolean testsPassing)`.', 'Return "Ready to ship" when true and "Keep working" otherwise.', 'Print the result for `true`.'],
    hints: ['Place the method inside `Main`, but outside `main`.', 'Use `if (testsPassing)` and an `else` branch.'],
    project: { title: 'Practice · Java Launch Check', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    boolean testsPassing = true;\n    System.out.println("Keep working");\n  }\n\n  // Define launchStatus here.\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Define launchStatus', pattern: /\bstatic\s+String\s+launchStatus\s*\(\s*boolean\s+testsPassing\s*\)/ },
      { filePath: 'Main.java', label: 'Use a conditional', pattern: /\bif\s*\([\s\S]*\belse\b/ },
    ],
    expectedOutput: 'Ready to ship',
  },
]

const webChallenges: PracticeChallenge[] = [
  {
    id: 'web-semantic-profile', kind: 'web', title: 'Build a profile card', difficulty: 'Starter',
    summary: 'Use semantic HTML to structure a small, accessible profile.',
    concepts: ['semantic HTML', 'accessibility'],
    instructions: ['Add one `<main>` element.', 'Inside it, add an `<h1>` containing “Lina”.', 'Add a link whose visible text is “View work”.'],
    hints: ['`<main>` wraps the page’s primary content.', 'A link looks like `<a href="...">View work</a>`.'],
    project: { title: 'Practice · Web Profile Card', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>Lina’s profile</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <!-- Build the profile card here. -->\n  </body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: 'body {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  font-family: system-ui, sans-serif;\n  background: #f7f0e5;\n}\n\nmain {\n  max-width: 24rem;\n  padding: 2rem;\n  border: 2px solid #14110f;\n}\n' },
    ] },
    checks: [
      { filePath: 'index.html', label: 'Use a main element', pattern: /<main(?:\s|>)/i },
      { filePath: 'index.html', label: 'Add Lina as the main heading', pattern: /<h1(?:\s[^>]*)?>[^<]*Lina[^<]*<\/h1>/i },
      { filePath: 'index.html', label: 'Add the View work link', pattern: /<a(?:\s[^>]*)?>[^<]*View work[^<]*<\/a>/i },
    ],
  },
  {
    id: 'web-responsive-grid', kind: 'web', title: 'Make a responsive grid', difficulty: 'Builder',
    summary: 'Create a card layout that adapts without fixed device widths.',
    concepts: ['CSS Grid', 'responsive design'],
    instructions: ['Make `.project-grid` a CSS grid.', 'Use `repeat(auto-fit, minmax(...))` for flexible columns.', 'Set a gap between cards.'],
    hints: ['Start with `.project-grid { display: grid; }`.', 'Try `grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));`.'],
    project: { title: 'Practice · Responsive Grid', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="style.css" /><title>Projects</title></head>\n<body><main><h1>Projects</h1><section class="project-grid"><article>Weather app</article><article>Study timer</article><article>Portfolio</article></section></main></body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: 'body { margin: 0; padding: 2rem; font-family: system-ui, sans-serif; }\n\n.project-grid {\n  /* Make this layout responsive. */\n}\n\narticle { padding: 1.25rem; border: 2px solid #14110f; }\n' },
    ] },
    checks: [
      { filePath: 'style.css', label: 'Use CSS Grid', pattern: /\.project-grid\s*\{[\s\S]*display\s*:\s*grid\s*;/i },
      { filePath: 'style.css', label: 'Create flexible columns', pattern: /grid-template-columns\s*:\s*repeat\s*\(\s*auto-fit\s*,\s*minmax\s*\(/i },
      { filePath: 'style.css', label: 'Add space between cards', pattern: /\bgap\s*:\s*(?!0(?:[;\s]|$))[^;]+;/i },
    ],
  },
  {
    id: 'web-click-counter', kind: 'web', title: 'Wire up a counter', difficulty: 'Stretch',
    summary: 'Connect a button to page state with a JavaScript event listener.',
    concepts: ['DOM', 'events', 'state'],
    instructions: ['Listen for clicks on `#count-button`.', 'Increase the `count` variable on each click.', 'Write the new count into `#count-output`.'],
    hints: ['Find elements with `document.querySelector(...)`.', 'Use `.addEventListener("click", () => { ... })`.'],
    project: { title: 'Practice · Web Click Counter', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Counter</title></head>\n<body><main><h1>Counter</h1><p id="count-output">0</p><button id="count-button">Add one</button></main><script src="script.js"></script></body>\n</html>\n' },
      { path: 'script.js', language: 'javascript', content: 'let count = 0\nconst button = document.querySelector("#count-button")\nconst output = document.querySelector("#count-output")\n\n// Add the click behavior here.\n' },
    ] },
    checks: [
      { filePath: 'script.js', label: 'Listen for button clicks', pattern: /\bbutton\s*\.\s*addEventListener\s*\(\s*["']click["']/ },
      { filePath: 'script.js', label: 'Increase the count', pattern: /(?:\+\+count|count\+\+|count\s*\+=\s*1|count\s*=\s*count\s*\+\s*1)/ },
      { filePath: 'script.js', label: 'Update the output element', pattern: /\boutput\s*\.\s*(?:textContent|innerText)\s*=\s*count\b/ },
    ],
  },
]

export const PRACTICE_CHALLENGES = Object.freeze([...runtimeChallenges, ...webChallenges])

/** Returns the ordered Starter, Builder, and Stretch challenges for one project kind. */
export function practiceChallengesFor(kind: ProjectKind) {
  return PRACTICE_CHALLENGES.filter((challenge) => challenge.kind === kind)
}

/** Resolves a persisted challenge id without trusting stale local data. */
export function practiceChallengeById(id: string | null | undefined) {
  return id ? PRACTICE_CHALLENGES.find((challenge) => challenge.id === id) ?? null : null
}

function normalizeOutput(output: string) {
  return output.replace(/\r\n/g, '\n').split('\n').map((line) => line.trimEnd()).join('\n').trim()
}

/** Checks source requirements first, then runtime output when the challenge has an executable result. */
export function evaluatePracticeChallenge(challenge: PracticeChallenge, files: ProjectFile[], outcome?: RunnerOutcome): PracticeCheckResult {
  const checks = challenge.checks.map((check) => {
    const file = files.find((candidate) => candidate.path === check.filePath)
    return { label: check.label, passed: Boolean(file && check.pattern.test(file.content)) }
  })

  if (challenge.expectedOutput !== undefined) {
    const actualOutput = outcome?.stdout ?? ''
    checks.push({
      label: `Output matches “${challenge.expectedOutput.replace(/\n/g, ' / ')}”`,
      passed: outcome?.status === 'success' && normalizeOutput(actualOutput) === normalizeOutput(challenge.expectedOutput),
    })
    return {
      passed: checks.every((check) => check.passed),
      checks,
      expectedOutput: challenge.expectedOutput,
      actualOutput: outcome ? actualOutput : undefined,
    }
  }

  return { passed: checks.every((check) => check.passed), checks }
}
