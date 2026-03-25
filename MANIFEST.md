# Gemini CLI Config Package

**Purpose**: Portable Gemini CLI configuration for hackathon and general use.
**Target**: Any machine with Node.js 20+ and npm (Linux, macOS, Windows 11).
**Gemini CLI Version**: v0.36.0-preview.0+

---

## Package Contents

### Installers
| File | Platform | Description |
|------|----------|-------------|
| `install.sh` | Linux / macOS | Bash installer — merges settings, preserves auth, installs skills/hooks |
| `install.ps1` | Windows | PowerShell installer — same logic, Windows paths (`%USERPROFILE%\.gemini\`) |

### Core Config
| File | Destination (Linux/macOS) | Destination (Windows) | Description | Status |
|------|---------------------------|----------------------|-------------|--------|
| `settings.json` | `~/.gemini/settings.json` | `%USERPROFILE%\.gemini\settings.json` | Main config — theme, approval mode, tools, hooks, MCP | DONE |
| `user.json` | `~/.gemini/user.json` | `%USERPROFILE%\.gemini\user.json` | User profile — name, preferences (created on first session by Astra) | AUTO |
| `GEMINI.md` | `~/.gemini/GEMINI.md` | `%USERPROFILE%\.gemini\GEMINI.md` | Astra persona — personality, communication, teaching style | DONE |
| `standards/rules.md` | `~/.gemini/standards/rules.md` | `%USERPROFILE%\.gemini\standards\rules.md` | Core dev standards — 11 Rules, Confirm Protocol, Three Fix, Quality Gates | DONE |

### Skills (destination: `~/.gemini/skills/<name>/SKILL.md`)
| Skill | Description | Status |
|-------|-------------|--------|
| ~~`dev-standards`~~ | ~~Moved to standards/rules.md (always-loaded via @import)~~ | DONE |
| `python-standards` | Python standards (uv, ruff, polars, type hints, pytest, project structure) | DONE |
| `typescript-standards` | TS/React — strict mode, type patterns, Vitest, Zustand, TanStack Query, Zod, Biome | DONE |
| `rust-standards` | Rust — thiserror/anyhow, tokio production patterns, axum, proptest, cargo-nextest | DONE |
| `backend-patterns` | FastAPI, SQLAlchemy 2.0, WebSocket, DI, testing, request tracing, health checks | DONE |
| `frontend-patterns` | React 19, Zustand, TanStack Query, shadcn/ui, Tailwind, a11y, performance | DONE |
| `integration-patterns` | OpenAPI type sync, API client, TanStack Query, WebSocket, CORS, Docker Compose | DONE |
| `ml-ops` | PyTorch, CUDA, Docker GPU, model serving, ONNX, quantization, health checks | DONE |
| `project-onboarding` | GEMINI.md creation, module summaries, cross-tool compatible | DONE |
| `log-analysis` | Docker debugging, structured logging, root cause analysis, GPU/CUDA, health checks | DONE |
| `openwebui` | OpenWebUI/Ollama API, RAG workflows, Docker deployment, troubleshooting | DONE |
| `docker-ops` | Dockerfile best practices, Compose, multi-stage builds, security, debugging | DONE |
| `database-patterns` | PostgreSQL, Cosmos DB, Redis, SQLAlchemy, Prisma, Alembic, query optimization | DONE |
| `azure-ops` | App Service, Functions, Cosmos DB, Blob Storage, Key Vault, Bicep, DevOps Pipelines | DONE |
| `kickstart` | Guided project discovery — scoping, tech stack, experience calibration, brief generation | DONE |
| `git-github` | Git workflow, conventional commits, gh CLI, GitHub Actions CI/CD, branching, PRs, advanced Git | DONE |
| `hooks-guide` | Hook system reference — all events, schemas, patterns, writing custom hooks | DONE |
| ~~`image-gen`~~ | ~~Dropped — not needed for team package~~ | — |
| ~~`code-viz`~~ | ~~Dropped — not needed for team package~~ | — |
| ~~`regex-viz`~~ | ~~Dropped — not needed for team package~~ | — |

### Agents (destination: `~/.gemini/agents/<name>.md`)
| Agent | Description | Tools | Status |
|-------|-------------|-------|--------|
| `code-reviewer` | Reviews code for bugs, security, logic errors, standards compliance | read-only | DONE |
| `test-writer` | Generates test suites — TDD, edge cases, all frameworks | read + write + shell | DONE |
| `debugger` | Systematic root-cause debugging — logs, evidence, hypothesis testing | read + shell | DONE |
| `doc-generator` | Generates module summaries, API docs, project GEMINI.md | read + write | DONE |

### Hooks (destination: `~/.gemini/hooks/`, configured in settings.json)
| Hook | Event | Description | Status |
|------|-------|-------------|--------|
| `secret-scanner.mjs` | `BeforeTool` (write/edit) | Blocks writes containing API keys, passwords, tokens, credentials | DONE |
| `auto-lint.mjs` | `AfterTool` (write/edit) | Auto-formats with ruff (Python), biome (TS), rustfmt (Rust) | DONE |
| `context-loader.mjs` | `SessionStart` | Loads user.json preferences + kickstart-refs detection | DONE |
| `build-gate.mjs` | `AfterAgent` | Runs build/lint/type checks after coding tasks, forces retry on failure | DONE |
| `test-gate.mjs` | `BeforeTool` (write/edit) | TDD enforcement — blocks implementation writes when no test file exists | DONE |

---

## Install Steps

### Linux / macOS
```bash
# 1. Install Gemini CLI
npm install -g @google/gemini-cli@preview

# 2. Run once to create ~/.gemini and do OAuth
gemini

# 3. Run the install script
chmod +x install.sh && ./install.sh

# Dry run (preview only):
./install.sh --dry-run
```

### Windows (PowerShell)
```powershell
# 1. Install Gemini CLI
npm install -g @google/gemini-cli@preview

# 2. Run once to create ~\.gemini and do OAuth
gemini

# 3. Run the install script
.\install.ps1

# Dry run (preview only):
.\install.ps1 -DryRun
```

---

## Customisation

### Don't Like the Name "Astra"?
Edit `GEMINI.md` — change the name in the first line and the closing line. The personality and standards still work regardless of what you call the AI.

### Too Many Skills?
Skills use progressive disclosure — only the name and description load until activated. They don't bloat your context. But if you want to trim, disable any skill with:
```
/skills disable skill-name
```
Or delete the skill directory from `~/.gemini/skills/`.

### Want Different Loading Phrases?
Edit `settings.json` — modify `customWittyPhrases` or set `"loadingPhrases": "off"` to disable them entirely.

### Don't Want Hooks?
Set `"hooksConfig": { "enabled": false }` in `settings.json` to disable all hooks, or remove individual hook files from `~/.gemini/hooks/`.

### Want a Different Theme?
Use `/theme` inside a Gemini session to pick from built-in themes, or edit `"ui.theme"` in `settings.json`.

### Existing Config?
The installer automatically backs up your existing `settings.json`, `GEMINI.md`, and `standards/` before making changes. Backups are saved to `~/.gemini/backup_TIMESTAMP/`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-24 | Initial package creation. settings.json with Dracula theme, custom loading phrases. |
| 2026-03-24 | Added PowerShell installer (install.ps1) for Windows support. Cross-platform package. |
| 2026-03-24 | GEMINI.md created — Astra persona. Warm, professional, concise. 30% personality / 70% engineering discipline. |
| 2026-03-24 | Restructured: dev standards moved from skill to standards/rules.md (@imported into GEMINI.md). Always loaded, not on-demand. Skills now purely domain-specific. |
| 2026-03-24 | Added standards/testing.md — TDD workflow, test pyramid, AI+TDD synergy, anti-patterns. |
| 2026-03-24 | First skill ported: python-standards. Cleaned from rayne-python, professional tone, all substance preserved. |
