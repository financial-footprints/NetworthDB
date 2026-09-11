//! Generate Bruno OneCard PDF fixture from anonymized golden text.
//!
//! User-run:
//!   cargo run -p statements --bin gen-bruno-pdf

use std::fs;
use std::path::PathBuf;

use statements::write_text_pdf;

fn main() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let text_path = manifest_dir.join("tests/fixtures/onecard/default/sample.txt");
    let output_path =
        manifest_dir.join("../../apps/api/tests/bruno/11 Jobs/fixtures/statement.pdf");

    let text = fs::read_to_string(&text_path).expect("read sample.txt");
    write_text_pdf(&output_path, &text).expect("write statement.pdf");
    println!("Wrote {}", output_path.display());
}
