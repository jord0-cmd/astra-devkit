---
name: rust-standards
description: Use this skill when writing Rust code. Contains error handling (thiserror/anyhow), async patterns (tokio/axum), crate preferences, performance patterns, testing with cargo-nextest and proptest, and the cardinal rules for safe Rust.
---

# Rust Standards

Rust doesn't just catch bugs — it makes entire categories of bugs impossible. The compiler is your partner, not your enemy. When it yells at you, it's saving future-you from a 3am debugging session.

---

## Tooling

### Project Management: `cargo`

```bash
cargo new myproject      # Create project
cargo build --release    # Build optimized
cargo test               # Run tests
cargo clippy             # Lint
cargo fmt                # Format
cargo doc --open         # Generate docs
```

### Linting: `clippy`

```bash
cargo clippy -- -W clippy::all -W clippy::pedantic
```

Clippy catches patterns that compile but are suboptimal. If clippy complains, fix it.

### Formatting: `rustfmt`

```bash
cargo fmt
```

No debates. rustfmt decides. Configure once in `rustfmt.toml`.

### Testing: `cargo-nextest`

```bash
cargo install cargo-nextest
cargo nextest run         # Faster than cargo test, better output
```

Parallel test execution, better failure reporting. Drop-in replacement for `cargo test`.

---

## Crate Preferences

| Need | Use | Notes |
|------|-----|-------|
| Error (library) | `thiserror` | Typed, matchable errors |
| Error (app) | `anyhow` | Context-rich, convenient |
| Serialization | `serde` + `serde_json` | High-perf JSON: `simd-json`. Binary: `bincode` |
| Async runtime | `tokio` | The standard. Use specific feature flags. |
| HTTP client | `reqwest` | Async-native, built on tokio |
| HTTP server | `axum` | Modern, tower-based, great ergonomics |
| CLI | `clap` (derive) | Type-safe CLI from structs |
| Data | `polars` | Lazy eval, parallel, fast |
| Logging | `tracing` | Structured, async-aware |
| Parallelism | `rayon` | Data parallelism with `par_iter` |
| Progress | `indicatif` | Progress bars and spinners |
| TUI | `ratatui` + `crossterm` | Terminal UIs |

---

## Error Handling

### Library Code: `thiserror`

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ProcessingError {
    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("IO error")]
    Io(#[from] std::io::Error),

    #[error("parse error at line {line}: {message}")]
    Parse { line: usize, message: String },
}
```

**Error message conventions:**
- Lowercase, no trailing punctuation
- Describe only this error, not the whole chain
- Always derive `Debug`

### Application Code: `anyhow`

```rust
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let config = load_config()
        .context("failed to load configuration")?;
    Ok(())
}
```

### When to Use Which

- **thiserror** — library code where callers match on variants
- **anyhow** — application code where errors get logged or displayed
- **Don't over-engineer** — if you have 20 variants and callers handle them the same way, group related errors or use `#[error(transparent)]`

### The `?` Operator

```rust
fn load_and_parse(path: &Path) -> Result<Config> {
    let content = fs::read_to_string(path)?;
    let config = serde_json::from_str(&content)?;
    Ok(config)
}
```

### Add Context to Errors

```rust
use anyhow::Context;

// Use with_context for dynamic messages (avoids formatting when not needed)
let config = fs::read_to_string(&path)
    .with_context(|| format!("failed to read config from {}", path.display()))?;
```

---

## Async / Tokio

### Basic Setup

```rust
#[tokio::main]
async fn main() {
    let result = fetch_data().await;
}
```

### Production Feature Flags

```toml
# Don't use "full" in production — only what you need
[dependencies]
tokio = { version = "1", features = ["rt-multi-thread", "macros", "net", "time", "signal"] }
```

Smaller compile times, smaller binary.

### Blocking Operations

```rust
// CPU-bound or blocking I/O in async context — use spawn_blocking
let result = tokio::task::spawn_blocking(|| {
    expensive_computation()
}).await?;
```

Never block the async executor with CPU-heavy work, filesystem calls, or synchronous mutexes.

### Don't Over-Spawn

If you spawn thousands of micro-tasks that each do almost nothing, scheduling overhead exceeds useful work. Batch small operations instead.

### Graceful Shutdown

```rust
use tokio::signal;

#[tokio::main]
async fn main() -> Result<()> {
    let app = build_app();

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    signal::ctrl_c()
        .await
        .expect("failed to listen for ctrl+c");
    tracing::info!("shutdown signal received");
}
```

### HTTP Server: `axum`

```rust
use axum::{
    routing::{get, post},
    Router, Json, extract::State,
};

async fn health() -> &'static str {
    "OK"
}

async fn create_user(
    State(db): State<Database>,
    Json(payload): Json<CreateUser>,
) -> Result<Json<User>, AppError> {
    let user = db.create_user(payload).await?;
    Ok(Json(user))
}

let app = Router::new()
    .route("/health", get(health))
    .route("/users", post(create_user))
    .with_state(database);
```

### HTTP Client: `reqwest`

```rust
let client = reqwest::Client::new();
let data: ApiResponse = client
    .get("https://api.example.com/data")
    .header("Authorization", format!("Bearer {}", token))
    .send()
    .await?
    .json()
    .await?;
```

---

## Serialization: `serde`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Config {
    host: String,
    port: u16,
    #[serde(default)]
    debug: bool,
}

let config: Config = serde_json::from_str(&json_str)?;
let json = serde_json::to_string_pretty(&config)?;
```

---

## CLI: `clap` (derive)

```rust
use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "myapp", about = "Does awesome things")]
struct Args {
    /// Input file path
    #[arg(short, long)]
    input: PathBuf,

    /// Verbosity level
    #[arg(short, long, action = clap::ArgAction::Count)]
    verbose: u8,

    /// Number of threads
    #[arg(short, long, default_value = "4")]
    threads: usize,
}

fn main() {
    let args = Args::parse();
}
```

---

## Logging: `tracing`

```rust
use tracing::{info, warn, error, instrument, Level};
use tracing_subscriber::FmtSubscriber;

// Setup
let subscriber = FmtSubscriber::builder()
    .with_max_level(Level::DEBUG)
    .finish();
tracing::subscriber::set_global_default(subscriber)?;

// Usage — #[instrument] adds function args to span
#[instrument]
fn process_data(input: &str) -> Result<Output> {
    info!(input_len = input.len(), "processing started");
    warn!("approaching rate limit");
    error!(?err, "processing failed");
}
```

---

## The Cardinal Rules

### NEVER `.unwrap()` in Library Code

```rust
// NEVER in library code
let value = some_option.unwrap();  // Panics on None

// YES — return errors
let value = some_option.ok_or(MyError::MissingValue)?;

// ACCEPTABLE — when invariant is guaranteed and documented
let value = some_option.expect("value always set after init");
```

`.unwrap()` in main() for prototyping? Fine. In a library? Unacceptable.

### Handle ALL Results

```rust
// NO — ignoring errors
let _ = file.write_all(data);

// YES — explicit handling
file.write_all(data)?;

// YES — if you truly don't care (rare, make it explicit)
let _ = file.write_all(data).ok();
```

### Avoid `unsafe` Unless Necessary

```rust
/// # Safety
/// Caller must ensure `ptr` is valid and properly aligned.
unsafe fn dangerous_operation(ptr: *const u8) {
    // SAFETY: We checked alignment in the caller
    let value = *ptr;
}
```

99% of code should be safe. If you're reaching for unsafe often, you're fighting the language.

---

## Code Style

### Naming

```rust
// Functions and variables: snake_case
fn calculate_total_price(items: &[Item]) -> Decimal { }

// Types, Traits, Enums: PascalCase
struct OrderProcessor { }
trait Serializable { }
enum ConnectionState { }

// Constants: SCREAMING_SNAKE_CASE
const MAX_CONNECTIONS: usize = 100;

// Lifetimes: short lowercase
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str { }
```

### Imports

```rust
// Group and order: std → external → crate
use std::collections::HashMap;
use std::path::PathBuf;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use tokio::fs;

use crate::config::Config;
use crate::error::AppError;
```

---

## Performance

### Avoid Allocations in Hot Paths

```rust
// Reuse buffers instead of allocating
fn process_into(items: &[Item], buffer: &mut Vec<String>) {
    buffer.clear();
    buffer.extend(items.iter().map(|i| &i.name));
}
```

### Use Iterators (Lazy, No Intermediates)

```rust
let sum: i32 = items
    .iter()
    .filter(|i| i.active)
    .map(|i| i.value)
    .sum();
```

### Prefer `&str` Over `String` in Parameters

```rust
// YES — accepts both String and &str
fn process(input: &str) -> Result<Output> { }
```

### Use `Cow` for Conditional Ownership

```rust
use std::borrow::Cow;

fn process(input: &str) -> Cow<'_, str> {
    if needs_modification(input) {
        Cow::Owned(modify(input))
    } else {
        Cow::Borrowed(input)
    }
}
```

### Data Parallelism: `rayon`

```rust
use rayon::prelude::*;

let results: Vec<_> = items
    .par_iter()
    .map(|item| expensive_computation(item))
    .collect();
```

---

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_input() {
        let result = parse("valid input");
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_invalid_input() {
        let result = parse("invalid");
        assert!(matches!(result, Err(ParseError::Invalid(_))));
    }
}
```

### Integration Tests

```rust
// tests/integration_test.rs
use mylib::Client;

#[tokio::test]
async fn test_full_workflow() {
    let client = Client::new();
    let result = client.process().await;
    assert!(result.is_ok());
}
```

### Property-Based Testing: `proptest`

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_roundtrip(s in "\\PC*") {
        let encoded = encode(&s);
        let decoded = decode(&encoded)?;
        prop_assert_eq!(s, decoded);
    }
}
```

---

## Documentation

### Every Public Item Gets Docs

```rust
/// A high-performance data processor.
///
/// # Examples
///
/// ```
/// use mylib::Processor;
/// let processor = Processor::new(Config::default());
/// let results = processor.process(&data)?;
/// ```
pub struct Processor { ... }
```

### Document Panics and Safety

```rust
/// # Panics
/// Panics if `divisor` is zero.
pub fn divide(dividend: i32, divisor: i32) -> i32 { ... }

/// # Safety
/// The caller must ensure that `ptr` points to a valid, aligned `T`.
pub unsafe fn read_ptr<T>(ptr: *const T) -> T { ... }
```

---

## Project Structure

```
myproject/
├── src/
│   ├── lib.rs          # Library root
│   ├── main.rs         # Binary root
│   ├── config.rs
│   ├── error.rs
│   └── processor/
│       ├── mod.rs
│       └── worker.rs
├── tests/
│   └── integration.rs
├── benches/
│   └── benchmark.rs
├── Cargo.toml
├── rustfmt.toml
└── README.md
```

### Cargo.toml

```toml
[package]
name = "myproject"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"

[dependencies]
tokio = { version = "1", features = ["rt-multi-thread", "macros", "net", "signal"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = "0.3"

[dev-dependencies]
tokio-test = "0.4"
proptest = "1"

[profile.release]
lto = true
codegen-units = 1
panic = "abort"
```

### rustfmt.toml

```toml
max_width = 100
use_small_heuristics = "Default"
edition = "2021"
```

---

## Pre-Commit Checklist

```bash
cargo fmt                           # Format
cargo clippy -- -W clippy::all      # Lint
cargo nextest run                   # Test
cargo doc --no-deps                 # Docs build
```

Manual checks:
- [ ] No `unwrap()` in library code
- [ ] No `unsafe` without documentation
- [ ] No `todo!()` or `unimplemented!()` in production paths
- [ ] Error types are meaningful and derive Debug
- [ ] Error messages are lowercase, no trailing punctuation
- [ ] Public API is documented with examples
- [ ] Tokio features are specific, not "full"

---

*Make it compile. Make it correct. Make it fast. In that order.*
