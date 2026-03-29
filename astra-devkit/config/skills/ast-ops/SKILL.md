---
description: "AST-aware code editing and searching using ast-grep (sg). Activate when modifying code structure: renaming symbols, changing imports, refactoring patterns across files, or finding all references to a function/type."
---

# AST Operations

Use `sg` (ast-grep) for structural code modifications and searches. NEVER use `sed`, `awk`, or string replacement for modifying source code — they are fragile and break on whitespace/formatting changes.

## Editing: `sg --rewrite`

Structurally replace code patterns across files:

```bash
# Replace console.log with structlog
sg -p 'console.log($MSG)' -r 'logger.info($MSG)' -i src/**/*.ts

# Convert named import to type-only import
sg -p 'import { $NAME } from "$MOD"' -r 'import type { $NAME } from "$MOD"' -i src/**/*.ts

# Rename a function across all files
sg -p 'getIncident($$$ARGS)' -r 'fetchIncident($$$ARGS)' -i src/**/*.ts

# Replace deprecated Pydantic pattern
sg -p 'class Config:' -r 'model_config = ConfigDict()' -l python -i src/**/*.py
```

## Searching: `sg -p`

Find structural code patterns (better than grep for code):

```bash
# Find all references to a type
sg -p 'Incident' src/

# Find all async functions with their signatures
sg -p 'async function $NAME($$$PARAMS)' src/

# Find all Protocol definitions
sg -p 'class $NAME(Protocol):' -l python src/

# Find all React components that accept props
sg -p 'function $NAME({ $$$PROPS }: $TYPE)' src/

# Find all FastAPI route handlers
sg -p '@router.$METHOD($$$ARGS)' -l python src/
```

## Metavariables

| Syntax | Matches |
|--------|---------|
| `$NAME` | Single AST node (identifier, expression) |
| `$$$ARGS` | Zero or more nodes (function args, list items) |
| `$$OPT` | Optional single node |

## Rules

- **NEVER** use `sed -i`, `awk`, or string `replace` for code modification
- **ALWAYS** use `sg --rewrite` for structural edits
- **ALWAYS** use `sg -p` for structural code search (better than grep for code patterns)
- Use `-l python` or `-l typescript` to specify language when patterns are ambiguous
- Use `-i` flag for in-place edits (modifies files directly)
- Use `--json` for machine-readable output
- Test patterns without `-i` first to preview matches
