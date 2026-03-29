#!/usr/bin/env node
// Office mode bypass — dev hooks exit silently in office mode
import { existsSync as _exF, readFileSync as _rdF } from "node:fs";
import { join as _jn } from "node:path";
import { homedir as _hd } from "node:os";
const _uf = _jn(_hd(), ".gemini", "user.json");
if (_exF(_uf)) { try { if (JSON.parse(_rdF(_uf, "utf-8")).mode === "office") { console.log("{}"); process.exit(0); } } catch {} }

/**
 * AfterAgent hook — Build Gate
 * Runs build/test verification after the agent completes a coding task.
 * Only triggers if the agent likely modified source files.
 * Cross-platform (Node.js).
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const MAX_RETRIES = 3;

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const projectDir = input.cwd || "";
  const response = input.prompt_response || "";
  const sessionId = input.session_id || "unknown";

  // Only run if the agent actually wrote/modified files
  const writeIndicators =
    /write_file|replace|created|modified|updated.*file|wrote.*to|edit_file/i;
  if (!writeIndicators.test(response)) {
    console.log("{}");
    process.exit(0);
  }

  if (!projectDir) {
    console.log("{}");
    process.exit(0);
  }

  // Circuit breaker — track retries per session, bail after MAX_RETRIES
  const retryDir = join(tmpdir(), "astra-build-gate");
  const retryFile = join(retryDir, `${sessionId.replace(/[^a-zA-Z0-9]/g, "_")}.json`);

  let retryCount = 0;
  try {
    mkdirSync(retryDir, { recursive: true });
    if (existsSync(retryFile)) {
      const data = JSON.parse(readFileSync(retryFile, "utf-8"));
      retryCount = data.count || 0;
    }
  } catch { /* ignore */ }

  if (retryCount >= MAX_RETRIES) {
    process.stderr.write(
      `BUILD GATE: Circuit breaker tripped (${MAX_RETRIES} retries). Passing to human.\n`
    );
    // Reset for next round
    try { writeFileSync(retryFile, JSON.stringify({ count: 0 })); } catch { /* ignore */ }
    console.log("{}");
    process.exit(0);
  }

  function tryCheck(cmd, cwd) {
    try {
      execSync(cmd, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 25000,
      });
      return null; // No error
    } catch (err) {
      const output = (err.stderr?.toString() || "") + (err.stdout?.toString() || "");
      // Return first few lines of error
      return output
        .split("\n")
        .filter((line) => line.trim())
        .slice(0, 8)
        .join("\n");
    }
  }

  function commandExists(cmd) {
    try {
      execSync(process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      return true;
    } catch {
      return false;
    }
  }

  const issues = [];

  // Python project
  if (
    existsSync(join(projectDir, "pyproject.toml")) ||
    existsSync(join(projectDir, "requirements.txt"))
  ) {
    if (commandExists("ruff")) {
      const lintErr = tryCheck("ruff check . --quiet", projectDir);
      if (lintErr) issues.push(`Python lint (ruff):\n${lintErr}`);
    }
    if (commandExists("mypy")) {
      const typeErr = tryCheck("mypy src/ --no-error-summary", projectDir);
      if (typeErr) {
        const errors = typeErr
          .split("\n")
          .filter((l) => l.includes("error:"))
          .slice(0, 5)
          .join("\n");
        if (errors) issues.push(`Python type errors (mypy):\n${errors}`);
      }
    }
  }

  // TypeScript/Node project
  if (existsSync(join(projectDir, "package.json"))) {
    if (existsSync(join(projectDir, "tsconfig.json")) && commandExists("npx")) {
      const tscErr = tryCheck("npx tsc --noEmit", projectDir);
      if (tscErr) {
        const errors = tscErr
          .split("\n")
          .filter((l) => l.includes("error TS"))
          .slice(0, 5)
          .join("\n");
        if (errors) issues.push(`TypeScript errors:\n${errors}`);
      }
    }
  }

  // Rust project
  if (existsSync(join(projectDir, "Cargo.toml"))) {
    if (commandExists("cargo")) {
      const cargoErr = tryCheck("cargo check 2>&1", projectDir);
      if (cargoErr) {
        const errors = cargoErr
          .split("\n")
          .filter((l) => l.startsWith("error"))
          .slice(0, 5)
          .join("\n");
        if (errors) issues.push(`Cargo errors:\n${errors}`);
      }
    }
  }

  // Report
  if (issues.length > 0) {
    // Increment retry counter
    try {
      writeFileSync(retryFile, JSON.stringify({ count: retryCount + 1 }));
    } catch { /* ignore */ }

    const attemptsLeft = MAX_RETRIES - (retryCount + 1);
    const retryNote = attemptsLeft > 0
      ? `\n(Attempt ${retryCount + 1}/${MAX_RETRIES} — ${attemptsLeft} retries remaining before handing to human)`
      : `\n(Final attempt — fix these or the build gate will pass control back to you)`;

    const reason = `Build gate found issues after your changes:\n\n${issues.join("\n\n")}${retryNote}\n\nPlease fix these before continuing.`;
    console.log(JSON.stringify({ decision: "block", reason }));
    process.stderr.write(`BUILD GATE: Issues found — retry ${retryCount + 1}/${MAX_RETRIES}\n`);
  } else {
    // Success — reset retry counter
    try { writeFileSync(retryFile, JSON.stringify({ count: 0 })); } catch { /* ignore */ }
    console.log("{}");
  }
  process.exit(0);
});
