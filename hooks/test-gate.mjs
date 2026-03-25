#!/usr/bin/env node
/**
 * BeforeTool hook — Test Gate
 * Blocks implementation file writes when no corresponding test file exists.
 * Forces TDD: tests must exist before implementation.
 * Cross-platform (Node.js).
 *
 * Logic:
 * - Only triggers on writes to app/, src/, or lib/ directories
 * - Skips test files, configs, docs, __init__.py, schemas, types
 * - Checks if a corresponding test file exists
 * - If no test file: blocks the write and tells the model to write tests first
 */

import { existsSync } from "node:fs";
import { basename, dirname, join, extname, sep } from "node:path";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const file = input.tool_input?.path || input.tool_input?.file_path || "";

  if (!file) {
    console.log("{}");
    process.exit(0);
  }

  const ext = extname(file).toLowerCase();
  const name = basename(file);
  const dir = dirname(file);
  const normalizedPath = file.replace(/\\/g, "/");

  // Only check source code files
  const codeExtensions = [".py", ".ts", ".tsx", ".js", ".jsx", ".rs"];
  if (!codeExtensions.includes(ext)) {
    console.log("{}");
    process.exit(0);
  }

  // Only check files in implementation directories
  const implDirs = /\/(app|src|lib)\//;
  if (!implDirs.test(normalizedPath)) {
    console.log("{}");
    process.exit(0);
  }

  // Skip files that don't need tests
  const skipPatterns = [
    /test_/, /\.test\./, /\.spec\./, /_test\./,  // Test files themselves
    /__init__\.py$/,                               // Python init
    /conftest\.py$/,                               // Pytest config
    /schema/, /types/, /type\./,                   // Type definitions
    /config/, /settings/,                          // Configuration
    /migration/, /alembic/,                        // Migrations
    /setup\.py$/, /manage\.py$/,                   // Setup files
    /\.d\.ts$/,                                    // Type declarations
    /main\.py$/, /main\.ts$/, /index\.ts$/,        // Entry points (debatable, but common)
  ];

  if (skipPatterns.some((p) => p.test(normalizedPath))) {
    console.log("{}");
    process.exit(0);
  }

  // Find the project root (walk up until we find package.json, pyproject.toml, or Cargo.toml)
  let projectRoot = dir;
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(join(projectRoot, "package.json")) ||
      existsSync(join(projectRoot, "pyproject.toml")) ||
      existsSync(join(projectRoot, "Cargo.toml")) ||
      existsSync(join(projectRoot, "requirements.txt"))
    ) {
      break;
    }
    const parent = dirname(projectRoot);
    if (parent === projectRoot) break;
    projectRoot = parent;
  }

  // Determine test file locations to check
  const nameWithoutExt = basename(file, ext);
  const testLocations = [];

  if (ext === ".py") {
    // Python: tests/test_name.py, tests/dir/test_name.py
    testLocations.push(join(projectRoot, "tests", `test_${nameWithoutExt}.py`));
    testLocations.push(join(projectRoot, "tests", basename(dir), `test_${nameWithoutExt}.py`));
    testLocations.push(join(dir, `test_${nameWithoutExt}.py`));
  } else if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    // TypeScript/JS: name.test.ts, name.spec.ts, __tests__/name.test.ts
    const testExt = ext.replace(/x$/, ""); // .tsx → .ts for test files
    testLocations.push(join(dir, `${nameWithoutExt}.test${testExt}`));
    testLocations.push(join(dir, `${nameWithoutExt}.spec${testExt}`));
    testLocations.push(join(dir, "__tests__", `${nameWithoutExt}.test${testExt}`));
    testLocations.push(join(projectRoot, "tests", `${nameWithoutExt}.test${testExt}`));
  } else if (ext === ".rs") {
    // Rust: tests are typically in the same file (#[cfg(test)]) or tests/ dir
    // Can't easily check inline tests, so check tests/ dir
    testLocations.push(join(projectRoot, "tests", `${nameWithoutExt}.rs`));
    testLocations.push(join(projectRoot, "tests", `test_${nameWithoutExt}.rs`));
  }

  // Check if any test file exists
  const hasTests = testLocations.some((loc) => existsSync(loc));

  if (!hasTests) {
    const testExamples = testLocations.slice(0, 2).join(" or ");
    const reason =
      `TDD Protocol: No test file found for ${name}. ` +
      `Before writing implementation, create the test file first (e.g., ${testExamples}). ` +
      `Write failing tests that define the expected behaviour, then implement the code to make them pass.`;

    console.log(JSON.stringify({ decision: "deny", reason }));
    process.stderr.write(`TEST GATE: Blocked ${name} — no corresponding test file\n`);
    process.exit(0);
  }

  // Tests exist — allow the write
  console.log("{}");
  process.exit(0);
});
