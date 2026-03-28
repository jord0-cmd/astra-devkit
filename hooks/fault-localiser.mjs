#!/usr/bin/env node
/**
 * AfterAgent hook — Reasoning-Guided Fault Localisation (RGFL)
 *
 * When tests fail, runs pytest with JUnit XML output, parses structured
 * results, and builds a "fault capsule" identifying the source files
 * and likely causes. Gives the agent a surgical target instead of a
 * wall of traceback text.
 *
 * Only fires when: build-gate passed (lint/types OK) but tests failed.
 * Uses pytest --junitxml for reliable parsing (not stdout).
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

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

  // Only fire if agent response mentions test failures
  const failureIndicators = /FAILED|AssertionError|assert.*==|pytest.*failed|test.*fail|Error.*test/i;
  if (!failureIndicators.test(response)) {
    console.log("{}");
    process.exit(0);
  }

  // Must have a Python test directory
  const hasTests = existsSync(join(cwd, "tests")) ||
                   existsSync(join(cwd, "backend", "tests"));
  if (!hasTests) {
    console.log("{}");
    process.exit(0);
  }

  // Run pytest with JUnit XML output
  const reportPath = join(cwd, ".astra", "test-report.xml");
  try {
    execSync(`mkdir -p ${join(cwd, ".astra")}`, { stdio: "pipe" });
    execSync(
      `uv run pytest --junitxml="${reportPath}" -q --tb=line 2>&1`,
      { cwd, stdio: ["pipe", "pipe", "pipe"], timeout: 30000 }
    );
    // If pytest passes, no fault to localise
    try { unlinkSync(reportPath); } catch { /* ignore */ }
    console.log("{}");
    process.exit(0);
  } catch {
    // Tests failed — this is expected, parse the XML
  }

  // Parse JUnit XML for failures
  if (!existsSync(reportPath)) {
    console.log("{}");
    process.exit(0);
  }

  let xml;
  try {
    xml = readFileSync(reportPath, "utf-8");
  } catch {
    console.log("{}");
    process.exit(0);
  }

  // Extract failure info from JUnit XML
  // <testcase classname="tests.test_api" name="test_create_task" file="tests/test_api.py" line="26">
  //   <failure message="assert 422 == 201">...</failure>
  // </testcase>
  const failures = [];
  const testcaseRegex = /<testcase[^>]*classname="([^"]*)"[^>]*name="([^"]*)"[^>]*file="([^"]*)"[^>]*line="(\d+)"[^>]*>[\s\S]*?<failure[^>]*message="([^"]*)"[^>]*>([\s\S]*?)<\/failure>/g;

  let match;
  while ((match = testcaseRegex.exec(xml)) !== null) {
    failures.push({
      classname: match[1],
      testName: match[2],
      file: match[3],
      line: match[4],
      message: match[5].substring(0, 200),
      detail: match[6].substring(0, 300),
    });
  }

  // Also try a simpler pattern for different pytest versions
  if (failures.length === 0) {
    const simpleRegex = /<testcase[^>]*name="([^"]*)"[^>]*>[\s\S]*?<failure[^>]*message="([^"]*)"[^>]*>/g;
    while ((match = simpleRegex.exec(xml)) !== null) {
      failures.push({
        classname: "",
        testName: match[1],
        file: "unknown",
        line: "0",
        message: match[2].substring(0, 200),
        detail: "",
      });
    }
  }

  if (failures.length === 0) {
    // Couldn't parse — pass through
    console.log("{}");
    process.exit(0);
  }

  // Build fault capsules
  const capsules = failures.slice(0, 5).map((f) => {
    // Try to identify source file from test file name
    let sourceGuess = "unknown";
    if (f.file.includes("test_api")) sourceGuess = "src/api/routes/";
    else if (f.file.includes("test_domain")) sourceGuess = "src/domain/models.py";
    else if (f.file.includes("test_")) {
      const module = f.file.replace("tests/", "").replace("test_", "").replace(".py", "");
      sourceGuess = `src/**/${module}*.py`;
    }

    return `  TEST: ${f.file}::${f.testName} (line ${f.line})\n` +
           `  FAILURE: ${f.message}\n` +
           `  LIKELY SOURCE: ${sourceGuess}`;
  });

  const capsule =
    `FAULT LOCALISATION (${failures.length} test failure${failures.length > 1 ? "s" : ""}):\n\n` +
    capsules.join("\n\n") +
    `\n\nFocus your fix on the LIKELY SOURCE files listed above.\n` +
    `DO NOT modify test files unless the test itself is wrong.\n` +
    `Fix ONE failure at a time, run tests between each fix.`;

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        additionalContext: capsule,
      },
    })
  );

  // Clean up
  try { unlinkSync(reportPath); } catch { /* ignore */ }

  process.exit(0);
});
