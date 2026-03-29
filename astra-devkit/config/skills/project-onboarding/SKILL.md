---
name: project-onboarding
description: Use this skill when starting work on a new project, onboarding a codebase, creating or updating a project GEMINI.md, generating module summaries, or when opening a project with no context file. Also use proactively when you notice a project lacks a GEMINI.md.
---

# Project Onboarding

Systematic project setup so the AI never starts blind.

---

## The Problem

Without project context, AI coding tools:
- Don't know the architecture, tech stack, or conventions
- Guess at directory structure and import patterns
- Miss project-specific gotchas that waste hours
- Generate code that doesn't match the existing style

A well-configured project context file compresses onboarding from hours to seconds.

---

## Two Layers of Project Intelligence

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: GEMINI.md (Auto-loaded every session)         │
│  Architecture, commands, conventions, gotchas            │
│  → AI knows the project the moment the session starts   │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Module Summaries (In project docs)            │
│  Natural language descriptions of key modules           │
│  → "What handles authentication?" answered instantly    │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Project Scan

Before writing any context file, understand the project:

```bash
# 1. Top-level structure
ls -la

# 2. Doc and config files
find . -maxdepth 3 -type f \( -name "*.md" -o -name "*.json" \
  -o -name "*.toml" -o -name "*.yaml" -o -name "*.yml" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/venv/*" | sort

# 3. Source code map
find . -maxdepth 4 -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \
  -o -name "*.rs" -o -name "*.go" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/venv/*" | sort

# 4. Git history (recent development context)
git log --oneline -30

# 5. Existing context?
cat GEMINI.md 2>/dev/null || cat CLAUDE.md 2>/dev/null || echo "No context file found"
```

Read key files: README, architecture docs, package manifests (pyproject.toml, package.json, Cargo.toml), main entry points, config files.

---

## Phase 2: Create Project GEMINI.md

### Important: Global vs Project Context

**DO NOT modify `~/.gemini/GEMINI.md`** — that's the global config (Astra personality + standards). It's managed by the package installer and applies to all projects.

This skill creates a **project-level** context file in the project root. Both load together — they stack, they don't replace each other.

### How Context Files Work

| Scope | Path | When Loaded | Who Manages It |
|-------|------|-------------|---------------|
| **Global** | `~/.gemini/GEMINI.md` | Always (all projects) | Package installer — don't touch |
| **Project** | `./GEMINI.md` or `./.gemini/GEMINI.md` | When working in this project | This skill creates it |
| **Subdirectory** | `./backend/GEMINI.md` | JIT — when tools access that dir | Create as needed |

Project context is loaded in addition to global. The AI gets Astra's personality AND the project-specific knowledge.

**The Golden Test**: For each line, ask *"Would removing this cause the AI to make mistakes?"* If not, cut it.

### The Template

**Target: 100-300 lines. Max: 500. Every line must earn its place.**

```markdown
# Project Name

{One sentence: what this project IS and DOES.}

## Architecture

{2-5 lines. How the system is structured. Only what can't be inferred from code.}

## Tech Stack

- **Frontend**: {framework, language, key libs}
- **Backend**: {framework, language, key libs}
- **Database**: {type, ORM, sync/async}
- **Infrastructure**: {Docker, K8s, cloud provider}

## Commands

```bash
# Start development
{exact command}

# Run tests
{exact command}

# Build for production
{exact command}

# Database migrations
{exact command}

# Lint and format
{exact command}
```

## Key Directories

| Path | What's There |
|------|-------------|
| `src/api/routes/` | API endpoint handlers |
| `src/services/` | Business logic layer |
| `src/models/` | Database models |
| `frontend/src/components/` | React components |

## Key Patterns

- {Non-obvious pattern that would cause mistakes without knowing it}
- {Another critical convention}

## Gotchas

- {Thing that WILL trip you up if you don't know it}
- {Another gotcha — save debugging hours by reading this}
```

### Rules for Writing GEMINI.md

1. **Only include what prevents mistakes.** If you'd figure it out from reading code, leave it out.
2. **Commands must be copy-paste ready.** Not "run the start script" — the actual command.
3. **Key Directories, not File Maps.** List directories with purposes, not individual files.
4. **No duplicating README.** GEMINI.md is for the AI. README is for humans. Different content.
5. **Be specific.** "FastAPI with async SQLAlchemy 2.0 on PostgreSQL via asyncpg" not "Python backend".
6. **Gotchas are gold.** Non-obvious behaviours that waste debugging time.
7. **Update when architecture changes.** A stale context file causes wrong assumptions.
8. **Use @imports for detail.** Keep the main file lean, import heavy docs: `@docs/architecture.md`

---

## Phase 3: Module Summaries

Module summaries are natural language descriptions of source code files. They help the AI understand the codebase without reading every file.

### Format

```
{filename} — {What this module does}

Key exports:
- {function/class}: {what it does, key params, return type}
- {another export}: {description}

Dependencies: {key imports, external services}
Called by: {what uses this module}
Calls: {what this module depends on}
Key details: {important implementation notes, gotchas}
```

### Example

```
auth_service.py — Handles user authentication, JWT token generation and validation.

Key exports:
- authenticate(email, password) -> User | None: Validates credentials against DB
- create_token(user) -> str: Generates JWT with 30min expiry
- verify_token(token) -> TokenPayload: Validates and decodes JWT, raises AuthError if expired
- get_current_user(token) -> User: FastAPI dependency, extracts user from request token

Dependencies: jose (JWT), passlib (bcrypt), SQLAlchemy async session
Called by: auth routes, all protected endpoint dependencies
Calls: user_repository.get_by_email(), core/config.SECRET_KEY
Key details: Tokens use HS256. Refresh tokens stored in Redis with 7-day TTL.
```

### What to Summarise

**Yes**: Entry points, services, models, API routes, key components, state stores, utilities with significant logic

**No**: `__init__.py`, test files, config-only files, generated files, trivial wrappers, files under 20 lines

### Where to Store Summaries

Store in the project's docs directory:

```
docs/
└── module-summaries/
    ├── auth-service.md
    ├── user-repository.md
    └── payment-handler.md
```

Or as a single file: `docs/MODULE_SUMMARIES.md`

These can be imported into GEMINI.md with `@docs/MODULE_SUMMARIES.md` if the project is large enough to warrant it.

---

## Phase 4: Validation

After onboarding, verify:

### GEMINI.md
- [ ] File exists at project root (or .gemini/)
- [ ] Under 300 lines
- [ ] Every line passes "would mistakes happen without this?" test
- [ ] Has: architecture, tech stack, commands, key directories, gotchas
- [ ] No empty placeholder sections
- [ ] Commands are copy-paste ready and tested

### Module Summaries
- [ ] All important source files have summaries
- [ ] Summaries use natural language, not raw code
- [ ] Summaries are accessible (in docs/ or imported)

### Quick Test
Open a new session in the project directory and ask:
- "What's the tech stack?" — should answer from context, not guessing
- "How do I run tests?" — should give the exact command
- "Where does authentication happen?" — should point to the right module

If any of these fail, the context file needs work.

---

## Full Onboarding Workflow

1. **Scan** — understand the project structure and key files
2. **Check existing** — is there already a GEMINI.md or CLAUDE.md?
3. **Read key files** — README, package manifests, main entry points, config
4. **Write GEMINI.md** — follow the template, keep it lean
5. **Generate module summaries** — for important source files
6. **Validate** — run the checklist, test with a fresh session
7. **Commit** — GEMINI.md and docs/module-summaries/ should be in git

---

## Maintenance

| Trigger | Action |
|---------|--------|
| New files added | Add module summaries |
| Architecture changed | Update GEMINI.md |
| Major refactor | Regenerate summaries, update GEMINI.md |
| New team member | Verify GEMINI.md still makes sense to fresh eyes |

Keep it current. A stale context file is worse than no context file — it causes confident wrong assumptions.

---

## Cross-Tool Compatibility

The same pattern works for all AI coding tools:

| Tool | Context File | Skills Dir |
|------|-------------|-----------|
| Gemini CLI | `GEMINI.md` | `.gemini/skills/` |
| Antigravity | `GEMINI.md` + `AGENTS.md` | `.agent/skills/` |
| Claude Code | `CLAUDE.md` | `.claude/skills/` |
| Cursor | `.cursor/rules` | — |

Write the content once, adapt the filename. The principles are identical.

---

*A well-onboarded AI is 10x more productive than one guessing at your architecture. Invest the 30 minutes — it pays back every session.*
