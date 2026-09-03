import type { PracticeChallenge } from '../practiceLab'

function isObviouslyHidden(element: Element) {
  let current: Element | null = element
  while (current) {
    const inlineStyle = (current as HTMLElement).style
    if (
      current.hasAttribute('hidden')
      || current.getAttribute('aria-hidden')?.toLowerCase() === 'true'
      || inlineStyle?.display.toLowerCase() === 'none'
      || inlineStyle?.visibility.toLowerCase() === 'hidden'
    ) return true
    current = current.parentElement
  }
  return false
}

function visibleTextContent(element: Element): string {
  return Array.from(element.childNodes).map((node) => {
    if (node.nodeType === 3) return node.textContent ?? ''
    if (node.nodeType !== 1) return ''
    const child = node as Element
    if (isObviouslyHidden(child) || /^(SCRIPT|STYLE|TEMPLATE)$/.test(child.tagName)) return ''
    return visibleTextContent(child)
  }).join('')
}

function closingBraceIndex(source: string, openingBrace: number) {
  let depth = 1
  let quote: string | null = null
  let escaped = false
  for (let index = openingBrace + 1; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    if (depth === 0) return index
  }
  return -1
}

function extractBracedBody(source: string, openingBrace: number) {
  const closingBrace = closingBraceIndex(source, openingBrace)
  return closingBrace === -1 ? '' : source.slice(openingBrace + 1, closingBrace)
}

const MIN_WIDTH_MEDIA_START = /@media\b[^{}]*\(\s*min-width\s*:\s*(?:\d*\.)?\d+(?:px|rem|em)\s*\)[^{}]*\{/gi

function minWidthMediaBodies(source: string) {
  const mediaStart = new RegExp(MIN_WIDTH_MEDIA_START)
  return Array.from(source.matchAll(mediaStart), (match) => (
    extractBracedBody(source, match.index + match[0].lastIndexOf('{'))
  )).join('\n')
}

function withoutMinWidthMediaBlocks(source: string) {
  const mediaStart = new RegExp(MIN_WIDTH_MEDIA_START)
  const ranges = Array.from(source.matchAll(mediaStart), (match) => {
    const openingBrace = match.index + match[0].lastIndexOf('{')
    return { start: match.index, end: closingBraceIndex(source, openingBrace) }
  }).filter((range) => range.end !== -1)

  return ranges.reverse().reduce((result, range) => (
    result.slice(0, range.start) + result.slice(range.end + 1)
  ), source)
}

function withoutFormatNameDeclaration(source: string) {
  return source
    .replace(/^\s*def\s+format_name\s*\(\s*name\s*\)\s*:?.*$/gm, '')
    .replace(/\bfunction\s+formatName\s*\(\s*name\s*\)/g, '')
    .replace(/\bstatic\s+String\s+formatName\s*\(\s*String\s+name\s*\)/g, '')
}

/** Additional intermediate exercises. The original loop/grid challenge remains first for every language. */
export const ADDITIONAL_BUILDER_CHALLENGES: PracticeChallenge[] = [
  {
    id: 'ruby-filter-scores', kind: 'ruby', title: 'Filter passing scores', difficulty: 'Builder',
    summary: 'Select values from an array that meet a condition.',
    concepts: ['arrays', 'filtering', 'blocks'],
    instructions: ['Create `scores` with 88, 72, 95, and 61.', 'Use `select` to keep scores that are at least 80.', 'Print `Passing: 88, 95` from the filtered array.'],
    hints: ['Call `scores.select` with a block.', 'Join the selected values with `passing.join(", ")`.'],
    project: { title: 'Practice · Ruby Score Filter', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'scores = [88, 72, 95, 61]\npassing = []\n\nputs "Passing: #{passing.join(", ")}"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Filter the scores with select', pattern: /\bscores\.select\b[\s\S]*(?:>=\s*80|80\s*<=)/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Build the output from passing', pattern: /\bpassing\.join\s*\(/ },
    ],
    expectedOutput: 'Passing: 88, 95',
  },
  {
    id: 'ruby-count-priorities', kind: 'ruby', title: 'Count priority requests', difficulty: 'Builder',
    summary: 'Use a loop and a conditional to count matching values.',
    concepts: ['arrays', 'loops', 'conditionals'],
    instructions: ['Keep the four values in `priorities`.', 'Loop over the array and increase `high_count` only for "high".', 'Print `High priority: 2`.'],
    hints: ['Start with `priorities.each do |priority|`.', 'Inside the block, compare `priority == "high"`.'],
    project: { title: 'Practice · Ruby Priority Count', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\n\n# Count the high-priority requests.\n\nputs "High priority: #{high_count}"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Loop over priorities', pattern: /\bpriorities\.each\b/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Count only high priorities', pattern: /\bpriority\s*==\s*["']high["'][\s\S]*\bhigh_count\s*\+=\s*1/, ignoreStrings: false },
    ],
    expectedOutput: 'High priority: 2',
  },
  {
    id: 'ruby-hash-district', kind: 'ruby', title: 'Look up a district', difficulty: 'Builder',
    summary: 'Use a hash to retrieve a value by its key.',
    concepts: ['hashes', 'keys', 'lookups'],
    instructions: ['Create a `districts` hash mapping "H", "T", and "D" to the supplied village names.', 'Read the value for the "T" key from the hash.', 'Print `District T: Tamuning`.'],
    hints: ['A string-keyed hash can start with `{ "H" => "Hagåtña" }`.', 'Read a value with `districts["T"]`.'],
    project: { title: 'Practice · Ruby District Lookup', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'districts = {}\n\nputs "District T: unknown"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Create the district hash', pattern: /\bdistricts\s*=\s*\{/ },
      { filePath: 'main.rb', label: 'Map H to Hagåtña', pattern: /["']H["']\s*=>\s*["']Hagåtña["']/ },
      { filePath: 'main.rb', label: 'Map T to Tamuning', pattern: /["']T["']\s*=>\s*["']Tamuning["']/ },
      { filePath: 'main.rb', label: 'Map D to Dededo', pattern: /["']D["']\s*=>\s*["']Dededo["']/ },
      { filePath: 'main.rb', label: 'Look up district T', pattern: /\bdistricts\s*\[\s*["']T["']\s*\]/ },
    ],
    expectedOutput: 'District T: Tamuning',
  },
  {
    id: 'ruby-format-roster', kind: 'ruby', title: 'Format a roster', difficulty: 'Builder',
    summary: 'Transform names through a reusable method.',
    concepts: ['methods', 'arrays', 'string methods'],
    instructions: ['Define `format_name(name)` and have it return the uppercase name.', 'Use the method for "Ana" and "Ben".', 'Print `Roster: ANA, BEN`.'],
    hints: ['Ruby uppercases text with `.upcase`.', 'Call `format_name` for each name before joining or interpolating them.'],
    project: { title: 'Practice · Ruby Roster Formatter', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'names = ["Ana", "Ben"]\n\n# Define format_name(name) here.\n\nputs "Roster: #{names.join(", ")}"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Define format_name with a parameter', pattern: /\bdef\s+format_name\s*\(\s*name\s*\)/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Uppercase the supplied name', pattern: /\bname\.upcase\b/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Call format_name for the roster', pattern: /\bformat_name\s*\(/, scope: withoutFormatNameDeclaration, ignoreStrings: true },
    ],
    expectedOutput: 'Roster: ANA, BEN',
  },
  {
    id: 'javascript-filter-scores', kind: 'javascript', title: 'Filter passing scores', difficulty: 'Builder',
    summary: 'Create a new array containing only values that meet a condition.',
    concepts: ['arrays', 'filter', 'arrow functions'],
    instructions: ['Create `scores` with 88, 72, 95, and 61.', 'Use `.filter` to keep scores that are at least 80.', 'Log `Passing: 88, 95` from the filtered array.'],
    hints: ['Try `scores.filter((score) => score >= 80)`.', 'Join the filtered values with `passing.join(", ")`.'],
    project: { title: 'Practice · JavaScript Score Filter', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const scores = [88, 72, 95, 61]\nconst passing = []\n\nconsole.log(`Passing: ${passing.join(", ")}`)\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Filter the scores', pattern: /\bscores\.filter\s*\([\s\S]*(?:>=\s*80|80\s*<=)/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Build the output from passing', pattern: /\bpassing\.join\s*\(/ },
    ],
    expectedOutput: 'Passing: 88, 95',
  },
  {
    id: 'javascript-count-priorities', kind: 'javascript', title: 'Count priority requests', difficulty: 'Builder',
    summary: 'Combine a loop with a conditional counter.',
    concepts: ['arrays', 'loops', 'conditionals'],
    instructions: ['Keep the four values in `priorities`.', 'Loop over the array and increase `highCount` only for "high".', 'Log `High priority: 2`.'],
    hints: ['A `for...of` loop can read each priority.', 'Inside the loop, compare `priority === "high"`.'],
    project: { title: 'Practice · JavaScript Priority Count', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const priorities = ["high", "low", "high", "medium"]\nlet highCount = 0\n\n// Count the high-priority requests.\n\nconsole.log(`High priority: ${highCount}`)\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Loop over priorities', pattern: /\bfor\s*\([^)]*\bof\s+priorities\s*\)/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Count only high priorities', pattern: /\bpriority\s*===\s*["']high["'][\s\S]*\b(?:highCount\+\+|\+\+highCount|highCount\s*\+=\s*1)/ },
    ],
    expectedOutput: 'High priority: 2',
  },
  {
    id: 'javascript-object-district', kind: 'javascript', title: 'Look up a district', difficulty: 'Builder',
    summary: 'Use an object to retrieve a value by its key.',
    concepts: ['objects', 'properties', 'lookups'],
    instructions: ['Create `districts` with H, T, and D mapped to the supplied village names.', 'Read the T value from the object.', 'Log `District T: Tamuning`.'],
    hints: ['Start with `const districts = { H: "Hagåtña", ... }`.', 'Read the value with `districts.T` or `districts["T"]`.'],
    project: { title: 'Practice · JavaScript District Lookup', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const districts = {}\n\nconsole.log("District T: unknown")\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Create the district object', pattern: /\bdistricts\s*=\s*\{/ },
      { filePath: 'main.js', label: 'Map H to Hagåtña', pattern: /(?:\bH|["']H["'])\s*:\s*["']Hagåtña["']/ },
      { filePath: 'main.js', label: 'Map T to Tamuning', pattern: /(?:\bT|["']T["'])\s*:\s*["']Tamuning["']/ },
      { filePath: 'main.js', label: 'Map D to Dededo', pattern: /(?:\bD|["']D["'])\s*:\s*["']Dededo["']/ },
      { filePath: 'main.js', label: 'Look up district T', pattern: /\bdistricts\s*(?:\.T\b|\[\s*["']T["']\s*\])/ },
    ],
    expectedOutput: 'District T: Tamuning',
  },
  {
    id: 'javascript-format-roster', kind: 'javascript', title: 'Format a roster', difficulty: 'Builder',
    summary: 'Transform names through a reusable function.',
    concepts: ['functions', 'arrays', 'string methods'],
    instructions: ['Define `formatName(name)` and return the uppercase name.', 'Use the function for "Ana" and "Ben".', 'Log `Roster: ANA, BEN`.'],
    hints: ['JavaScript uppercases text with `.toUpperCase()`.', 'Use `.map(formatName)` or call the function for both names.'],
    project: { title: 'Practice · JavaScript Roster Formatter', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const names = ["Ana", "Ben"]\n\n// Define formatName(name) here.\n\nconsole.log(`Roster: ${names.join(", ")}`)\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Define formatName with a parameter', pattern: /\bfunction\s+formatName\s*\(\s*name\s*\)/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Uppercase the supplied name', pattern: /\bname\.toUpperCase\s*\(\s*\)/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Call formatName for the roster', pattern: /\b(?:map\s*\(\s*formatName\s*\)|formatName\s*\()/, scope: withoutFormatNameDeclaration, ignoreStrings: true },
    ],
    expectedOutput: 'Roster: ANA, BEN',
  },
  {
    id: 'python-filter-scores', kind: 'python', title: 'Filter passing scores', difficulty: 'Builder',
    summary: 'Build a new list containing values that meet a condition.',
    concepts: ['lists', 'list comprehensions', 'filtering'],
    instructions: ['Create `scores` with 88, 72, 95, and 61.', 'Use a list comprehension to keep scores that are at least 80.', 'Print `Passing: 88, 95` from the filtered list.'],
    hints: ['Try `[score for score in scores if score >= 80]`.', 'Convert each number with `str` before using `join`.'],
    project: { title: 'Practice · Python Score Filter', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'scores = [88, 72, 95, 61]\npassing = []\n\nprint(f"Passing: {\', \'.join(str(score) for score in passing)}")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Filter with a list comprehension', pattern: /\[[^\]]*\bfor\s+score\s+in\s+scores\s+if\s+(?:score\s*>=\s*80|80\s*<=\s*score)[^\]]*\]/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Build the output from passing', pattern: /\bfor\s+score\s+in\s+passing\b/ },
    ],
    expectedOutput: 'Passing: 88, 95',
  },
  {
    id: 'python-count-priorities', kind: 'python', title: 'Count priority requests', difficulty: 'Builder',
    summary: 'Combine a loop with a conditional counter.',
    concepts: ['lists', 'loops', 'conditionals'],
    instructions: ['Keep the four values in `priorities`.', 'Loop over the list and increase `high_count` only for "high".', 'Print `High priority: 2`.'],
    hints: ['Start with `for priority in priorities:`.', 'Inside the loop, compare `priority == "high"`.'],
    project: { title: 'Practice · Python Priority Count', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\n\n# Count the high-priority requests.\n\nprint(f"High priority: {high_count}")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Loop over priorities', pattern: /\bfor\s+priority\s+in\s+priorities\s*:/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Count only high priorities', pattern: /\bif\s+priority\s*==\s*["']high["']\s*:[\s\S]*\bhigh_count\s*\+=\s*1/ },
    ],
    expectedOutput: 'High priority: 2',
  },
  {
    id: 'python-dict-district', kind: 'python', title: 'Look up a district', difficulty: 'Builder',
    summary: 'Use a dictionary to retrieve a value by its key.',
    concepts: ['dictionaries', 'keys', 'lookups'],
    instructions: ['Create `districts` mapping "H", "T", and "D" to the supplied village names.', 'Read the value for the "T" key.', 'Print `District T: Tamuning`.'],
    hints: ['A dictionary starts with `{ "H": "Hagåtña" }`.', 'Read the value with `districts["T"]`.'],
    project: { title: 'Practice · Python District Lookup', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'districts = {}\n\nprint("District T: unknown")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Create the district dictionary', pattern: /\bdistricts\s*=\s*\{/ },
      { filePath: 'main.py', label: 'Map H to Hagåtña', pattern: /["']H["']\s*:\s*["']Hagåtña["']/ },
      { filePath: 'main.py', label: 'Map T to Tamuning', pattern: /["']T["']\s*:\s*["']Tamuning["']/ },
      { filePath: 'main.py', label: 'Map D to Dededo', pattern: /["']D["']\s*:\s*["']Dededo["']/ },
      { filePath: 'main.py', label: 'Look up district T', pattern: /\bdistricts\s*\[\s*["']T["']\s*\]/ },
    ],
    expectedOutput: 'District T: Tamuning',
  },
  {
    id: 'python-format-roster', kind: 'python', title: 'Format a roster', difficulty: 'Builder',
    summary: 'Transform names through a reusable function.',
    concepts: ['functions', 'lists', 'string methods'],
    instructions: ['Define `format_name(name)` and return the uppercase name.', 'Use the function for "Ana" and "Ben".', 'Print `Roster: ANA, BEN`.'],
    hints: ['Python uppercases text with `.upper()`.', 'Use a list comprehension or `map` to call the function for every name.'],
    project: { title: 'Practice · Python Roster Formatter', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'names = ["Ana", "Ben"]\n\n# Define format_name(name) here.\n\nprint(f"Roster: {\', \'.join(names)}")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Define format_name with a parameter', pattern: /\bdef\s+format_name\s*\(\s*name\s*\)\s*:/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Uppercase the supplied name', pattern: /\bname\.upper\s*\(\s*\)/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Call format_name for the roster', pattern: /\bformat_name\s*\(/, scope: withoutFormatNameDeclaration, ignoreStrings: true },
    ],
    expectedOutput: 'Roster: ANA, BEN',
  },
  {
    id: 'java-filter-scores', kind: 'java', title: 'Filter passing scores', difficulty: 'Builder',
    summary: 'Use a typed collection, loop, and condition to keep matching values.',
    concepts: ['ArrayList', 'loops', 'filtering'],
    instructions: ['Keep the `scores` array with 88, 72, 95, and 61.', 'Loop over it and add scores of at least 80 to `passing`.', 'Print `Passing: [88, 95]`.'],
    hints: ['Create `List<Integer> passing = new ArrayList<>();`.', 'Inside a `for` loop, call `passing.add(score)` when `score >= 80`.'],
    project: { title: 'Practice · Java Score Filter', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'import java.util.ArrayList;\nimport java.util.List;\n\npublic class Main {\n  public static void main(String[] args) {\n    int[] scores = {88, 72, 95, 61};\n    List<Integer> passing = new ArrayList<>();\n\n    // Add passing scores to the list.\n\n    System.out.println("Passing: " + passing);\n  }\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Loop over the scores', pattern: /\bfor\s*\([^)]*\bscore\s*:\s*scores\s*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Check for a passing score', pattern: /\bif\s*\(\s*(?:score\s*>=\s*80|80\s*<=\s*score)\s*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Add passing scores to the list', pattern: /\bpassing\.add\s*\(\s*score\s*\)/, ignoreStrings: true },
    ],
    expectedOutput: 'Passing: [88, 95]',
  },
  {
    id: 'java-count-priorities', kind: 'java', title: 'Count priority requests', difficulty: 'Builder',
    summary: 'Combine a typed array, loop, and conditional counter.',
    concepts: ['arrays', 'loops', 'String equality'],
    instructions: ['Keep the four values in `priorities`.', 'Loop over the array and increase `highCount` only when the value equals "high".', 'Print `High priority: 2`.'],
    hints: ['Use an enhanced loop: `for (String priority : priorities)`.', 'Compare Java strings with `"high".equals(priority)`.'],
    project: { title: 'Practice · Java Priority Count', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    String[] priorities = {"high", "low", "high", "medium"};\n    int highCount = 0;\n\n    // Count the high-priority requests.\n\n    System.out.println("High priority: " + highCount);\n  }\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Loop over priorities', pattern: /\bfor\s*\(\s*String\s+priority\s*:\s*priorities\s*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Compare Java strings by value', pattern: /["']high["']\.equals\s*\(\s*priority\s*\)/ },
      { filePath: 'Main.java', label: 'Increase the high-priority count', pattern: /\b(?:highCount\+\+|\+\+highCount|highCount\s*\+=\s*1)/, ignoreStrings: true },
    ],
    expectedOutput: 'High priority: 2',
  },
  {
    id: 'java-map-district', kind: 'java', title: 'Look up a district', difficulty: 'Builder',
    summary: 'Store named values in a typed map and retrieve one by its key.',
    concepts: ['Map', 'HashMap', 'lookups'],
    instructions: ['Create a `Map<String, String>` named `districts`.', 'Put H, T, and D with the supplied village names into it.', 'Use `get("T")` to print `District T: Tamuning`.'],
    hints: ['Initialize it with `new HashMap<>()`.', 'Add entries with `districts.put(key, value)`.'],
    project: { title: 'Practice · Java District Lookup', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'import java.util.HashMap;\nimport java.util.Map;\n\npublic class Main {\n  public static void main(String[] args) {\n    Map<String, String> districts = new HashMap<>();\n\n    System.out.println("District T: unknown");\n  }\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Create the typed district map', pattern: /\bMap\s*<\s*String\s*,\s*String\s*>\s+districts\s*=\s*new\s+HashMap\s*<>\s*\(\s*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Map H to Hagåtña', pattern: /\bdistricts\.put\s*\(\s*"H"\s*,\s*"Hagåtña"\s*\)/ },
      { filePath: 'Main.java', label: 'Map T to Tamuning', pattern: /\bdistricts\.put\s*\(\s*"T"\s*,\s*"Tamuning"\s*\)/ },
      { filePath: 'Main.java', label: 'Map D to Dededo', pattern: /\bdistricts\.put\s*\(\s*"D"\s*,\s*"Dededo"\s*\)/ },
      { filePath: 'Main.java', label: 'Look up district T', pattern: /\bdistricts\.get\s*\(\s*"T"\s*\)/ },
    ],
    expectedOutput: 'District T: Tamuning',
  },
  {
    id: 'java-format-roster', kind: 'java', title: 'Format a roster', difficulty: 'Builder',
    summary: 'Transform names through a reusable typed method.',
    concepts: ['methods', 'arrays', 'string methods'],
    instructions: ['Define `static String formatName(String name)` and return the uppercase name.', 'Call the method for "Ana" and "Ben".', 'Print `Roster: ANA, BEN`.'],
    hints: ['Java uppercases text with `name.toUpperCase()`.', 'Keep the method inside `Main`, but outside `main`.'],
    project: { title: 'Practice · Java Roster Formatter', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    String[] names = {"Ana", "Ben"};\n    System.out.println("Roster: " + String.join(", ", names));\n  }\n\n  // Define formatName(String name) here.\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Define the typed formatName method', pattern: /\bstatic\s+String\s+formatName\s*\(\s*String\s+name\s*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Uppercase the supplied name', pattern: /\bname\.toUpperCase\s*\(\s*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Call formatName for the roster', pattern: /\bformatName\s*\(/, scope: withoutFormatNameDeclaration, ignoreStrings: true },
    ],
    expectedOutput: 'Roster: ANA, BEN',
  },
  {
    id: 'web-group-contact-options', kind: 'web', title: 'Group contact options', difficulty: 'Builder',
    summary: 'Create an accessible group of related radio controls.',
    concepts: ['forms', 'fieldset', 'radio buttons'],
    instructions: ['Wrap the contact choices in a `<fieldset>`.', 'Give the group a `<legend>` with the visible text “Preferred contact”.', 'Add labeled Email and Phone radio buttons that share the name `contact`.'],
    hints: ['A `<legend>` is the group label and belongs directly inside `<fieldset>`.', 'Give each radio a unique `id`, then match it from a label’s `for`.'],
    project: { title: 'Practice · Web Contact Options', entryPath: 'index.html', files: [{ path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Contact preference</title></head>\n<body><main><h1>Contact preference</h1><form><!-- Add the grouped choices here. --></form></main></body>\n</html>\n' }] },
    checks: [
      { filePath: 'index.html', label: 'Add the Preferred contact group label', domCheck: (document) => Array.from(document.querySelectorAll('fieldset > legend')).some((legend) => !isObviouslyHidden(legend) && visibleTextContent(legend).replace(/\s+/g, ' ').trim() === 'Preferred contact') },
      { filePath: 'index.html', label: 'Add Email and Phone radio choices', domCheck: (document) => {
        const radios = Array.from(document.querySelectorAll('fieldset input[type="radio"][name="contact"][id]'))
        const labels = Array.from(document.querySelectorAll('fieldset label[for]'))
        const radioLabels = radios.map((radio) => {
          const label = labels.find((candidate) => candidate.getAttribute('for') === radio.id)
          return label && !isObviouslyHidden(label) ? visibleTextContent(label).replace(/\s+/g, ' ').trim() : undefined
        })
        return radios.length >= 2 && radioLabels.includes('Email') && radioLabels.includes('Phone')
      } },
    ],
  },
  {
    id: 'web-flexible-navigation', kind: 'web', title: 'Make navigation wrap', difficulty: 'Builder',
    summary: 'Build a flexible navigation row that remains usable in narrow spaces.',
    concepts: ['Flexbox', 'wrapping', 'spacing'],
    instructions: ['Target `.site-nav` in `style.css`.', 'Make it a flex container that wraps.', 'Add a non-zero gap between links.'],
    hints: ['Use `display: flex` and `flex-wrap: wrap`.', 'A `gap` value such as `0.75rem` spaces both rows and columns.'],
    project: { title: 'Practice · Flexible Web Navigation', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="style.css" /><title>Island guide</title></head>\n<body><nav class="site-nav" aria-label="Main"><a href="#home">Home</a><a href="#places">Places</a><a href="#events">Events</a><a href="#about">About</a></nav></body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: 'body { margin: 0; padding: 1.5rem; font-family: system-ui, sans-serif; }\n\n.site-nav {\n  /* Make the links flexible here. */\n}\n' },
    ] },
    checks: [
      { filePath: 'style.css', label: 'Use a flex layout', pattern: /\.site-nav\s*\{[^}]*display\s*:\s*flex\s*[;}]/i },
      { filePath: 'style.css', label: 'Allow navigation to wrap', pattern: /\.site-nav\s*\{[^}]*flex-wrap\s*:\s*wrap\s*[;}]/i },
      { filePath: 'style.css', label: 'Add space between links', pattern: /\.site-nav\s*\{[^}]*\bgap\s*:\s*(?:0*\.(?:\d*[1-9]\d*)|[1-9]\d*(?:\.\d+)?)(?:px|rem|em|%|vw|vh|ch)\s*[;}]/i },
    ],
  },
  {
    id: 'web-native-disclosure', kind: 'web', title: 'Add a helpful disclosure', difficulty: 'Builder',
    summary: 'Use native HTML to reveal optional information without custom JavaScript.',
    concepts: ['details', 'summary', 'progressive disclosure'],
    instructions: ['Add one `<details>` element inside `main`.', 'Give it a `<summary>` with the visible text “What should I bring?”.', 'Inside it, add a paragraph that mentions “water”.'],
    hints: ['Place `<summary>` directly inside `<details>`.', 'The browser supplies keyboard and open/close behavior automatically.'],
    project: { title: 'Practice · Web Event Disclosure', entryPath: 'index.html', files: [{ path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Cleanup FAQ</title></head>\n<body><main><h1>Beach cleanup</h1><!-- Add the disclosure here. --></main></body>\n</html>\n' }] },
    checks: [
      { filePath: 'index.html', label: 'Add a native disclosure', domCheck: (document) => Boolean(document.querySelector('main details')) },
      { filePath: 'index.html', label: 'Add the question as its summary', domCheck: (document) => Array.from(document.querySelectorAll('main details > summary')).some((summary) => !isObviouslyHidden(summary) && visibleTextContent(summary).replace(/\s+/g, ' ').trim() === 'What should I bring?') },
      { filePath: 'index.html', label: 'Mention water in the answer', domCheck: (document) => Array.from(document.querySelectorAll('main details p')).some((paragraph) => !isObviouslyHidden(paragraph) && /\bwater\b/i.test(visibleTextContent(paragraph))) },
    ],
  },
  {
    id: 'web-responsive-breakpoint', kind: 'web', title: 'Add a layout breakpoint', difficulty: 'Builder',
    summary: 'Enhance a single-column card layout when more room is available.',
    concepts: ['media queries', 'CSS Grid', 'mobile-first design'],
    instructions: ['Keep `.card-grid` as a one-column grid by default.', 'Add a `min-width` media query using px, rem, or em.', 'Inside it, give `.card-grid` at least two equal columns.'],
    hints: ['Start with `@media (min-width: 40rem) { ... }`.', 'Inside the query, try `grid-template-columns: repeat(2, 1fr)`.'],
    project: { title: 'Practice · Web Layout Breakpoint', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="style.css" /><title>Community programs</title></head>\n<body><main><h1>Programs</h1><section class="card-grid"><article>Mentoring</article><article>Workshops</article></section></main></body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: '.card-grid {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: 1rem;\n}\n\n/* Add a wider-screen enhancement here. */\n' },
    ] },
    checks: [
      { filePath: 'style.css', label: 'Use a grid by default', pattern: /\.card-grid\s*\{[^}]*display\s*:\s*grid\s*[;}]/i, scope: withoutMinWidthMediaBlocks },
      { filePath: 'style.css', label: 'Start with one column', pattern: /\.card-grid\s*\{[^}]*grid-template-columns\s*:\s*1fr\s*[;}]/i, scope: withoutMinWidthMediaBlocks },
      { filePath: 'style.css', label: 'Add a min-width media query', pattern: /@media\b[^{}]*\(\s*min-width\s*:\s*(?:\d*\.)?\d+(?:px|rem|em)\s*\)[^{}]*\{/i },
      { filePath: 'style.css', label: 'Create multiple columns inside the breakpoint', pattern: /\.card-grid\s*\{[^}]*(?:grid-template-columns\s*:\s*repeat\s*\(\s*[2-9]\d*\s*,\s*1fr\s*\)|grid-template-columns\s*:\s*1fr\s+1fr(?:\s+1fr)*)\s*[;}][^}]*\}/i, scope: minWidthMediaBodies },
    ],
  },
]
