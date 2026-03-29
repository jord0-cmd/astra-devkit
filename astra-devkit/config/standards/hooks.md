# Hook Policy

How Astra's automated hooks work, their execution order, and what happens when they block.

---

## Execution Order

Hooks fire in this order during a session:

```
Session Start
  └─ context-loader          Load user preferences, detect kickstart-refs

User sends prompt
  └─ skill-preflight          Detect tech keywords, nudge relevant skills (BeforeAgent)

AI writes a file
  ├─ secret-scanner           Block writes with secrets/credentials (BeforeTool)
  ├─ code-standards           Block requirements.txt, flag DI issues (BeforeTool)
  └─ test-gate                Block implementation without tests (BeforeTool)

File written successfully
  └─ auto-lint                Format with ruff/biome/rustfmt (AfterTool)

AI completes a task
  └─ build-gate               Run build/lint/type checks, retry on failure (AfterAgent)
```

Within the same event (e.g., multiple BeforeTool hooks), they execute in the order listed in `settings.json`. **If any hook blocks, later hooks in the same event do not run.**

---

## Block Messages

When a hook blocks an action, it uses a standardised format:

```
ASTRA-BLOCK: [HookName] — [Reason]

[Specific guidance on what to do instead]

[Escape hatch information if applicable]
```

Example:
```
ASTRA-BLOCK: test-gate — No test file found for service.py

Before writing this implementation, create the test file first:
    tests/test_service.py

Write failing tests that define the expected behaviour, then implement.

If this is exploratory/spike work, set ASTRA_TDD=off to temporarily bypass.
```

---

## Hook Precedence (When Hooks Conflict)

1. **Security hooks always win.** `secret-scanner` overrides everything — a secret is never allowed.
2. **Test-gate overrides code-standards.** If there's no test file, the implementation shouldn't be written regardless of other style issues.
3. **Build-gate is advisory.** It blocks the agent's retry, not the user's next action.

---

## Hook States

| State | Meaning | User Impact |
|-------|---------|-------------|
| **Deny** | Hook blocked the action | AI told why and what to do instead |
| **Allow** | Hook approved the action | No visible impact |
| **Warn** | Hook found issues but didn't block | Warning injected into context |
| **Error** | Hook itself crashed | Warning logged, action proceeds (fail-open) |

All hooks are **fail-open** — if the hook script crashes, the action proceeds with a warning. This prevents broken hooks from locking the user out.

---

## Gate Reports

Blocking hooks write reports to `.astra/gate-reports.jsonl`:

```json
{"hook":"test-gate","event":"BeforeTool","action":"denied","file":"app/service.py","reason":"No test file","timestamp":"2026-03-25T10:00:00Z"}
```

View recent blocks:
```bash
cat .astra/gate-reports.jsonl | tail -5 | jq .
```

---

## Escape Hatches

| Hook | Override | Duration |
|------|---------|----------|
| test-gate | `ASTRA_TDD=off` env var | Until unset |
| build-gate | Circuit breaker (3 retries) | Auto-resets on success |
| code-standards | None — fix the code | Permanent |
| secret-scanner | None — never bypass security | Permanent |

---

## Adding Custom Hooks

See the `hooks-guide` skill for templates and patterns. All hooks must be:
- Node.js (.mjs) for cross-platform compatibility
- Fast (< 1.5 seconds for BeforeTool, < 30 seconds for AfterAgent)
- Fail-open (crash = allow, not crash = block)
- JSON on stdout only, logs on stderr

---

*Hooks are policy. They enforce what written rules cannot.*
