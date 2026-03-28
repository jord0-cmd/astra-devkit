# ADR-001: No Stateful Developer Tools for Agents

**Status**: Accepted
**Date**: 2026-03-27
**Proposed by**: Vesper (Gemini 3.1 Pro Preview), validated by Rayne (Claude Opus 4.6)
**Context**: Astra's self-critique after achieving 100% on fullstack subagent test

---

## Decision

Agents MUST NOT use stateful tools: LSP servers, persistent shell sessions, background processes, or long-running daemons.

All agent operations must be **synchronous, stateless, and idempotent**.

---

## Context

After achieving 100% on the fullstack subagent delegation test, Astra proposed five architectural improvements. Two of them involved stateful tools:

1. **LSP integration** — background language server for semantic code queries
2. **Persistent shell sessions** — keep background processes (dev servers, log streams) running

Vesper identified both as **"Hero Coder" anti-patterns**: they look powerful but introduce systemic fragility.

---

## Consequences of Stateful Tools

### LSP Servers
- Crash frequently and require re-initialization
- Get out of sync with filesystem after agent file writes
- Require proper project initialization (tsconfig, pyproject.toml) before they work
- Token-expensive: agents "browse" code like humans instead of making targeted queries
- Race conditions between LSP indexing and agent file operations

### Persistent Shell Sessions
- Background process stdout pollutes agent context window
- Port conflicts between sessions
- Orphaned processes after session ends (resource leaks)
- Race conditions between agent writes and running processes
- Non-deterministic results (output depends on process timing)

---

## Alternatives

| Stateful Tool | Stateless Alternative |
|---------------|----------------------|
| LSP for "find references" | `sg -p 'MyFunction' src/` (ast-grep) |
| LSP for "type errors" | `tsc --noEmit` (one-shot) |
| LSP for "go to definition" | `sg -p 'function MyFunction' src/` |
| `npm run dev` (background server) | `npm run test:integration` (self-contained) |
| `docker compose logs -f` (streaming) | `docker compose logs --tail 50` (snapshot) |
| Persistent REPL | One-shot script execution |

---

## Decision Rationale

> "We aren't trying to make Astra a better 10x developer. We're building a factory where she is just the logic unit. The factory needs better conveyor belts, not a smarter worker."
> — Vesper

> "A Junior engineer says, 'The tool is broken, I'll do it manually.' A Staff+ engineer says, 'The pipeline is broken, I will fix the pipeline.'"
> — Vesper

Stateless tools are:
- **Deterministic**: Same input always produces same output
- **Composable**: Can be chained without side effects
- **Recoverable**: If they fail, restart from scratch with no orphaned state
- **Observable**: Input → output, fully captured in telemetry
- **Cheap**: No initialization overhead, no background resource consumption
