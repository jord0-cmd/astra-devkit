#!/usr/bin/env node
// Office mode bypass — dev hooks exit silently in office mode
import { existsSync as _exF, readFileSync as _rdF } from "node:fs";
import { join as _jn } from "node:path";
import { homedir as _hd } from "node:os";
const _uf = _jn(_hd(), ".gemini", "user.json");
if (_exF(_uf)) { try { if (JSON.parse(_rdF(_uf, "utf-8")).mode === "office") { console.log("{}"); process.exit(0); } } catch {} }

/**
 * AfterAgent hook — CEGIS Repair Loop (Counterexample-Guided)
 *
 * State machine that tracks repeated test failures across retries.
 * On retry for the same failing test, provides minimal counterexample
 * and constrains the next fix attempt. Escalates after 3 retries.
 *
 * State persisted to .astra/cegis_state.json (repo-local, survives
 * build-gate interruptions).
 *
 * Fires AFTER fault-localiser. Only activates on retries, not first failures.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MAX_RETRIES = 3;

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const cwd = input.cwd || "";
  const response = input.prompt_response || "";

  if (!cwd) {
    console.log("{}");
    process.exit(0);
  }

  const astraDir = join(cwd, ".astra");
  const statePath = join(astraDir, "cegis_state.json");

  // Ensure .astra directory exists
  try { mkdirSync(astraDir, { recursive: true }); } catch { /* ignore */ }

  // Check if tests are currently failing
  let testsPassing = true;
  let failedTests = [];

  const hasTests = existsSync(join(cwd, "tests")) ||
                   existsSync(join(cwd, "backend", "tests"));
  const hasPython = existsSync(join(cwd, "pyproject.toml"));

  if (!hasTests || !hasPython) {
    // Clear state if no tests
    try { if (existsSync(statePath)) writeFileSync(statePath, "{}"); } catch { /* ignore */ }
    console.log("{}");
    process.exit(0);
  }

  // Run quick test check
  try {
    const result = execSync(
      "uv run pytest -q --tb=line 2>&1",
      { cwd, stdio: ["pipe", "pipe", "pipe"], timeout: 30000 }
    );
    testsPassing = true;
  } catch (err) {
    testsPassing = false;
    // Extract failed test names from output
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    const failPattern = /FAILED ([\w\/\.:]+)/g;
    let m;
    while ((m = failPattern.exec(output)) !== null) {
      failedTests.push(m[1]);
    }
  }

  // If tests pass, clear CEGIS state and exit
  if (testsPassing) {
    if (existsSync(statePath)) {
      try {
        const oldState = JSON.parse(readFileSync(statePath, "utf-8"));
        if (oldState.status === "active") {
          process.stderr.write(
            `CEGIS: Test ${oldState.target_test || "unknown"} now passes after ${oldState.attempt || 0} attempt(s). Repair loop complete.\n`
          );
        }
      } catch { /* ignore */ }
      writeFileSync(statePath, JSON.stringify({ status: "cleared" }));
    }
    console.log("{}");
    process.exit(0);
  }

  // Tests are failing — load or create CEGIS state
  let state = { status: "inactive", attempt: 0, target_test: "", previous_diffs: [] };
  try {
    if (existsSync(statePath)) {
      state = JSON.parse(readFileSync(statePath, "utf-8"));
    }
  } catch { /* ignore */ }

  const currentTarget = failedTests[0] || "unknown";

  // Is this the same test failing again?
  if (state.status === "active" && state.target_test === currentTarget) {
    // Same test, retry detected
    state.attempt += 1;
  } else {
    // New failure or different test — start fresh CEGIS
    state = {
      status: "active",
      attempt: 1,
      target_test: currentTarget,
      previous_diffs: [],
    };
  }

  // Capture what changed since last attempt
  let recentDiff = "";
  try {
    recentDiff = execSync("git diff --name-only HEAD 2>/dev/null || echo 'no git'", {
      cwd, stdio: ["pipe", "pipe", "pipe"], timeout: 5000,
    }).toString().trim();
  } catch { /* ignore */ }

  if (recentDiff && recentDiff !== "no git") {
    state.previous_diffs.push(recentDiff);
  }

  // Save state
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  // First failure — let fault-localiser handle it, CEGIS stays quiet
  if (state.attempt <= 1) {
    console.log("{}");
    process.exit(0);
  }

  // Escalation: after MAX_RETRIES, declare architectural
  if (state.attempt > MAX_RETRIES) {
    const capsule =
      `CEGIS ESCALATION: Test "${currentTarget}" has failed ${state.attempt} consecutive attempts.\n\n` +
      `This is likely an architectural issue, not an implementation bug.\n` +
      `Files modified across attempts:\n${state.previous_diffs.map((d) => "  " + d).join("\n")}\n\n` +
      `STOP patching. Step back and:\n` +
      `1. Explain WHY this test keeps failing\n` +
      `2. Identify the structural mismatch\n` +
      `3. Propose a redesign, not another patch`;

    console.log(JSON.stringify({ hookSpecificOutput: { additionalContext: capsule } }));
    process.exit(0);
  }

  // Retry #2-3: provide minimal counterexample
  // Run the specific failing test to get detailed output
  let testDetail = "";
  try {
    execSync(
      `uv run pytest "${currentTarget.split("::")[0]}" -k "${currentTarget.split("::")[1] || ""}" -v --tb=short 2>&1`,
      { cwd, stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }
    );
  } catch (err) {
    testDetail = (err.stdout?.toString() || "").substring(0, 500);
  }

  const capsule =
    `CEGIS REPAIR (attempt ${state.attempt}/${MAX_RETRIES}):\n\n` +
    `Target: ${currentTarget}\n` +
    `Previous fix DID NOT WORK. Try a DIFFERENT approach.\n\n` +
    `Files changed in previous attempts:\n${state.previous_diffs.map((d) => "  " + d).join("\n")}\n\n` +
    (testDetail ? `Test output:\n${testDetail}\n\n` : "") +
    `CONSTRAINTS:\n` +
    `- Your fix must pass "${currentTarget}" without breaking other tests\n` +
    `- Do NOT repeat the same change you already tried\n` +
    `- If the issue is in your domain model, check the contract first\n` +
    `- Run tests after EACH change, not in batch`;

  console.log(JSON.stringify({ hookSpecificOutput: { additionalContext: capsule } }));
  process.exit(0);
});
