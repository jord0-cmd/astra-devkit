# Development Standards

These rules apply to every coding session, every language, every project. No exceptions.

---

## Core Philosophy

**Code is communication.** Every line should be clear to someone reading it six months from now — including you.

**Finish what you start.** Incomplete implementations create more problems than they solve. Complete it or don't start it.

**Simplicity wins.** The best solution is the one that works with minimum complexity. Clever code is usually bad code.

---

## The 11 Rules

### 1. Never Make Unauthorised Changes
- Only modify what is explicitly requested
- Never change unrelated code, files, or functionality
- If something else needs changing, ask first

### 2. Dependency Management Is Mandatory
- Always update package manifests when adding imports
- Never add imports without corresponding dependency entries
- Verify all dependencies are declared before suggesting code

### 3. No Placeholders
- Never use "YOUR_API_KEY", "TODO", or dummy data
- Always use proper variable references or configuration patterns
- Environment variables or config files, not hardcoded values

### 4. Questions vs Code Requests
- When asked a question, provide an answer — don't change code
- Only modify code when explicitly requested: "change", "update", "fix"
- Never assume a question is a code change request

### 5. No Assumptions
- If information is missing, ask for clarification
- Never guess library versions, API formats, or implementation details
- State clearly what information you need to proceed

### 6. Security Is Non-Negotiable
- Never put secrets in client-side code
- Always use environment variables for sensitive data
- Always implement proper input validation
- Always implement appropriate access controls for data

### 7. Be Honest About Capabilities
- Never attempt impossible features
- State limitations clearly
- Suggest proper alternatives using appropriate libraries or services

### 8. Preserve Functional Requirements
- Never change core functionality to "fix" errors
- Fix the technical issue, not the requirements
- If requirements seem problematic, ask before changing

### 9. Evidence-Based Responses
- When asked if something is implemented, show the code
- Reference specific files and line numbers
- Never guess implementation status

### 10. No Hardcoded Examples
- Never hardcode example values as permanent solutions
- Always use variables, parameters, or configuration
- If showing examples, clearly mark them as such

### 11. Intelligent Logging
- Log key decision points, data transformations, state changes
- Never over-log trivial operations
- Never under-log critical flows
- Use appropriate levels: ERROR, WARN, INFO, DEBUG
- Include context: user ID, request ID, key parameters

### 12. Modern Python Packaging
- Use `pyproject.toml` for all Python projects — not `requirements.txt`
- Use `uv` for dependency management — not pip or poetry
- Never generate `requirements.txt` as the primary dependency file
- If a project already uses `requirements.txt`, offer to migrate to `pyproject.toml`

### 13. Resist Tutorial Defaults
- When building common patterns (CRUD APIs, auth, user management), do NOT fall back to basic tutorial implementations
- Check if project skills define a more sophisticated approach FIRST
- Our standards exist because the default tutorial way is insufficient
- Use dependency injection, not hardcoded globals
- Use proper project structure, not everything-in-main.py
- Use async patterns where the framework supports them
- The most common implementation on the internet is rarely the best one

### 14. Use Current Library APIs — No Deprecated Patterns
Common deprecated patterns to NEVER use:
- **SQLAlchemy**: `from sqlalchemy.ext.declarative import declarative_base` is DEPRECATED. Use `from sqlalchemy.orm import DeclarativeBase` and `class Base(DeclarativeBase): pass`
- **SQLAlchemy**: `Column(Integer)` style is DEPRECATED for new code. Use `Mapped[int]` with `mapped_column()`
- **Pydantic**: `class Config:` inner class is DEPRECATED. Use `model_config = ConfigDict(from_attributes=True)`
- **Pydantic**: `from typing import Optional` for optional fields. Use `field: str | None = None` (Python 3.10+)
- **FastAPI**: Always create `__init__.py` in app/ and tests/ directories
- **FastAPI**: Always create `pyproject.toml` at project setup — before writing any code

### 15. Asymmetric Planning — Match Strategy to Domain
Different domains need different approaches:
- **Backend / API / Database / IaC**: Jump straight to building. Compiler errors, test failures, and import chains naturally guide completion. Do NOT over-plan.
- **Frontend / Dashboard / UI**: ALWAYS plan first. Enter Plan Mode and design the full component hierarchy before writing any code. Frontend has no compiler gravity — a skeleton that builds is not complete. The plan creates the structural tension.
- **Full-stack**: Build backend first (no plan needed), then plan the frontend component tree before building it.

### 16. Contract-First Integration
For fullstack projects, the API contract MUST exist before frontend implementation begins:
- `docs/api-contract.md` documents every endpoint with method, path, request/response schemas, enum values
- Frontend TypeScript interfaces are DERIVED from the contract — never invented independently
- If you're about to write `.tsx` code and no contract exists, create it first
- Enum values, field names, and types must match EXACTLY between backend and frontend

### 17. Domain Types Over Primitives
Use domain-specific types for business concepts — not bare primitives:
- Python: `NewType("TaskId", str)` or `enum.StrEnum` — not bare `str` for IDs, statuses, priorities
- TypeScript: `type TaskId = string & { __brand: "TaskId" }` or union string literals — not bare `string`
- This prevents accidental misuse: passing a `user_id` where `task_id` is expected
- At minimum, ALL enums MUST be proper enum types, not loose strings

### 18. Accessibility Is Mandatory
All frontend code MUST include accessibility attributes — this is not optional:
- Every interactive element needs `aria-label` or `aria-labelledby`
- Use semantic HTML: `<main>`, `<nav>`, `<section>`, `<header>`, `<footer>` — not `<div>` for everything
- Labels MUST use `htmlFor` to associate with inputs
- Focus states MUST be visible (Tailwind `ring` utilities or equivalent)
- A skip-to-main-content link MUST be the first focusable element
- Colour contrast: 4.5:1 minimum for text

### 19. AST-Aware Code Modification
- NEVER use `sed`, `awk`, or string replacement for modifying source code files
- Use `sg` (ast-grep) for structural code edits: `sg -p 'pattern' -r 'replacement' -i file`
- Use `sg` for structural code search: `sg -p 'pattern' dir/`
- String replacement is fragile — it breaks on whitespace, indentation, and formatting changes
- ast-grep operates on the abstract syntax tree and is format-independent
- If `sg` is not available, use the `replace` tool with sufficient context — never `sed -i`

### 20. Runtime Tool Creation
- If no existing tool solves a problem during implementation, **create a script** in `scripts/` that does
- Utility scripts, data generators, and dev-ops tools MUST go in `scripts/`. NEVER place them in `tests/`
- Save it, use it, document it in GEMINI.md under Key Directories or Commands
- Self-created tools persist across sessions via the hippocampus
- Examples: data migration scripts, custom validators, format converters, test data generators, CSV parsers
- A purpose-built script beats a generic workaround every time

### 21. Build at Project Root
- ALL files and directories must be created in the current working directory root (`./`)
- DO NOT wrap the project in a nested top-level directory named after the project
- If asked to "build X", create `src/`, `tests/`, `pyproject.toml` etc at `./`, NOT inside `./X/`
- The working directory IS the project root — don't create another one inside it

---

## No Mock Services

All code must be production-ready and fully functional.

**Never:**
- Use mock data or placeholder services
- Implement temporary workarounds with TODOs
- Create fallback logic that bypasses core functionality
- Return fake responses "for now"
- Use empty function bodies

**Always:**
- Implement real, working solutions
- Connect to actual services
- Solve the root problem, not symptoms
- Complete all functionality before moving on

---

## The Confirm Protocol

Before implementing any new feature or significant change, **state the plan back**:

> "We're building X to achieve Y. It connects to Z. The constraints are W."

This is not optional. This is not "ask if unsure." This is proving alignment before writing code.

If a request for something new lacks context — what it does, why, what it connects to, what the constraints are — don't guess. Push back:

> "I need more context before I start. Tell me: 1. What does this connect to? 2. What happens if it fails?"

Most wrong implementations happen in the gap between what someone pictures in their head and what gets built. Close the gap before writing a single line.

---

## The Three Fix Rule

After 3 failed attempts to fix the same issue:

1. **Stop** writing code
2. **Declare**: "Three fixes failed. This looks structural, not implementation."
3. **Step back**: Examine the design, not the code
4. **Propose**: A structural change, not another patch

If three patches didn't work, the problem isn't in the patch — it's in the foundation.

---

## Quality Gates

Verification checkpoints at transition boundaries. Move fast between gates, but you cannot pass one without the check.

| Gate | When | What to Verify |
|------|------|----------------|
| **Gate 0: Confirm** | Before starting new work | State plan, get confirmation |
| **Gate 1: Build** | After implementation | Project builds clean — no errors, no warnings |
| **Gate 2: Test** | After integration | Tests pass, no regressions |
| **Gate 3: Pre-Commit** | Before committing | Lint clean, no secrets, no TODOs |

Between gates: move fast, experiment, iterate. That's where the best work happens.

---

## Debugging Standards

When something breaks:

1. **Reproduce**: Can you make it fail consistently?
2. **Isolate**: What's the smallest code that fails?
3. **Instrument**: Add logging, not print statements
4. **Hypothesise**: What do you think is wrong?
5. **Test**: Verify the hypothesis
6. **Fix**: Address root cause, not symptoms
7. **Verify**: Does the original issue still occur?
8. **Prevent**: Add a test to catch regression

---

## Code Review Checklist

Before shipping:

- [ ] All functions have type hints or equivalent
- [ ] Error handling is complete
- [ ] Logging is sufficient for debugging
- [ ] No hardcoded values — use config
- [ ] Tests cover the happy path and edge cases
- [ ] No commented-out code
- [ ] No TODO comments without a ticket or issue reference
- [ ] Imports are organised
- [ ] Variable names are descriptive
- [ ] Functions are under 50 lines
- [ ] Classes are under 300 lines

---

## Feature Completion Criteria

**A feature is complete when:**
1. All code implemented — no placeholders
2. All errors handled appropriately
3. Tests written and passing
4. Standards compliance verified
5. Documentation complete
6. Integration tested
7. No known bugs

**Incomplete features must not be committed to main, marked as done, or deployed.**

---

## Emergency Stop

Specific triggers — not vague "if unsure":

- **Ambiguous deliverable**: What exactly are we building? — Run Confirm (Gate 0)
- **SDK/package selection**: State exact name, verify it exists before installing
- **Visual tuning**: After 2 iterations without convergence — stop, get acceptance criteria
- **New project scaffold**: Confirm stack, structure, and template before creating files
- **Three fixes failed**: Stop patching, declare structural

If none of the above apply but you're still uncertain:
1. Stop code generation
2. Ask for clarification
3. Wait for explicit confirmation

**Better to ask than to break everything.**

---

*Quality over speed. Complete over partial. Working over "almost working."*
