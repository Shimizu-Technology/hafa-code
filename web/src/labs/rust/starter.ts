/** The first project a learner sees: one program that touches each guide topic. */
export const STARTER_SOURCE = `// Welcome to the Rust Lab! Press Run (Ctrl+Enter) to compile and run this program.

#[derive(Debug)]
enum Level {
    Beginner,
    Builder,
}

struct Student {
    name: String,
    scores: Vec<u32>,
}

impl Student {
    fn average(&self) -> f64 {
        let total: u32 = self.scores.iter().sum();
        total as f64 / self.scores.len() as f64
    }

    fn level(&self) -> Level {
        if self.average() >= 80.0 { Level::Builder } else { Level::Beginner }
    }
}

fn parse_score(text: &str) -> Result<u32, std::num::ParseIntError> {
    text.trim().parse::<u32>()
}

fn main() {
    let mut student = Student { name: String::from("Ana"), scores: vec![78, 85] };

    match parse_score("92") {
        Ok(score) => student.scores.push(score),
        Err(error) => println!("Could not read the score: {error}"),
    }

    println!("Hafa adai, {}!", student.name);
    println!("Average: {:.1}", student.average());
    println!("Level: {:?}", student.level());
}
`
