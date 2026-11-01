export type RustGuideTopicId = 'variables' | 'ownership' | 'borrowing' | 'structs' | 'results'

export interface RustGuideTopic {
  id: RustGuideTopicId
  title: string
  summary: string
  points: string[]
  /** A complete program that compiles and runs. */
  example: string
}

export const RUST_GUIDE: RustGuideTopic[] = [
  {
    id: 'variables',
    title: 'println! and variables',
    summary: 'Print values and decide which variables may change.',
    points: [
      'println!("{}", value) prints a value. {name} inside the string prints a variable by name.',
      'let creates a variable. It cannot change unless you write let mut.',
      'Rust usually works out the type, but you can write it: let age: u32 = 16;',
      'Common types: i32 and u32 for whole numbers, f64 for decimals, bool, char, and String for text you own.',
    ],
    example: `fn main() {
    let name = "Ana";
    let mut score: u32 = 10;
    println!("{name} starts with {score} points");

    score += 5; // allowed because score is mut
    println!("{} now has {} points", name, score);

    let average: f64 = (score as f64) / 2.0;
    println!("Half of that is {average:.1}");
}
`,
  },
  {
    id: 'ownership',
    title: 'Ownership and moves',
    summary: 'Every String and Vec has exactly one owner.',
    points: [
      'When you assign a String to another variable, ownership moves. The old name can no longer be used.',
      'Passing a String to a function moves it into that function, too.',
      'Numbers, bool, and char are Copy: assigning them copies the value instead of moving it.',
      'Use .clone() when you really need a second, independent copy. Error E0382 means a value was used after it moved.',
    ],
    example: `fn shout(text: String) -> String {
    text.to_uppercase()
}

fn main() {
    let greeting = String::from("hafa adai");
    let copy = greeting.clone(); // a separate String
    let loud = shout(greeting); // greeting moves into shout
    println!("{loud}");
    println!("{copy}");

    let a = 5;
    let b = a; // i32 is Copy, so a is still usable
    println!("{a} {b}");
}
`,
  },
  {
    id: 'borrowing',
    title: 'Borrowing and references',
    summary: 'Lend a value with & instead of moving it.',
    points: [
      '&value lends a read-only reference. Many shared references can exist at once.',
      '&mut value lends a reference that can change the value, and only one may exist at a time.',
      'While a shared reference is still used, the value cannot be changed (E0502). Two &mut at once is E0499.',
      'A reference stops counting as soon as it is last used, so ordering your lines often fixes borrow errors.',
    ],
    example: `fn count_letters(text: &str) -> usize {
    text.chars().filter(|c| c.is_alphabetic()).count()
}

fn add_bonus(scores: &mut Vec<u32>) {
    for score in scores.iter_mut() {
        *score += 5;
    }
}

fn main() {
    let name = String::from("Guam");
    println!("{} has {} letters", name, count_letters(&name));
    println!("{name} is still ours to use");

    let mut scores = vec![70, 85, 90];
    add_bonus(&mut scores);
    let first = scores[0]; // copy the number out
    scores.push(100);
    println!("first: {first}, all: {:?}", scores);
}
`,
  },
  {
    id: 'structs',
    title: 'Structs, enums, and match',
    summary: 'Group data with struct; list possibilities with enum; handle each with match.',
    points: [
      'A struct groups named fields. impl adds methods; &self lets a method read the struct.',
      'An enum is one value out of a fixed set of variants, and a variant can carry data.',
      'match must handle every variant. The compiler tells you if one is missing.',
      'Add #[derive(Debug)] to print a struct or enum with {:?}.',
    ],
    example: `#[derive(Debug)]
enum Weather {
    Sunny,
    Rainy { millimeters: u32 },
    Typhoon(String),
}

struct Day {
    name: String,
    weather: Weather,
}

impl Day {
    fn advice(&self) -> String {
        match &self.weather {
            Weather::Sunny => String::from("Go to the beach"),
            Weather::Rainy { millimeters } if *millimeters > 20 => String::from("Stay inside"),
            Weather::Rainy { .. } => String::from("Bring an umbrella"),
            Weather::Typhoon(name) => format!("Shelter from Typhoon {name}"),
        }
    }
}

fn main() {
    let week = vec![
        Day { name: String::from("Monday"), weather: Weather::Sunny },
        Day { name: String::from("Tuesday"), weather: Weather::Rainy { millimeters: 30 } },
        Day { name: String::from("Friday"), weather: Weather::Typhoon(String::from("Mawar")) },
    ];
    for day in &week {
        println!("{}: {:?} -> {}", day.name, day.weather, day.advice());
    }
}
`,
  },
  {
    id: 'results',
    title: 'Result and the ? operator',
    summary: 'Handle things that can fail without crashing.',
    points: [
      'A function that can fail returns Result<T, E>: Ok(value) on success or Err(error) on failure.',
      'match on a Result to handle both cases.',
      'Inside a function that returns Result, value? returns the error to the caller early.',
      'unwrap() stops the program (a panic) on Err; prefer match or ? in real code.',
    ],
    example: `use std::num::ParseIntError;

fn double(text: &str) -> Result<i32, ParseIntError> {
    let number: i32 = text.trim().parse()?;
    Ok(number * 2)
}

fn main() {
    for input in ["21", "seven", " 50 "] {
        match double(input) {
            Ok(value) => println!("{input:?} doubled is {value}"),
            Err(error) => println!("{input:?} is not a number: {error}"),
        }
    }
}
`,
  },
]

export function guideTopic(id: RustGuideTopicId) {
  return RUST_GUIDE.find((topic) => topic.id === id)!
}
