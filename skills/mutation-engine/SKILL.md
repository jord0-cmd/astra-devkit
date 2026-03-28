---
description: "AST-driven mutation testing. Activate when: verifying test quality, checking if tests actually defend the architecture, proving test coverage is structural not cosmetic, or after generating tests for new code."
---

# Mutation Engine

Prove tests defend the architecture. Do NOT trust test pass rates alone.

## When to Use

After writing tests for any codebase. Mutation testing answers:
"Do these tests actually catch bugs, or do they just run green?"

## How It Works

1. Copy `references/mutate_test.py` to `scripts/mutate_test.py` in the project
2. Define mutations targeting the codebase's critical paths
3. Run: `python3 scripts/mutate_test.py`
4. Three verdicts: KILLED (good), SURVIVED (test gap), FAILED TO APPLY (bad pattern)

## Writing Mutations

```python
Mutation(
    file="src/domain/models.py",           # Target file
    pattern="status: Status = Status.BACKLOG",  # sg pattern to find
    replacement="status: Status = Status.DONE",  # What to replace with
    description="Flip default status",      # Human-readable
    category="value",                       # value | logic | structural | boundary
)
```

## Mutation Categories

| Category | What to Mutate | Example |
|----------|---------------|---------|
| **value** | Default values, enum assignments | Flip `BACKLOG` to `DONE` |
| **logic** | Return values, status codes, conditionals | Force `return []`, change 201 to 200 |
| **structural** | Remove fields, middleware, guards | Comment out required field, remove CORS |
| **boundary** | Validation constraints, limits | Remove `min_length`, strip `Query()` params |

## Critical Rules

1. **ALWAYS use `--lang python` and `--update-all`** with sg. Without these, mutations silently fail.
2. **ALWAYS verify mutations applied** via diff before trusting results. The engine does this automatically.
3. **Three states, not two.** FAILED TO APPLY is not KILLED. Silent tool failure = false positive.
4. **Test patterns without replacement first**: `sg -p 'your_pattern' --lang python file.py`
5. **Use attribute expressions, not keyword arguments** for sg patterns. `status.HTTP_201_CREATED` works, `status_code=status.HTTP_201_CREATED` does not.

## sg Pattern Reference

| Syntax | Matches | Example |
|--------|---------|---------|
| `$NAME` | Single AST node | `Status.$NAME` matches `Status.BACKLOG` |
| `$$$ARGS` | Zero or more nodes | `repo.list($$$ARGS)` matches any args |
| Literal | Exact match | `status: Status = Status.BACKLOG` |

## Interpreting Results

- **100% killed**: Tests structurally defend the code. Ship it.
- **Survivors found**: Tests have gaps. Write tests that fail when the surviving mutation is applied.
- **Many FAILED TO APPLY**: Pattern engineering issue. Test patterns with `sg -p` first.

## Target Selection

Mutate the **critical paths** first:
1. Domain model defaults and constraints (Pydantic fields, enums)
2. API status codes (201, 204, 404)
3. Return values from repository/service calls
4. Middleware and security configuration
5. Validation boundaries (min/max, required fields)
