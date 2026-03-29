# Astra DevKit v4.0 — Package Manifest

**Purpose**: Portable, installable Gemini CLI configuration package.
**Target**: Any machine with Node.js 20+ (Linux, macOS, Windows).
**Gemini CLI Version**: v0.36.0+

---

## Package Contents

### Installers
| File | Platform | Description |
|------|----------|-------------|
| `astra-devkit/` | All (npm) | `npm install -g github:jord0-cmd/astra-devkit` — interactive setup wizard, doctor, update |
| `install.sh` | Linux / macOS | Bash installer — merges settings, preserves auth |
| `install.ps1` | Windows | PowerShell installer ��� same logic, Windows paths |

### Core Config
| File | Destination | Description |
|------|-------------|-------------|
| `settings.json` | `~/.gemini/settings.json` | Theme, hooks, MCPs, agents, skills config (merged, auth preserved) |
| `GEMINI.md` | `~/.gemini/GEMINI.md` | Astra persona — personality, communication, teaching style |
| `standards/rules.md` | `~/.gemini/standards/rules.md` | 21 Development Rules, Confirm Protocol, Quality Gates |
| `standards/testing.md` | `~/.gemini/standards/testing.md` | TDD, test pyramid, test isolation, AI+TDD synergy |
| `standards/hooks.md` | `~/.gemini/standards/hooks.md` | Hook policy — execution order, block format, escape hatches |
| `standards/skills.md` | `~/.gemini/standards/skills.md` | Skill compatibility matrix for common tech stacks |

### Skills (24) — `~/.gemini/skills/<name>/SKILL.md`
| Skill | Description | New in v4 |
|-------|-------------|-----------|
| `kickstart` | Guided project discovery — scoping, tech stack, brief generation | |
| `python-standards` | uv, ruff, polars, type hints, pytest, structlog | |
| `typescript-standards` | Strict mode, Vitest, Zustand, TanStack Query, Zod, Biome | |
| `rust-standards` | thiserror/anyhow, tokio, axum, proptest, cargo-nextest | |
| `backend-patterns` | FastAPI, SQLAlchemy 2.0, WebSocket, DI, health checks | |
| `frontend-patterns` | React 19, shadcn/ui, Tailwind, a11y, performance | |
| `integration-patterns` | OpenAPI type sync, API client, CORS, Docker Compose | |
| `database-patterns` | PostgreSQL, Cosmos DB, Redis, Prisma, Alembic | |
| `docker-ops` | Dockerfile best practices, Compose, multi-stage builds, security | |
| `azure-ops` | Functions, Blob Storage, Key Vault, Bicep, DevOps Pipelines | |
| `ml-ops` | PyTorch, CUDA, Docker GPU, ONNX, model serving | |
| `git-github` | Conventional commits, gh CLI, GitHub Actions, branching | |
| `log-analysis` | Docker debugging, structured logging, root cause analysis | |
| `openwebui` | OpenWebUI/Ollama API, RAG workflows | |
| `project-onboarding` | GEMINI.md creation, module summaries | |
| `hooks-guide` | Hook system reference for custom automation | |
| `aag-engine` | AST-based architectural graph, drift detection | |
| `ast-ops` | ast-grep structural code search and modification | |
| `mutation-engine` | AST mutation testing for test quality verification | |
| `property-testing` | Hypothesis/proptest property-based testing | |
| `experience-replay` | Learn from past failures, pattern matching | |
| `card-builder` | Interactive OpenWebUI card + model config generator | YES |
| `pdf-reports` | Professional PDF reports via HTML + Pandoc MCP | YES |
| `ollama-ops` | Local Ollama model management, VRAM budgeting | YES |

### Agents (9) — `~/.gemini/agents/<name>.md`
| Agent | Description |
|-------|-------------|
| `backend-builder` | Builds backend services following contract-first pattern |
| `frontend-builder` | Builds frontend from API contract types |
| `code-reviewer` | Bugs, security, logic, standards compliance |
| `test-writer` | TDD test generation, all frameworks |
| `debugger` | Systematic root-cause debugging |
| `doc-generator` | Module summaries, API docs |
| `contract-enforcer` | Validates API contract compliance |
| `dx-orchestrator` | Full project orchestration — delegates to specialists |
| `a11y-auditor` | Accessibility audit and WCAG compliance |

### Hooks (17) — `~/.gemini/hooks/*.mjs`
| Hook | Event | Description |
|------|-------|-------------|
| `context-loader` | SessionStart | User preferences, Astra banner, kickstart state |
| `skill-preflight` | BeforeAgent | Tech keyword detection, skill nudging |
| `spec-mining` | BeforeAgent | Ambiguous spec detection, clarification nudging |
| `secret-scanner` | BeforeTool | Blocks writes containing secrets |
| `code-standards` | BeforeTool | Blocks requirements.txt, warns on hardcoded state |
| `test-gate` | BeforeTool | TDD enforcement, sad path detection |
| `contract-first-gate` | BeforeTool | Warns on frontend code without API contract |
| `root-files-gate` | BeforeTool | Prevents writing to repo root |
| `auto-lint` | AfterTool | ruff/biome/rustfmt after writes |
| `build-gate` | AfterAgent | Build/type checks, 3-strike circuit breaker |
| `fault-localiser` | AfterAgent | Test failure → fault capsule with causal reasoning |
| `cegis-repair` | AfterAgent | Repeated failure tracking, counterexamples |
| `mutation-gate` | AfterAgent | AST mutations to detect test gaps |
| `artifact-checker` | AfterAgent | Required artifact detection |
| `hippocampus` | AfterAgent | GEMINI.md continuity enforcement |
| `drift-check` | AfterAgent | AAG engine drift detection |
| `agent-telemetry` | AfterAgent | Failure signal capture for analysis |

### MCP Servers (7) — configured in `settings.json`
| MCP | Command | Category |
|-----|---------|----------|
| `context7` | `npx @upstash/context7-mcp@latest` | Coding |
| `pandoc` | `uvx mcp-pandoc` | Documents |
| `powerpoint` | `uvx office-powerpoint-mcp-server` | Documents |
| `excel` | `uvx excel-mcp-server` | Documents |
| `word-docs` | `uvx office-word-mcp-server` | Documents |
| `gemini-image` | `npx mcp-image` | Images |
| `playwright` | `npx @anthropic-ai/mcp-playwright` | Coding |

### Themes (3) — `~/.gemini/themes/*.json`
| Theme | Style |
|-------|-------|
| `astra.json` | Dark professional (GitHub-inspired) |
| `retro-green.json` | CRT terminal (phosphor green) |
| `retro-amber.json` | CRT terminal (warm amber) |

### npm Package — `astra-devkit/`
| File | Purpose |
|------|---------|
| `bin/astra-devkit.mjs` | CLI entry point |
| `lib/setup-wizard.mjs` | Interactive first-time setup |
| `lib/mcp-selector.mjs` | MCP enable/disable menu |
| `lib/theme-selector.mjs` | Theme picker |
| `lib/doctor.mjs` | 10-point health check |
| `lib/installer.mjs` | Component deployment + uninstall |
| `lib/file-ops.mjs` | Cross-platform file operations |
| `config/` | Bundled components for deployment |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-28 | **v4.0**: npm package (`astra-devkit`), 7 MCPs, card-builder/pdf-reports/ollama-ops skills, 3 themes, setup wizard, Astra banner |
| 2026-03-27 | **v3.0**: Architect Pattern, contract-first, AAG engine, mutation testing, 21 rules, 9 agents, 17 hooks |
| 2026-03-26 | Frontier testing (CLI, ETL, WebSocket, Library) — 88%+ across 4 non-CRUD domains |
| 2026-03-25 | **v2.0**: Hooks system, TDD gates, build gates, secret scanner, 17 skills |
| 2026-03-24 | **v1.0**: Initial release — Astra persona, standards, 4 agents, 7 hooks |
