---
name: hooks-guide
description: Use this skill when the user asks about hooks, wants to create custom hooks, needs to understand hook events, debug a hook, or modify the automation pipeline. Contains the complete hook system reference, all event schemas, and patterns for building custom hooks.
---

# Hooks Guide

Hooks are scripts that Gemini CLI runs at specific points in the agent loop. They let you automate quality checks, inject context, block dangerous operations, and customise how the AI works — without modifying the CLI itself.

---

## How Hooks Work

- Hooks run **synchronously** — the agent waits for them to finish
- Communication: **JSON in via stdin, JSON out via stdout, logs to stderr**
- Exit codes: **0** = success, **2** = block/deny, anything else = warning
- Configured in `settings.json` (user or project level)

**The golden rule:** stdout must contain ONLY the final JSON object. Any plain text on stdout will break parsing. Use stderr for all logging.

---

## Available Hook Events

### Lifecycle Hooks
| Event | When | Can Block? | Use For |
|-------|------|-----------|---------|
| `SessionStart` | Session begins | No | Load context, preferences, project state |
| `SessionEnd` | Session ends | No | Save state, cleanup, sync |
| `PreCompress` | Before context compression | No | Save important state before trim |
| `Notification` | System alert | No | Forward to Slack, desktop notification |

### Agent Hooks
| Event | When | Can Block? | Use For |
|-------|------|-----------|---------|
| `BeforeAgent` | After user prompt, before processing | Yes | Add context, validate input |
| `AfterAgent` | After agent completes turn | Yes (force retry) | Quality gates, build checks |

### Model Hooks
| Event | When | Can Block? | Use For |
|-------|------|-----------|---------|
| `BeforeModel` | Before LLM API call | Yes | Modify prompts, swap models |
| `AfterModel` | After LLM response chunk | Yes | Redact PII, filter content |
| `BeforeToolSelection` | Before tool selection | Yes | Restrict available tools |

### Tool Hooks
| Event | When | Can Block? | Use For |
|-------|------|-----------|---------|
| `BeforeTool` | Before tool executes | Yes | Validate args, scan for secrets |
| `AfterTool` | After tool executes | Yes | Auto-lint, add context, chain tools |

---

## Configuration Format

```json
// In settings.json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "regex_pattern",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/script.sh",
            "name": "my-hook-name",
            "timeout": 5000,
            "description": "What this hook does"
          }
        ]
      }
    ]
  }
}
```

### Matchers
- **Tool events** (`BeforeTool`, `AfterTool`): regex on tool name (e.g., `"write_file|replace_in_file"`)
- **Lifecycle events**: not applicable (fire on all occurrences)
- `"*"` or `""` matches everything

---

## Input/Output Schemas

### Base Input (all hooks receive)
```json
{
  "session_id": "string",
  "cwd": "string",
  "hook_event_name": "string",
  "timestamp": "ISO 8601 string"
}
```

### Common Output Fields
```json
{
  "decision": "allow|deny|block",
  "reason": "string — shown to agent",
  "systemMessage": "string — shown to user",
  "hookSpecificOutput": {
    "additionalContext": "string — injected into context"
  }
}
```

### Tool Hook Input
```json
{
  "tool_name": "write_file",
  "tool_input": { "path": "/app/main.py", "content": "..." }
}
```

### Agent Hook Input
```json
{
  "prompt": "user's message",
  "prompt_response": "agent's response (AfterAgent only)"
}
```

---

## Pre-Built Hooks (Installed with Package)

### Secret Scanner (`secret-scanner.mjs` — BeforeTool)
- Triggers on: `write_file`, `replace_in_file`, `create_file`, `edit_file`
- Scans for: AWS keys, GitHub tokens, OpenAI keys, Azure keys, GCP keys, passwords, private keys, connection strings
- Action: blocks the write, tells agent to use environment variables instead
- Named pattern matching — output says exactly what was caught (e.g., "AWS Access Key detected")

### Auto Lint (`auto-lint.mjs` — AfterTool)
- Triggers on: `write_file`, `replace_in_file`, `create_file`, `edit_file`
- Detects language: `.py` → ruff, `.ts/.tsx` → biome/eslint+prettier, `.rs` → rustfmt, `.json` → reformat
- Cross-platform command detection (`which` on Unix, `where` on Windows)
- Fails silently if linter not installed — won't break the workflow

### Context Loader (`context-loader.mjs` — SessionStart)
- Loads `~/.gemini/user.json` (name, experience, explanation preference, primary language)
- Checks for `kickstart-refs/` directory in project root
- Uses `os.homedir()` for cross-platform home directory resolution
- Injects as session context

### Build Gate (`build-gate.mjs` — AfterAgent)
- Only triggers when agent actually modified files (checks response text for write indicators)
- Auto-detects project type from manifest files (pyproject.toml, package.json, Cargo.toml)
- Runs appropriate checks: ruff + mypy (Python), tsc (TypeScript), cargo check (Rust)
- If issues found, forces agent to retry with error context

---

## Writing Your Own Hook

All hooks use **Node.js** (.mjs) for cross-platform compatibility (Windows, macOS, Linux). Node 20+ is required — same as Gemini CLI.

### Template — Block a Tool (BeforeTool)

```javascript
#!/usr/bin/env node
// Save as: ~/.gemini/hooks/my-hook.mjs

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());

  // Your logic here
  if (input.tool_name === "dangerous_thing") {
    console.log(JSON.stringify({
      decision: "deny",
      reason: "Blocked: not allowed in this project",
    }));
    process.stderr.write("MY HOOK: Blocked dangerous_thing\n");
    process.exit(0);
  }

  // Allow by default
  console.log("{}");
  process.exit(0);
});
```

### Template — Inject Context (SessionStart / BeforeAgent)

```javascript
#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());

  // Load some context
  const notes = existsSync("./NOTES.md")
    ? readFileSync("./NOTES.md", "utf-8").slice(0, 2000)
    : null;

  if (notes) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        additionalContext: `Project notes:\n${notes}`,
      },
    }));
  } else {
    console.log("{}");
  }
  process.exit(0);
});
```

### Template — Quality Gate with Retry (AfterAgent)

```javascript
#!/usr/bin/env node
import { execSync } from "node:child_process";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());

  // Run tests
  try {
    execSync("npm run test -- --run", { cwd: input.cwd, timeout: 20000 });
    console.log("{}"); // Tests passed
  } catch (err) {
    const output = err.stdout?.toString().slice(0, 500) || "Tests failed";
    console.log(JSON.stringify({
      decision: "block",
      reason: `Tests failed after your changes:\n${output}\nPlease fix.`,
    }));
  }
  process.exit(0);
});
```

### Cross-Platform Utility

```javascript
// Check if a command exists on any OS
function commandExists(cmd) {
  try {
    const check = process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`;
    execSync(check, { stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}
```

### Settings.json Configuration

```json
{
  "hooks": {
    "BeforeTool": [
      {
        "matcher": "write_file|edit_file",
        "hooks": [{
          "type": "command",
          "command": "node ~/.gemini/hooks/my-hook.mjs",
          "name": "my-hook",
          "timeout": 5000,
          "description": "What this hook does"
        }]
      }
    ]
  }
}
```

### Testing Your Hook

```bash
# Test with sample input (works on all platforms)
echo '{"tool_name":"write_file","tool_input":{"path":"test.py","content":"API_KEY=sk-12345"}}' | node ~/.gemini/hooks/secret-scanner.mjs

# Expected: {"decision": "deny", "reason": "..."}

# Test with safe content
echo '{"tool_name":"write_file","tool_input":{"path":"test.py","content":"print(hello)"}}' | node ~/.gemini/hooks/secret-scanner.mjs

# Expected: {}
```

---

## Patterns

### Context Injection (BeforeAgent / SessionStart)
```json
{
  "hookSpecificOutput": {
    "additionalContext": "The last 5 commits were: feat: add auth, fix: timeout, ..."
  }
}
```

### Security Gate (BeforeTool)
```json
{
  "decision": "deny",
  "reason": "Blocked: attempted to write credentials to source file. Use environment variables."
}
```

### Quality Gate with Retry (AfterAgent)
```json
{
  "decision": "block",
  "reason": "Build failed after your changes: TypeError in auth.ts line 42. Please fix."
}
```
This forces the agent to try again with the error message as context.

### Tool Chaining (AfterTool)
```json
{
  "hookSpecificOutput": {
    "tailToolCallRequest": {
      "name": "run_shell_command",
      "args": { "command": "npm run lint --fix" }
    }
  }
}
```
Executes another tool automatically after the first one completes.

---

## Best Practices

- **Keep hooks fast** — they block the agent. Under 5 seconds for tool hooks, under 15 for agent hooks.
- **Use specific matchers** — `"write_file|replace_in_file"` not `"*"`
- **Log to stderr** — stdout is ONLY for the JSON response
- **Test independently** — pipe sample JSON in, check output
- **Cache expensive operations** — file-based cache for repeated checks
- **Start simple** — get a basic hook working before adding complexity
- **Version control hooks** — commit to `.gemini/hooks/` for team sharing

## Debugging

```bash
# Check hook status in session
/hooks panel

# Test a hook manually
echo '{"tool_name":"write_file","tool_input":{"path":"x","content":"test"}}' | bash ~/.gemini/hooks/secret-scanner.sh

# Check for JSON parsing issues
echo '{"test": true}' | bash ~/.gemini/hooks/my-hook.sh | jq .
```

---

## Environment Variables Available

| Variable | Description |
|----------|-------------|
| `GEMINI_PROJECT_DIR` | Project root path |
| `GEMINI_SESSION_ID` | Current session ID |
| `GEMINI_CWD` | Working directory |

---

*Hooks are the team's quality guardrails. Automate the things humans forget.*
