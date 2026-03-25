# Astra DevKit

**An AI coding partner for Gemini CLI.** Skills, agents, hooks, and standards that turn Gemini from a cold AI into a capable teammate.

Astra is a complete configuration package that gives Gemini CLI a warm personality, professional coding standards, specialist agents, automated quality gates, and 17 domain skills covering Python, TypeScript, Rust, React, FastAPI, Docker, Azure, databases, and more.

---

## Quick Install

```bash
# Prerequisites: Node.js 20+, Gemini CLI installed and authenticated
npx astra-devkit
```

Or manually:

```bash
git clone https://github.com/jord0-cmd/astra-devkit.git
cd astra-devkit
node bin/install.mjs
```

The installer backs up your existing config before making changes.

---

## What You Get

### Astra — Your AI Coding Partner
A persona that's warm, professional, and concise. She introduces herself, learns your name, remembers your preferences, and adapts to your experience level. Not a cold chatbot — a colleague.

### 17 Domain Skills
On-demand expertise that activates when relevant:

| Skill | What It Covers |
|-------|---------------|
| `python-standards` | uv, ruff, mypy, polars, httpx, pydantic, pytest, hypothesis |
| `typescript-standards` | Strict mode, Vitest, Zustand, TanStack Query, Zod, Biome |
| `rust-standards` | thiserror/anyhow, tokio, axum, proptest, cargo-nextest |
| `backend-patterns` | FastAPI, SQLAlchemy 2.0, DI, WebSocket, testing |
| `frontend-patterns` | React 19, shadcn/ui, Tailwind, accessibility, Core Web Vitals |
| `integration-patterns` | OpenAPI type sync, API client, CORS, Docker Compose |
| `docker-ops` | Multi-stage builds, Compose, security, debugging |
| `database-patterns` | PostgreSQL, Cosmos DB, Redis, SQLAlchemy, Prisma, Alembic |
| `azure-ops` | Functions, Blob Storage, Key Vault, Bicep, DevOps Pipelines |
| `ml-ops` | PyTorch, CUDA, Docker GPU, ONNX, model serving |
| `git-github` | Conventional commits, branching, gh CLI, GitHub Actions |
| `log-analysis` | Docker debugging, structured logging, root cause analysis |
| `openwebui` | OpenWebUI/Ollama API, RAG workflows |
| `project-onboarding` | GEMINI.md creation, module summaries |
| `kickstart` | Guided project discovery for developers new to AI tools |
| `hooks-guide` | Hook system reference for building custom automation |

Skills use progressive disclosure — only metadata loads until activated. No context bloat.

### 4 Specialist Agents

| Agent | Purpose | Invoke |
|-------|---------|--------|
| Code Reviewer | Bugs, security, logic, standards | `@code-reviewer` or `/review` |
| Test Writer | TDD test generation, all frameworks | `@test-writer` or `/test` |
| Debugger | Systematic root-cause analysis | `@debugger` or `/debug` |
| Doc Generator | Module summaries, API docs | `@doc-generator` or `/gendocs` |

### 4 Automated Hooks (Node.js, cross-platform)

| Hook | What It Does |
|------|-------------|
| Secret Scanner | Blocks file writes containing API keys, passwords, tokens |
| Auto Lint | Runs ruff/biome/rustfmt after file writes |
| Context Loader | Loads user preferences on session start |
| Build Gate | Runs build/type checks after coding, forces retry on failure (3-strike circuit breaker) |

### Always-On Standards
Loaded every session via `@import`:
- **11 Development Rules** — no unauthorized changes, no placeholders, confirm before building
- **Testing Standards** — TDD workflow, test pyramid, AI+TDD synergy, anti-patterns
- **Quality Gates** — verify at build, test, and pre-commit boundaries

### Custom Commands

| Command | What It Does |
|---------|-------------|
| `/kickstart` | Guided project scoping (from skill) |
| `/review` | Code review via agent |
| `/test` | Generate test suite via agent |
| `/debug` | Systematic debugging via agent |
| `/gendocs` | Generate documentation via agent |

---

## Requirements

- **Node.js 20+** (for Gemini CLI and hooks)
- **Gemini CLI** — `npm install -g @google/gemini-cli@preview`
- **Authenticated** — run `gemini` once to complete OAuth

---

## What Gets Installed

```
~/.gemini/
  GEMINI.md              Astra persona + @imported standards
  settings.json          Theme, hooks, agents, skills config (merged, auth preserved)
  user.json              Your name + preferences (created by Astra on first chat)
  standards/
    rules.md             11 Rules, Confirm Protocol, Three Fix, Quality Gates
    testing.md           TDD, test pyramid, AI+TDD synergy
  skills/                17 domain skill directories
  agents/                4 specialist agent definitions
  hooks/                 4 Node.js automation scripts
  commands/              5 custom slash commands
```

Your existing config is automatically backed up to `~/.gemini/backup_TIMESTAMP/` before any changes.

---

## Customisation

### Rename the Persona
Edit `~/.gemini/GEMINI.md` — change "Astra" to whatever you like.

### Disable Skills
```
/skills disable skill-name
```

### Disable Hooks
Set `"hooksConfig": { "enabled": false }` in settings.json, or delete individual hook files.

### Change Theme
Use `/theme` in a Gemini session, or edit `"ui.theme"` in settings.json.

### Disable Loading Phrases
Set `"loadingPhrases": "off"` in settings.json.

### Project-Level Overrides
Add a `.gemini/settings.json` in any project to override global settings for that project only.

---

## For Teams

Astra is designed for development teams of 5-10 people. The `kickstart` skill helps developers who are new to AI coding tools get started with guided discovery instead of staring at a blank prompt.

The `user.json` system remembers each team member's name, experience level, and explanation preferences — so Astra adapts to each person individually.

---

## Cross-Platform

Everything works on Linux, macOS, and Windows:
- Hooks are Node.js (`.mjs`) — no bash/PowerShell split
- Installers available in bash (`install.sh`), PowerShell (`install.ps1`), and Node.js (`bin/install.mjs`)
- Config paths use `os.homedir()` — resolves correctly everywhere

---

## License

MIT

---

## Credits

Built by [jord0-cmd](https://github.com/jord0-cmd) with Rayne.
