import type { ProjectFile, ProjectKind } from './projectTypes'

export interface GuidePracticeProject {
  title: string
  entryPath: string
  files: ProjectFile[]
}

export interface LanguageGuideTopic {
  id: string
  title: string
  summary: string
  keywords: readonly string[]
  code: string
  expectedOutput: string
  commonMistake: string
  practiceProject: GuidePracticeProject
}

export interface LanguageGuide {
  kind: ProjectKind
  label: string
  introduction: string
  topics: readonly LanguageGuideTopic[]
}

type TopicInput = Omit<LanguageGuideTopic, 'practiceProject'> & {
  titleForProject?: string
  entryPath?: string
  files?: ProjectFile[]
}

const ENTRY_PATHS: Record<Exclude<ProjectKind, 'web'>, string> = {
  ruby: 'main.rb',
  javascript: 'main.js',
  python: 'main.py',
  java: 'Main.java',
}

const FILE_LANGUAGES = {
  ruby: 'ruby',
  javascript: 'javascript',
  python: 'python',
  java: 'java',
} as const

function runnableTopic(kind: Exclude<ProjectKind, 'web'>, input: TopicInput): LanguageGuideTopic {
  const entryPath = input.entryPath ?? ENTRY_PATHS[kind]
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    keywords: input.keywords,
    code: input.code,
    expectedOutput: input.expectedOutput,
    commonMistake: input.commonMistake,
    practiceProject: {
      title: input.titleForProject ?? `${input.title} Practice`,
      entryPath,
      files: input.files ?? [{ path: entryPath, language: FILE_LANGUAGES[kind], content: input.code }],
    },
  }
}

function webTopic(input: TopicInput): LanguageGuideTopic {
  const files = input.files ?? []
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    keywords: input.keywords,
    code: input.code,
    expectedOutput: input.expectedOutput,
    commonMistake: input.commonMistake,
    practiceProject: {
      title: input.titleForProject ?? `${input.title} Practice`,
      entryPath: input.entryPath ?? 'index.html',
      files,
    },
  }
}

const rubyTopics = [
  runnableTopic('ruby', {
    id: 'ruby-output-comments',
    title: 'Output and comments',
    summary: '`puts` prints a value with a new line. Comments start with `#` and are ignored by Ruby.',
    keywords: ['puts', 'print', 'comment', 'output', 'console'],
    code: `# Ruby ignores this line
puts "Hafa adai!"
print "Same line... "
puts "finished"\n`,
    expectedOutput: 'Hafa adai!\nSame line... finished',
    commonMistake: '`print` does not add a new line. Use `puts` when each value should appear on its own line.',
  }),
  runnableTopic('ruby', {
    id: 'ruby-variables-types',
    title: 'Variables and data types',
    summary: 'Ruby creates a variable when you assign a value. You do not declare its type separately.',
    keywords: ['variable', 'string', 'integer', 'float', 'boolean', 'nil', 'type'],
    code: `name = "Mia"       # String
lessons = 4         # Integer
score = 9.5         # Float
ready = true        # Boolean
note = nil          # No value

puts "#{name} has #{lessons} lessons"
puts score
puts ready
puts note.nil?\n`,
    expectedOutput: 'Mia has 4 lessons\n9.5\ntrue\ntrue',
    commonMistake: 'Variable names do not use quotes. `"name"` is text; `name` retrieves the stored value.',
  }),
  runnableTopic('ruby', {
    id: 'ruby-strings',
    title: 'Strings',
    summary: 'Strings hold text. Double-quoted strings can interpolate values with `#{...}`.',
    keywords: ['string', 'text', 'interpolation', 'length', 'upcase'],
    code: `island = "Guam"
greeting = "Hafa adai, #{island}!"

puts greeting
puts greeting.upcase
puts "Characters: #{island.length}"\n`,
    expectedOutput: 'Hafa adai, Guam!\nHAFA ADAI, GUAM!\nCharacters: 4',
    commonMistake: 'Interpolation does not run inside single quotes. Use double quotes for `"Hello, #{name}"`.',
  }),
  runnableTopic('ruby', {
    id: 'ruby-conditionals',
    title: 'Conditionals',
    summary: '`if`, `elsif`, and `else` choose which code runs based on true or false conditions.',
    keywords: ['if', 'elsif', 'else', 'comparison', 'boolean', 'conditional'],
    code: `score = 84

if score >= 90
  puts "Excellent"
elsif score >= 70
  puts "Passed"
else
  puts "Keep practicing"
end\n`,
    expectedOutput: 'Passed',
    commonMistake: 'Use `==` to compare values. A single `=` assigns a new value to a variable.',
  }),
  runnableTopic('ruby', {
    id: 'ruby-loops',
    title: 'Loops',
    summary: 'Loops repeat work. Ruby blocks usually end with `end` and can expose the current item.',
    keywords: ['loop', 'times', 'each', 'while', 'repeat', 'iteration'],
    code: `3.times do |index|
  puts "Round #{index + 1}"
end

["Ruby", "Java", "Python"].each do |language|
  puts "Practice #{language}"
end\n`,
    expectedOutput: 'Round 1\nRound 2\nRound 3\nPractice Ruby\nPractice Java\nPractice Python',
    commonMistake: '`times` starts its index at `0`. Add `1` when you want labels that begin at one.',
  }),
  runnableTopic('ruby', {
    id: 'ruby-arrays-hashes',
    title: 'Arrays and hashes',
    summary: 'Arrays store ordered values. Hashes store values under named keys.',
    keywords: ['array', 'hash', 'list', 'collection', 'key', 'value', 'symbol'],
    code: `languages = ["Ruby", "Java", "Python"]
student = { name: "Kai", level: 2 }

languages << "JavaScript"
puts languages[0]
puts languages.length
puts "#{student[:name]} is level #{student[:level]}"\n`,
    expectedOutput: 'Ruby\n4\nKai is level 2',
    commonMistake: 'Array positions start at `0`. Hash keys must match: `student[:name]` is different from `student["name"]`.',
  }),
  runnableTopic('ruby', {
    id: 'ruby-methods',
    title: 'Methods',
    summary: 'A method names reusable behavior. Ruby returns the last evaluated expression automatically.',
    keywords: ['method', 'def', 'parameter', 'argument', 'return', 'function'],
    code: `def greeting(name, times = 1)
  message = "Hafa adai, #{name}!"
  message * times
end

puts greeting("Lina")
puts greeting("Bo", 2)\n`,
    expectedOutput: 'Hafa adai, Lina!\nHafa adai, Bo!Hafa adai, Bo!',
    commonMistake: 'Defining a method does not run it. Call it later with its name and the required arguments.',
  }),
  runnableTopic('ruby', {
    id: 'ruby-classes-errors',
    title: 'Classes and errors',
    summary: 'Classes bundle data and behavior. `begin` and `rescue` let a program handle expected errors.',
    keywords: ['class', 'object', 'initialize', 'instance', 'rescue', 'exception', 'error'],
    code: `class Student
  def initialize(name)
    @name = name
  end

  def introduce
    "I am #{@name}."
  end
end

student = Student.new("Ana")
puts student.introduce

begin
  Integer("not a number")
rescue ArgumentError
  puts "Please enter a number."
end\n`,
    expectedOutput: 'I am Ana.\nPlease enter a number.',
    commonMistake: 'Instance variables begin with `@`. A plain local variable inside `initialize` is not retained by the object.',
  }),
] as const

const javascriptTopics = [
  runnableTopic('javascript', {
    id: 'javascript-output-variables',
    title: 'Output and variables',
    summary: '`console.log` prints values. Prefer `const` unless the variable must be reassigned, then use `let`.',
    keywords: ['console', 'log', 'const', 'let', 'variable', 'comment', 'output'],
    code: `// This is a comment
const name = "Mia"
let lessons = 3
lessons += 1

console.log("Hafa adai, " + name)
console.log(lessons)\n`,
    expectedOutput: 'Hafa adai, Mia\n4',
    commonMistake: 'Do not use `const` when you plan to reassign the variable. Use `let` for a changing value.',
  }),
  runnableTopic('javascript', {
    id: 'javascript-types-strings',
    title: 'Types and strings',
    summary: 'JavaScript values include strings, numbers, booleans, `null`, and `undefined`. Template literals insert expressions.',
    keywords: ['string', 'number', 'boolean', 'null', 'undefined', 'template literal', 'typeof'],
    code: `const island = "Guam"
const students = 12
const ready = true
const note = null

console.log(\`Learning on \${island}\`)
console.log(typeof students)
console.log(typeof ready)
console.log(note === null)\n`,
    expectedOutput: 'Learning on Guam\nnumber\nboolean\ntrue',
    commonMistake: 'Template literals use backticks, not regular quotes. Write `` `Hello ${name}` ``.',
  }),
  runnableTopic('javascript', {
    id: 'javascript-conditionals',
    title: 'Conditionals',
    summary: '`if`, `else if`, and `else` select a branch. Conditions go inside parentheses.',
    keywords: ['if', 'else', 'conditional', 'comparison', 'strict equality', 'boolean'],
    code: `const score = 84

if (score >= 90) {
  console.log("Excellent")
} else if (score >= 70) {
  console.log("Passed")
} else {
  console.log("Keep practicing")
}\n`,
    expectedOutput: 'Passed',
    commonMistake: 'Prefer strict equality (`===`) so JavaScript does not silently convert values before comparing them.',
  }),
  runnableTopic('javascript', {
    id: 'javascript-loops',
    title: 'Loops',
    summary: '`for` repeats with a counter. `for...of` reads each value from an iterable such as an array.',
    keywords: ['for', 'while', 'loop', 'iteration', 'for of', 'repeat'],
    code: `for (let round = 1; round <= 3; round += 1) {
  console.log(\`Round \${round}\`)
}

for (const language of ["JS", "Ruby", "Java"]) {
  console.log(\`Practice \${language}\`)
}\n`,
    expectedOutput: 'Round 1\nRound 2\nRound 3\nPractice JS\nPractice Ruby\nPractice Java',
    commonMistake: 'A loop must eventually stop. Check the condition and make sure the counter changes on every pass.',
  }),
  runnableTopic('javascript', {
    id: 'javascript-arrays-objects',
    title: 'Arrays and objects',
    summary: 'Arrays store ordered values. Objects group values under property names.',
    keywords: ['array', 'object', 'list', 'property', 'map', 'push', 'collection'],
    code: `const languages = ["JavaScript", "Python"]
const student = { name: "Kai", level: 2 }

languages.push("Java")
console.log(languages[0])
console.log(languages.length)
console.log(\`\${student.name} is level \${student.level}\`)\n`,
    expectedOutput: 'JavaScript\n3\nKai is level 2',
    commonMistake: 'Array positions start at `0`. Object properties usually use `object.property` or `object["property"]`.',
  }),
  runnableTopic('javascript', {
    id: 'javascript-functions',
    title: 'Functions',
    summary: 'Functions package reusable behavior. Parameters receive values and `return` sends a result back.',
    keywords: ['function', 'arrow function', 'parameter', 'argument', 'return', 'callback'],
    code: `function greet(name) {
  return \`Hafa adai, \${name}!\`
}

const double = (number) => number * 2

console.log(greet("Lina"))
console.log(double(6))\n`,
    expectedOutput: 'Hafa adai, Lina!\n12',
    commonMistake: '`return` ends the function. Code placed after it in the same branch will not run.',
  }),
  runnableTopic('javascript', {
    id: 'javascript-classes',
    title: 'Classes',
    summary: 'A class is a blueprint for objects. `constructor` initializes each new instance.',
    keywords: ['class', 'object', 'constructor', 'new', 'method', 'this'],
    code: `class Student {
  constructor(name) {
    this.name = name
  }

  introduce() {
    return \`I am \${this.name}.\`
  }
}

const student = new Student("Ana")
console.log(student.introduce())\n`,
    expectedOutput: 'I am Ana.',
    commonMistake: 'Inside a class method, use `this.name` to read the property on the current object.',
  }),
  runnableTopic('javascript', {
    id: 'javascript-errors',
    title: 'Errors',
    summary: '`try` and `catch` handle an expected failure. Throw an `Error` when a function cannot continue safely.',
    keywords: ['try', 'catch', 'throw', 'error', 'exception', 'validation'],
    code: `function requirePositive(number) {
  if (number <= 0) throw new Error("Use a positive number")
  return number
}

try {
  console.log(requirePositive(-2))
} catch (error) {
  console.log(error.message)
}\n`,
    expectedOutput: 'Use a positive number',
    commonMistake: 'Throw an `Error` object rather than a loose string so callers receive a message and useful stack information.',
  }),
] as const

const pythonTopics = [
  runnableTopic('python', {
    id: 'python-output-comments',
    title: 'Output and comments',
    summary: '`print()` displays values. Comments begin with `#` and are not executed.',
    keywords: ['print', 'comment', 'output', 'console'],
    code: `# Python ignores this line
print("Hafa adai!")
print("Score:", 98)\n`,
    expectedOutput: 'Hafa adai!\nScore: 98',
    commonMistake: '`print` is a function in modern Python, so the value belongs inside parentheses.',
  }),
  runnableTopic('python', {
    id: 'python-variables-types',
    title: 'Variables and data types',
    summary: 'Python creates a variable when you assign a value. Common types include `str`, `int`, `float`, `bool`, and `None`.',
    keywords: ['variable', 'string', 'integer', 'float', 'boolean', 'none', 'type'],
    code: `name = "Mia"
lessons = 4
score = 9.5
ready = True
note = None

print(name, lessons)
print(type(score).__name__)
print(ready)
print(note is None)\n`,
    expectedOutput: 'Mia 4\nfloat\nTrue\nTrue',
    commonMistake: 'Python booleans are capitalized: `True` and `False`, not `true` and `false`.',
  }),
  runnableTopic('python', {
    id: 'python-strings',
    title: 'Strings',
    summary: 'Strings hold text. Prefix a string with `f` to insert expressions inside `{...}`.',
    keywords: ['string', 'text', 'f-string', 'format', 'upper', 'length'],
    code: `island = "Guam"
greeting = f"Hafa adai, {island}!"

print(greeting)
print(greeting.upper())
print(f"Characters: {len(island)}")\n`,
    expectedOutput: 'Hafa adai, Guam!\nHAFA ADAI, GUAM!\nCharacters: 4',
    commonMistake: 'Without the leading `f`, Python prints `{name}` literally instead of inserting the variable.',
  }),
  runnableTopic('python', {
    id: 'python-conditionals',
    title: 'Conditionals',
    summary: '`if`, `elif`, and `else` select a branch. Indentation defines which statements belong together.',
    keywords: ['if', 'elif', 'else', 'conditional', 'comparison', 'indentation'],
    code: `score = 84

if score >= 90:
    print("Excellent")
elif score >= 70:
    print("Passed")
else:
    print("Keep practicing")\n`,
    expectedOutput: 'Passed',
    commonMistake: 'Each condition line needs a colon, and the code inside each branch must be indented consistently.',
  }),
  runnableTopic('python', {
    id: 'python-loops',
    title: 'Loops',
    summary: '`for` reads items from a sequence. `range` creates a predictable series of integers.',
    keywords: ['for', 'while', 'loop', 'range', 'iteration', 'repeat'],
    code: `for round_number in range(1, 4):
    print(f"Round {round_number}")

for language in ["Python", "Ruby", "Java"]:
    print(f"Practice {language}")\n`,
    expectedOutput: 'Round 1\nRound 2\nRound 3\nPractice Python\nPractice Ruby\nPractice Java',
    commonMistake: 'The ending number in `range(1, 4)` is excluded, so it produces `1`, `2`, and `3`.',
  }),
  runnableTopic('python', {
    id: 'python-lists-dictionaries',
    title: 'Lists and dictionaries',
    summary: 'Lists store ordered values. Dictionaries map keys to values.',
    keywords: ['list', 'dictionary', 'dict', 'array', 'collection', 'key', 'value'],
    code: `languages = ["Python", "Java"]
student = {"name": "Kai", "level": 2}

languages.append("Ruby")
print(languages[0])
print(len(languages))
print(f"{student['name']} is level {student['level']}")\n`,
    expectedOutput: 'Python\n3\nKai is level 2',
    commonMistake: 'List positions start at `0`. Dictionary keys must match exactly, including capitalization and type.',
  }),
  runnableTopic('python', {
    id: 'python-functions',
    title: 'Functions',
    summary: '`def` names reusable behavior. Parameters receive inputs and `return` provides a result.',
    keywords: ['function', 'def', 'parameter', 'argument', 'return', 'default'],
    code: `def greet(name, punctuation="!"):
    return f"Hafa adai, {name}{punctuation}"

print(greet("Lina"))
print(greet("Bo", "."))\n`,
    expectedOutput: 'Hafa adai, Lina!\nHafa adai, Bo.',
    commonMistake: 'Calling a function before Python has executed its `def` statement causes a name error.',
  }),
  runnableTopic('python', {
    id: 'python-classes-errors',
    title: 'Classes and errors',
    summary: 'Classes define objects. `try` and `except` handle errors that a program knows how to recover from.',
    keywords: ['class', 'object', 'init', 'self', 'try', 'except', 'error'],
    code: `class Student:
    def __init__(self, name):
        self.name = name

    def introduce(self):
        return f"I am {self.name}."

student = Student("Ana")
print(student.introduce())

try:
    int("not a number")
except ValueError:
    print("Please enter a number.")\n`,
    expectedOutput: 'I am Ana.\nPlease enter a number.',
    commonMistake: 'Instance methods need `self` as their first parameter so they can access the current object.',
  }),
] as const

const javaTopics = [
  runnableTopic('java', {
    id: 'java-output-comments',
    title: 'Output and comments',
    summary: '`System.out.println` prints a value and starts a new line. Java supports `//` and `/* ... */` comments.',
    keywords: ['println', 'print', 'comment', 'output', 'console', 'main'],
    code: `public class Main {
  public static void main(String[] args) {
    // Java ignores this line.
    System.out.println("Hafa adai!");
    System.out.print("Same line... ");
    System.out.println("finished");
  }
}\n`,
    expectedOutput: 'Hafa adai!\nSame line... finished',
    commonMistake: 'Most Java statements end with a semicolon. The compiler points to the next token when one is missing.',
  }),
  runnableTopic('java', {
    id: 'java-variables-types',
    title: 'Variables and types',
    summary: 'Java variables declare a type before the name. Primitive types hold simple values; `String` is an object type.',
    keywords: ['variable', 'int', 'double', 'boolean', 'char', 'string', 'type', 'final'],
    code: `public class Main {
  public static void main(String[] args) {
    String name = "Mia";
    int lessons = 4;
    double score = 9.5;
    boolean ready = true;
    char grade = 'A';
    final String island = "Guam";

    System.out.println(name + " has " + lessons + " lessons");
    System.out.println(score);
    System.out.println(ready);
    System.out.println(grade + " in " + island);
  }
}\n`,
    expectedOutput: 'Mia has 4 lessons\n9.5\ntrue\nA in Guam',
    commonMistake: 'A `char` uses single quotes and holds one character. A `String` uses double quotes and can hold text.',
  }),
  runnableTopic('java', {
    id: 'java-strings',
    title: 'Strings',
    summary: '`String` stores text and provides methods such as `.length()`, `.toUpperCase()`, and `.equals()`.',
    keywords: ['string', 'text', 'length', 'equals', 'uppercase', 'concatenation'],
    code: `public class Main {
  public static void main(String[] args) {
    String island = "Guam";
    String greeting = "Hafa adai, " + island + "!";

    System.out.println(greeting);
    System.out.println(greeting.toUpperCase());
    System.out.println("Characters: " + island.length());
    System.out.println(island.equals("Guam"));
  }
}\n`,
    expectedOutput: 'Hafa adai, Guam!\nHAFA ADAI, GUAM!\nCharacters: 4\ntrue',
    commonMistake: 'Compare strings with `.equals()`, not `==`. The `==` operator checks whether two references point to the same object.',
  }),
  runnableTopic('java', {
    id: 'java-operators-conditionals',
    title: 'Operators and conditionals',
    summary: 'Operators calculate or compare values. `if`, `else if`, and `else` choose which block runs.',
    keywords: ['operator', 'if', 'else', 'comparison', 'boolean', 'conditional', 'and', 'or'],
    code: `public class Main {
  public static void main(String[] args) {
    int score = 84;
    boolean submitted = true;

    if (score >= 90 && submitted) {
      System.out.println("Excellent");
    } else if (score >= 70 && submitted) {
      System.out.println("Passed");
    } else {
      System.out.println("Keep practicing");
    }
  }
}\n`,
    expectedOutput: 'Passed',
    commonMistake: 'Use `==` for primitive comparisons. A single `=` assigns a value instead of comparing it.',
  }),
  runnableTopic('java', {
    id: 'java-loops',
    title: 'Loops',
    summary: '`for` works well with counters. An enhanced `for` loop reads every item from an array or collection.',
    keywords: ['for', 'while', 'loop', 'enhanced for', 'iteration', 'repeat'],
    code: `public class Main {
  public static void main(String[] args) {
    for (int round = 1; round <= 3; round++) {
      System.out.println("Round " + round);
    }

    String[] languages = {"Java", "Ruby", "Python"};
    for (String language : languages) {
      System.out.println("Practice " + language);
    }
  }
}\n`,
    expectedOutput: 'Round 1\nRound 2\nRound 3\nPractice Java\nPractice Ruby\nPractice Python',
    commonMistake: 'A loop must eventually stop. Confirm the condition becomes false and the counter changes each time.',
  }),
  runnableTopic('java', {
    id: 'java-methods',
    title: 'Methods',
    summary: 'A method declares its return type, name, and typed parameters. Use `void` when it returns no value.',
    keywords: ['method', 'static', 'parameter', 'argument', 'return', 'void'],
    code: `public class Main {
  static String greet(String name) {
    return "Hafa adai, " + name + "!";
  }

  static int doubleNumber(int number) {
    return number * 2;
  }

  public static void main(String[] args) {
    System.out.println(greet("Lina"));
    System.out.println(doubleNumber(6));
  }
}\n`,
    expectedOutput: 'Hafa adai, Lina!\n12',
    commonMistake: 'The returned value must match the declared return type. A method declared as `int` cannot return text.',
  }),
  runnableTopic('java', {
    id: 'java-arrays-arraylist',
    title: 'Arrays and ArrayList',
    summary: 'Arrays have a fixed size. `ArrayList` can grow and shrink while the program runs.',
    keywords: ['array', 'arraylist', 'list', 'collection', 'index', 'add', 'size'],
    code: `import java.util.ArrayList;

public class Main {
  public static void main(String[] args) {
    String[] fixed = {"Java", "Ruby"};
    ArrayList<String> languages = new ArrayList<>();
    languages.add("Java");
    languages.add("Python");
    languages.add("Ruby");

    System.out.println(fixed[0]);
    System.out.println(languages.get(1));
    System.out.println(languages.size());
  }
}\n`,
    expectedOutput: 'Java\nPython\n3',
    commonMistake: 'Arrays use `.length`; `ArrayList` uses `.size()`. Both begin at index `0`.',
  }),
  runnableTopic('java', {
    id: 'java-classes-objects',
    title: 'Classes and objects',
    summary: 'A class is a blueprint. A constructor initializes each object, and methods define its behavior.',
    keywords: ['class', 'object', 'constructor', 'new', 'field', 'instance', 'this'],
    code: `class Student {
  private final String name;

  Student(String name) {
    this.name = name;
  }

  String introduce() {
    return "I am " + name + ".";
  }
}

public class Main {
  public static void main(String[] args) {
    Student student = new Student("Ana");
    System.out.println(student.introduce());
  }
}\n`,
    expectedOutput: 'I am Ana.',
    commonMistake: 'Only one top-level class in `Main.java` can be `public`, and its name must match the filename.',
  }),
  runnableTopic('java', {
    id: 'java-exceptions',
    title: 'Exceptions',
    summary: '`try` and `catch` handle a specific failure. Use `finally` for cleanup that must happen either way.',
    keywords: ['try', 'catch', 'finally', 'throw', 'exception', 'error'],
    code: `public class Main {
  public static void main(String[] args) {
    try {
      int number = Integer.parseInt("not a number");
      System.out.println(number);
    } catch (NumberFormatException error) {
      System.out.println("Please enter a number.");
    } finally {
      System.out.println("Finished safely.");
    }
  }
}\n`,
    expectedOutput: 'Please enter a number.\nFinished safely.',
    commonMistake: 'Catch the most specific exception you can handle. Catching every `Exception` can hide unrelated bugs.',
  }),
  runnableTopic('java', {
    id: 'java-scanner-input',
    title: 'Scanner input',
    summary: '`Scanner` reads text from `System.in`. Hafa Code sends terminal input to Java one line at a time.',
    keywords: ['scanner', 'input', 'system in', 'nextline', 'stdin', 'interactive'],
    code: `import java.util.Scanner;

public class Main {
  public static void main(String[] args) {
    Scanner scanner = new Scanner(System.in);
    System.out.print("What is your name? ");
    String name = scanner.nextLine();
    System.out.println("Hafa adai, " + name + "!");
    scanner.close();
  }
}\n`,
    expectedOutput: 'What is your name? [your input]\nHafa adai, [your input]!',
    commonMistake: 'After `nextInt()`, a newline can remain unread before `nextLine()`. Reading whole lines and parsing them is often simpler.',
  }),
] as const

const webBaseCss: ProjectFile = {
  path: 'style.css',
  language: 'css',
  content: `* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  padding: 2rem;
  font-family: sans-serif;
  background: #f8efe2;
  color: #1f1915;
}
main { max-width: 42rem; margin: auto; }
button, input { font: inherit; }\n`,
}

const webEmptyScript: ProjectFile = { path: 'script.js', language: 'javascript', content: '// Add browser behavior here.\n' }

function webFiles(html: string, css = webBaseCss.content, script = webEmptyScript.content): ProjectFile[] {
  return [
    { path: 'index.html', language: 'html', content: html },
    { path: 'style.css', language: 'css', content: css },
    { path: 'script.js', language: 'javascript', content: script },
  ]
}

const webTopics = [
  webTopic({
    id: 'web-html-structure',
    title: 'HTML document structure',
    summary: 'HTML gives a page meaning and structure. The document shell declares the page, metadata, title, and visible body.',
    keywords: ['html', 'doctype', 'head', 'body', 'title', 'meta', 'structure'],
    code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My first page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main>
      <h1>Hafa adai!</h1>
      <p>I built this page in Hafa Code.</p>
    </main>
    <script src="script.js"></script>
  </body>
</html>\n`,
    expectedOutput: 'A page with a heading and paragraph; the browser tab is titled “My first page.”',
    commonMistake: 'Visible page content belongs inside `<body>`, not `<head>`.',
    files: webFiles(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My first page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main>
      <h1>Hafa adai!</h1>
      <p>I built this page in Hafa Code.</p>
    </main>
    <script src="script.js"></script>
  </body>
</html>\n`),
  }),
  webTopic({
    id: 'web-semantic-html',
    title: 'Semantic HTML',
    summary: 'Semantic elements describe each region’s purpose, helping people, browsers, and assistive technology understand the page.',
    keywords: ['semantic', 'header', 'nav', 'main', 'section', 'article', 'footer', 'accessibility'],
    code: `<header>
  <h1>Island Journal</h1>
  <nav aria-label="Main navigation">
    <a href="#stories">Stories</a>
    <a href="#about">About</a>
  </nav>
</header>

<main>
  <section id="stories">
    <h2>Latest stories</h2>
    <article>
      <h3>A morning in Hagåtña</h3>
      <p>The city woke beneath a warm sunrise.</p>
    </article>
  </section>
</main>

<footer>Built on Guam.</footer>\n`,
    expectedOutput: 'A page organized into a header, navigation, main story section, article, and footer.',
    commonMistake: 'Choose elements for meaning, not appearance. CSS controls how a semantic element looks.',
    files: webFiles(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Island Journal</title><link rel="stylesheet" href="style.css" /></head><body><header><h1>Island Journal</h1><nav aria-label="Main navigation"><a href="#stories">Stories</a> <a href="#about">About</a></nav></header><main><section id="stories"><h2>Latest stories</h2><article><h3>A morning in Hagåtña</h3><p>The city woke beneath a warm sunrise.</p></article></section></main><footer>Built on Guam.</footer><script src="script.js"></script></body></html>\n`),
  }),
  webTopic({
    id: 'web-links-images',
    title: 'Links and images',
    summary: 'Links move people to another location. Images need useful alternative text when they communicate information.',
    keywords: ['link', 'anchor', 'href', 'image', 'img', 'alt', 'accessibility'],
    code: `<a href="https://www.guam.gov/">Visit Guam.gov</a>

<img
  src="landscape.svg"
  alt="Green hills beneath a blue sky"
/>\n`,
    expectedOutput: 'A clickable link followed by an image with descriptive alternative text.',
    commonMistake: 'Do not write `alt="image"`. Describe the useful information, or use an empty `alt` for a purely decorative image.',
    files: [
      ...webFiles(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Links and images</title><link rel="stylesheet" href="style.css" /></head><body><main><h1>Explore</h1><a href="https://www.guam.gov/">Visit Guam.gov</a><img src="landscape.svg" alt="Green hills beneath a blue sky" /></main><script src="script.js"></script></body></html>\n`, `${webBaseCss.content}\nimg { display: block; width: 100%; margin-top: 1rem; border-radius: 1rem; }`),
      {
        path: 'landscape.svg',
        language: 'plain',
        content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" role="img" aria-labelledby="title"><title id="title">Green hills beneath a blue sky</title><rect width="900" height="500" fill="#8ed1e8"/><circle cx="735" cy="105" r="58" fill="#ffd166"/><path d="M0 360 Q180 210 390 355 T900 320 V500 H0Z" fill="#2f8062"/><path d="M0 410 Q225 285 455 405 T900 370 V500 H0Z" fill="#136f63"/></svg>\n`,
      },
    ],
  }),
  webTopic({
    id: 'web-forms',
    title: 'Forms and labels',
    summary: 'Forms collect input. A visible label explains every field, and the submit event is where JavaScript can process it.',
    keywords: ['form', 'label', 'input', 'button', 'submit', 'required', 'event'],
    code: `<form id="greeting-form">
  <label for="name">Your name</label>
  <input id="name" name="name" required />
  <button type="submit">Say hello</button>
</form>
<p id="message" aria-live="polite"></p>\n`,
    expectedOutput: 'A labeled name field. Submitting it displays a personalized greeting.',
    commonMistake: 'A placeholder is not a replacement for a label; it disappears when someone starts typing.',
    files: webFiles(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Greeting form</title><link rel="stylesheet" href="style.css" /></head><body><main><h1>Greeting maker</h1><form id="greeting-form"><label for="name">Your name</label><input id="name" name="name" required /><button type="submit">Say hello</button></form><p id="message" aria-live="polite"></p></main><script src="script.js"></script></body></html>\n`, `${webBaseCss.content}\nform { display: grid; gap: .6rem; } input, button { min-height: 44px; padding: .7rem; }`, `document.querySelector("#greeting-form")?.addEventListener("submit", (event) => {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  document.querySelector("#message").textContent = \`Hafa adai, \${form.get("name")}!\`
})\n`),
  }),
  webTopic({
    id: 'web-css-selectors',
    title: 'CSS selectors',
    summary: 'Selectors choose elements to style. Element, class, and ID selectors have different purposes and specificity.',
    keywords: ['css', 'selector', 'class', 'id', 'property', 'style', 'specificity'],
    code: `/* Every paragraph */
p { line-height: 1.6; }

/* Every element with class="note" */
.note { color: #136f63; }

/* The one element with id="important" */
#important { font-weight: 700; }\n`,
    expectedOutput: 'Paragraphs have relaxed spacing; notes are green; the important item is bold.',
    commonMistake: 'Class selectors start with `.` and ID selectors start with `#`. The HTML attribute itself has no prefix.',
    files: webFiles(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>CSS selectors</title><link rel="stylesheet" href="style.css" /></head><body><main><h1>Selector practice</h1><p class="note">Classes can be reused.</p><p id="important">IDs should be unique.</p></main><script src="script.js"></script></body></html>\n`, `${webBaseCss.content}\np { line-height: 1.6; }\n.note { color: #136f63; }\n#important { font-weight: 700; }`),
  }),
  webTopic({
    id: 'web-box-model',
    title: 'The box model',
    summary: 'Every element is a box: content sits inside padding, then a border, then margin separates it from neighbors.',
    keywords: ['css', 'box model', 'margin', 'border', 'padding', 'width', 'box sizing'],
    code: `* { box-sizing: border-box; }

.card {
  width: 100%;
  max-width: 24rem;
  margin: 2rem auto;
  border: 2px solid #e9472f;
  padding: 1.5rem;
  background: white;
}\n`,
    expectedOutput: 'A centered white card with inner space and a red border, never wider than 24rem.',
    commonMistake: 'Without `box-sizing: border-box`, padding and borders add to the declared width.',
    files: webFiles(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Box model</title><link rel="stylesheet" href="style.css" /></head><body><main><article class="card"><h1>The box model</h1><p>Inspect the space around this content.</p></article></main><script src="script.js"></script></body></html>\n`, `${webBaseCss.content}\n.card { width: 100%; max-width: 24rem; margin: 2rem auto; border: 2px solid #e9472f; padding: 1.5rem; background: white; }`),
  }),
  webTopic({
    id: 'web-flexbox-grid',
    title: 'Flexbox and Grid',
    summary: 'Flexbox arranges items in one direction. Grid arranges rows and columns. Both can adapt without fixed pixel layouts.',
    keywords: ['css', 'flexbox', 'grid', 'layout', 'gap', 'columns', 'responsive'],
    code: `.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1rem;
}\n`,
    expectedOutput: 'A single-row toolbar and a card grid that creates as many useful columns as the screen can hold.',
    commonMistake: 'Use `gap` on the flex or grid container instead of adding unrelated margins to every child.',
    files: webFiles(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Layout</title><link rel="stylesheet" href="style.css" /></head><body><main><div class="toolbar"><h1>Projects</h1><button>New</button></div><section class="card-grid"><article>Ruby</article><article>Java</article><article>Python</article></section></main><script src="script.js"></script></body></html>\n`, `${webBaseCss.content}\n.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }\n.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem; }\narticle { background: white; border: 1px solid #d8cbbb; padding: 1.5rem; }`),
  }),
  webTopic({
    id: 'web-responsive-design',
    title: 'Responsive design',
    summary: 'Start with a useful small-screen layout, then use a media query when the content has room for a wider arrangement.',
    keywords: ['responsive', 'mobile', 'desktop', 'media query', 'viewport', 'min width'],
    code: `.layout {
  display: grid;
  gap: 1rem;
}

@media (min-width: 48rem) {
  .layout {
    grid-template-columns: 16rem minmax(0, 1fr);
  }
}\n`,
    expectedOutput: 'One column on narrow screens and a 16rem sidebar beside flexible content on wider screens.',
    commonMistake: 'Do not choose breakpoints only by device names. Add one where the content itself needs more room.',
    files: webFiles(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Responsive layout</title><link rel="stylesheet" href="style.css" /></head><body><main class="layout"><aside><h1>Topics</h1></aside><section><h2>Responsive content</h2><p>Resize the preview to see the layout change.</p></section></main><script src="script.js"></script></body></html>\n`, `${webBaseCss.content}\n.layout { display: grid; gap: 1rem; }\naside, section { background: white; padding: 1rem; }\n@media (min-width: 48rem) { .layout { grid-template-columns: 16rem minmax(0, 1fr); } }`),
  }),
  webTopic({
    id: 'web-dom-events',
    title: 'DOM and events',
    summary: 'The DOM represents the page as JavaScript objects. Select an element, listen for an event, then update a property.',
    keywords: ['javascript', 'dom', 'queryselector', 'event', 'click', 'textcontent', 'add event listener'],
    code: `const button = document.querySelector("#counter")
const output = document.querySelector("#count")
let count = 0

button?.addEventListener("click", () => {
  count += 1
  output.textContent = String(count)
})\n`,
    expectedOutput: 'Each button click increases the visible count by one.',
    commonMistake: 'Make sure the selector matches the HTML. `#counter` looks for `id="counter"`; `.counter` looks for a class.',
    files: webFiles(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>DOM counter</title><link rel="stylesheet" href="style.css" /></head><body><main><h1>Count: <span id="count">0</span></h1><button id="counter">Add one</button></main><script src="script.js"></script></body></html>\n`, `${webBaseCss.content}\nbutton { min-height: 44px; padding: .75rem 1rem; border: 0; background: #e9472f; color: white; }`, `const button = document.querySelector("#counter")
const output = document.querySelector("#count")
let count = 0

button?.addEventListener("click", () => {
  count += 1
  output.textContent = String(count)
})\n`),
  }),
] as const

export const LANGUAGE_GUIDES = {
  ruby: {
    kind: 'ruby',
    label: 'Ruby',
    introduction: 'Readable, expressive syntax with blocks, objects, and a strong “everything is an object” style.',
    topics: rubyTopics,
  },
  javascript: {
    kind: 'javascript',
    label: 'JavaScript',
    introduction: 'The language of browser behavior, also useful for general programming and server-side applications.',
    topics: javascriptTopics,
  },
  python: {
    kind: 'python',
    label: 'Python',
    introduction: 'Whitespace-based syntax designed for clarity, with a large standard library and direct data structures.',
    topics: pythonTopics,
  },
  java: {
    kind: 'java',
    label: 'Java',
    introduction: 'A statically typed, object-oriented language whose structure and syntax provide a strong bridge toward Salesforce Apex.',
    topics: javaTopics,
  },
  web: {
    kind: 'web',
    label: 'HTML, CSS, and JavaScript',
    introduction: 'HTML supplies meaning, CSS controls presentation, and JavaScript adds behavior. Together they make a web page.',
    topics: webTopics,
  },
} as const satisfies Record<ProjectKind, LanguageGuide>

export function languageGuideFor(kind: ProjectKind): LanguageGuide {
  return LANGUAGE_GUIDES[kind]
}

export function filterGuideTopics(guide: LanguageGuide, query: string): readonly LanguageGuideTopic[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return guide.topics

  return guide.topics.filter((topic) => [
    topic.title,
    topic.summary,
    topic.code,
    topic.commonMistake,
    ...topic.keywords,
  ].some((value) => value.toLowerCase().includes(normalizedQuery)))
}
