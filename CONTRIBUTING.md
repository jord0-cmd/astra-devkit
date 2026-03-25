# Contributing to Astra DevKit

## Design Philosophy

**Hooks are policy. Agents are advisors.** Skills are knowledge. Standards are always-on rules.

We enforce behaviours via architecture, not reminders. If something must always happen, it's a hook. If something should usually happen, it's a standard. If something is domain-specific knowledge, it's a skill.

---

## Package Structure

```
gemini-config/
├── GEMINI.md              # Astra persona + @imports
├── settings.json          # Config: theme, hooks, agents, skills
├── standards/             # Always-loaded rules (@imported into GEMINI.md)
│   ├── rules.md           # 11 Rules, Confirm Protocol, Three Fix, Quality Gates
│   └── testing.md         # TDD, test pyramid, AI+TDD synergy
├── skills/                # On-demand domain knowledge (progressive disclosure)
│   └── <skill-name>/
│       └── SKILL.md       # Frontmatter (name, description) + instructions
├── agents/                # Specialist subagents (isolated context)
│   └── <agent-name>.md    # Frontmatter (name, description, tools, model, temp)
├── hooks/                 # Node.js automation scripts (cross-platform .mjs)
│   └── <hook-name>.mjs    # Runs at specific points in the agent loop
├── commands/              # Custom slash commands (TOML files)
│   └── <command>.toml     # prompt + description fields
├── bin/
│   └── install.mjs        # Node.js installer (npx entry point)
├── install.sh             # Bash installer (Linux/macOS)
├── install.ps1            # PowerShell installer (Windows)
└── geminiignore.template  # Template for project .geminiignore files
```

---

## Adding a Skill

1. Create `skills/<skill-name>/SKILL.md`
2. Add YAML frontmatter:
   ```yaml
   ---
   name: skill-name
   description: When to activate and what it does. This is what the model reads to decide activation.
   ---
   ```
3. Write instructions in markdown below the frontmatter
4. Keep under 700 lines — move detailed references to separate files if needed
5. The `description` field is critical — it determines when the model activates the skill

**Guidelines:**
- Skills are knowledge, not commands — teach the model, don't script it
- Include code examples — they're more effective than abstract rules
- Add a checklist at the end for verification
- Progressive disclosure: only name + description load initially; body loads on activation

---

## Adding an Agent

1. Create `agents/<agent-name>.md`
2. Add YAML frontmatter:
   ```yaml
   ---
   name: agent-name
   description: What this agent does and when to use it
   tools:
     - read_file
     - write_file
     - grep_search
   model: inherit
   temperature: 0.2
   max_turns: 15
   timeout_mins: 5
   ---
   ```
3. Write the system prompt in markdown below
4. Restrict tools to minimum needed (least privilege)

**Valid tool names:** `read_file`, `write_file`, `grep_search`, `list_directory`, `read_many_files`, `run_shell_command`, `web_search`, `web_fetch`

**Rules:**
- Agents can't call other agents (no recursion)
- Prefer read-only tools unless the agent needs to write
- Lower temperature for precision tasks (review, debug), higher for creative tasks

---

## Adding a Hook

1. Create `hooks/<hook-name>.mjs` (Node.js ESM)
2. Communication: JSON in via stdin, JSON out via stdout, logs to stderr
3. Wire it in `settings.json` under the appropriate event

**Template:**
```javascript
#!/usr/bin/env node
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());

  // Your logic here

  console.log("{}"); // Allow (or deny with decision/reason)
  process.exit(0);
});
```

**Rules:**
- Must be cross-platform (Node.js, no bash/PowerShell)
- stdout ONLY contains the final JSON — use stderr for all logging
- Keep hooks fast (< 5 seconds for tool hooks, < 30 for agent hooks)
- Exit 0 = success, Exit 2 = system block
- Test independently: `echo '{"tool_input":{"path":"test.py"}}' | node hooks/my-hook.mjs`

---

## Adding a Command

1. Create `commands/<command-name>.toml`
2. Flat format (no sections):
   ```toml
   description = "What this command does"
   prompt = "The prompt text sent to Gemini when invoked"
   ```
3. Don't conflict with built-in commands (`/help`, `/docs`, `/plan`, etc.)
4. Use `{{args}}` for user input: `prompt = "Review this: {{args}}"`

---

## Testing Changes

```bash
# Test a hook
echo '{"tool_input":{"path":"app/service.py","content":"test"}}' | node hooks/test-gate.mjs

# Test the installer (dry run)
node bin/install.mjs --dry-run

# Full test: wipe and reinstall
rm -rf ~/.gemini
gemini  # Re-auth
node bin/install.mjs
gemini  # Verify
```

---

## Pull Request Guidelines

- One concern per PR
- Test on both Linux and Windows if touching hooks or installers
- Update MANIFEST.md if adding/removing files
- Update README.md if adding user-facing features
- Follow conventional commits: `feat:`, `fix:`, `docs:`, `chore:`

---

## Design Decisions

**Why Node.js hooks?** Cross-platform. The team uses Windows and Linux. Node 20+ is already required by Gemini CLI. One codebase, works everywhere.

**Why progressive disclosure for skills?** Only metadata loads until activated. 17 skills at ~500 lines each would be 8,500 tokens of context bloat if loaded simultaneously.

**Why physical hooks over written rules?** Active vectors beat passive constraints in the attention mechanism. A written rule becomes wallpaper. A hook that blocks a write is impossible to ignore.

**Why the test-gate has an escape hatch?** Enforcement needs legible legitimacy. `ASTRA_TDD=off` exists because spike work is real, and if we don't provide a sanctioned bypass, people will create a worse one.
