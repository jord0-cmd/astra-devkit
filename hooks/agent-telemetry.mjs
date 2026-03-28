#!/usr/bin/env node
/**
 * AfterAgent hook — Agent Telemetry
 * Captures deterministic signals from agent responses for failure analysis.
 * Logs to .astra/agent-telemetry.jsonl — structured, machine-readable.
 *
 * Does NOT interpret or judge — just captures signals for post-hoc analysis.
 * Never blocks or modifies behavior.
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Error patterns — things that indicate something went wrong
const ERROR_PATTERNS = [
  { pattern: /AbortError/i, label: "AbortError (agent/tool timeout)" },
  { pattern: /ENOENT/i, label: "ENOENT (file not found)" },
  { pattern: /EACCES/i, label: "EACCES (permission denied)" },
  { pattern: /ETIMEDOUT/i, label: "ETIMEDOUT (network timeout)" },
  { pattern: /npm ERR!/i, label: "npm error" },
  { pattern: /pip.*error/i, label: "pip error" },
  { pattern: /ModuleNotFoundError/i, label: "Python module not found" },
  { pattern: /ImportError/i, label: "Python import error" },
  { pattern: /SyntaxError/i, label: "Syntax error" },
  { pattern: /TypeError/i, label: "Type error" },
  { pattern: /Cannot find module/i, label: "Node module not found" },
  { pattern: /command not found/i, label: "Command not found" },
  { pattern: /exit code [1-9]/i, label: "Non-zero exit code" },
  { pattern: /timed? ?out/i, label: "Timeout" },
  { pattern: /hung|unresponsive|not responding/i, label: "Process hung" },
  { pattern: /interactive prompt/i, label: "Interactive prompt blocked" },
  { pattern: /permission denied/i, label: "Permission denied" },
  { pattern: /CORS.*error/i, label: "CORS error" },
  { pattern: /type.*mismatch/i, label: "Type mismatch" },
  { pattern: /compilation? (?:error|fail)/i, label: "Compilation failure" },
  { pattern: /build (?:error|fail)/i, label: "Build failure" },
  { pattern: /test.*(?:fail|error)/i, label: "Test failure" },
];

// Success patterns — things that indicate completion
const SUCCESS_PATTERNS = [
  { pattern: /tests? (?:are |all |were )?(?:pass|passing|passed|green)/i, label: "tests_pass" },
  { pattern: /build (?:was )?(?:success|complete|passed)/i, label: "build_success" },
  { pattern: /(?:all|every) (?:checks?|tests?) (?:pass|green)/i, label: "all_checks_pass" },
  { pattern: /compilation? success/i, label: "compile_success" },
  { pattern: /(?:created|generated|wrote) \d+ files?/i, label: "files_generated" },
  { pattern: /docker.*(?:running|up|started)/i, label: "docker_running" },
  { pattern: /complete|finished|done/i, label: "task_complete" },
];

// Tool mentions — what tools were used
const TOOL_PATTERNS = [
  { pattern: /write_file/gi, label: "write_file" },
  { pattern: /read_file/gi, label: "read_file" },
  { pattern: /run_shell_command/gi, label: "run_shell_command" },
  { pattern: /replace/gi, label: "replace" },
  { pattern: /grep_search/gi, label: "grep_search" },
  { pattern: /npm (?:create|install|init|run)/gi, label: "npm_command" },
  { pattern: /pip install|uv (?:pip|add|run)/gi, label: "pip_command" },
  { pattern: /docker (?:compose|build|run)/gi, label: "docker_command" },
  { pattern: /pytest|vitest|jest/gi, label: "test_runner" },
  { pattern: /ruff|mypy|tsc|biome/gi, label: "linter" },
  { pattern: /alembic/gi, label: "alembic" },
  { pattern: /sg |ast-grep/gi, label: "ast_grep" },
  { pattern: /sed -i|awk /gi, label: "sed_awk_deprecated" },
];

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString());
    const response = input.prompt_response || "";
    const prompt = input.prompt || "";
    const sessionId = input.session_id || "";

    // Extract signals
    const detectedErrors = [];
    const successSignals = [];
    const toolsMentioned = [];

    for (const { pattern, label } of ERROR_PATTERNS) {
      if (pattern.test(response)) {
        detectedErrors.push(label);
      }
    }

    for (const { pattern, label } of SUCCESS_PATTERNS) {
      if (pattern.test(response)) {
        successSignals.push(label);
      }
    }

    for (const { pattern, label } of TOOL_PATTERNS) {
      if (pattern.test(response)) {
        toolsMentioned.push(label);
      }
    }

    // Determine overall status heuristic
    let status = "unknown";
    if (detectedErrors.length === 0 && successSignals.length > 0) {
      status = "success";
    } else if (detectedErrors.length > 0 && successSignals.length === 0) {
      status = "failure";
    } else if (detectedErrors.length > 0 && successSignals.length > 0) {
      status = "partial";  // Had errors but recovered
    }

    // Check for deprecated tool usage
    const deprecatedTools = toolsMentioned.filter(
      (t) => t === "sed_awk_deprecated" || t === "npm_command" || t === "pip_command"
    );



    // Capture AAG State Drift if available
    let aagState = { available: false, in_sync: null, high_warnings: 0 };
    const cwd = input.cwd || process.cwd();
    const graphPath = join(cwd, "docs", "architectural-graph.json");
    if (existsSync(graphPath)) {
        try {
            const graph = JSON.parse(readFileSync(graphPath, "utf-8"));
            const warnings = graph.drift_warnings || [];
            const highWarnings = warnings.filter((w) => w.severity === "high").length;
            aagState = {
                available: true,
                in_sync: highWarnings === 0,
                high_warnings: highWarnings
            };
        } catch (e) {
            // Ignore parse errors, aagState stays unavailable
        }
    }

    const entry = {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      status,
      response_length: response.length,
      prompt_preview: prompt.substring(0, 200),
      detected_errors: [...new Set(detectedErrors)],
      success_signals: [...new Set(successSignals)],
      tools_mentioned: [...new Set(toolsMentioned)],
      deprecated_tools: [...new Set(deprecatedTools)],
      error_count: detectedErrors.length,
      recovery_detected: detectedErrors.length > 0 && successSignals.length > 0,
      aag_state: aagState,
    };

    // Write to telemetry log
    const reportDir = join(cwd, ".astra");
    mkdirSync(reportDir, { recursive: true });
    appendFileSync(
      join(reportDir, "agent-telemetry.jsonl"),
      JSON.stringify(entry) + "\n"
    );

    // Inject context about deprecated tools if found
    if (deprecatedTools.length > 0) {
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            additionalContext:
              `TELEMETRY NOTE: Detected deprecated tool usage: ${deprecatedTools.join(", ")}. ` +
              `Prefer ast-grep (sg) over sed/awk for code modification, and write package files directly instead of running npm/pip install.`,
          },
        })
      );
      process.exit(0);
    }

    // Silent pass — don't inject anything unless there's a signal worth surfacing
    console.log("{}");
    process.exit(0);
  } catch (err) {
    // Fail open — never break the agent loop
    process.stderr.write(`TELEMETRY: Hook error (non-fatal): ${err.message}\n`);
    console.log("{}");
    process.exit(0);
  }
});
