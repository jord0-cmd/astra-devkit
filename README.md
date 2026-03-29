<p align="center">
  <pre align="center">
  ╔══════════════════════════════════════════════╗
  ║    █████╗ ███████╗████████╗██████╗  █████╗   ║
  ║   ██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗  ║
  ║   ███████║███████╗   ██║   ██████╔╝███████║  ║
  ║   ██╔══██║╚════██║   ██║   ██╔══██╗██╔══██║  ║
  ║   ██║  ██║███████║   ██║   ██║  ██║██║  ██║  ║
  ║   ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝  ║
  ║            DevKit v4.0                        ║
  ╚══════════════════════════════════════════════╝
  </pre>
</p>

<p align="center">
  <strong>An AI Engineering Partner for Gemini CLI</strong><br>
  <em>Skills, agents, hooks, MCPs, and standards that turn Gemini from a cold AI into a capable teammate.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/node-20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Gemini_CLI-0.36+-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini CLI">
  <img src="https://img.shields.io/badge/platform-linux%20%7C%20macos%20%7C%20windows-lightgrey?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License">
</p>

---

## What Is This?

Astra DevKit is a complete configuration package for [Gemini CLI](https://github.com/anthropics/anthropic-cli). It gives your Gemini CLI a warm personality, professional coding standards, specialist agents, automated quality gates, MCP servers for document/image generation, and 24 domain skills — all installable with a single command.

Astra is the senior dev on your team who's sharp, approachable, and genuinely wants the code to be good. She learns your name, remembers your preferences, adapts to your experience level, and enforces best practices automatically through hooks.

### The Numbers

| Component | Count | Description |
|-----------|-------|-------------|
| **Skills** | 24 | On-demand expertise: Python, TypeScript, Rust, React, FastAPI, Docker, Azure, databases, PDF reports, card builder, and more |
| **Hooks** | 17 | Automated quality gates: secret scanning, TDD enforcement, build gates, mutation testing, drift detection |
| **Agents** | 9 | Specialist subagents: backend/frontend builders, code reviewer, debugger, test writer, contract enforcer |
| **MCP Servers** | 7 | Context7, Pandoc, PowerPoint, Excel, Word, Gemini Imagen, Playwright |
| **Standards** | 21 | Always-loaded development rules — no placeholders, no shortcuts, no excuses |
| **Themes** | 3 | Astra (dark professional), Retro Green (CRT terminal), Retro Amber (warm CRT) |

---

## Quick Start

```bash
# Install directly from GitHub
npm install -g github:jord0-cmd/astra-devkit

# Run interactive setup
astra-devkit setup
```

Then start Gemini CLI:

```bash
gemini
```

You'll see the Astra banner with your component counts, and she'll introduce herself.

---

## Prerequisites

### Required

| Dependency | Version | How to Install |
|-----------|---------|----------------|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| **Gemini CLI** | 0.36+ | `npm install -g @google/gemini-cli` |

### Recommended (for full MCP support)

| Dependency | Version | How to Install | Used By |
|-----------|---------|----------------|---------|
| **Python** | 3.11+ | [python.org](https://python.org/) | Document MCPs (Pandoc, PowerPoint, Excel, Word) |
| **uv** | Latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | Python MCP servers (runs via `uvx`) |
| **pandoc** | 3.0+ | `apt install pandoc` / `brew install pandoc` | PDF generation via Pandoc MCP |
| **texlive** | Any | `apt install texlive-base` / `brew install texlive` | PDF output from Pandoc |

> Without Python/uv, the document MCPs (Pandoc, PowerPoint, Excel, Word) won't be available. Everything else works fine with just Node.js.

---

## Installation by Platform

### Linux (Ubuntu/Debian)

```bash
# 1. Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Install Gemini CLI
npm install -g @google/gemini-cli

# 3. Authenticate (run once — opens browser for OAuth)
gemini

# 4. Install Python + uv (for document MCPs)
sudo apt install -y python3 python3-pip
curl -LsSf https://astral.sh/uv/install.sh | sh

# 5. Install pandoc (for PDF generation)
sudo apt install -y pandoc texlive-base

# 6. Install Astra DevKit
npm install -g github:jord0-cmd/astra-devkit
astra-devkit setup

# 7. Verify
astra-devkit doctor
```

### macOS

```bash
# 1. Install Node.js 20+ (via Homebrew)
brew install node@20

# 2. Install Gemini CLI
npm install -g @google/gemini-cli

# 3. Authenticate
gemini

# 4. Install Python + uv (for document MCPs)
brew install python@3.12
curl -LsSf https://astral.sh/uv/install.sh | sh

# 5. Install pandoc (for PDF generation)
brew install pandoc texlive

# 6. Install Astra DevKit
npm install -g github:jord0-cmd/astra-devkit
astra-devkit setup

# 7. Verify
astra-devkit doctor
```

### Windows

```powershell
# 1. Install Node.js 20+ (download from nodejs.org or use winget)
winget install OpenJS.NodeJS.LTS

# 2. Install Gemini CLI
npm install -g @google/gemini-cli

# 3. Authenticate (run once — opens browser)
gemini

# 4. Install Python + uv (for document MCPs)
winget install Python.Python.3.12
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 5. Install pandoc (for PDF generation)
winget install JohnMacFarlane.Pandoc

# 6. Install Astra DevKit
npm install -g github:jord0-cmd/astra-devkit
astra-devkit setup

# 7. Verify
astra-devkit doctor
```

### Docker (for testing)

```bash
docker run -it node:20 bash -c "
  npm install -g @google/gemini-cli github:jord0-cmd/astra-devkit && \
  astra-devkit doctor
"
```

---

## What's Inside

### 24 Domain Skills

Skills use progressive disclosure — only metadata loads until activated. No context bloat.

| Skill | What It Covers |
|-------|---------------|
| `kickstart` | Guided project discovery — scoping, tech stack, experience calibration, brief generation |
| `python-standards` | uv, ruff, mypy, polars, httpx, pydantic v2, pytest, hypothesis, structlog |
| `typescript-standards` | Strict mode, Vitest, Zustand, TanStack Query, Zod, Biome |
| `rust-standards` | thiserror/anyhow, tokio, axum, proptest, cargo-nextest |
| `backend-patterns` | FastAPI, SQLAlchemy 2.0, DI, WebSocket, request tracing, health checks |
| `frontend-patterns` | React 19, shadcn/ui, Tailwind, accessibility, Core Web Vitals |
| `integration-patterns` | OpenAPI type sync, API client, CORS, Docker Compose |
| `database-patterns` | PostgreSQL, Cosmos DB, Redis, SQLAlchemy, Prisma, Alembic, query optimisation |
| `docker-ops` | Multi-stage builds, Compose, security, debugging |
| `azure-ops` | Functions, Blob Storage, Key Vault, Bicep, DevOps Pipelines |
| `ml-ops` | PyTorch, CUDA, Docker GPU, ONNX, model serving |
| `git-github` | Conventional commits, branching, gh CLI, GitHub Actions |
| `log-analysis` | Docker debugging, structured logging, root cause analysis |
| `openwebui` | OpenWebUI/Ollama API, RAG workflows, Docker deployment |
| `card-builder` | **NEW** — Interactive OpenWebUI dashboard card + model config generator |
| `pdf-reports` | **NEW** — Professional PDF reports via HTML + Pandoc MCP pipeline |
| `ollama-ops` | **NEW** — Local Ollama model management, VRAM budgeting, OpenWebUI API |
| `aag-engine` | AST-based architectural graph — scans models, routes, types, detects drift |
| `mutation-engine` | AST mutation testing — verifies test suite quality |
| `property-testing` | Hypothesis/proptest — property-based testing patterns |
| `experience-replay` | Learn from past failures — pattern matching across sessions |
| `ast-ops` | ast-grep structural code search and modification |
| `project-onboarding` | GEMINI.md creation, module summaries |
| `hooks-guide` | Hook system reference for building custom automation |

### 9 Specialist Agents

| Agent | Purpose | How to Invoke |
|-------|---------|---------------|
| `backend-builder` | Builds backend services following contract-first pattern | Delegated by Astra during fullstack builds |
| `frontend-builder` | Builds frontend from API contract types | Delegated by Astra during fullstack builds |
| `code-reviewer` | Bugs, security, logic, standards compliance | `@code-reviewer` |
| `test-writer` | TDD test generation across all frameworks | `@test-writer` |
| `debugger` | Systematic root-cause analysis with evidence | `@debugger` |
| `doc-generator` | Module summaries, API docs, project docs | `@doc-generator` |
| `contract-enforcer` | Validates API contract compliance | Invoked by hooks automatically |
| `dx-orchestrator` | Full project orchestration — delegates to specialists | Top-level architecture agent |
| `a11y-auditor` | Accessibility audit and WCAG compliance | `@a11y-auditor` |

### 17 Automated Hooks

All hooks are Node.js (`.mjs`) — cross-platform, no bash/PowerShell split. They write reports to `.astra/gate-reports.jsonl` when they trigger.

| Hook | Event | What It Does |
|------|-------|-------------|
| `context-loader` | SessionStart | Loads user preferences, displays Astra banner, detects kickstart state |
| `skill-preflight` | BeforeAgent | Detects tech keywords, nudges relevant skill activation |
| `spec-mining` | BeforeAgent | Detects ambiguous specs, nudges clarifying questions before contract |
| `secret-scanner` | BeforeTool | Blocks file writes containing API keys, passwords, tokens |
| `code-standards` | BeforeTool | Blocks `requirements.txt` (use `pyproject.toml`), warns on hardcoded state |
| `test-gate` | BeforeTool | TDD enforcement — blocks implementation without tests |
| `contract-first-gate` | BeforeTool | Warns when frontend code is written without an API contract |
| `auto-lint` | AfterTool | Runs ruff/biome/rustfmt after file writes |
| `build-gate` | AfterAgent | Runs build/type checks after coding, 3-strike circuit breaker |
| `fault-localiser` | AfterAgent | Parses test failures into fault capsules with causal reasoning |
| `cegis-repair` | AfterAgent | Tracks repeated failures, provides counterexamples, escalates after 3 retries |
| `mutation-gate` | AfterAgent | Runs AST mutations on critical paths to detect test gaps |
| `artifact-checker` | AfterAgent | Scans for required project artifacts, nudges creation of missing ones |
| `hippocampus` | AfterAgent | Ensures GEMINI.md exists with required sections for session continuity |
| `drift-check` | AfterAgent | Runs AAG engine to detect state drift between backend and frontend |
| `agent-telemetry` | AfterAgent | Captures failure signals and tool usage for analysis |
| `root-files-gate` | BeforeTool | Prevents writing to repository root (forces proper project structure) |

### 7 MCP Servers

Model Context Protocol servers give Astra new capabilities beyond code:

| MCP | Category | What It Does | Requires |
|-----|----------|-------------|----------|
| **Context7** | Coding | Live documentation for 9,000+ libraries — no hallucinated APIs | Node.js |
| **Pandoc** | Documents | Convert between any document format (Markdown, PDF, DOCX, HTML, LaTeX) | Python + uv + pandoc |
| **PowerPoint** | Documents | Create and edit presentations (34 tools) | Python + uv |
| **Excel** | Documents | Create and edit spreadsheets (20 tools) | Python + uv |
| **Word** | Documents | Create and edit rich documents | Python + uv |
| **Gemini Imagen** | Images | AI image generation via Gemini | Node.js + `GEMINI_API_KEY` |
| **Playwright** | Coding | Browser automation and testing | Node.js |

MCPs are selectable during setup — enable only what you need.

### 3 Custom Themes

| Theme | Style | Preview |
|-------|-------|---------|
| **Astra** | Dark professional — blue accents, green success, GitHub-inspired | `#0d1117` background, `#58a6ff` links |
| **Retro Green** | CRT terminal — phosphor green on black | `#0a0a0a` background, `#33ff33` text |
| **Retro Amber** | Warm CRT terminal — amber on dark | `#0a0800` background, `#ffb000` text |

### 21 Always-On Development Rules

Loaded every session via `@import` — not optional, not on-demand:

1. Never make unauthorised changes
2. Dependency management is mandatory
3. No placeholders
4. Questions vs code requests
5. No assumptions
6. Security is non-negotiable
7. Be honest about capabilities
8. Preserve functional requirements
9. Evidence-based responses
10. No hardcoded examples
11. Intelligent logging
12. Modern Python packaging (`pyproject.toml`, never `requirements.txt`)
13. Resist tutorial defaults
14. Use current library APIs — no deprecated patterns
15. Asymmetric planning — match strategy to domain
16. Contract-first integration
17. Domain types over primitives
18. Accessibility is mandatory
19. AST-aware code modification
20. Runtime tool creation
21. Build at project root

Plus: TDD standards, test pyramid, hook execution policy, skill compatibility matrix.

### 60 Custom Loading Phrases

Because `"Deploying to prod on a Friday..."` is more fun than a spinner.

---

## CLI Commands

After installing globally:

```bash
astra-devkit setup       # Interactive first-time setup (name, experience, focus, MCPs, theme)
astra-devkit update      # Update all components to latest
astra-devkit mcps        # Interactive MCP enable/disable menu
astra-devkit theme       # Switch between themes
astra-devkit doctor      # Health check — verifies all components
astra-devkit uninstall   # Clean removal of all Astra components
astra-devkit help        # Show available commands
astra-devkit --version   # Show version
```

### Doctor Output (example)

```
Astra DevKit — Health Check

  ✓ Node.js: v24.11.0 (OK)
  ✓ Gemini CLI: 0.36.0-preview.3
  ✓ Python + uv: Python 3.12.12 + uv installed
  ✓ Skills: 24 installed (OK)
  ✓ Hooks: 17 installed (OK)
  ✓ Agents: 9 installed (OK)
  ✓ Standards: 4 installed (OK)
  ✓ Settings + MCPs: 7 MCPs, hooks ON, skills ON
  ✓ Themes: 3 available (OK)
  ✓ Pandoc: pandoc 3.1.11.1

10/10 checks passed.

All systems operational. You're good to go.
```

---

## What Gets Installed

```
~/.gemini/
├── GEMINI.md              Astra persona + @imported standards
├── settings.json          Theme, hooks, agents, skills, MCPs (merged — auth preserved)
├── user.json              Your name + preferences (created during setup)
├── standards/
│   ├── rules.md           21 Rules, Confirm Protocol, Three Fix, Quality Gates
│   ├── testing.md         TDD, test pyramid, test isolation, AI+TDD synergy
│   ├── hooks.md           Hook policy, execution order, block format, escape hatches
│   └── skills.md          Skill compatibility matrix for common tech stacks
├── skills/                24 domain skill directories (SKILL.md + references/)
├── agents/                9 specialist agent definitions (.md)
├── hooks/                 17 Node.js automation scripts (.mjs)
├── themes/                3 custom theme definitions (.json)
└── commands/              Custom slash commands (TOML)
```

Your existing config is preserved — the installer merges settings, it doesn't overwrite.

---

## The Architect Pattern

Astra's flagship capability is the **Architect Pattern** for fullstack projects — the lever that took a complex fullstack scenario from 19% to 100% pass rate:

1. **Contract-First** — Before any code, create `docs/api-contract.md` with the full domain model, endpoints, enum values, and shared conventions
2. **Architectural State** — Create `docs/architectural-state.md` as a living document tracking completion, decisions, and quality gates
3. **Orchestrated Delegation** — Astra acts as Architect, delegating to `@backend-builder` (reads/updates contract) then `@frontend-builder` (derives types from contract)
4. **Sequencing** — Backend completes and updates the contract BEFORE frontend starts
5. **Quality Gates** — Hooks automatically enforce structlog, contract-first, drift detection

### Proven Results

| Metric | Without DevKit | With DevKit v4 |
|--------|---------------|----------------|
| Fullstack pass rate | 19% | 100% |
| Cost per run | $7.69 (4 prompts) | $1.61 (1 prompt) |
| Wall time | 1h 38m | 24m 41s |
| Human prompts needed | 4 | 1 |

Validated across CRUD, CLI tools, data pipelines, WebSocket servers, and library packaging domains. Three-point ablation study confirms the contract is the critical lever (42.5 percentage point drop when removed).

---

## Customisation

### Rename the Persona
Edit `~/.gemini/GEMINI.md` — change "Astra" to whatever you like. The personality and standards still work regardless of name.

### Disable Individual Skills
```
/skills disable skill-name
```
Or delete the skill directory from `~/.gemini/skills/`.

### Disable Hooks
Set `"hooksConfig": { "enabled": false }` in `~/.gemini/settings.json` to disable all hooks, or delete individual hook files from `~/.gemini/hooks/`.

### TDD Gate Escape Hatch
Set `ASTRA_TDD=off` in your environment to bypass TDD enforcement for quick prototyping.

### Change Theme
Run `astra-devkit theme` or use `/theme` inside a Gemini session.

### Disable Loading Phrases
Set `"loadingPhrases": "off"` in `settings.json`.

### Project-Level Overrides
Add a `.gemini/settings.json` in any project to override global settings for that project only.

### Add Your Own MCPs
Run `astra-devkit mcps` to toggle servers, or edit the `mcpServers` block in `~/.gemini/settings.json` directly.

---

## For Teams

Astra is designed for development teams. The `kickstart` skill helps developers new to AI coding tools get started with guided discovery instead of staring at a blank prompt.

The `user.json` system remembers each team member's name, experience level, and explanation preferences — so Astra adapts to each person individually:

- **Beginners** get detailed explanations and step-by-step guidance
- **Intermediate** developers get balanced context
- **Senior** engineers get concise, direct responses

---

## Cross-Platform

Everything works on Linux, macOS, and Windows:

- **Hooks** are Node.js (`.mjs`) — no bash/PowerShell split
- **Config paths** use `os.homedir()` — resolves correctly everywhere
- **Setup wizard** is interactive Node.js — same experience on all platforms
- **MCP servers** use `npx` (Node.js) and `uvx` (Python) — both cross-platform
- **Installers** available in bash (`install.sh`), PowerShell (`install.ps1`), and Node.js (`astra-devkit setup`)

---

## Project Structure

```
gemini-config/
├── GEMINI.md              # Astra persona definition
├── settings.json          # Full config (theme, hooks, MCPs, skills, agents)
├── skills/                # 24 domain skills
│   ├── kickstart/         #   Guided project discovery
│   ├── python-standards/  #   Python best practices
│   ├── card-builder/      #   OpenWebUI card generator
│   ├── pdf-reports/       #   PDF report pipeline
│   ├── ollama-ops/        #   Local model management
│   └── ...
├── hooks/                 # 17 automation hooks (Node.js)
├── agents/                # 9 specialist agents
├── standards/             # 4 always-loaded standards files (21 rules)
├── themes/                # 3 custom themes
├── astra-devkit/          # npm package source
│   ├── bin/               #   CLI entry point
│   ├── lib/               #   Setup wizard, MCP selector, doctor, installer
│   └── config/            #   Bundled components for deployment
├── install.sh             # Bash installer (Linux/macOS)
├── install.ps1            # PowerShell installer (Windows)
└── docs/                  # Architecture documentation
```

---

## Diagnostics

If something's not working:

```bash
# Run the full health check
astra-devkit doctor

# Check if hooks are firing
ls ~/.gemini/hooks/

# Check MCP config
cat ~/.gemini/settings.json | python3 -c "import json,sys; s=json.load(sys.stdin); print(json.dumps(s.get('mcpServers',{}), indent=2))"

# Check gate reports (what hooks have blocked)
cat .astra/gate-reports.jsonl 2>/dev/null
```

---

## Version History

| Version | Date | Highlights |
|---------|------|-----------|
| **v4.0** | 2026-03-28 | npm package, 7 MCPs, card builder, PDF reports, ollama ops, 3 themes, setup wizard, 24 skills, 17 hooks |
| **v3.0** | 2026-03-27 | Architect Pattern, contract-first, AAG engine, mutation testing, 21 rules, 9 agents |
| **v2.0** | 2026-03-25 | Hooks system, TDD gates, build gates, secret scanner, 17 skills |
| **v1.0** | 2026-03-24 | Initial release — persona, standards, 4 agents, 7 hooks |

---

## Research

The DevKit is backed by systematic testing via the [Astra Harness](https://github.com/jord0-cmd/astra-harness) — an automated test framework that scores Gemini CLI output against YAML-defined scenarios.

Key findings:
- **Tutorial gravity**: LLM training priors beat passive context. Prescriptive imperatives win.
- **Progressive disclosure**: 83-line SKILL.md outperformed 565-line encyclopedia by 2x.
- **Contract-first**: The API contract IS the architecture. 19% without, 87% with.
- **The Factory Over the Hero**: Better environment beats bigger model. Pro model usage dropped from 69% to 21%.
- **Friction equals tokens**: Reducing tool friction shifts work from expensive to cheap models.

15 research documents and a paper ("The Factory Over the Hero") available in the research archive.

---

## License

MIT

---

## Credits

Built by [jord0-cmd](https://github.com/jord0-cmd) with [Rayne](https://github.com/jord0-cmd) and the Council (Vesper, Sloane, Astra).
