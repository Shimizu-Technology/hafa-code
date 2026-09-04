import type { PracticeChallenge } from '../practiceLab'
import { isObviouslyHidden } from './dom'

function visibleTextContent(element: Element): string {
  return Array.from(element.childNodes).map((node) => {
    if (node.nodeType === 3) return node.textContent ?? ''
    if (node.nodeType !== 1 || isObviouslyHidden(node as Element)) return ''
    return visibleTextContent(node as Element)
  }).join('')
}

/** Additional first-step exercises. The original greeting challenge remains first for every language. */
export const ADDITIONAL_STARTER_CHALLENGES: PracticeChallenge[] = [
  {
    id: 'ruby-arithmetic-total', kind: 'ruby', title: 'Calculate an order total', difficulty: 'Starter',
    summary: 'Combine number variables with multiplication to calculate a total.',
    concepts: ['numbers', 'arithmetic', 'variables'],
    instructions: ['Set `price` to 6 and `quantity` to 3.', 'Calculate `total` by multiplying `price` and `quantity`.', 'Print `Total: 18`.'],
    hints: ['Ruby multiplies values with `*`.', 'Build the output with `puts "Total: #{total}"`.'],
    project: { title: 'Practice · Ruby Order Total', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'price = 0\nquantity = 0\ntotal = 0\n\nputs "Total: #{total}"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Set price to 6', pattern: /^\s*price\s*=\s*6\s*$/m },
      { filePath: 'main.rb', label: 'Set quantity to 3', pattern: /^\s*quantity\s*=\s*3\s*$/m },
      { filePath: 'main.rb', label: 'Multiply price by quantity', pattern: /^\s*total\s*=\s*price\s*\*\s*quantity\s*$/m, ignoreStrings: true },
    ],
    expectedOutput: 'Total: 18',
  },
  {
    id: 'ruby-conditional-access', kind: 'ruby', title: 'Choose an access message', difficulty: 'Starter',
    summary: 'Use a simple conditional to choose one of two messages.',
    concepts: ['conditionals', 'comparisons', 'numbers'],
    instructions: ['Set `age` to 18.', 'Print "Access granted" when age is at least 18.', 'Otherwise, print "Ask an adult".'],
    hints: ['Compare with `age >= 18`.', 'Ruby conditionals use `if`, `else`, and `end`.'],
    project: { title: 'Practice · Ruby Access Message', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'age = 0\n\n# Choose the message with an if/else.\nputs "Ask an adult"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Set age to 18', pattern: /^\s*age\s*=\s*18\s*$/m },
      { filePath: 'main.rb', label: 'Compare age in an if/else', pattern: /\bif\s+age\s*>=\s*18\b[\s\S]*\belse\b[\s\S]*\bend\b/, ignoreStrings: true },
    ],
    expectedOutput: 'Access granted',
  },
  {
    id: 'ruby-array-stops', kind: 'ruby', title: 'Read a list of stops', difficulty: 'Starter',
    summary: 'Store related values in an array and read its first item and size.',
    concepts: ['arrays', 'indexing', 'length'],
    instructions: ['Create `stops` with "Hagåtña", "Tamuning", and "Dededo" in that order.', 'Print `First stop: Hagåtña` using the array.', 'Print `Total stops: 3` using the array size.'],
    hints: ['An array uses square brackets: `["one", "two"]`.', 'Read the first item with `stops[0]` or `stops.first`, and its size with `stops.length`.'],
    project: { title: 'Practice · Ruby Stop List', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'stops = []\n\nputs "First stop: "\nputs "Total stops: 0"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Create the three-stop array', pattern: /\bstops\s*=\s*\[\s*["']Hagåtña["']\s*,\s*["']Tamuning["']\s*,\s*["']Dededo["']\s*\]/ },
      { filePath: 'main.rb', label: 'Read the first stop from the array', pattern: /\bstops\s*(?:\[\s*0\s*\]|\.first\b)/ },
      { filePath: 'main.rb', label: 'Read the array size', pattern: /\bstops\.(?:length|size)\b/ },
    ],
    expectedOutput: 'First stop: Hagåtña\nTotal stops: 3',
  },
  {
    id: 'ruby-method-welcome', kind: 'ruby', title: 'Write a welcome method', difficulty: 'Starter',
    summary: 'Put a small string transformation into a reusable method.',
    concepts: ['methods', 'parameters', 'return values'],
    instructions: ['Define `welcome(name)`.', 'Have it produce `Welcome, <name>!` using the parameter.', 'Call it with "Mia" and print the result.'],
    hints: ['Start with `def welcome(name)` and finish with `end`.', 'The last expression in a Ruby method becomes its return value.'],
    project: { title: 'Practice · Ruby Welcome Method', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: '# Define welcome(name) here.\n\nputs "Welcome, friend!"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Define welcome with a name parameter', pattern: /\bdef\s+welcome\s*\(\s*name\s*\)/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Call welcome with Mia', pattern: /\bwelcome\s*\(\s*["']Mia["']\s*\)/ },
    ],
    expectedOutput: 'Welcome, Mia!',
  },
  {
    id: 'javascript-arithmetic-total', kind: 'javascript', title: 'Calculate an order total', difficulty: 'Starter',
    summary: 'Combine number constants with multiplication to calculate a total.',
    concepts: ['numbers', 'arithmetic', 'constants'],
    instructions: ['Set `price` to 6 and `quantity` to 3.', 'Calculate `total` by multiplying `price` and `quantity`.', 'Log `Total: 18`.'],
    hints: ['JavaScript multiplies values with `*`.', 'Use a template string: `` `Total: ${total}` ``.'],
    project: { title: 'Practice · JavaScript Order Total', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const price = 0\nconst quantity = 0\nconst total = 0\n\nconsole.log(`Total: ${total}`)\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Set price to 6', pattern: /^\s*(?:const|let)\s+price\s*=\s*6\s*;?\s*$/m },
      { filePath: 'main.js', label: 'Set quantity to 3', pattern: /^\s*(?:const|let)\s+quantity\s*=\s*3\s*;?\s*$/m },
      { filePath: 'main.js', label: 'Multiply price by quantity', pattern: /^\s*(?:const|let)\s+total\s*=\s*price\s*\*\s*quantity\s*;?\s*$/m, ignoreStrings: true },
    ],
    expectedOutput: 'Total: 18',
  },
  {
    id: 'javascript-conditional-access', kind: 'javascript', title: 'Choose an access message', difficulty: 'Starter',
    summary: 'Use a simple conditional to choose one of two messages.',
    concepts: ['conditionals', 'comparisons', 'numbers'],
    instructions: ['Set `age` to 18.', 'Log "Access granted" when age is at least 18.', 'Otherwise, log "Ask an adult".'],
    hints: ['Compare with `age >= 18`.', 'Put the two `console.log` calls inside `if` and `else` blocks.'],
    project: { title: 'Practice · JavaScript Access Message', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const age = 0\n\n// Choose the message with an if/else.\nconsole.log("Ask an adult")\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Set age to 18', pattern: /^\s*(?:const|let)\s+age\s*=\s*18\s*;?\s*$/m },
      { filePath: 'main.js', label: 'Compare age in an if/else', pattern: /\bif\s*\(\s*age\s*>=\s*18\s*\)[\s\S]*\belse\b/, ignoreStrings: true },
    ],
    expectedOutput: 'Access granted',
  },
  {
    id: 'javascript-array-stops', kind: 'javascript', title: 'Read a list of stops', difficulty: 'Starter',
    summary: 'Store related values in an array and read its first item and length.',
    concepts: ['arrays', 'indexing', 'length'],
    instructions: ['Create `stops` with "Hagåtña", "Tamuning", and "Dededo" in that order.', 'Log `First stop: Hagåtña` using the array.', 'Log `Total stops: 3` using `.length`.'],
    hints: ['An array uses square brackets: `["one", "two"]`.', 'The first item is `stops[0]`; the item count is `stops.length`.'],
    project: { title: 'Practice · JavaScript Stop List', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const stops = []\n\nconsole.log("First stop: ")\nconsole.log("Total stops: 0")\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Create the three-stop array', pattern: /\bstops\s*=\s*\[\s*["']Hagåtña["']\s*,\s*["']Tamuning["']\s*,\s*["']Dededo["']\s*\]/ },
      { filePath: 'main.js', label: 'Read the first stop from the array', pattern: /\bstops\s*\[\s*0\s*\]/ },
      { filePath: 'main.js', label: 'Read the array length', pattern: /\bstops\.length\b/ },
    ],
    expectedOutput: 'First stop: Hagåtña\nTotal stops: 3',
  },
  {
    id: 'javascript-function-welcome', kind: 'javascript', title: 'Write a welcome function', difficulty: 'Starter',
    summary: 'Put a small string transformation into a reusable function.',
    concepts: ['functions', 'parameters', 'return values'],
    instructions: ['Define `welcome(name)`.', 'Return `Welcome, <name>!` using the parameter.', 'Call it with "Mia" and log the result.'],
    hints: ['Start with `function welcome(name) {`.', 'Use `return`, then call the function inside `console.log`.'],
    project: { title: 'Practice · JavaScript Welcome Function', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: '// Define welcome(name) here.\n\nconsole.log("Welcome, friend!")\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Define welcome with a name parameter', pattern: /\bfunction\s+welcome\s*\(\s*name\s*\)/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Return a value from welcome', pattern: /\breturn\b/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Call welcome with Mia', pattern: /\bwelcome\s*\(\s*["']Mia["']\s*\)/ },
    ],
    expectedOutput: 'Welcome, Mia!',
  },
  {
    id: 'python-arithmetic-total', kind: 'python', title: 'Calculate an order total', difficulty: 'Starter',
    summary: 'Combine number variables with multiplication to calculate a total.',
    concepts: ['numbers', 'arithmetic', 'variables'],
    instructions: ['Set `price` to 6 and `quantity` to 3.', 'Calculate `total` by multiplying `price` and `quantity`.', 'Print `Total: 18`.'],
    hints: ['Python multiplies values with `*`.', 'Build the output with `print(f"Total: {total}")`.'],
    project: { title: 'Practice · Python Order Total', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'price = 0\nquantity = 0\ntotal = 0\n\nprint(f"Total: {total}")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Set price to 6', pattern: /^\s*price\s*=\s*6\s*$/m },
      { filePath: 'main.py', label: 'Set quantity to 3', pattern: /^\s*quantity\s*=\s*3\s*$/m },
      { filePath: 'main.py', label: 'Multiply price by quantity', pattern: /^\s*total\s*=\s*price\s*\*\s*quantity\s*$/m, ignoreStrings: true },
    ],
    expectedOutput: 'Total: 18',
  },
  {
    id: 'python-conditional-access', kind: 'python', title: 'Choose an access message', difficulty: 'Starter',
    summary: 'Use a simple conditional to choose one of two messages.',
    concepts: ['conditionals', 'comparisons', 'numbers'],
    instructions: ['Set `age` to 18.', 'Print "Access granted" when age is at least 18.', 'Otherwise, print "Ask an adult".'],
    hints: ['Compare with `age >= 18`.', 'Python uses `if ...:` and `else:` with indented bodies.'],
    project: { title: 'Practice · Python Access Message', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'age = 0\n\n# Choose the message with an if/else.\nprint("Ask an adult")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Set age to 18', pattern: /^\s*age\s*=\s*18\s*$/m },
      { filePath: 'main.py', label: 'Compare age in an if/else', pattern: /\bif\s+age\s*>=\s*18\s*:[\s\S]*\belse\s*:/, ignoreStrings: true },
    ],
    expectedOutput: 'Access granted',
  },
  {
    id: 'python-list-stops', kind: 'python', title: 'Read a list of stops', difficulty: 'Starter',
    summary: 'Store related values in a list and read its first item and length.',
    concepts: ['lists', 'indexing', 'length'],
    instructions: ['Create `stops` with "Hagåtña", "Tamuning", and "Dededo" in that order.', 'Print `First stop: Hagåtña` using the list.', 'Print `Total stops: 3` using `len`.'],
    hints: ['A list uses square brackets: `["one", "two"]`.', 'The first item is `stops[0]`; count items with `len(stops)`.'],
    project: { title: 'Practice · Python Stop List', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'stops = []\n\nprint("First stop: ")\nprint("Total stops: 0")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Create the three-stop list', pattern: /\bstops\s*=\s*\[\s*["']Hagåtña["']\s*,\s*["']Tamuning["']\s*,\s*["']Dededo["']\s*\]/ },
      { filePath: 'main.py', label: 'Read the first stop from the list', pattern: /\bstops\s*\[\s*0\s*\]/ },
      { filePath: 'main.py', label: 'Read the list length', pattern: /\blen\s*\(\s*stops\s*\)/ },
    ],
    expectedOutput: 'First stop: Hagåtña\nTotal stops: 3',
  },
  {
    id: 'python-function-welcome', kind: 'python', title: 'Write a welcome function', difficulty: 'Starter',
    summary: 'Put a small string transformation into a reusable function.',
    concepts: ['functions', 'parameters', 'return values'],
    instructions: ['Define `welcome(name)`.', 'Return `Welcome, <name>!` using the parameter.', 'Call it with "Mia" and print the result.'],
    hints: ['Start with `def welcome(name):`.', 'Use an indented `return`, then call the function inside `print`.'],
    project: { title: 'Practice · Python Welcome Function', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: '# Define welcome(name) here.\n\nprint("Welcome, friend!")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Define welcome with a name parameter', pattern: /\bdef\s+welcome\s*\(\s*name\s*\)\s*:/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Return a value from welcome', pattern: /\breturn\b/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Call welcome with Mia', pattern: /\bwelcome\s*\(\s*["']Mia["']\s*\)/ },
    ],
    expectedOutput: 'Welcome, Mia!',
  },
  {
    id: 'java-arithmetic-total', kind: 'java', title: 'Calculate an order total', difficulty: 'Starter',
    summary: 'Combine typed number variables with multiplication to calculate a total.',
    concepts: ['integers', 'arithmetic', 'types'],
    instructions: ['Set the `int` variables `price` to 6 and `quantity` to 3.', 'Calculate `total` by multiplying `price` and `quantity`.', 'Print `Total: 18`.'],
    hints: ['Declare a whole number with `int`.', 'Java multiplies values with `*`; remember the semicolon.'],
    project: { title: 'Practice · Java Order Total', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    int price = 0;\n    int quantity = 0;\n    int total = 0;\n\n    System.out.println("Total: " + total);\n  }\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Set price to 6', pattern: /^\s*int\s+price\s*=\s*6\s*;\s*$/m },
      { filePath: 'Main.java', label: 'Set quantity to 3', pattern: /^\s*int\s+quantity\s*=\s*3\s*;\s*$/m },
      { filePath: 'Main.java', label: 'Multiply price by quantity', pattern: /^\s*int\s+total\s*=\s*price\s*\*\s*quantity\s*;\s*$/m, ignoreStrings: true },
    ],
    expectedOutput: 'Total: 18',
  },
  {
    id: 'java-conditional-access', kind: 'java', title: 'Choose an access message', difficulty: 'Starter',
    summary: 'Use a simple conditional to choose one of two messages.',
    concepts: ['conditionals', 'comparisons', 'integers'],
    instructions: ['Set the `int` variable `age` to 18.', 'Print "Access granted" when age is at least 18.', 'Otherwise, print "Ask an adult".'],
    hints: ['Compare with `age >= 18` inside parentheses.', 'Java uses braces around the `if` and `else` bodies.'],
    project: { title: 'Practice · Java Access Message', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    int age = 0;\n\n    // Choose the message with an if/else.\n    System.out.println("Ask an adult");\n  }\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Set age to 18', pattern: /^\s*int\s+age\s*=\s*18\s*;\s*$/m },
      { filePath: 'Main.java', label: 'Compare age in an if/else', pattern: /\bif\s*\(\s*age\s*>=\s*18\s*\)[\s\S]*\belse\b/, ignoreStrings: true },
    ],
    expectedOutput: 'Access granted',
  },
  {
    id: 'java-array-stops', kind: 'java', title: 'Read an array of stops', difficulty: 'Starter',
    summary: 'Store related text in a typed array and read its first item and length.',
    concepts: ['arrays', 'indexing', 'types'],
    instructions: ['Create `String[] stops` with "Hagåtña", "Tamuning", and "Dededo" in that order.', 'Print `First stop: Hagåtña` using the array.', 'Print `Total stops: 3` using `.length`.'],
    hints: ['Create it with `String[] stops = { ... };`.', 'The first item is `stops[0]`; an array count is `stops.length`.'],
    project: { title: 'Practice · Java Stop Array', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    String[] stops = {};\n\n    System.out.println("First stop: ");\n    System.out.println("Total stops: 0");\n  }\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Create the three-stop String array', pattern: /\bString\s*\[\s*\]\s+stops\s*=\s*\{\s*"Hagåtña"\s*,\s*"Tamuning"\s*,\s*"Dededo"\s*\}\s*;/ },
      { filePath: 'Main.java', label: 'Read the first stop from the array', pattern: /\bstops\s*\[\s*0\s*\]/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Read the array length', pattern: /\bstops\.length\b/, ignoreStrings: true },
    ],
    expectedOutput: 'First stop: Hagåtña\nTotal stops: 3',
  },
  {
    id: 'java-method-welcome', kind: 'java', title: 'Write a welcome method', difficulty: 'Starter',
    summary: 'Put a small string transformation into a reusable typed method.',
    concepts: ['methods', 'parameters', 'return values'],
    instructions: ['Define `static String welcome(String name)` inside `Main`.', 'Return `Welcome, <name>!` using the parameter.', 'Call it with "Mia" from `main` and print the result.'],
    hints: ['Place the method inside the class but outside `main`.', 'Use `return "Welcome, " + name + "!";`.'],
    project: { title: 'Practice · Java Welcome Method', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Welcome, friend!");\n  }\n\n  // Define welcome(String name) here.\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Define a typed welcome method', pattern: /\bstatic\s+String\s+welcome\s*\(\s*String\s+name\s*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Return a value from welcome', pattern: /\breturn\b/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Call welcome with Mia', pattern: /\bwelcome\s*\(\s*"Mia"\s*\)/ },
    ],
    expectedOutput: 'Welcome, Mia!',
  },
  {
    id: 'web-page-landmarks', kind: 'web', title: 'Structure a community page', difficulty: 'Starter',
    summary: 'Organize a page with landmarks that explain each section’s purpose.',
    concepts: ['semantic HTML', 'landmarks', 'page structure'],
    instructions: ['Add one `<header>` containing the page heading.', 'Add a `<nav>` with at least one link.', 'Add one `<main>` and one `<footer>`.'],
    hints: ['Place the landmarks as siblings inside `<body>`.', 'Give the navigation link a real `href`, such as `#events`.'],
    project: { title: 'Practice · Web Community Landmarks', entryPath: 'index.html', files: [{ path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Community board</title></head>\n<body>\n  <h1>Community board</h1>\n  <p>Find upcoming events around the island.</p>\n</body>\n</html>\n' }] },
    checks: [
      { filePath: 'index.html', label: 'Add a header containing the heading', domCheck: (document) => Boolean(document.querySelector('header h1')) },
      { filePath: 'index.html', label: 'Add navigation with a working link', domCheck: (document) => Array.from(document.querySelectorAll('nav a[href]')).some((link) => Boolean(link.getAttribute('href')?.trim())) },
      { filePath: 'index.html', label: 'Add the main content landmark', domCheck: (document) => Boolean(document.querySelector('main')) },
      { filePath: 'index.html', label: 'Add the footer landmark', domCheck: (document) => Boolean(document.querySelector('footer')) },
    ],
  },
  {
    id: 'web-accessible-email', kind: 'web', title: 'Label an email field', difficulty: 'Starter',
    summary: 'Connect visible instructions to a form control for every visitor.',
    concepts: ['forms', 'labels', 'accessibility'],
    instructions: ['Add an input with `id="email"` and `type="email"`.', 'Add a visible `<label>` whose `for` value is `email`.', 'Give the field the name `email`.'],
    hints: ['The label and input connect when `for` and `id` match.', 'A complete field can start with `<input id="email" name="email" type="email">`.'],
    project: { title: 'Practice · Accessible Email Field', entryPath: 'index.html', files: [{ path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Updates</title></head>\n<body><main><h1>Get community updates</h1><form><!-- Add the labeled email field here. --><button>Sign up</button></form></main></body>\n</html>\n' }] },
    checks: [
      { filePath: 'index.html', label: 'Add the email input', domCheck: (document) => Boolean(document.querySelector('input#email[type="email"][name="email"]')) },
      { filePath: 'index.html', label: 'Connect a visible label to the field', domCheck: (document) => (
        Array.from(document.querySelectorAll('label[for="email"]')).some((label) => (
          !isObviouslyHidden(label)
          && Boolean(visibleTextContent(label).trim())
        ))
      ) },
    ],
  },
  {
    id: 'web-style-action', kind: 'web', title: 'Style an action button', difficulty: 'Starter',
    summary: 'Target a class in CSS and give the action clear visual weight.',
    concepts: ['CSS selectors', 'color', 'spacing'],
    instructions: ['Target `.action` in `style.css`.', 'Set a non-transparent `background` or `background-color`.', 'Add non-zero `padding` and set the text `color`.'],
    hints: ['Start with `.action { ... }`.', 'Try `padding: 0.75rem 1rem;` and choose colors with enough contrast.'],
    project: { title: 'Practice · Styled Web Action', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="style.css" /><title>Volunteer</title></head>\n<body><main><h1>Beach cleanup</h1><a class="action" href="#signup">Join the team</a></main></body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: 'body { font-family: system-ui, sans-serif; padding: 2rem; }\n\n/* Style .action here. */\n' },
    ] },
    checks: [
      { filePath: 'style.css', label: 'Target the action class', pattern: /\.action\s*\{[^}]*\}/i },
      { filePath: 'style.css', label: 'Add an action background', pattern: /\.action\s*\{[^}]*(?:background|background-color)\s*:\s*(?!transparent\b|none\b)[^;}]+[;}]/i },
      { filePath: 'style.css', label: 'Add space inside the action', pattern: /\.action\s*\{[^}]*padding\s*:\s*(?:0*\.(?:\d*[1-9]\d*)|[1-9]\d*(?:\.\d+)?)(?:px|rem|em|%|vw|vh|ch)(?:\s+[^;}]+)?[;}]/i },
      { filePath: 'style.css', label: 'Set the action text color', pattern: /\.action\s*\{\s*(?:[^;}]+;\s*)*color\s*:\s*[^;}]+[;}]/i },
    ],
  },
  {
    id: 'web-responsive-image', kind: 'web', title: 'Keep an image in bounds', difficulty: 'Starter',
    summary: 'Make an image scale down with its container without stretching.',
    concepts: ['responsive images', 'CSS sizing'],
    instructions: ['Target `.hero-image` in `style.css`.', 'Set `max-width` to `100%`.', 'Set `height` to `auto`.'],
    hints: ['Use the class selector `.hero-image`.', '`max-width: 100%` prevents horizontal overflow while `height: auto` preserves the shape.'],
    project: { title: 'Practice · Responsive Web Image', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="style.css" /><title>Island view</title></head>\n<body><main><h1>Island view</h1><img class="hero-image" src="sunset.svg" alt="Sunset over Guam" /></main></body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: 'main { width: min(42rem, 90vw); margin: 2rem auto; }\n\n/* Keep .hero-image inside main. */\n' },
      { path: 'sunset.svg', language: 'plain', content: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#ff9f80"/><circle cx="480" cy="240" r="90" fill="#ffd166"/><path d="M0 340h960v200H0z" fill="#176b78"/></svg>\n' },
    ] },
    checks: [
      { filePath: 'style.css', label: 'Limit the image to its container', pattern: /\.hero-image\s*\{[^}]*max-width\s*:\s*100%\s*[;}]/i },
      { filePath: 'style.css', label: 'Preserve the image proportions', pattern: /\.hero-image\s*\{[^}]*height\s*:\s*auto\s*[;}]/i },
    ],
  },
]
