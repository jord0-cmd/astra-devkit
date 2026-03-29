#!/usr/bin/env node
// Office mode bypass — dev hooks exit silently in office mode
import { existsSync as _exF, readFileSync as _rdF } from "node:fs";
import { join as _jn } from "node:path";
import { homedir as _hd } from "node:os";
const _uf = _jn(_hd(), ".gemini", "user.json");
if (_exF(_uf)) { try { if (JSON.parse(_rdF(_uf, "utf-8")).mode === "office") { console.log("{}"); process.exit(0); } } catch {} }

/**
 * BeforeTool hook — Code Standards Gate
 * Fast static checks combined into one hook (< 1.5s).
 * - Blocks requirements.txt creation (use pyproject.toml)
 * - Warns on hardcoded global state in source files
 * Cross-platform (Node.js).
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const file = input.tool_input?.path || input.tool_input?.file_path || "";
  const content = input.tool_input?.content || input.tool_input?.new_string || "";
  const sessionId = input.session_id || "";

  if (!file) {
    console.log("{}");
    process.exit(0);
  }

  const name = basename(file);
  const normalizedPath = file.replace(/\\/g, "/");

  // --- Check 1: Block requirements.txt creation ---
  if (name === "requirements.txt") {
    const reason =
      "ASTRA-BLOCK: code-standards — requirements.txt is not allowed.\n\n" +
      "Use pyproject.toml with uv for dependency management instead:\n\n" +
      "```toml\n[project]\nname = \"myproject\"\nversion = \"0.1.0\"\n" +
      "requires-python = \">=3.11\"\ndependencies = [\n    \"fastapi>=0.115\",\n]\n```\n\n" +
      "Then run: uv sync";

    writeGateReport({
      hook: "code-standards",
      event: "BeforeTool",
      action: "denied",
      file: name,
      reason: "requirements.txt blocked — use pyproject.toml",
      session_id: sessionId,
    });

    console.log(JSON.stringify({ decision: "deny", reason }));
    process.stderr.write("CODE STANDARDS: Blocked requirements.txt — use pyproject.toml\n");
    process.exit(0);
  }

  // --- Check 2: Warn on hardcoded global state in Python source ---
  if (extname(file) === ".py" && /\/(app|src|lib)\//.test(normalizedPath) && content) {
    // Look for hardcoded file paths as module-level constants
    const globalStatePatterns = [
      /^[A-Z_]+\s*=\s*["'][^"']*\.(json|db|sqlite|csv|txt|log)["']/m,
    ];

    const warnings = [];
    for (const pattern of globalStatePatterns) {
      if (pattern.test(content)) {
        const match = content.match(pattern)?.[0]?.trim();
        warnings.push(
          `Hardcoded file path detected: \`${match}\`. ` +
          "Consider using Pydantic BaseSettings or function parameters for configuration " +
          "so tests can inject different paths."
        );
      }
    }

    if (warnings.length > 0) {
      // Warn, don't block — nudge toward better patterns
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            additionalContext:
              "CODE STANDARDS WARNING: " + warnings.join(" | ") +
              " This doesn't block your write, but hardcoded paths make testing harder.",
          },
        })
      );
      process.exit(0);
    }
  }

  // --- Check 3: Block `import logging` in Python source files ---
  if (extname(file) === ".py" && /\/(app|src|lib)\//.test(normalizedPath) && content) {
    const loggingImport = /^(?:import logging|from logging import)/m;
    if (loggingImport.test(content)) {
      const reason =
        "ASTRA-BLOCK: code-standards — `import logging` is not allowed in source files.\n\n" +
        "Use structlog for structured, JSON-serializable logging:\n\n" +
        "```python\nimport structlog\nlogger = structlog.get_logger()\n```\n\n" +
        "structlog provides structured context binding, automatic key-value formatting, " +
        "and integrates with standard library logging as a renderer.";

      writeGateReport({
        hook: "code-standards",
        event: "BeforeTool",
        action: "denied",
        file: name,
        reason: "stdlib logging blocked — use structlog",
        session_id: sessionId,
      });

      console.log(JSON.stringify({ decision: "deny", reason }));
      process.stderr.write("CODE STANDARDS: Blocked import logging — use structlog\n");
      process.exit(0);
    }
  }

  // --- Check 4: Warn on primitive types for domain concepts in Python ---
  if (extname(file) === ".py" && /\/(app|src|lib)\/domain\//.test(normalizedPath) && content) {
    // Look for function params using bare str/int where domain types should exist
    const primitiveWarnings = [];
    if (/def\s+\w+\(.*\b(user_id|incident_id|task_id|booking_id|equipment_id)\s*:\s*str\b/.test(content)) {
      primitiveWarnings.push(
        "Domain IDs typed as bare `str` — consider using `NewType` or a branded type " +
        "(e.g., `TaskId = NewType('TaskId', str)`) to prevent accidental misuse."
      );
    }

    if (primitiveWarnings.length > 0) {
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            additionalContext:
              "CODE STANDARDS WARNING: " + primitiveWarnings.join(" | ") +
              " This is advisory — domain types prevent bugs at boundaries.",
          },
        })
      );
      process.exit(0);
    }
  }

  // All checks passed
  console.log("{}");
  process.exit(0);
});

function writeGateReport(report) {
  try {
    const reportDir = join(process.cwd(), ".astra");
    mkdirSync(reportDir, { recursive: true });
    const entry = JSON.stringify({
      ...report,
      timestamp: new Date().toISOString(),
    });
    appendFileSync(join(reportDir, "gate-reports.jsonl"), entry + "\n");
  } catch {
    // Gate reports are best-effort — don't crash the hook
  }
}
