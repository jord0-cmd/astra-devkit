---
name: python-standards
description: Use this skill when writing Python code. Contains modern Python standards including tooling (uv, ruff, mypy), library preferences (polars, httpx, pydantic), type hints, error handling, logging, project structure, and testing with pytest.
---

# Python Standards

Modern Python, done right.

---

## Tooling

### Package Management: `uv`

```bash
uv init           # Start projects
uv add package    # Add dependencies
uv sync           # Install from lockfile
uv run script.py  # Run with correct env
```

Fast, reliable, Rust-powered. Replaces pip, poetry, and pipenv.

### Linting & Formatting: `ruff`

```bash
ruff check .      # Lint
ruff format .     # Format (replaces Black)
```

One tool handles what used to require flake8, isort, Black, and pyupgrade.

### Type Checking: `mypy` (strict mode)

```bash
mypy --strict src/
```

Types aren't optional — they're documentation that the compiler verifies.

---

## Library Preferences

| Need | Use | Not |
|------|-----|-----|
| Data | `polars` | pandas (unless legacy requires it) |
| JSON | `orjson` | stdlib json |
| HTTP | `httpx` | requests |
| CLI | `typer` | argparse |
| Async | `asyncio` + `anyio` | threading |
| Validation | `pydantic` | manual checks |
| Dates | `pendulum` | datetime |
| Logging (prod) | `structlog` | print statements |

### Data: `polars` over pandas

```python
import polars as pl
df = pl.read_csv("data.csv")
result = df.filter(pl.col("value") > 100).group_by("category").agg(pl.col("value").mean())
```

Lazy evaluation, true parallelism, consistent API.

### JSON: `orjson`

```python
import orjson

data = orjson.dumps({"key": "value"})  # Returns bytes
obj = orjson.loads(data)
```

10x faster than stdlib. Handles datetimes, numpy, dataclasses natively.

### HTTP: `httpx`

```python
import httpx

# Sync
response = httpx.get("https://api.example.com")

# Async
async with httpx.AsyncClient() as client:
    response = await client.get("https://api.example.com")
```

Modern, async-native, HTTP/2 support.

### CLI: `typer`

```python
import typer

app = typer.Typer()

@app.command()
def main(name: str, count: int = 1):
    for _ in range(count):
        print(f"Hello {name}")

if __name__ == "__main__":
    app()
```

Type hints become CLI arguments automatically.

### Async: `asyncio` + `anyio`

```python
import anyio

async def main():
    async with anyio.create_task_group() as tg:
        tg.start_soon(task1)
        tg.start_soon(task2)

anyio.run(main)
```

Proper structured concurrency.

### Validation: `pydantic` (v2 — NEVER use v1 patterns)

```python
from pydantic import BaseModel, ConfigDict

class User(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # NOT class Config

    name: str
    email: str
    age: int

user = User(name="Alex", email="alex@example.com", age=30)
```

**DEPRECATED — never use:**
```python
# NO — Pydantic v1 pattern, deprecated
class Config:
    from_attributes = True

# YES — Pydantic v2 pattern
model_config = ConfigDict(from_attributes=True)
```

Runtime validation that plays nice with type checkers. FastAPI's backbone.

### Dates: `pendulum`

```python
import pendulum

now = pendulum.now("UTC")
tomorrow = now.add(days=1)
formatted = now.to_iso8601_string()
```

What datetime should have been.

---

## Code Style

### Naming

```python
# Functions and variables: snake_case
def calculate_total_price(items: list[Item]) -> Decimal:
    pass

# Classes: PascalCase
class OrderProcessor:
    pass

# Constants: SCREAMING_SNAKE_CASE
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT = 30.0

# Private: single underscore prefix
def _internal_helper():
    pass
```

### Formatting

- **Line length**: 88 characters (ruff default)
- **Indentation**: 4 spaces. Never tabs.
- **Quotes**: Double quotes for strings (ruff default)
- **Trailing commas**: Always in multi-line structures

```python
# Yes
config = {
    "host": "localhost",
    "port": 8080,
    "debug": True,  # Trailing comma
}
```

### Imports

```python
# Standard library
from pathlib import Path
import json

# Third party
import polars as pl
from pydantic import BaseModel

# Local
from myproject.utils import helper
from myproject.models import User
```

Ruff handles sorting. Let it.

---

## Type Hints

### Every Function Gets Types

```python
# Yes
def process_data(input_path: Path, threshold: float = 0.5) -> pl.DataFrame:
    ...

# No
def process_data(input_path, threshold=0.5):
    ...
```

### Modern Syntax (Python 3.10+)

```python
# Yes - built-in generics
def get_items(ids: list[int]) -> dict[str, Item]:
    ...

# Avoid - old typing imports
from typing import List, Dict
def get_items(ids: List[int]) -> Dict[str, Item]:
    ...
```

### Union Types

```python
# Yes (Python 3.10+)
def find_user(id: int) -> User | None:
    ...

# Acceptable (older codebases)
from typing import Optional
def find_user(id: int) -> Optional[User]:
    ...
```

### TypedDict for Complex Dicts

```python
from typing import TypedDict

class Config(TypedDict):
    host: str
    port: int
    debug: bool

def load_config() -> Config:
    ...
```

---

## Error Handling

### Be Specific

```python
# Yes
try:
    data = orjson.loads(raw)
except orjson.JSONDecodeError as e:
    logger.error(f"Invalid JSON: {e}")
    raise ValueError(f"Configuration file corrupted: {e}") from e

# No
try:
    data = orjson.loads(raw)
except Exception:
    print("Error!")
```

### Use Custom Exceptions

```python
class ProcessingError(Exception):
    """Raised when data processing fails."""
    pass

class ValidationError(ProcessingError):
    """Raised when validation fails."""
    pass
```

### Context Managers for Resources

```python
# Yes
with Path("data.txt").open() as f:
    content = f.read()

# No
f = open("data.txt")
content = f.read()
f.close()
```

---

## Logging

Use loggers, never print.

```python
import logging

logger = logging.getLogger(__name__)

# Configuration (once, at entry point)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s"
)

# Usage
logger.debug("Processing started")
logger.info(f"Processed {count} items")
logger.warning("Rate limit approaching")
logger.error(f"Failed to connect: {e}")
logger.exception("Unexpected error")  # Includes traceback
```

For production, use `structlog` for structured JSON logging.

---

## Testing with pytest

```python
import pytest
from myproject.processor import process_data

def test_process_data_returns_dataframe():
    # Arrange
    input_data = [{"a": 1}, {"a": 2}]

    # Act
    result = process_data(input_data)

    # Assert
    assert len(result) == 2
    assert "a" in result.columns

def test_process_data_raises_on_empty():
    with pytest.raises(ValueError, match="empty"):
        process_data([])

@pytest.fixture
def sample_config():
    return {"host": "localhost", "port": 8080}

def test_with_fixture(sample_config):
    assert sample_config["port"] == 8080
```

### Mocking External Dependencies

```python
from unittest.mock import patch, MagicMock

def test_api_call():
    with patch("myproject.client.httpx.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"ok": True})
        result = fetch_data()
        assert result["ok"] is True
```

### Property-Based Testing with Hypothesis

Don't just test the cases you thought of — let Hypothesis find the ones you didn't.

```python
from hypothesis import given, strategies as st

@given(st.lists(st.integers()))
def test_sort_is_idempotent(xs):
    assert sorted(sorted(xs)) == sorted(xs)

@given(st.text(min_size=1))
def test_process_never_returns_empty_for_non_empty_input(text):
    result = process(text)
    assert len(result) > 0
```

Hypothesis generates hundreds of edge cases automatically. Use it for any function with non-trivial input space.

### Async Testing

Use pytest-asyncio in auto mode — no decorators needed.

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

```python
async def test_async_fetch():
    async with httpx.AsyncClient() as client:
        response = await client.get("http://localhost:8000/health")
        assert response.status_code == 200
```

### Run with Coverage

```bash
pytest --cov=src --cov-report=term-missing
```

---

## Security

### Secrets

```python
# Yes - environment variables
import os
API_KEY = os.environ["API_KEY"]

# Yes - .env files with python-dotenv
from dotenv import load_dotenv
load_dotenv()

# NEVER
API_KEY = "sk-1234567890"
```

### SQL — Always Parameterised

```python
# Yes
cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))

# NEVER
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")  # SQL injection
```

### Path Handling — Always pathlib

```python
from pathlib import Path
config_path = Path.home() / ".config" / "myapp" / "config.json"
```

---

## Project Structure

```
myproject/
├── src/
│   └── myproject/
│       ├── __init__.py
│       ├── main.py
│       ├── models.py
│       └── utils.py
├── tests/
│   ├── __init__.py
│   ├── test_main.py
│   └── test_models.py
├── pyproject.toml
├── README.md
└── .gitignore
```

### pyproject.toml

```toml
[project]
name = "myproject"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "polars>=0.20",
    "httpx>=0.27",
    "pydantic>=2.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "mypy>=1.8",
    "ruff>=0.3",
]

[tool.ruff]
line-length = 88
target-version = "py311"

[tool.mypy]
strict = true
```

---

## Modern Python Patterns

### Structural Pattern Matching (Python 3.10+)

```python
match command:
    case "quit":
        sys.exit(0)
    case "help" | "?":
        show_help()
    case str(cmd) if cmd.startswith("/"):
        handle_slash_command(cmd)
    case _:
        process_input(command)
```

### Comprehensions Over Loops

```python
# Yes
active_users = [u for u in users if u.is_active]
user_map = {u.id: u for u in users}

# Avoid
active_users = []
for u in users:
    if u.is_active:
        active_users.append(u)
```

### Walrus Operator

```python
# Useful for "compute and check" in one step
if (n := len(data)) > 100:
    logger.warning(f"Large dataset: {n} items")

# In while loops
while chunk := file.read(8192):
    process(chunk)
```

### Validate at Boundaries with Pydantic

Validate external data at the point it enters your system — not deep in business logic.

```python
from pydantic import BaseModel, model_validator

class CreateUserRequest(BaseModel):
    name: str
    email: str
    age: int

    @model_validator(mode="after")
    def validate_age(self) -> "CreateUserRequest":
        if self.age < 0 or self.age > 150:
            raise ValueError("Age must be between 0 and 150")
        return self

# At the API boundary
def create_user(raw_data: dict) -> User:
    request = CreateUserRequest.model_validate(raw_data)  # Validates here
    return user_service.create(request)  # Business logic trusts clean data
```

---

## Pre-Commit Hook Config

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.9.0
    hooks:
      - id: mypy
        additional_dependencies: [pydantic]
```

```bash
uv add --dev pre-commit
pre-commit install
```

Now standards are enforced automatically on every commit.

---

## Docstrings

```python
def calculate_metrics(
    data: pl.DataFrame,
    threshold: float = 0.5,
    include_nulls: bool = False,
) -> dict[str, float]:
    """Calculate statistical metrics for the given dataset.

    Args:
        data: Input DataFrame with numeric columns.
        threshold: Minimum value threshold for filtering.
        include_nulls: Whether to include null values in calculations.

    Returns:
        Dictionary mapping metric names to their values.

    Raises:
        ValueError: If data is empty or has no numeric columns.

    Example:
        >>> df = pl.DataFrame({"values": [1, 2, 3, 4, 5]})
        >>> metrics = calculate_metrics(df, threshold=2.0)
        >>> metrics["mean"]
        3.5
    """
```

---

## Pre-Commit Checklist

Before committing Python code:

- [ ] `ruff check . && ruff format .` — no lint errors, properly formatted
- [ ] `mypy --strict src/` — type checks pass
- [ ] `pytest` — all tests green
- [ ] No `print()` statements (use logger)
- [ ] No hardcoded secrets
- [ ] No commented-out code
- [ ] No TODO/FIXME without ticket reference
- [ ] Docstrings on public functions

---

*Clean code is written by someone who cares about the next person reading it.*
