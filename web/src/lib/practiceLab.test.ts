import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_KINDS } from './codeRunner'
import { evaluatePracticeChallenge, nextIncompletePracticeChallenge, practiceChallengeById, practiceChallengesFor } from './practiceLab'
import { ADDITIONAL_STARTER_CHALLENGES } from './practiceChallenges/starter'
import { ADDITIONAL_BUILDER_CHALLENGES } from './practiceChallenges/builder'
import { ADDITIONAL_STRETCH_CHALLENGES } from './practiceChallenges/stretch'
import { eventHandlerBody } from './practiceChallenges/javascript'
import {
  completePracticeChallenge,
  completedPracticeChallengeIds,
  linkPracticeProject,
  pendingPracticeCheckMatches,
  practiceChallengeIdForProject,
  preservePracticeConflictLinks,
  resetPracticeProgressCache,
  remapPendingPracticeCheck,
  replacePracticeProjectId,
} from './practiceProgress'

afterEach(() => vi.restoreAllMocks())

describe('practice challenge catalog', () => {
  it('offers five exercises at every difficulty for every supported project kind', () => {
    PROJECT_KINDS.forEach((kind) => {
      const challenges = practiceChallengesFor(kind)
      expect(challenges).toHaveLength(15)
      expect(challenges.map((challenge) => challenge.difficulty)).toEqual([
        'Starter', 'Starter', 'Starter', 'Starter', 'Starter',
        'Builder', 'Builder', 'Builder', 'Builder', 'Builder',
        'Stretch', 'Stretch', 'Stretch', 'Stretch', 'Stretch',
      ])
      challenges.forEach((challenge) => {
        expect(challenge.project.files.some((file) => file.path === challenge.project.entryPath)).toBe(true)
        expect(challenge.instructions.length).toBeGreaterThanOrEqual(2)
        expect(challenge.hints.length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  it('recommends the next unfinished challenge in the same language', () => {
    const first = practiceChallengeById('java-variables-greeting')!
    const second = practiceChallengeById('java-arithmetic-total')!
    const third = practiceChallengeById('java-conditional-access')!
    const last = practiceChallengeById('java-sort-requests')!
    const everyJavaChallenge = practiceChallengesFor('java').map((challenge) => challenge.id)

    expect(nextIncompletePracticeChallenge(first, [first.id])).toBe(second)
    expect(nextIncompletePracticeChallenge(first, [first.id, second.id])).toBe(third)
    expect(nextIncompletePracticeChallenge(last, [last.id])).toBe(first)
    expect(nextIncompletePracticeChallenge(last, everyJavaChallenge)).toBeNull()
  })

  it('gives every additional Starter an unfinished scaffold and a valid reference solution', () => {
    const runtimeSolutions: Record<string, string> = {
      'ruby-arithmetic-total': 'price = 6\nquantity = 3\ntotal = price * quantity\nputs "Total: #{total}"\n',
      'ruby-conditional-access': 'age = 18\nif age >= 18\n  puts "Access granted"\nelse\n  puts "Ask an adult"\nend\n',
      'ruby-array-stops': 'stops = ["Hagåtña", "Tamuning", "Dededo"]\nputs "First stop: #{stops.first}"\nputs "Total stops: #{stops.length}"\n',
      'ruby-method-welcome': 'def welcome(name)\n  "Welcome, #{name}!"\nend\nputs welcome("Mia")\n',
      'javascript-arithmetic-total': 'const price = 6\nconst quantity = 3\nconst total = price * quantity\nconsole.log(`Total: ${total}`)\n',
      'javascript-conditional-access': 'const age = 18\nif (age >= 18) {\n  console.log("Access granted")\n} else {\n  console.log("Ask an adult")\n}\n',
      'javascript-array-stops': 'const stops = ["Hagåtña", "Tamuning", "Dededo"]\nconsole.log(`First stop: ${stops[0]}`)\nconsole.log(`Total stops: ${stops.length}`)\n',
      'javascript-function-welcome': 'function welcome(name) {\n  return `Welcome, ${name}!`\n}\nconsole.log(welcome("Mia"))\n',
      'python-arithmetic-total': 'price = 6\nquantity = 3\ntotal = price * quantity\nprint(f"Total: {total}")\n',
      'python-conditional-access': 'age = 18\nif age >= 18:\n    print("Access granted")\nelse:\n    print("Ask an adult")\n',
      'python-list-stops': 'stops = ["Hagåtña", "Tamuning", "Dededo"]\nprint(f"First stop: {stops[0]}")\nprint(f"Total stops: {len(stops)}")\n',
      'python-function-welcome': 'def welcome(name):\n    return f"Welcome, {name}!"\nprint(welcome("Mia"))\n',
      'java-arithmetic-total': 'class Main { public static void main(String[] args) {\nint price = 6;\nint quantity = 3;\nint total = price * quantity;\nSystem.out.println("Total: " + total);\n} }\n',
      'java-conditional-access': 'class Main { public static void main(String[] args) {\nint age = 18;\nif (age >= 18) { System.out.println("Access granted"); } else { System.out.println("Ask an adult"); }\n} }\n',
      'java-array-stops': 'class Main { public static void main(String[] args) {\nString[] stops = {"Hagåtña", "Tamuning", "Dededo"};\nSystem.out.println("First stop: " + stops[0]);\nSystem.out.println("Total stops: " + stops.length);\n} }\n',
      'java-method-welcome': 'class Main {\nstatic String welcome(String name) { return "Welcome, " + name + "!"; }\npublic static void main(String[] args) { System.out.println(welcome("Mia")); }\n}\n',
    }
    const webSolutions: Record<string, Record<string, string>> = {
      'web-page-landmarks': { 'index.html': '<header><h1>Community board</h1></header><nav><a href="#events">Events</a></nav><main id="events">Events</main><footer>Guam</footer>' },
      'web-accessible-email': { 'index.html': '<form><label for="email">Email address</label><input id="email" name="email" type="email"></form>' },
      'web-style-action': { 'style.css': '.action { background: #176b78; padding: 0.75rem 1rem; color: white; }' },
      'web-responsive-image': { 'style.css': '.hero-image { max-width: 100%; height: auto; }' },
    }

    expect(ADDITIONAL_STARTER_CHALLENGES).toHaveLength(20)
    ADDITIONAL_STARTER_CHALLENGES.forEach((challenge) => {
      const unfinished = evaluatePracticeChallenge(challenge, challenge.project.files, challenge.expectedOutput ? {
        status: 'success', stdout: challenge.expectedOutput, stderr: '', durationMs: 1,
      } : undefined)
      expect(unfinished.passed, `${challenge.id} should require learner work`).toBe(false)

      const source = runtimeSolutions[challenge.id]
      const files = source
        ? challenge.project.files.map((file) => file.path === challenge.project.entryPath ? { ...file, content: source } : file)
        : challenge.project.files.map((file) => ({ ...file, content: webSolutions[challenge.id]?.[file.path] ?? file.content }))
      const result = evaluatePracticeChallenge(challenge, files, challenge.expectedOutput ? {
        status: 'success', stdout: challenge.expectedOutput, stderr: '', durationMs: 1,
      } : undefined)
      expect(result.passed, `${challenge.id} should accept its reference solution: ${JSON.stringify(result.checks)}`).toBe(true)
    })
  })

  it('gives every additional Builder an unfinished scaffold and a valid reference solution', () => {
    const runtimeSolutions: Record<string, string> = {
      'ruby-filter-scores': 'scores = [88, 72, 95, 61]\npassing = scores.select { |score| score >= 80 }\nputs "Passing: #{passing.join(", ")}"\n',
      'ruby-count-priorities': 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\npriorities.each do |priority|\n  if priority == "high"\n    high_count += 1\n  end\nend\nputs "High priority: #{high_count}"\n',
      'ruby-hash-district': 'districts = { "H" => "Hagåtña", "T" => "Tamuning", "D" => "Dededo" }\nputs "District T: #{districts["T"]}"\n',
      'ruby-format-roster': 'def format_name(name)\n  name.upcase\nend\nnames = ["Ana", "Ben"]\nformatted = names.map { |name| format_name(name) }\nputs "Roster: #{formatted.join(", ")}"\n',
      'javascript-filter-scores': 'const scores = [88, 72, 95, 61]\nconst passing = scores.filter((score) => score >= 80)\nconsole.log(`Passing: ${passing.join(", ")}`)\n',
      'javascript-count-priorities': 'const priorities = ["high", "low", "high", "medium"]\nlet highCount = 0\nfor (const priority of priorities) {\n  if (priority === "high") highCount++\n}\nconsole.log(`High priority: ${highCount}`)\n',
      'javascript-object-district': 'const districts = { H: "Hagåtña", T: "Tamuning", D: "Dededo" }\nconsole.log(`District T: ${districts.T}`)\n',
      'javascript-format-roster': 'function formatName(name) {\n  return name.toUpperCase()\n}\nconst names = ["Ana", "Ben"]\nconst formatted = names.map(formatName)\nconsole.log(`Roster: ${formatted.join(", ")}`)\n',
      'python-filter-scores': 'scores = [88, 72, 95, 61]\npassing = [score for score in scores if score >= 80]\nprint(f"Passing: {\', \'.join(str(score) for score in passing)}")\n',
      'python-count-priorities': 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\nfor priority in priorities:\n    if priority == "high":\n        high_count += 1\nprint(f"High priority: {high_count}")\n',
      'python-dict-district': 'districts = { "H": "Hagåtña", "T": "Tamuning", "D": "Dededo" }\nprint(f"District T: {districts[\'T\']}")\n',
      'python-format-roster': 'def format_name(name):\n    return name.upper()\nnames = ["Ana", "Ben"]\nformatted = [format_name(name) for name in names]\nprint(f"Roster: {\', \'.join(formatted)}")\n',
      'java-filter-scores': 'import java.util.ArrayList;\nimport java.util.List;\nclass Main { public static void main(String[] args) {\nint[] scores = {88, 72, 95, 61};\nList<Integer> passing = new ArrayList<>();\nfor (int score : scores) { if (score >= 80) passing.add(score); }\nSystem.out.println("Passing: " + passing);\n} }\n',
      'java-count-priorities': 'class Main { public static void main(String[] args) {\nString[] priorities = {"high", "low", "high", "medium"};\nint highCount = 0;\nfor (String priority : priorities) { if ("high".equals(priority)) highCount++; }\nSystem.out.println("High priority: " + highCount);\n} }\n',
      'java-map-district': 'import java.util.HashMap;\nimport java.util.Map;\nclass Main { public static void main(String[] args) {\nMap<String, String> districts = new HashMap<>();\ndistricts.put("H", "Hagåtña");\ndistricts.put("T", "Tamuning");\ndistricts.put("D", "Dededo");\nSystem.out.println("District T: " + districts.get("T"));\n} }\n',
      'java-format-roster': 'class Main {\nstatic String formatName(String name) { return name.toUpperCase(); }\npublic static void main(String[] args) {\nString[] names = {"Ana", "Ben"};\nSystem.out.println("Roster: " + formatName(names[0]) + ", " + formatName(names[1]));\n}\n}\n',
    }
    const webSolutions: Record<string, Record<string, string>> = {
      'web-group-contact-options': { 'index.html': '<main><form><fieldset><legend>Preferred contact</legend><input id="email" type="radio" name="contact"><label for="email">Email</label><input id="phone" type="radio" name="contact"><label for="phone">Phone</label></fieldset></form></main>' },
      'web-flexible-navigation': { 'style.css': '.site-nav { display: flex; flex-wrap: wrap; gap: 0.75rem; }' },
      'web-native-disclosure': { 'index.html': '<main><details><summary>What should I bring?</summary><p>Bring water and sun protection.</p></details></main>' },
      'web-responsive-breakpoint': { 'style.css': '.card-grid { display: grid; grid-template-columns: 1fr; } @media (min-width: 40rem) { .card-grid { grid-template-columns: repeat(2, 1fr); } }' },
    }

    expect(ADDITIONAL_BUILDER_CHALLENGES).toHaveLength(20)
    ADDITIONAL_BUILDER_CHALLENGES.forEach((challenge) => {
      const unfinished = evaluatePracticeChallenge(challenge, challenge.project.files, challenge.expectedOutput ? {
        status: 'success', stdout: challenge.expectedOutput, stderr: '', durationMs: 1,
      } : undefined)
      expect(unfinished.passed, `${challenge.id} should require learner work`).toBe(false)

      const source = runtimeSolutions[challenge.id]
      const files = source
        ? challenge.project.files.map((file) => file.path === challenge.project.entryPath ? { ...file, content: source } : file)
        : challenge.project.files.map((file) => ({ ...file, content: webSolutions[challenge.id]?.[file.path] ?? file.content }))
      const result = evaluatePracticeChallenge(challenge, files, challenge.expectedOutput ? {
        status: 'success', stdout: challenge.expectedOutput, stderr: '', durationMs: 1,
      } : undefined)
      expect(result.passed, `${challenge.id} should accept its reference solution: ${JSON.stringify(result.checks)}`).toBe(true)
    })
  })

  it('gives every additional Stretch an unfinished scaffold and a valid reference solution', () => {
    const runtimeSolutions: Record<string, string> = {
      'ruby-ticket-class': 'class SupportTicket\n  def initialize(customer, priority)\n    @customer = customer\n    @priority = priority\n  end\n  def summary\n    "#{@customer} | #{@priority}"\n  end\nend\nticket = SupportTicket.new("Mia", "high")\nputs ticket.summary\n',
      'ruby-transfer-errors': 'def transfer_status(amount)\n  raise ArgumentError, "Amount must be positive" if amount <= 0\n  "Transfer: $#{amount}"\nend\nputs transfer_status(75)\nbegin\n  transfer_status(-1)\nrescue ArgumentError => error\n  puts "Error: #{error.message}"\nend\n',
      'ruby-transaction-totals': 'transactions = [{ category: "Food", amount: 12 }, { category: "Travel", amount: 5 }, { category: "Food", amount: 8 }]\ntotals = Hash.new(0)\ntransactions.each do |transaction|\n  totals[transaction[:category]] += transaction[:amount]\nend\nputs "Food: #{totals["Food"]}"\nputs "Travel: #{totals["Travel"]}"\n',
      'ruby-sort-requests': 'requests = [{ name: "Card question", priority: 1 }, { name: "Password reset", priority: 3 }, { name: "Address update", priority: 2 }]\nranked = requests.sort_by { |request| -request[:priority] }\nputs ranked.map { |request| request[:name] }.join(" > ")\n',
      'javascript-ticket-class': 'class SupportTicket {\n  constructor(customer, priority) { this.customer = customer; this.priority = priority }\n  summary() { return `${this.customer} | ${this.priority}` }\n}\nconst ticket = new SupportTicket("Mia", "high")\nconsole.log(ticket.summary())\n',
      'javascript-transfer-errors': 'function transferStatus(amount) {\n  if (amount <= 0) throw new Error("Amount must be positive")\n  return `Transfer: $${amount}`\n}\nconsole.log(transferStatus(75))\ntry { transferStatus(-1) } catch (error) { console.log(`Error: ${error.message}`) }\n',
      'javascript-transaction-totals': 'const transactions = [{ category: "Food", amount: 12 }, { category: "Travel", amount: 5 }, { category: "Food", amount: 8 }]\nconst totals = {}\nfor (const transaction of transactions) { totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount }\nconsole.log(`Food: ${totals.Food}`)\nconsole.log(`Travel: ${totals.Travel}`)\n',
      'javascript-sort-requests': 'const requests = [{ name: "Card question", priority: 1 }, { name: "Password reset", priority: 3 }, { name: "Address update", priority: 2 }]\nconst ranked = requests.sort((a, b) => b.priority - a.priority)\nconsole.log(ranked.map((request) => request.name).join(" > "))\n',
      'python-ticket-class': 'class SupportTicket:\n    def __init__(self, customer, priority):\n        self.customer = customer\n        self.priority = priority\n    def summary(self):\n        return f"{self.customer} | {self.priority}"\nticket = SupportTicket("Mia", "high")\nprint(ticket.summary())\n',
      'python-transfer-errors': 'def transfer_status(amount):\n    if amount <= 0:\n        raise ValueError("Amount must be positive")\n    return f"Transfer: ${amount}"\nprint(transfer_status(75))\ntry:\n    transfer_status(-1)\nexcept ValueError as error:\n    print(f"Error: {error}")\n',
      'python-transaction-totals': 'transactions = [{"category": "Food", "amount": 12}, {"category": "Travel", "amount": 5}, {"category": "Food", "amount": 8}]\ntotals = {}\nfor transaction in transactions:\n    totals[transaction["category"]] = totals.get(transaction["category"], 0) + transaction["amount"]\nprint(f"Food: {totals[\'Food\']}")\nprint(f"Travel: {totals[\'Travel\']}")\n',
      'python-sort-requests': 'requests = [{"name": "Card question", "priority": 1}, {"name": "Password reset", "priority": 3}, {"name": "Address update", "priority": 2}]\nranked = sorted(requests, key=lambda request: request["priority"], reverse=True)\nprint(" > ".join([request["name"] for request in ranked]))\n',
      'java-ticket-class': 'public class Main { public static void main(String[] args) { SupportTicket ticket = new SupportTicket("Mia", "high"); System.out.println(ticket.summary()); } }\nclass SupportTicket { String customer; String priority; SupportTicket(String customer, String priority) { this.customer = customer; this.priority = priority; } String summary() { return customer + " | " + priority; } }\n',
      'java-transfer-errors': 'public class Main {\nstatic String transferStatus(int amount) { if (amount <= 0) throw new IllegalArgumentException("Amount must be positive"); return "Transfer: $" + amount; }\npublic static void main(String[] args) { System.out.println(transferStatus(75)); try { transferStatus(-1); } catch (IllegalArgumentException error) { System.out.println("Error: " + error.getMessage()); } }\n}\n',
      'java-transaction-totals': 'import java.util.LinkedHashMap; import java.util.Map;\npublic class Main { public static void main(String[] args) { String[] categories = {"Food", "Travel", "Food"}; int[] amounts = {12, 5, 8}; Map<String, Integer> totals = new LinkedHashMap<>(); for (int index = 0; index < categories.length; index++) { totals.put(categories[index], totals.getOrDefault(categories[index], 0) + amounts[index]); } System.out.println("Food: " + totals.get("Food")); System.out.println("Travel: " + totals.get("Travel")); } }\n',
      'java-sort-requests': 'import java.util.ArrayList; import java.util.Collections; import java.util.List;\npublic class Main { public static void main(String[] args) { List<ServiceRequest> requests = new ArrayList<>(); requests.add(new ServiceRequest("Card question", 1)); requests.add(new ServiceRequest("Password reset", 3)); requests.add(new ServiceRequest("Address update", 2)); Collections.sort(requests); System.out.println(requests.get(0).name + " > " + requests.get(1).name + " > " + requests.get(2).name); } }\nclass ServiceRequest implements Comparable<ServiceRequest> { String name; int priority; ServiceRequest(String name, int priority) { this.name = name; this.priority = priority; } public int compareTo(ServiceRequest other) { return Integer.compare(other.priority, this.priority); } }\n',
    }
    const webSolutions: Record<string, Record<string, string>> = {
      'web-accessible-dialog': {
        'index.html': '<main><h1>Help center</h1><button id="open-help">Open help</button><dialog id="help-dialog" aria-labelledby="help-title"><h2 id="help-title">Quick help</h2><form method="dialog"><button>Close</button></form></dialog></main>',
        'script.js': 'const openButton = document.querySelector("#open-help")\nconst dialog = document.querySelector("#help-dialog")\nopenButton.addEventListener("click", () => { dialog.showModal() })',
      },
      'web-validated-form': {
        'index.html': '<main><form novalidate><label for="email">Email</label><input id="email" type="email" required aria-describedby="email-error"><p id="email-error" role="status"></p><button id="join-updates">Join</button></form></main>',
        'script.js': 'const form = document.querySelector("form")\nconst submitButton = document.querySelector("#join-updates")\nconst error = document.querySelector("#email-error")\nsubmitButton.addEventListener("click", (event) => { if (!form.checkValidity()) { event.preventDefault(); error.textContent = "Enter a valid email" } })',
      },
      'web-theme-toggle': {
        'index.html': '<main><button id="theme-toggle" aria-pressed="false">Dark theme</button></main>',
        'script.js': 'const toggle = document.querySelector("#theme-toggle")\ntoggle.addEventListener("click", () => { const isDark = document.body.classList.toggle("dark-theme"); toggle.setAttribute("aria-pressed", String(isDark)) })',
      },
      'web-dynamic-task-list': {
        'index.html': '<main><label for="task-input">Task</label><input id="task-input"><button id="add-task">Add task</button><ul id="task-list"></ul></main>',
        'script.js': 'const input = document.querySelector("#task-input")\nconst button = document.querySelector("#add-task")\nconst list = document.querySelector("#task-list")\nbutton.addEventListener("click", () => { const item = document.createElement("li"); item.textContent = input.value.trim(); list.append(item); input.value = "" })',
      },
    }

    expect(ADDITIONAL_STRETCH_CHALLENGES).toHaveLength(20)
    ADDITIONAL_STRETCH_CHALLENGES.forEach((challenge) => {
      const unfinished = evaluatePracticeChallenge(challenge, challenge.project.files, challenge.expectedOutput ? {
        status: 'success', stdout: challenge.expectedOutput, stderr: '', durationMs: 1,
      } : undefined)
      expect(unfinished.passed, `${challenge.id} should require learner work`).toBe(false)

      const source = runtimeSolutions[challenge.id]
      const files = source
        ? challenge.project.files.map((file) => file.path === challenge.project.entryPath ? { ...file, content: source } : file)
        : challenge.project.files.map((file) => ({ ...file, content: webSolutions[challenge.id]?.[file.path] ?? file.content }))
      const result = evaluatePracticeChallenge(challenge, files, challenge.expectedOutput ? {
        status: 'success', stdout: challenge.expectedOutput, stderr: '', durationMs: 1,
      } : undefined)
      expect(result.passed, `${challenge.id} should accept its reference solution: ${JSON.stringify(result.checks)}`).toBe(true)
    })
  })

  it('allows the custom invalid-email Join handler to announce its error', () => {
    document.body.innerHTML = '<form novalidate><label for="email">Email</label><input id="email" type="email" required aria-describedby="email-error"><p id="email-error" role="status"></p><button id="join-updates">Join</button></form>'
    const form = document.querySelector('form')!
    const submitButton = document.querySelector('#join-updates')!
    const error = document.querySelector('#email-error')!
    submitButton.addEventListener('click', (event) => {
      if (!form.checkValidity()) {
        event.preventDefault()
        error.textContent = 'Enter a valid email'
      }
    })

    const accepted = submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect((form as HTMLFormElement).noValidate).toBe(true)
    expect(accepted).toBe(false)
    expect(error.textContent).toBe('Enter a valid email')
  })

  it.each([
    {
      id: 'web-accessible-dialog',
      source: 'const openButton = document.querySelector("#open-help")\nconst dialog = document.querySelector("#help-dialog")\nopenButton.addEventListener("click", () => {})\ndialog.showModal()\n',
      labels: ['Open the dialog from its click handler'],
    },
    {
      id: 'web-validated-form',
      source: 'const form = document.querySelector("form")\nconst submitButton = document.querySelector("#join-updates")\nconst error = document.querySelector("#email-error")\nsubmitButton.addEventListener("click", () => {})\nif (!form.checkValidity()) { event.preventDefault(); error.textContent = "Enter a valid email" }\n',
      labels: ['Handle and explain an invalid Join action'],
    },
    {
      id: 'web-theme-toggle',
      source: 'const toggle = document.querySelector("#theme-toggle")\ntoggle.addEventListener("click", () => {})\nconst isDark = document.body.classList.toggle("dark-theme")\ntoggle.setAttribute("aria-pressed", String(isDark))\n',
      labels: ['Toggle dark-theme from its click handler', 'Synchronize aria-pressed in the handler'],
    },
    {
      id: 'web-dynamic-task-list',
      source: 'const input = document.querySelector("#task-input")\nconst button = document.querySelector("#add-task")\nconst list = document.querySelector("#task-list")\nbutton.addEventListener("click", () => {})\nconst item = document.createElement("li")\nitem.textContent = input.value.trim()\nlist.append(item)\ninput.value = ""\n',
      labels: ['Create a safe item inside the click handler', 'Append the item and clear input in the handler'],
    },
  ])('rejects disconnected interaction code for $id', ({ id, source, labels }) => {
    const challenge = practiceChallengeById(id)!
    const result = evaluatePracticeChallenge(challenge, [{ path: 'script.js', language: 'javascript', content: source }])

    labels.forEach((label) => expect(result.checks.find((check) => check.label === label)?.passed).toBe(false))
    expect(result.passed).toBe(false)
  })

  it('extracts every executable handler for a standalone receiver', () => {
    const clickBodies = eventHandlerBody('openButton', 'click')
    const source = '// openButton.addEventListener("click", () => { fake() })\n/* { openButton.addEventListener("click", () => { fake() }) } */\nother.\n  openButton.addEventListener("click", () => { wrong() })\nopenButton.addEventListener("click", () => { first() })\nopenButton.addEventListener("click", () => { second() })\n'

    expect(clickBodies(source)).toBe(' first() \n second() ')
  })

  it('resolves named handlers from the listener registration lexical scope', () => {
    const clickBodies = eventHandlerBody('openButton', 'click')
    const source = 'function handleOpen() {}\nopenButton.addEventListener("click", handleOpen)\nif (false) { function handleOpen() { dialog.showModal() } }\n'

    expect(clickBodies(source)).toBe('')
  })

  it('stops named-handler lookup at parameter and local-variable shadows', () => {
    const clickBodies = eventHandlerBody('openButton', 'click')
    const source = 'function handleOpen() { dialog.showModal() }\nfunction bindParameter(handleOpen) { openButton.addEventListener("click", handleOpen) }\nfunction bindLocal() { const handleOpen = null; openButton.addEventListener("click", handleOpen) }\n'

    expect(clickBodies(source)).toBe('')
  })

  it('hoists var callback shadows to the nearest function scope', () => {
    const clickBodies = eventHandlerBody('openButton', 'click')
    const source = 'function handleOpen() { dialog.showModal() }\nfunction bind() { if (false) { var handleOpen = null } openButton.addEventListener("click", handleOpen) }\n'

    expect(clickBodies(source)).toBe('')
  })

  it('keeps let callback shadows inside their for-loop scope', () => {
    const clickBodies = eventHandlerBody('openButton', 'click')
    const source = 'function handleOpen() { dialog.showModal() }\nfor (let handleOpen = null; false;) { openButton.addEventListener("click", handleOpen) }\nopenButton.addEventListener("click", handleOpen)\n'

    expect(clickBodies(source)).toContain('dialog.showModal()')
  })

  it('does not use later let or var callback initializers for earlier listeners', () => {
    const clickBodies = eventHandlerBody('openButton', 'click')
    const laterLet = 'openButton.addEventListener("click", handleOpen)\nlet handleOpen = () => { dialog.showModal() }\n'
    const laterVar = 'openButton.addEventListener("click", handleOpen)\nvar handleOpen = () => { dialog.showModal() }\n'

    expect(clickBodies(laterLet)).toBe('')
    expect(clickBodies(laterVar)).toBe('')
  })

  it('preserves function declaration hoisting for named listeners', () => {
    const clickBodies = eventHandlerBody('openButton', 'click')
    const source = 'openButton.addEventListener("click", handleOpen)\nfunction handleOpen() { dialog.showModal() }\n'

    expect(clickBodies(source)).toContain('dialog.showModal()')
  })

  it('keeps switch-case callback bindings inside the switch scope', () => {
    const clickBodies = eventHandlerBody('openButton', 'click')
    const source = 'function handleOpen() { dialog.showModal() }\nswitch (mode) { case "local": const handleOpen = () => { wrong() }; break }\nopenButton.addEventListener("click", handleOpen)\n'

    expect(clickBodies(source)).toContain('dialog.showModal()')
    expect(clickBodies(source)).not.toContain('wrong()')
  })

  it('accepts required theme operations split across two live click handlers', () => {
    const challenge = practiceChallengeById('web-theme-toggle')!
    const source = 'const toggle = document.querySelector("#theme-toggle")\ntoggle.addEventListener("click", () => { document.body.classList.toggle("dark-theme") })\ntoggle.addEventListener("click", () => { const isDark = true; toggle.setAttribute("aria-pressed", String(isDark)) })\n'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'script.js', language: 'javascript', content: source }])

    expect(result.checks.find((check) => check.label === 'Toggle dark-theme from its click handler')?.passed).toBe(true)
    expect(result.checks.find((check) => check.label === 'Synchronize aria-pressed in the handler')?.passed).toBe(true)
  })

  it('accepts district mappings in any order', () => {
    const challenge = practiceChallengeById('java-map-district')!
    const source = 'import java.util.*; class Main { public static void main(String[] args) { Map<String, String> districts = new HashMap<>(); districts.put("D", "Dededo"); districts.put("H", "Hagåtña"); districts.put("T", "Tamuning"); System.out.println("District T: " + districts.get("T")); } }'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'Main.java', language: 'java', content: source }], {
      status: 'success', stdout: 'District T: Tamuning', stderr: '', durationMs: 1,
    })

    expect(result.passed).toBe(true)
  })

  it.each([
    {
      id: 'ruby-array-stops',
      source: 'stops = ["Hagatna", "Tamuning", "Dededo"]\nputs "First stop: #{stops.first}"\nputs "Total stops: #{stops.length}"\n',
      stdout: 'First stop: Hagatna\nTotal stops: 3',
    },
    {
      id: 'javascript-array-stops',
      source: 'const stops = ["Hagatna", "Tamuning", "Dededo"]\nconsole.log(`First stop: ${stops[0]}`)\nconsole.log(`Total stops: ${stops.length}`)\n',
      stdout: 'First stop: Hagatna\nTotal stops: 3',
    },
    {
      id: 'python-list-stops',
      source: 'stops = ["Hagatna", "Tamuning", "Dededo"]\nprint(f"First stop: {stops[0]}")\nprint(f"Total stops: {len(stops)}")\n',
      stdout: 'First stop: Hagatna\nTotal stops: 3',
    },
    {
      id: 'java-array-stops',
      source: 'class Main { public static void main(String[] args) { String[] stops = {"Hagatna", "Tamuning", "Dededo"}; System.out.println("First stop: " + stops[0]); System.out.println("Total stops: " + stops.length); } }',
      stdout: 'First stop: Hagatna\nTotal stops: 3',
    },
    {
      id: 'ruby-hash-district',
      source: 'districts = { "H" => "Hagatna", "T" => "Tamuning", "D" => "Dededo" }\nputs "District T: #{districts["T"]}"\n',
      stdout: 'District T: Tamuning',
    },
    {
      id: 'javascript-object-district',
      source: 'const districts = { H: "Hagatna", T: "Tamuning", D: "Dededo" }\nconsole.log(`District T: ${districts.T}`)\n',
      stdout: 'District T: Tamuning',
    },
    {
      id: 'python-dict-district',
      source: 'districts = { "H": "Hagatna", "T": "Tamuning", "D": "Dededo" }\nprint(f"District T: {districts[\'T\']}")\n',
      stdout: 'District T: Tamuning',
    },
    {
      id: 'java-map-district',
      source: 'import java.util.*; class Main { public static void main(String[] args) { Map<String, String> districts = new HashMap<>(); districts.put("H", "Hagatna"); districts.put("T", "Tamuning"); districts.put("D", "Dededo"); System.out.println("District T: " + districts.get("T")); } }',
      stdout: 'District T: Tamuning',
    },
  ])('accepts plain-keyboard text in $id', ({ id, source, stdout }) => {
    const challenge = practiceChallengeById(id)!
    const files = challenge.project.files.map((file) => (
      file.path === challenge.project.entryPath ? { ...file, content: source } : file
    ))
    const result = evaluatePracticeChallenge(challenge, files, {
      status: 'success', stdout, stderr: '', durationMs: 1,
    })

    expect(result.passed, JSON.stringify(result.checks)).toBe(true)
  })

  it('still requires the requested code structure when learner text is normalized', () => {
    const challenge = practiceChallengeById('java-array-stops')!
    const source = 'class Main { public static void main(String[] args) { String first = "Hagatna"; System.out.println("First stop: " + first); System.out.println("Total stops: 3"); } }'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'Main.java', language: 'java', content: source }], {
      status: 'success', stdout: 'First stop: Hagatna\nTotal stops: 3', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label === 'Create the three-stop String array')?.passed).toBe(false)
    expect(result.checks.find((check) => check.label.startsWith('Output matches'))?.passed).toBe(true)
    expect(result.passed).toBe(false)
  })

  it('treats equivalent Unicode, spaces, and common keyboard punctuation as the same learner text', () => {
    const base = practiceChallengeById('ruby-variables-greeting')!
    const challenge = {
      ...base,
      checks: [],
      expectedOutput: 'Hagåtña says: “Ready”—now…',
    }
    const result = evaluatePracticeChallenge(challenge, [], {
      status: 'success',
      stdout: 'Haga\u030Atn\u0303a\u1680says: "Ready"-now...',
      stderr: '',
      durationMs: 1,
    })

    expect(result.passed).toBe(true)
  })

  it.each([
    ['different capitalization', 'access granted!'],
    ['missing meaningful punctuation', 'Access granted'],
    ['different wording', 'Access approved!'],
  ])('still rejects %s in learner output', (_description, stdout) => {
    const base = practiceChallengeById('ruby-variables-greeting')!
    const challenge = { ...base, checks: [], expectedOutput: 'Access granted!' }
    const result = evaluatePracticeChallenge(challenge, [], {
      status: 'success', stdout, stderr: '', durationMs: 1,
    })

    expect(result.passed).toBe(false)
  })

  it('does not fold compatibility characters into semantic values', () => {
    const base = practiceChallengeById('ruby-variables-greeting')!
    const challenge = { ...base, checks: [], expectedOutput: 'Stop 2' }
    const result = evaluatePracticeChallenge(challenge, [], {
      status: 'success', stdout: 'Stop ²', stderr: '', durationMs: 1,
    })

    expect(result.passed).toBe(false)
  })

  it('requires visible labels for grouped Web contact choices', () => {
    const challenge = practiceChallengeById('web-group-contact-options')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'index.html',
      language: 'html',
      content: '<fieldset><legend hidden>Preferred contact</legend><input id="email" type="radio" name="contact"><label hidden for="email">Email</label><input id="phone" type="radio" name="contact"><label hidden for="phone">Phone</label></fieldset>',
    }])

    expect(result.checks).toHaveLength(2)
    expect(result.checks).toEqual([
      { label: 'Add the Preferred contact group label', passed: false },
      { label: 'Add Email and Phone radio choices', passed: false },
    ])

    const nonRenderedText = evaluatePracticeChallenge(challenge, [{
      path: 'index.html',
      language: 'html',
      content: '<fieldset><legend><script>Preferred contact</script></legend><input id="email" type="radio" name="contact"><label for="email"><style>Email</style></label><input id="phone" type="radio" name="contact"><label for="phone"><template>Phone</template></label></fieldset>',
    }])
    expect(nonRenderedText.checks).toEqual([
      { label: 'Add the Preferred contact group label', passed: false },
      { label: 'Add Email and Phone radio choices', passed: false },
    ])
  })

  it('does not mistake roster formatter declarations for calls', () => {
    const declarationOnly: Record<string, string> = {
      'ruby-format-roster': 'def format_name(name)\n  name.upcase\nend\nputs "Roster: ANA, BEN"\n',
      'javascript-format-roster': 'function formatName(name) { return name.toUpperCase() }\nconsole.log("Roster: ANA, BEN")\n',
      'python-format-roster': 'def format_name(name):\n    return name.upper()\nprint("Roster: ANA, BEN")\n',
      'java-format-roster': 'class Main { public static String formatName(final String name) { return name.toUpperCase(); } public static void main(String[] args) { System.out.println("Roster: ANA, BEN"); } }',
    }

    Object.entries(declarationOnly).forEach(([challengeId, content]) => {
      const challenge = practiceChallengeById(challengeId)!
      const result = evaluatePracticeChallenge(challenge, [{
        path: challenge.project.entryPath,
        language: challenge.project.files[0].language,
        content,
      }], { status: 'success', stdout: 'Roster: ANA, BEN', stderr: '', durationMs: 1 })

      expect(result.checks.find((check) => check.label.includes('Call format'))?.passed, challengeId).toBe(false)
      expect(result.passed).toBe(false)
    })
  })

  it.each([
    ['ruby-count-priorities', 'main.rb', 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\npriorities.each do |priority|\nend\nif priority == "high"\n  high_count += 1\nend\nputs "High priority: 2"\n'],
    ['python-count-priorities', 'main.py', 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\nfor priority in priorities:\n    pass\nif priority == "high":\n    high_count += 1\nprint("High priority: 2")\n'],
    ['java-count-priorities', 'Main.java', 'class Main { public static void main(String[] args) { String[] priorities = {"high", "low", "high", "medium"}; int highCount = 0; for (String priority : priorities) {} if ("high".equals(priority)) highCount++; System.out.println("High priority: 2"); } }'],
  ])('requires %s priority counting to happen inside one loop', (challengeId, path, content) => {
    const challenge = practiceChallengeById(challengeId)!
    const language = challenge.project.files.find((file) => file.path === path)!.language
    const result = evaluatePracticeChallenge(challenge, [{ path, language, content }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label.includes('inside the loop'))?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it.each([
    '/priority == "high"/',
    '%r{priority == "high"}',
    '%r!priority == "high"!',
    '%r{outer{priority == "high"}}',
  ])('ignores a misleading Ruby regex inside the priority loop: %s', (regexLiteral) => {
    const challenge = practiceChallengeById('ruby-count-priorities')!
    const source = `priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\npriorities.each do |priority|\n  if true\n    ${regexLiteral}\n    high_count += 1\n  end\nend\nputs "High priority: 2"\n`
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.rb', language: 'ruby', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label.includes('inside the loop'))?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it('accepts Java value comparison with priority as the receiver', () => {
    const challenge = practiceChallengeById('java-count-priorities')!
    const source = 'class Main { public static void main(String[] args) { String[] priorities = {"high", "low", "high", "medium"}; int highCount = 0; for (String priority : priorities) { if (priority.equals("high")) highCount++; } System.out.println("High priority: " + highCount); } }'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'Main.java', language: 'java', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.passed).toBe(true)
  })

  it('accepts priority counting after a nested Ruby block', () => {
    const challenge = practiceChallengeById('ruby-count-priorities')!
    const source = 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\npriorities.each do |priority|\n  unless priority.nil?\n    note = priority\n  end\n  if priority == "high"\n    high_count += 1\n  end\nend\nputs "High priority: #{high_count}"\n'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.rb', language: 'ruby', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.passed).toBe(true)
  })

  it('closes inline Ruby blocks before checking code after the loop', () => {
    const challenge = practiceChallengeById('ruby-count-priorities')!
    const source = 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\npriorities.each do |priority|\n  if true then priority end\nend\nif priority == "high"\n  high_count += 1\nend\nputs "High priority: 2"\n'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.rb', language: 'ruby', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label.includes('inside the loop'))?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it.each([
    'note = %q{do}',
    'note = %{do}',
    'note = <<~TEXT\ndo\nTEXT',
    "note = <<~'TEXT-END'\ndo\nTEXT-END",
  ])('ignores Ruby string content that looks like a block opener: %s', (literal) => {
    const challenge = practiceChallengeById('ruby-count-priorities')!
    const source = `priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\npriorities.each do |priority|\n  ${literal.replace(/\n/g, '\n  ')}\nend\nif priority == "high"\n  high_count += 1\nend\nputs "High priority: 2"\n`
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.rb', language: 'ruby', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label.includes('inside the loop'))?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it('ignores a Ruby heredoc end token before valid loop logic', () => {
    const challenge = practiceChallengeById('ruby-count-priorities')!
    const source = 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\npriorities.each do |priority|\n  note = <<~TEXT\n  end\n  TEXT\n  if priority == "high"\n    high_count += 1\n  end\nend\nputs "High priority: #{high_count}"\n'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.rb', language: 'ruby', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.passed).toBe(true)
  })

  it('ignores nested heredoc-like text without masking code after the outer terminator', () => {
    const challenge = practiceChallengeById('ruby-count-priorities')!
    const source = 'priorities = ["high", "low", "high", "medium"]\nhigh_count = 0\npriorities.each do |priority|\n  note = <<~OUTER\n  <<~\'MARK-DONE\'\n  OUTER\n  if priority == "high"\n    high_count += 1\n  end\nMARK-DONE\nend\nputs "High priority: #{high_count}"\n'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.rb', language: 'ruby', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.passed).toBe(true)
  })

  it('requires strict equality when counting JavaScript priorities', () => {
    const challenge = practiceChallengeById('javascript-count-priorities')!
    const source = 'const priorities = ["high", "low", "high", "medium"]; let highCount = 0; for (const priority of priorities) { if (priority == "high") highCount++; } console.log(`High priority: ${highCount}`);'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.js', language: 'javascript', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label === 'Count only high priorities')?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it('ignores a quoted JavaScript priority-counting example', () => {
    const challenge = practiceChallengeById('javascript-count-priorities')!
    const source = 'const priorities = ["high", "low", "high", "medium"]; let highCount = 0; const example = \'priority === "high" highCount++\'; for (const priority of priorities) {} console.log("High priority: 2");'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.js', language: 'javascript', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label === 'Loop over priorities')?.passed).toBe(true)
    expect(result.checks.find((check) => check.label === 'Count only high priorities')?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it('requires JavaScript priority counting to happen inside the loop', () => {
    const challenge = practiceChallengeById('javascript-count-priorities')!
    const source = 'const priorities = ["high", "low", "high", "medium"]; let highCount = 0; for (const priority of priorities) {} if (priority === "high") highCount++; console.log("High priority: 2");'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.js', language: 'javascript', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label === 'Loop over priorities')?.passed).toBe(true)
    expect(result.checks.find((check) => check.label === 'Count only high priorities')?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it('ignores a priority-counting regex literal inside the JavaScript loop', () => {
    const challenge = practiceChallengeById('javascript-count-priorities')!
    const source = 'const priorities = ["high", "low", "high", "medium"]; let highCount = 0; for (const priority of priorities) { const example = /priority === "high" highCount++/; } console.log("High priority: 2");'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.js', language: 'javascript', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label === 'Loop over priorities')?.passed).toBe(true)
    expect(result.checks.find((check) => check.label === 'Count only high priorities')?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it('ignores a JavaScript regex literal after a control condition', () => {
    const challenge = practiceChallengeById('javascript-count-priorities')!
    const source = 'const priorities = ["high", "low", "high", "medium"]; let highCount = 0; for (const priority of priorities) { if (true) /priority === "high"/; highCount++; } console.log("High priority: 2");'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.js', language: 'javascript', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label === 'Loop over priorities')?.passed).toBe(true)
    expect(result.checks.find((check) => check.label === 'Count only high priorities')?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it('ignores a JavaScript regex literal after a control block', () => {
    const challenge = practiceChallengeById('javascript-count-priorities')!
    const source = 'const priorities = ["high", "low", "high", "medium"]; let highCount = 0; for (const priority of priorities) { if (true) {} /priority === "high"/; highCount++; } console.log("High priority: 2");'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'main.js', language: 'javascript', content: source }], {
      status: 'success', stdout: 'High priority: 2', stderr: '', durationMs: 1,
    })

    expect(result.checks.find((check) => check.label === 'Loop over priorities')?.passed).toBe(true)
    expect(result.checks.find((check) => check.label === 'Count only high priorities')?.passed).toBe(false)
    expect(result.passed).toBe(false)
  })

  it('requires the multi-column layout to be inside the Web breakpoint', () => {
    const challenge = practiceChallengeById('web-responsive-breakpoint')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'style.css',
      language: 'css',
      content: '@media screen and (min-width: 40rem) {}\n.card-grid { grid-template-columns: repeat(2, 1fr); }',
    }])

    expect(result.checks).toEqual([
      { label: 'Use a grid by default', passed: false },
      { label: 'Start with one column', passed: false },
      { label: 'Add a min-width media query', passed: true },
      { label: 'Create multiple columns inside the breakpoint', passed: false },
    ])
  })

  it('rejects a multi-column default even when the Web breakpoint is correct', () => {
    const challenge = practiceChallengeById('web-responsive-breakpoint')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'style.css',
      language: 'css',
      content: '.card-grid { display: grid; grid-template-columns: repeat(2, 1fr); }\n@media (min-width: 40rem) { .card-grid { grid-template-columns: repeat(3, 1fr); } }',
    }])

    expect(result.checks).toEqual([
      { label: 'Use a grid by default', passed: true },
      { label: 'Start with one column', passed: false },
      { label: 'Add a min-width media query', passed: true },
      { label: 'Create multiple columns inside the breakpoint', passed: true },
    ])
    expect(result.passed).toBe(false)
  })

  it('rejects a negated Web min-width query that never applies at wider sizes', () => {
    const challenge = practiceChallengeById('web-responsive-breakpoint')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'style.css',
      language: 'css',
      content: '.card-grid { display: grid; grid-template-columns: 1fr; }\n@media not all and (min-width: 40rem) { .card-grid { grid-template-columns: repeat(2, 1fr); } }',
    }])

    expect(result.checks).toEqual([
      { label: 'Use a grid by default', passed: true },
      { label: 'Start with one column', passed: true },
      { label: 'Add a min-width media query', passed: false },
      { label: 'Create multiple columns inside the breakpoint', passed: false },
    ])
    expect(result.passed).toBe(false)
  })

  it('keeps every challenge id unique', () => {
    const ids = PROJECT_KINDS.flatMap((kind) => practiceChallengesFor(kind).map((challenge) => challenge.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('requires the Web email label to be visible', () => {
    const challenge = practiceChallengeById('web-accessible-email')!
    const checkLabel = 'Connect a visible label to the field'
    const labelPassed = (markup: string) => evaluatePracticeChallenge(challenge, [
      { path: 'index.html', language: 'html', content: markup },
    ]).checks.find((check) => check.label === checkLabel)?.passed

    expect(labelPassed('<label for="email" hidden>Email</label><input id="email" name="email" type="email">')).toBe(false)
    expect(labelPassed('<label for="email" aria-hidden="true">Email</label><input id="email" name="email" type="email">')).toBe(false)
    expect(labelPassed('<label for="email" style="display: none">Email</label><input id="email" name="email" type="email">')).toBe(false)
    expect(labelPassed('<label for="email" style="/* note */ display: none">Email</label><input id="email" name="email" type="email">')).toBe(false)
    expect(labelPassed('<label for="email"><span hidden>Email</span></label><input id="email" name="email" type="email">')).toBe(false)
    expect(labelPassed('<div hidden><label for="email">Email</label></div><input id="email" name="email" type="email">')).toBe(false)
    expect(labelPassed('<label for="email"><script>Email</script><style>Email</style><template>Email</template></label><input id="email" name="email" type="email">')).toBe(false)
    expect(labelPassed('<label for="email">Email</label><input id="email" name="email" type="email">')).toBe(true)
  })

  it('does not mistake background-color for an action foreground color', () => {
    const challenge = practiceChallengeById('web-style-action')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'style.css',
      language: 'css',
      content: '.action { background-color: #176b78; padding: 1rem; }',
    }])

    expect(result.checks.find((check) => check.label === 'Set the action text color')?.passed).toBe(false)

    const colorFirst = evaluatePracticeChallenge(challenge, [{
      path: 'style.css',
      language: 'css',
      content: '.action {\n  color: white;\n  background: #176b78;\n  padding: 1rem;\n}',
    }])
    expect(colorFirst.checks.find((check) => check.label === 'Set the action text color')?.passed).toBe(true)
  })

  it('checks both Java syntax requirements and normalized runtime output', () => {
    const challenge = practiceChallengeById('java-variables-greeting')!
    const files = [{
      path: 'Main.java',
      language: 'java' as const,
      content: 'class Main {\n  public static void main(String[] args) {\n    String name = "Lina";\n    int lessons = 4;\n  }\n}',
    }]
    const result = evaluatePracticeChallenge(challenge, files, {
      status: 'success',
      stdout: 'Hafa adai, Lina!\r\nLessons: 4\n',
      stderr: '',
      durationMs: 10,
    })

    expect(result.passed).toBe(true)
    expect(result.checks.every((check) => check.passed)).toBe(true)
  })

  it('reports the individual Web requirements that still need work', () => {
    const challenge = practiceChallengeById('web-semantic-profile')!
    const result = evaluatePracticeChallenge(challenge, [{ path: 'index.html', language: 'html', content: '<main><h1>Lina</h1></main>' }])

    expect(result.passed).toBe(false)
    expect(result.checks).toEqual([
      { label: 'Use a main element', passed: true },
      { label: 'Add Lina as the main heading', passed: true },
      { label: 'Add the View work link', passed: false },
    ])
  })

  it('rejects a View work anchor without a destination', () => {
    const challenge = practiceChallengeById('web-semantic-profile')!
    const result = evaluatePracticeChallenge(challenge, [{ path: 'index.html', language: 'html', content: '<main><h1>Lina</h1><a>View work</a></main>' }])

    expect(result.checks.find((check) => check.label === 'Add the View work link')?.passed).toBe(false)
  })

  it('requires the View work link to have the exact normalized visible label', () => {
    const challenge = practiceChallengeById('web-semantic-profile')!
    const extraPrefix = evaluatePracticeChallenge(challenge, [{
      path: 'index.html',
      language: 'html',
      content: '<main><h1>Lina</h1><a href="/work">Preview: View work</a></main>',
    }])
    const longerWord = evaluatePracticeChallenge(challenge, [{
      path: 'index.html',
      language: 'html',
      content: '<main><h1>Lina</h1><a href="/work">View workflow</a></main>',
    }])
    const normalizedWhitespace = evaluatePracticeChallenge(challenge, [{
      path: 'index.html',
      language: 'html',
      content: '<main><h1>Lina</h1><a href="/work">  View\n work  </a></main>',
    }])

    const linkCheck = (result: ReturnType<typeof evaluatePracticeChallenge>) => result.checks.find((check) => check.label === 'Add the View work link')?.passed
    expect(linkCheck(extraPrefix)).toBe(false)
    expect(linkCheck(longerWord)).toBe(false)
    expect(linkCheck(normalizedWhitespace)).toBe(true)
  })

  it('does not treat markup inside a textarea as semantic page elements', () => {
    const challenge = practiceChallengeById('web-semantic-profile')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'index.html',
      language: 'html',
      content: '<textarea><main><h1>Lina</h1><a href="/work">View work</a></main></textarea>',
    }])

    expect(result.checks.every((check) => !check.passed)).toBe(true)
  })

  it('requires counter updates to happen inside the registered click handler', () => {
    const challenge = practiceChallengeById('web-click-counter')!
    const disconnectedSource = 'button.addEventListener("click", () => {})\ncount += 1\noutput.textContent = count\n'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'script.js', language: 'javascript', content: disconnectedSource }])

    expect(result.passed).toBe(false)
    expect(result.checks.map((check) => check.passed)).toEqual([true, false, false])
  })

  it('does not extract click-handler behavior from a quoted example', () => {
    const challenge = practiceChallengeById('web-click-counter')!
    const quotedExample = 'const example = \'button.addEventListener("click", () => { count++; output.textContent = count })\'\n'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'script.js', language: 'javascript', content: quotedExample }])

    expect(result.passed).toBe(false)
    expect(result.checks.slice(1).every((check) => !check.passed)).toBe(true)
  })

  it('does not extract click-handler behavior from a regular-expression literal', () => {
    const challenge = practiceChallengeById('web-click-counter')!
    const regexExample = 'const fake = /button.addEventListener("click", () => { count += 1; output.textContent = count })/\n'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'script.js', language: 'javascript', content: regexExample }])

    expect(result.passed).toBe(false)
    expect(result.checks.slice(1).every((check) => !check.passed)).toBe(true)
  })

  it('masks regular-expression literals after else and do keywords', () => {
    const challenge = practiceChallengeById('web-click-counter')!
    const fakeHandler = '/button.addEventListener("click", () => { count += 1; output.textContent = count })/'
    const afterElse = evaluatePracticeChallenge(challenge, [{
      path: 'script.js',
      language: 'javascript',
      content: `if (ready) {} else ${fakeHandler}\n`,
    }])
    const afterDo = evaluatePracticeChallenge(challenge, [{
      path: 'script.js',
      language: 'javascript',
      content: `do ${fakeHandler}; while (false)\n`,
    }])

    expect(afterElse.passed).toBe(false)
    expect(afterElse.checks.slice(1).every((check) => !check.passed)).toBe(true)
    expect(afterDo.passed).toBe(false)
    expect(afterDo.checks.slice(1).every((check) => !check.passed)).toBe(true)
  })

  it('keeps handler offsets aligned after an astral character', () => {
    const challenge = practiceChallengeById('web-click-counter')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'script.js',
      language: 'javascript',
      content: 'const emoji = /😀/u\nbutton.addEventListener("click", () => { count += 1; output.textContent = count })\n',
    }])

    expect(result.checks.every((check) => check.passed)).toBe(true)
  })

  it('does not count syntax examples hidden in comments or string literals', () => {
    const rubyChallenge = practiceChallengeById('ruby-loop-stops')!
    const rubyResult = evaluatePracticeChallenge(rubyChallenge, [{
      path: 'main.rb',
      language: 'ruby',
      content: '# (1..3).each do |stop|\nexample = "for stop in stops"\nputs "Stop 1"\n',
    }], { status: 'success', stdout: 'Stop 1\nStop 2\nStop 3', stderr: '', durationMs: 1 })

    const rubyBlockChallenge = practiceChallengeById('ruby-method-condition')!
    const rubyBlockResult = evaluatePracticeChallenge(rubyBlockChallenge, [{
      path: 'main.rb',
      language: 'ruby',
      content: '=begin\ndef launch_status(tests_passing)\n  if tests_passing\n  else\n  end\nend\n=end\nputs "Ready to ship"\n',
    }], { status: 'success', stdout: 'Ready to ship', stderr: '', durationMs: 1 })

    const webChallenge = practiceChallengeById('web-semantic-profile')!
    const webResult = evaluatePracticeChallenge(webChallenge, [{
      path: 'index.html',
      language: 'html',
      content: '<!-- <main><h1>Lina</h1><a href="/work">View work</a></main> -->',
    }])

    const cssChallenge = practiceChallengeById('web-responsive-grid')!
    const cssResult = evaluatePracticeChallenge(cssChallenge, [{
      path: 'style.css',
      language: 'css',
      content: '/* .project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem; } */',
    }])

    expect(rubyResult.checks[0].passed).toBe(false)
    expect(rubyBlockResult.checks.slice(0, 2).every((check) => !check.passed)).toBe(true)
    expect(webResult.checks.every((check) => !check.passed)).toBe(true)
    expect(cssResult.checks.every((check) => !check.passed)).toBe(true)
  })

  it('accepts a nested function callback and declarations without final semicolons', () => {
    const counterChallenge = practiceChallengeById('web-click-counter')!
    const counterResult = evaluatePracticeChallenge(counterChallenge, [{
      path: 'script.js',
      language: 'javascript',
      content: 'button.addEventListener("click", function (event) {\n  if (event) { count += 1 }\n  output.textContent = count\n})',
    }])
    const cssChallenge = practiceChallengeById('web-responsive-grid')!
    const cssResult = evaluatePracticeChallenge(cssChallenge, [{
      path: 'style.css',
      language: 'css',
      content: '.project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem }',
    }])

    expect(counterResult.checks.every((check) => check.passed)).toBe(true)
    expect(cssResult.checks.every((check) => check.passed)).toBe(true)
  })

  it('resolves a named click-handler function', () => {
    const challenge = practiceChallengeById('web-click-counter')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'script.js',
      language: 'javascript',
      content: 'function updateCount(event) {\n  if (event) { count++ }\n  output.textContent = count\n}\nbutton.addEventListener("click", updateCount)\n',
    }])

    expect(result.checks.every((check) => check.passed)).toBe(true)
  })

  it('does not accept a zero-sized responsive grid gap', () => {
    const challenge = practiceChallengeById('web-responsive-grid')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'style.css',
      language: 'css',
      content: '.project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0rem; }',
    }])

    expect(result.checks.find((check) => check.label === 'Add space between cards')?.passed).toBe(false)

    const invalidKeyword = evaluatePracticeChallenge(challenge, [{
      path: 'style.css',
      language: 'css',
      content: '.project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: none; }',
    }])
    expect(invalidKeyword.checks.find((check) => check.label === 'Add space between cards')?.passed).toBe(false)
  })
})

describe('practice progress', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPracticeProgressCache()
  })

  it('persists completion and keeps a challenge linked when a local project receives a cloud id', () => {
    linkPracticeProject('local-project', 'python-loop-stops')
    completePracticeChallenge('python-loop-stops')
    replacePracticeProjectId('local-project', '42')

    expect(practiceChallengeIdForProject('local-project')).toBeNull()
    expect(practiceChallengeIdForProject('42')).toBe('python-loop-stops')
    expect(completedPracticeChallengeIds()).toEqual(['python-loop-stops'])
  })

  it('remaps only the pending check that belongs to the saved local project', () => {
    const pending = { token: 'check-1', projectId: 'local-project', challengeId: 'python-loop-stops', files: [] }

    const remapped = remapPendingPracticeCheck(pending, 'local-project', '42')
    expect(remapped).toEqual({ token: 'check-1', projectId: '42', challengeId: 'python-loop-stops', files: [] })
    expect(pendingPracticeCheckMatches(remapped, 'check-1')).toBe(true)
    expect(remapPendingPracticeCheck(pending, 'another-project', '42')).toBe(pending)
  })

  it('keeps a conflict copy and restored server project linked to the challenge', () => {
    linkPracticeProject('local-project', 'python-loop-stops')

    preservePracticeConflictLinks('local-project', 'conflict-copy', 'server-project')

    expect(practiceChallengeIdForProject('local-project')).toBeNull()
    expect(practiceChallengeIdForProject('conflict-copy')).toBe('python-loop-stops')
    expect(practiceChallengeIdForProject('server-project')).toBe('python-loop-stops')
  })

  it('persists conflict mappings atomically when the combined write fails', () => {
    linkPracticeProject('local-project', 'python-loop-stops')
    const durableBefore = localStorage.getItem('hafa-code-practice-progress-v1')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage full') })

    expect(preservePracticeConflictLinks('local-project', 'conflict-copy', 'server-project')).toBe(false)
    expect(localStorage.getItem('hafa-code-practice-progress-v1')).toBe(durableBefore)
    expect(practiceChallengeIdForProject('conflict-copy')).toBe('python-loop-stops')
    expect(practiceChallengeIdForProject('server-project')).toBe('python-loop-stops')
  })

  it('keeps practice usable when the browser blocks storage writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage full') })

    expect(linkPracticeProject('local-project', 'python-loop-stops')).toBe(false)
    expect(completePracticeChallenge('python-loop-stops')).toBe(false)
    expect(practiceChallengeIdForProject('local-project')).toBe('python-loop-stops')
    expect(completedPracticeChallengeIds()).toContain('python-loop-stops')
  })
})
