import type { PracticeChallenge } from '../practiceLab'
import { isObviouslyHidden, visibleTextContent } from './dom'
import { eventHandlerBody } from './javascript'

const visibleText = (element: Element | null) => element && !isObviouslyHidden(element)
  ? visibleTextContent(element).replace(/\s+/g, ' ').trim()
  : ''

const OPEN_HELP_HANDLER = eventHandlerBody('openButton', 'click')
const SUBMIT_EMAIL_HANDLER = eventHandlerBody('submitButton', 'click')
const THEME_TOGGLE_HANDLER = eventHandlerBody('toggle', 'click')
const ADD_TASK_HANDLER = eventHandlerBody('button', 'click')

/** Additional capstone-style exercises. The original launch/counter challenge remains first. */
export const ADDITIONAL_STRETCH_CHALLENGES: PracticeChallenge[] = [
  {
    id: 'ruby-ticket-class', kind: 'ruby', title: 'Model a support ticket', difficulty: 'Stretch',
    summary: 'Bundle support-ticket data and behavior into a reusable class.',
    concepts: ['classes', 'constructors', 'instance variables'],
    instructions: ['Create a `SupportTicket` class whose initializer accepts `customer` and `priority`.', 'Add a `summary` method that returns `<customer> | <priority>`.', 'Create a ticket for "Mia" and "high", then print its summary.'],
    hints: ['Store constructor values in `@customer` and `@priority`.', 'Create an object with `SupportTicket.new("Mia", "high")`.'],
    project: { title: 'Practice · Ruby Support Ticket', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: '# Create SupportTicket here.\n\nputs "Mia"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Define the SupportTicket class', pattern: /\bclass\s+SupportTicket\b/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Initialize customer and priority', pattern: /\bdef\s+initialize\s*\(\s*customer\s*,\s*priority\s*\)[\s\S]*@customer\s*=\s*customer[\s\S]*@priority\s*=\s*priority/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Define summary', pattern: /\bdef\s+summary\b/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Create a ticket and call summary', pattern: /\bSupportTicket\.new\s*\([\s\S]*\.summary\b/, ignoreStrings: true },
    ],
    expectedOutput: 'Mia | high',
  },
  {
    id: 'ruby-transfer-errors', kind: 'ruby', title: 'Handle an invalid transfer', difficulty: 'Stretch',
    summary: 'Raise and rescue a useful error when a transfer amount is invalid.',
    concepts: ['exceptions', 'methods', 'validation'],
    instructions: ['Define `transfer_status(amount)`.', 'Raise `ArgumentError` with "Amount must be positive" when amount is zero or less, and otherwise return `Transfer: $<amount>`.', 'Print the result for 75, then rescue an invalid -1 transfer and print `Error: <message>`.'],
    hints: ['Use `raise ArgumentError, "..." if amount <= 0`.', 'Wrap the invalid call in `begin` / `rescue ArgumentError => error`.'],
    project: { title: 'Practice · Ruby Transfer Validation', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: '# Define transfer_status and handle the invalid call.\n\nputs "Transfer: $75"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Define transfer_status with validation', pattern: /\bdef\s+transfer_status\s*\(\s*amount\s*\)[\s\S]*\b(?:raise|fail)\s+ArgumentError\b/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Check for a non-positive amount', pattern: /\bamount\s*<=\s*0\b/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Rescue ArgumentError', pattern: /\brescue\s+ArgumentError(?:\s*=>\s*\w+)?/, ignoreStrings: true },
    ],
    expectedOutput: 'Transfer: $75\nError: Amount must be positive',
  },
  {
    id: 'ruby-transaction-totals', kind: 'ruby', title: 'Total transactions by category', difficulty: 'Stretch',
    summary: 'Aggregate records into category totals with a hash.',
    concepts: ['hashes', 'aggregation', 'loops'],
    instructions: ['Create transactions for Food 12, Travel 5, and Food 8.', 'Accumulate each amount into a `totals` hash by category.', 'Print `Food: 20` and `Travel: 5` on separate lines.'],
    hints: ['Start totals with `Hash.new(0)`.', 'Inside `.each`, add the amount to `totals[transaction[:category]]`.'],
    project: { title: 'Practice · Ruby Transaction Totals', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'transactions = [\n  { category: "Food", amount: 12 },\n  { category: "Travel", amount: 5 },\n  { category: "Food", amount: 8 }\n]\n\n# Build totals from transactions.\nputs "Food: 0"\nputs "Travel: 0"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Create a totals hash with a numeric default', pattern: /\btotals\s*=\s*Hash\.new\s*\(\s*0\s*\)/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Loop over transactions', pattern: /\btransactions\.each\s+do\s*\|\s*transaction\s*\|/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Add each amount to its category', pattern: /\btotals\s*\[\s*transaction\s*\[\s*:category\s*\]\s*\]\s*\+=\s*transaction\s*\[\s*:amount\s*\]/, ignoreStrings: true },
    ],
    expectedOutput: 'Food: 20\nTravel: 5',
  },
  {
    id: 'ruby-sort-requests', kind: 'ruby', title: 'Rank a service queue', difficulty: 'Stretch',
    summary: 'Sort structured requests so the highest priority appears first.',
    concepts: ['sorting', 'arrays', 'blocks'],
    instructions: ['Create requests for Card question (1), Password reset (3), and Address update (2).', 'Sort the requests from highest priority to lowest.', 'Print their names joined with ` > `.'],
    hints: ['Use `sort_by` with a negative priority.', 'Use `map` to select each name before calling `join`.'],
    project: { title: 'Practice · Ruby Service Queue', entryPath: 'main.rb', files: [{ path: 'main.rb', language: 'ruby', content: 'requests = [\n  { name: "Card question", priority: 1 },\n  { name: "Password reset", priority: 3 },\n  { name: "Address update", priority: 2 }\n]\n\n# Sort and print the queue.\nputs "Card question"\n' }] },
    checks: [
      { filePath: 'main.rb', label: 'Sort requests by priority', pattern: /\brequests\.sort_by\s*(?:do\s*\|\s*\w+\s*\||\{\s*\|\s*\w+\s*\|)[\s\S]*-\s*\w+\s*\[\s*:priority\s*\]/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Read each request name', pattern: /\.(?:map|collect)\s*(?:do\s*\|\s*\w+\s*\||\{\s*\|\s*\w+\s*\|)[\s\S]*\w+\s*\[\s*:name\s*\]/, ignoreStrings: true },
      { filePath: 'main.rb', label: 'Join the ranked names', pattern: /\.join\s*\(\s*["']\s*>\s*["']\s*\)/ },
    ],
    expectedOutput: 'Password reset > Address update > Card question',
  },

  {
    id: 'javascript-ticket-class', kind: 'javascript', title: 'Model a support ticket', difficulty: 'Stretch',
    summary: 'Bundle support-ticket data and behavior into a reusable class.',
    concepts: ['classes', 'constructors', 'methods'],
    instructions: ['Create a `SupportTicket` class whose constructor accepts `customer` and `priority`.', 'Add a `summary()` method that returns `<customer> | <priority>`.', 'Create a ticket for "Mia" and "high", then log its summary.'],
    hints: ['Assign constructor values with `this.customer = customer`.', 'Create an object with `new SupportTicket("Mia", "high")`.'],
    project: { title: 'Practice · JavaScript Support Ticket', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: '// Create SupportTicket here.\n\nconsole.log("Mia")\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Define the SupportTicket class', pattern: /\bclass\s+SupportTicket\b/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Initialize customer and priority', pattern: /\bconstructor\s*\(\s*customer\s*,\s*priority\s*\)\s*\{[\s\S]*this\.customer\s*=\s*customer[\s\S]*this\.priority\s*=\s*priority/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Define summary', pattern: /\bsummary\s*\(\s*\)\s*\{/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Create a ticket and call summary', pattern: /\bnew\s+SupportTicket\s*\([\s\S]*\.summary\s*\(/, ignoreStrings: true },
    ],
    expectedOutput: 'Mia | high',
  },
  {
    id: 'javascript-transfer-errors', kind: 'javascript', title: 'Handle an invalid transfer', difficulty: 'Stretch',
    summary: 'Throw and catch a useful error when a transfer amount is invalid.',
    concepts: ['exceptions', 'functions', 'validation'],
    instructions: ['Define `transferStatus(amount)`.', 'Throw an `Error` with "Amount must be positive" when amount is zero or less, and otherwise return `Transfer: $<amount>`.', 'Log the result for 75, then catch an invalid -1 transfer and log `Error: <message>`.'],
    hints: ['Use `throw new Error("...")` inside an `if`.', 'Wrap the invalid call in `try` / `catch (error)`.'],
    project: { title: 'Practice · JavaScript Transfer Validation', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: '// Define transferStatus and handle the invalid call.\n\nconsole.log("Transfer: $75")\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Define transferStatus with validation', pattern: /\bfunction\s+transferStatus\s*\(\s*amount\s*\)\s*\{[\s\S]*\bthrow\s+new\s+Error\s*\(/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Check for a non-positive amount', pattern: /\bamount\s*<=\s*0\b/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Catch the invalid transfer error', pattern: /\btry\s*\{[\s\S]*\bcatch\s*\(\s*\w+\s*\)/, ignoreStrings: true },
    ],
    expectedOutput: 'Transfer: $75\nError: Amount must be positive',
  },
  {
    id: 'javascript-transaction-totals', kind: 'javascript', title: 'Total transactions by category', difficulty: 'Stretch',
    summary: 'Aggregate records into category totals with an object.',
    concepts: ['objects', 'aggregation', 'loops'],
    instructions: ['Create transactions for Food 12, Travel 5, and Food 8.', 'Accumulate each amount into a `totals` object by category.', 'Log `Food: 20` and `Travel: 5` on separate lines.'],
    hints: ['Start with `const totals = {}`.', 'Inside a `for...of` loop, add to `totals[transaction.category]`, using zero when the key is missing.'],
    project: { title: 'Practice · JavaScript Transaction Totals', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const transactions = [\n  { category: "Food", amount: 12 },\n  { category: "Travel", amount: 5 },\n  { category: "Food", amount: 8 },\n]\n\n// Build totals from transactions.\nconsole.log("Food: 0")\nconsole.log("Travel: 0")\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Create a totals object', pattern: /\b(?:const|let)\s+totals\s*=\s*\{\s*\}/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Loop over transactions', pattern: /\bfor\s*\(\s*const\s+transaction\s+of\s+transactions\s*\)/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Add each amount to its category', pattern: /\btotals\s*\[\s*transaction\.category\s*\]\s*=\s*\(\s*totals\s*\[\s*transaction\.category\s*\]\s*\|\|\s*0\s*\)\s*\+\s*transaction\.amount/, ignoreStrings: true },
    ],
    expectedOutput: 'Food: 20\nTravel: 5',
  },
  {
    id: 'javascript-sort-requests', kind: 'javascript', title: 'Rank a service queue', difficulty: 'Stretch',
    summary: 'Sort structured requests so the highest priority appears first.',
    concepts: ['sorting', 'arrays', 'callbacks'],
    instructions: ['Create requests for Card question (1), Password reset (3), and Address update (2).', 'Sort the requests from highest priority to lowest.', 'Log their names joined with ` > `.'],
    hints: ['Use `.sort((a, b) => b.priority - a.priority)`.', 'Use `.map(...)` to select each name before `.join(...)`.'],
    project: { title: 'Practice · JavaScript Service Queue', entryPath: 'main.js', files: [{ path: 'main.js', language: 'javascript', content: 'const requests = [\n  { name: "Card question", priority: 1 },\n  { name: "Password reset", priority: 3 },\n  { name: "Address update", priority: 2 },\n]\n\n// Sort and print the queue.\nconsole.log("Card question")\n' }] },
    checks: [
      { filePath: 'main.js', label: 'Sort requests by descending priority', pattern: /\brequests\.sort\s*\(\s*\(?\s*(\w+)\s*,\s*(\w+)\s*\)?\s*=>\s*\2\.priority\s*-\s*\1\.priority\s*\)/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Read each request name', pattern: /\.map\s*\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.name\s*\)/, ignoreStrings: true },
      { filePath: 'main.js', label: 'Join the ranked names', pattern: /\.join\s*\(\s*["']\s*>\s*["']\s*\)/ },
    ],
    expectedOutput: 'Password reset > Address update > Card question',
  },

  {
    id: 'python-ticket-class', kind: 'python', title: 'Model a support ticket', difficulty: 'Stretch',
    summary: 'Bundle support-ticket data and behavior into a reusable class.',
    concepts: ['classes', 'constructors', 'instance attributes'],
    instructions: ['Create a `SupportTicket` class whose initializer accepts `customer` and `priority`.', 'Add a `summary` method that returns `<customer> | <priority>`.', 'Create a ticket for "Mia" and "high", then print its summary.'],
    hints: ['Define `__init__(self, customer, priority)`.', 'Create an object with `SupportTicket("Mia", "high")`.'],
    project: { title: 'Practice · Python Support Ticket', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: '# Create SupportTicket here.\n\nprint("Mia")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Define the SupportTicket class', pattern: /\bclass\s+SupportTicket\s*:/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Initialize customer and priority', pattern: /\bdef\s+__init__\s*\(\s*self\s*,\s*customer\s*,\s*priority\s*\)\s*:[\s\S]*self\.customer\s*=\s*customer[\s\S]*self\.priority\s*=\s*priority/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Define summary', pattern: /\bdef\s+summary\s*\(\s*self\s*\)\s*:/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Create a ticket and call summary', pattern: /\bSupportTicket\s*\([\s\S]*\.summary\s*\(/, ignoreStrings: true },
    ],
    expectedOutput: 'Mia | high',
  },
  {
    id: 'python-transfer-errors', kind: 'python', title: 'Handle an invalid transfer', difficulty: 'Stretch',
    summary: 'Raise and catch a useful error when a transfer amount is invalid.',
    concepts: ['exceptions', 'functions', 'validation'],
    instructions: ['Define `transfer_status(amount)`.', 'Raise `ValueError` with "Amount must be positive" when amount is zero or less, and otherwise return `Transfer: $<amount>`.', 'Print the result for 75, then catch an invalid -1 transfer and print `Error: <message>`.'],
    hints: ['Use `raise ValueError("...")` inside an `if`.', 'Wrap the invalid call in `try` / `except ValueError as error`.'],
    project: { title: 'Practice · Python Transfer Validation', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: '# Define transfer_status and handle the invalid call.\n\nprint("Transfer: $75")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Define transfer_status with validation', pattern: /\bdef\s+transfer_status\s*\(\s*amount\s*\)\s*:[\s\S]*\braise\s+ValueError\s*\(/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Check for a non-positive amount', pattern: /\bamount\s*<=\s*0\b/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Catch the invalid transfer error', pattern: /\btry\s*:[\s\S]*\bexcept\s+ValueError(?:\s+as\s+\w+)?\s*:/, ignoreStrings: true },
    ],
    expectedOutput: 'Transfer: $75\nError: Amount must be positive',
  },
  {
    id: 'python-transaction-totals', kind: 'python', title: 'Total transactions by category', difficulty: 'Stretch',
    summary: 'Aggregate records into category totals with a dictionary.',
    concepts: ['dictionaries', 'aggregation', 'loops'],
    instructions: ['Create transactions for Food 12, Travel 5, and Food 8.', 'Accumulate each amount into a `totals` dictionary by category.', 'Print `Food: 20` and `Travel: 5` on separate lines.'],
    hints: ['Start with `totals = {}`.', 'Inside the loop, use `totals.get(transaction["category"], 0)` before adding the amount.'],
    project: { title: 'Practice · Python Transaction Totals', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'transactions = [\n    {"category": "Food", "amount": 12},\n    {"category": "Travel", "amount": 5},\n    {"category": "Food", "amount": 8},\n]\n\n# Build totals from transactions.\nprint("Food: 0")\nprint("Travel: 0")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Create a totals dictionary', pattern: /^\s*totals\s*=\s*\{\s*\}\s*$/m, ignoreStrings: true },
      { filePath: 'main.py', label: 'Loop over transactions', pattern: /\bfor\s+transaction\s+in\s+transactions\s*:/, ignoreStrings: true },
      { filePath: 'main.py', label: 'Add each amount to its category', pattern: /\btotals\s*\[\s*transaction\s*\[\s*["']category["']\s*\]\s*\]\s*=\s*totals\.get\s*\(\s*transaction\s*\[\s*["']category["']\s*\]\s*,\s*0\s*\)\s*\+\s*transaction\s*\[\s*["']amount["']\s*\]/ },
    ],
    expectedOutput: 'Food: 20\nTravel: 5',
  },
  {
    id: 'python-sort-requests', kind: 'python', title: 'Rank a service queue', difficulty: 'Stretch',
    summary: 'Sort structured requests so the highest priority appears first.',
    concepts: ['sorting', 'lists', 'lambda functions'],
    instructions: ['Create requests for Card question (1), Password reset (3), and Address update (2).', 'Sort the requests from highest priority to lowest.', 'Print their names joined with ` > `.'],
    hints: ['Use `sorted(requests, key=lambda request: request["priority"], reverse=True)`.', 'Use a comprehension to select each name before `join`.'],
    project: { title: 'Practice · Python Service Queue', entryPath: 'main.py', files: [{ path: 'main.py', language: 'python', content: 'requests = [\n    {"name": "Card question", "priority": 1},\n    {"name": "Password reset", "priority": 3},\n    {"name": "Address update", "priority": 2},\n]\n\n# Sort and print the queue.\nprint("Card question")\n' }] },
    checks: [
      { filePath: 'main.py', label: 'Sort requests by priority', pattern: /\bsorted\s*\(\s*requests\s*,\s*key\s*=\s*lambda\s+(\w+)\s*:\s*\1\s*\[\s*["']priority["']\s*\]\s*,\s*reverse\s*=\s*True\s*\)/ },
      { filePath: 'main.py', label: 'Read each request name', pattern: /\[\s*(\w+)\s*\[\s*["']name["']\s*\]\s+for\s+\1\s+in\s+\w+\s*\]/ },
      { filePath: 'main.py', label: 'Join the ranked names', pattern: /["']\s*>\s*["']\.join\s*\(/ },
    ],
    expectedOutput: 'Password reset > Address update > Card question',
  },

  {
    id: 'java-ticket-class', kind: 'java', title: 'Model a support ticket', difficulty: 'Stretch',
    summary: 'Bundle typed support-ticket data and behavior into a reusable class.',
    concepts: ['classes', 'constructors', 'fields'],
    instructions: ['Create a `SupportTicket` class with `String customer` and `String priority` fields.', 'Add a constructor that stores both values and a `String summary()` method that returns `<customer> | <priority>`.', 'Create a ticket for "Mia" and "high", then print its summary.'],
    hints: ['Assign fields with `this.customer = customer;`.', 'Create an object with `new SupportTicket("Mia", "high")`.'],
    project: { title: 'Practice · Java Support Ticket', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    // Create and print a SupportTicket.\n    System.out.println("Mia");\n  }\n}\n\n// Define SupportTicket here.\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Define the SupportTicket class and typed fields', pattern: /\bclass\s+SupportTicket\b[\s\S]*\bString\s+customer\s*;[\s\S]*\bString\s+priority\s*;/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Initialize customer and priority', pattern: /\bSupportTicket\s*\(\s*String\s+customer\s*,\s*String\s+priority\s*\)\s*\{[\s\S]*this\.customer\s*=\s*customer\s*;[\s\S]*this\.priority\s*=\s*priority\s*;/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Define summary', pattern: /\bString\s+summary\s*\(\s*\)\s*\{/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Create a ticket and call summary', pattern: /\bnew\s+SupportTicket\s*\([\s\S]*\.summary\s*\(/, ignoreStrings: true },
    ],
    expectedOutput: 'Mia | high',
  },
  {
    id: 'java-transfer-errors', kind: 'java', title: 'Handle an invalid transfer', difficulty: 'Stretch',
    summary: 'Throw and catch a useful exception when a transfer amount is invalid.',
    concepts: ['exceptions', 'methods', 'validation'],
    instructions: ['Define `static String transferStatus(int amount)`.', 'Throw `IllegalArgumentException` with "Amount must be positive" when amount is zero or less, and otherwise return `Transfer: $<amount>`.', 'Print the result for 75, then catch an invalid -1 transfer and print `Error: <message>`.'],
    hints: ['Use `throw new IllegalArgumentException("...");` inside an `if`.', 'Wrap the invalid call in `try` / `catch (IllegalArgumentException error)`.'],
    project: { title: 'Practice · Java Transfer Validation', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'public class Main {\n  public static void main(String[] args) {\n    // Print a valid transfer, then handle an invalid one.\n    System.out.println("Transfer: $75");\n  }\n\n  // Define transferStatus here.\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Define transferStatus with validation', pattern: /\bstatic\s+String\s+transferStatus\s*\(\s*int\s+amount\s*\)\s*\{[\s\S]*\bthrow\s+new\s+IllegalArgumentException\s*\(/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Check for a non-positive amount', pattern: /\bamount\s*<=\s*0\b/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Catch the invalid transfer exception', pattern: /\btry\s*\{[\s\S]*\bcatch\s*\(\s*IllegalArgumentException\s+\w+\s*\)/, ignoreStrings: true },
    ],
    expectedOutput: 'Transfer: $75\nError: Amount must be positive',
  },
  {
    id: 'java-transaction-totals', kind: 'java', title: 'Total transactions by category', difficulty: 'Stretch',
    summary: 'Aggregate typed transaction data into category totals with a map.',
    concepts: ['maps', 'aggregation', 'loops'],
    instructions: ['Use parallel category and amount arrays for Food 12, Travel 5, and Food 8.', 'Accumulate each amount into a `Map<String, Integer> totals` with `getOrDefault`.', 'Print `Food: 20` and `Travel: 5` on separate lines.'],
    hints: ['Create `totals` with `new LinkedHashMap<>()`.', 'Inside an index loop, call `totals.put(category, totals.getOrDefault(category, 0) + amount)`.'],
    project: { title: 'Practice · Java Transaction Totals', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'import java.util.LinkedHashMap;\nimport java.util.Map;\n\npublic class Main {\n  public static void main(String[] args) {\n    String[] categories = {"Food", "Travel", "Food"};\n    int[] amounts = {12, 5, 8};\n\n    // Build totals from the arrays.\n    System.out.println("Food: 0");\n    System.out.println("Travel: 0");\n  }\n}\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Create the typed totals map', pattern: /\bMap\s*<\s*String\s*,\s*Integer\s*>\s+totals\s*=\s*new\s+LinkedHashMap\s*<\s*>\s*\(\s*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Loop over the transaction arrays', pattern: /\bfor\s*\(\s*int\s+\w+\s*=\s*0\s*;[\s\S]*categories\.length[\s\S]*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Accumulate with put and getOrDefault', pattern: /\btotals\.put\s*\([\s\S]*\btotals\.getOrDefault\s*\([\s\S]*\+\s*amounts\s*\[/, ignoreStrings: true },
    ],
    expectedOutput: 'Food: 20\nTravel: 5',
  },
  {
    id: 'java-sort-requests', kind: 'java', title: 'Rank a service queue', difficulty: 'Stretch',
    summary: 'Implement a comparison rule so typed requests sort by priority.',
    concepts: ['Comparable', 'collections', 'sorting'],
    instructions: ['Create `ServiceRequest` objects for Card question (1), Password reset (3), and Address update (2).', 'Implement `Comparable<ServiceRequest>` so higher priorities sort first, then call `Collections.sort`.', 'Print the names joined with ` > `.'],
    hints: ['Implement `int compareTo(ServiceRequest other)`.', 'Return `Integer.compare(other.priority, this.priority)` for descending order.'],
    project: { title: 'Practice · Java Service Queue', entryPath: 'Main.java', files: [{ path: 'Main.java', language: 'java', content: 'import java.util.ArrayList;\nimport java.util.Collections;\nimport java.util.List;\n\npublic class Main {\n  public static void main(String[] args) {\n    List<ServiceRequest> requests = new ArrayList<>();\n    requests.add(new ServiceRequest("Card question", 1));\n    requests.add(new ServiceRequest("Password reset", 3));\n    requests.add(new ServiceRequest("Address update", 2));\n\n    // Sort and print the queue.\n    System.out.println("Card question");\n  }\n}\n\n// Define ServiceRequest here.\n' }] },
    checks: [
      { filePath: 'Main.java', label: 'Make ServiceRequest comparable', pattern: /\bclass\s+ServiceRequest\s+implements\s+Comparable\s*<\s*ServiceRequest\s*>/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Compare requests by descending priority', pattern: /\bint\s+compareTo\s*\(\s*ServiceRequest\s+other\s*\)\s*\{[\s\S]*Integer\.compare\s*\(\s*other\.priority\s*,\s*this\.priority\s*\)/, ignoreStrings: true },
      { filePath: 'Main.java', label: 'Sort the request collection', pattern: /\bCollections\.sort\s*\(\s*requests\s*\)/, ignoreStrings: true },
    ],
    expectedOutput: 'Password reset > Address update > Card question',
  },

  {
    id: 'web-accessible-dialog', kind: 'web', title: 'Build an accessible dialog', difficulty: 'Stretch',
    summary: 'Connect native dialog behavior with an accessible heading and close action.',
    concepts: ['dialog', 'ARIA', 'DOM events'],
    instructions: ['Add `#help-dialog` and label it with a visible heading through `aria-labelledby`.', 'Add an open button and a close button inside a `form method="dialog"`.', 'Use JavaScript to call `showModal()` when the open button is clicked.'],
    hints: ['Give the heading an id such as `help-title`.', 'Select the dialog and button, then add a click listener.'],
    project: { title: 'Practice · Accessible Dialog', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Help center</title></head>\n<body><main><h1>Help center</h1><!-- Add the open button and dialog. --></main><script src="script.js"></script></body>\n</html>\n' },
      { path: 'script.js', language: 'javascript', content: '// Open the dialog from its button.\n' },
    ] },
    checks: [
      { filePath: 'index.html', label: 'Label the dialog with a visible heading', domCheck: (document) => {
        const dialog = document.querySelector('dialog#help-dialog[aria-labelledby]')
        const labelId = dialog?.getAttribute('aria-labelledby')?.trim()
        const heading = labelId ? document.getElementById(labelId) : null
        return Boolean(dialog && heading && /^H[1-6]$/.test(heading.tagName) && visibleText(heading))
      } },
      { filePath: 'index.html', label: 'Add open and close controls', domCheck: (document) => Boolean(
        document.querySelector('button#open-help')
        && document.querySelector('dialog#help-dialog form[method="dialog"] button'),
      ) },
      { filePath: 'script.js', label: 'Select the dialog and open control', pattern: /\b(?:const|let)\s+openButton\s*=\s*document\.querySelector\s*\(\s*["']#open-help["']\s*\)[\s\S]*\b(?:const|let)\s+dialog\s*=\s*document\.querySelector\s*\(\s*["']#help-dialog["']\s*\)/ },
      { filePath: 'script.js', label: 'Open the dialog from its click handler', pattern: /\bdialog\.showModal\s*\(\s*\)/, scope: OPEN_HELP_HANDLER, ignoreStrings: true },
    ],
  },
  {
    id: 'web-validated-form', kind: 'web', title: 'Explain a form error', difficulty: 'Stretch',
    summary: 'Pair browser validation with a clear, announced error message.',
    concepts: ['forms', 'validation', 'accessibility'],
    instructions: ['Add a `novalidate` form with a labeled, required email input described by `#email-error` and a `#join-updates` button.', 'Make the error element a live status message.', 'When Join is clicked, prevent the invalid action and write "Enter a valid email" into the error element.'],
    hints: ['`novalidate` lets your code provide the custom feedback.', 'Listen for the button’s `click`, then use `form.checkValidity()` before continuing.'],
    project: { title: 'Practice · Validated Email Form', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Updates</title></head>\n<body><main><h1>Get updates</h1><!-- Build the email form. --></main><script src="script.js"></script></body>\n</html>\n' },
      { path: 'script.js', language: 'javascript', content: '// Explain invalid form submissions.\n' },
    ] },
    checks: [
      { filePath: 'index.html', label: 'Add a labeled required email input', domCheck: (document) => {
        const form = document.querySelector('form[novalidate]')
        const input = form?.querySelector('input#email[type="email"][required][aria-describedby~="email-error"]')
        const label = form?.querySelector('label[for="email"]')
        return Boolean(form && input && visibleText(label ?? null) && form.querySelector('button#join-updates'))
      } },
      { filePath: 'index.html', label: 'Add a live email error message', domCheck: (document) => Boolean(document.querySelector('#email-error[role="status"]')) },
      { filePath: 'script.js', label: 'Select the form, Join button, and error message', pattern: /\b(?:const|let)\s+form\s*=\s*document\.querySelector\s*\(\s*["']form["']\s*\)[\s\S]*\b(?:const|let)\s+submitButton\s*=\s*document\.querySelector\s*\(\s*["']#join-updates["']\s*\)[\s\S]*\b(?:const|let)\s+error\s*=\s*document\.querySelector\s*\(\s*["']#email-error["']\s*\)/ },
      { filePath: 'script.js', label: 'Handle and explain an invalid Join action', pattern: /!\s*form\.checkValidity\s*\(\s*\)[\s\S]*\.preventDefault\s*\([\s\S]*\berror\.textContent\s*=\s*["']Enter a valid email["']/, scope: SUBMIT_EMAIL_HANDLER },
    ],
  },
  {
    id: 'web-theme-toggle', kind: 'web', title: 'Create a theme toggle', difficulty: 'Stretch',
    summary: 'Keep a visual theme and the toggle’s accessible state synchronized.',
    concepts: ['DOM state', 'ARIA', 'CSS classes'],
    instructions: ['Add `#theme-toggle` with `aria-pressed="false"`.', 'On click, toggle the `dark-theme` class on `document.body`.', 'Update `aria-pressed` to match whether the class is active.'],
    hints: ['`classList.toggle` returns the new on/off state.', 'Pass `String(isDark)` to `setAttribute`.'],
    project: { title: 'Practice · Theme Toggle', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="style.css" /><title>Theme</title></head>\n<body><main><h1>Reading room</h1><!-- Add the theme toggle. --></main><script src="script.js"></script></body>\n</html>\n' },
      { path: 'style.css', language: 'css', content: 'body { background: white; color: #172026; }\n.dark-theme { background: #172026; color: white; }\n' },
      { path: 'script.js', language: 'javascript', content: '// Toggle the theme and accessible state.\n' },
    ] },
    checks: [
      { filePath: 'index.html', label: 'Add a visible theme toggle button', domCheck: (document) => {
        const button = document.querySelector('button#theme-toggle[aria-pressed="false"]')
        return Boolean(button && visibleText(button))
      } },
      { filePath: 'script.js', label: 'Select the theme toggle', pattern: /\b(?:const|let)\s+toggle\s*=\s*document\.querySelector\s*\(\s*["']#theme-toggle["']\s*\)/ },
      { filePath: 'script.js', label: 'Toggle dark-theme from its click handler', pattern: /\bdocument\.body\.classList\.toggle\s*\(\s*["']dark-theme["']\s*\)/, scope: THEME_TOGGLE_HANDLER },
      { filePath: 'script.js', label: 'Synchronize aria-pressed in the handler', pattern: /\btoggle\.setAttribute\s*\(\s*["']aria-pressed["']\s*,\s*String\s*\(\s*\w+\s*\)\s*\)/, scope: THEME_TOGGLE_HANDLER },
    ],
  },
  {
    id: 'web-dynamic-task-list', kind: 'web', title: 'Add items to a task list', difficulty: 'Stretch',
    summary: 'Create safe DOM elements from user input and reset the form for the next item.',
    concepts: ['DOM creation', 'events', 'forms'],
    instructions: ['Add a labeled `#task-input`, `#add-task` button, and `#task-list` list.', 'On click, create an `li` whose `textContent` is the trimmed input value and append it to the list.', 'Clear the input after adding the item.'],
    hints: ['Create the item with `document.createElement("li")`.', 'Use `list.append(item)` and then set `input.value = ""`.'],
    project: { title: 'Practice · Dynamic Task List', entryPath: 'index.html', files: [
      { path: 'index.html', language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Tasks</title></head>\n<body><main><h1>Tasks</h1><!-- Add the task controls and list. --></main><script src="script.js"></script></body>\n</html>\n' },
      { path: 'script.js', language: 'javascript', content: '// Add task items from the input.\n' },
    ] },
    checks: [
      { filePath: 'index.html', label: 'Add labeled task controls and a list', domCheck: (document) => Boolean(
        visibleText(document.querySelector('label[for="task-input"]'))
        && document.querySelector('input#task-input')
        && document.querySelector('button#add-task')
        && document.querySelector('ul#task-list'),
      ) },
      { filePath: 'script.js', label: 'Select the task controls and list', pattern: /\b(?:const|let)\s+input\s*=\s*document\.querySelector\s*\(\s*["']#task-input["']\s*\)[\s\S]*\b(?:const|let)\s+button\s*=\s*document\.querySelector\s*\(\s*["']#add-task["']\s*\)[\s\S]*\b(?:const|let)\s+list\s*=\s*document\.querySelector\s*\(\s*["']#task-list["']\s*\)/ },
      { filePath: 'script.js', label: 'Create a safe item inside the click handler', pattern: /\bdocument\.createElement\s*\(\s*["']li["']\s*\)[\s\S]*\bitem\.textContent\s*=\s*input\.value\.trim\s*\(\s*\)/, scope: ADD_TASK_HANDLER },
      { filePath: 'script.js', label: 'Append the item and clear input in the handler', pattern: /\blist\.append\s*\(\s*item\s*\)[\s\S]*\binput\.value\s*=\s*["']["']/, scope: ADD_TASK_HANDLER },
    ],
  },
]
