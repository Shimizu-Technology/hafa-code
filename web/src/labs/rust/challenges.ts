import type { RustGuideTopicId } from './guide'

export interface RustChallenge {
  id: string
  title: string
  level: 'Starter' | 'Builder' | 'Stretch'
  topic: RustGuideTopicId
  prompt: string
  starter: string
  expectedOutput: string
  hints: string[]
}

export const RUST_CHALLENGES: RustChallenge[] = [
  {
    id: 'rust-greeting',
    title: 'Count down to launch',
    level: 'Starter',
    topic: 'variables',
    prompt: 'Use a mutable counter to print 3, 2, 1, then "Liftoff!" on separate lines.',
    starter: `fn main() {
    let count = 3;
    // Print the count, then lower it by 1, until it reaches 0.

    println!("Liftoff!");
}
`,
    expectedOutput: '3\n2\n1\nLiftoff!',
    hints: ['A variable that changes needs let mut.', 'while count > 0 { ... } repeats while the condition is true.', 'count -= 1; lowers the counter.'],
  },
  {
    id: 'rust-ownership',
    title: 'Keep the name',
    level: 'Starter',
    topic: 'ownership',
    prompt: 'This program does not compile (E0382). Fix it so it prints "Hello, Ana!" and then "Ana has 3 letters".',
    starter: `fn greet(name: String) {
    println!("Hello, {name}!");
}

fn main() {
    let name = String::from("Ana");
    greet(name);
    println!("{} has {} letters", name, name.len());
}
`,
    expectedOutput: 'Hello, Ana!\nAna has 3 letters',
    hints: ['greet takes ownership of the String, so name moves away.', 'Change greet to borrow: fn greet(name: &str) and call greet(&name).'],
  },
  {
    id: 'rust-borrowing',
    title: 'Grow the list safely',
    level: 'Builder',
    topic: 'borrowing',
    prompt: 'Fix the borrow error (E0502) so the program prints "first was 4" and then "[4, 8, 15]".',
    starter: `fn main() {
    let mut numbers = vec![4, 8];
    let first = &numbers[0];
    numbers.push(15);
    println!("first was {first}");
    println!("{:?}", numbers);
}
`,
    expectedOutput: 'first was 4\n[4, 8, 15]',
    hints: ['first borrows numbers while push needs to change it.', 'Copy the number instead: let first = numbers[0];'],
  },
  {
    id: 'rust-shapes',
    title: 'Area of every shape',
    level: 'Builder',
    topic: 'structs',
    prompt: 'Finish area() with a match so the program prints each area: "square: 9", "rectangle: 8", "triangle: 6".',
    starter: `enum Shape {
    Square(u32),
    Rectangle(u32, u32),
    Triangle { base: u32, height: u32 },
}

fn area(shape: &Shape) -> u32 {
    // Return the area of each kind of shape.
    0
}

fn main() {
    let shapes = [("square", Shape::Square(3)), ("rectangle", Shape::Rectangle(2, 4)), ("triangle", Shape::Triangle { base: 4, height: 3 })];
    for (name, shape) in &shapes {
        println!("{name}: {}", area(shape));
    }
}
`,
    expectedOutput: 'square: 9\nrectangle: 8\ntriangle: 6',
    hints: ['match shape { Shape::Square(side) => side * side, ... }', 'A triangle is base * height / 2.'],
  },
  {
    id: 'rust-results',
    title: 'Add up the valid scores',
    level: 'Stretch',
    topic: 'results',
    prompt: 'Write parse_score so it returns an error for text that is not a number. Print the total of the valid scores: "skipped: abc" then "total: 30".',
    starter: `fn parse_score(text: &str) -> Result<u32, String> {
    // Use text.parse::<u32>() and turn its error into a String.
    Ok(0)
}

fn main() {
    let mut total = 0;
    for text in ["10", "abc", "20"] {
        match parse_score(text) {
            Ok(score) => total += score,
            Err(_) => println!("skipped: {text}"),
        }
    }
    println!("total: {total}");
}
`,
    expectedOutput: 'skipped: abc\ntotal: 30',
    hints: ['text.parse::<u32>() returns Result<u32, ParseIntError>.', '.map_err(|error| error.to_string()) turns the error into a String.'],
  },
]

/** Compares program output with the expected text, ignoring trailing spaces and blank lines at the end. */
export function outputMatches(actual: string, expected: string) {
  const normalize = (text: string) => text.replace(/\r\n/g, '\n').split('\n').map((line) => line.trimEnd()).join('\n').trimEnd()
  return normalize(actual) === normalize(expected)
}

export function challengeById(id: string) {
  return RUST_CHALLENGES.find((challenge) => challenge.id === id) ?? null
}
