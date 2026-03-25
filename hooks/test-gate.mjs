#!/usr/bin/env node
/**
 * BeforeTool hook — Test Gate (TDD Enforcement)
 * Blocks implementation file writes when no corresponding test file exists.
 * Cross-platform (Node.js).
 *
 * Features:
 * - Smart categorization: only blocks actual implementation files
 * - Spike mode: env var ASTRA_TDD=off bypasses (logged)
 * - Detailed block messages explaining exactly why and what to do
 * - Skips scaffolding, configs, types, schemas, entry points, migrations
 */

import { existsSync } from "node:fs";
import { basename, dirname, join, extname } from "node:path";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const file = input.tool_input?.path || input.tool_input?.file_path || "";

  if (!file) {
    console.log("{}");
    process.exit(0);
  }

  // Spike mode — explicit override via environment variable
  if (process.env.ASTRA_TDD === "off") {
    process.stderr.write(
      `TEST GATE: Spike mode active (ASTRA_TDD=off) — TDD enforcement bypassed for ${basename(file)}\n`
    );
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext:
            "Note: TDD gate is bypassed (spike mode). Remember to write tests before committing.",
        },
      })
    );
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

  // --- Smart skip categories ---
  // These files are allowed WITHOUT tests (scaffolding, config, types, etc.)
  const skipPatterns = [
    // Test files themselves
    /test_/, /\.test\./, /\.spec\./, /_test\./,
    // Python scaffolding
    /__init__\.py$/, /conftest\.py$/, /setup\.py$/, /manage\.py$/,
    // Configuration and settings
    /config/, /settings/, /constants/,
    // Type definitions and schemas (they ARE the spec)
    /schema/, /types/, /type\./, /\.d\.ts$/,
    // Database migrations
    /migration/, /alembic/, /prisma/,
    // Entry points and routers (thin wiring, not logic)
    /^main\./, /^index\./, /^app\./, /router/, /routes\//,
    // Database setup (connection, session factory — no logic to test)
    /database\./, /db\./, /session\./,
    // Middleware (often thin wrappers)
    /middleware/,
    // Models / ORM definitions (declarative, not logic)
    /models?\./,
    // Dependencies / DI wiring
    /deps\./, /dependencies\./,
    // Utilities under 50 lines are borderline — allow for now
  ];

  if (skipPatterns.some((p) => p.test(name) || p.test(normalizedPath))) {
    console.log("{}");
    process.exit(0);
  }

  // --- Find project root ---
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

  // --- Determine test file locations ---
  const nameWithoutExt = basename(file, ext);
  const testLocations = [];

  if (ext === ".py") {
    testLocations.push(join(projectRoot, "tests", `test_${nameWithoutExt}.py`));
    testLocations.push(
      join(projectRoot, "tests", basename(dir), `test_${nameWithoutExt}.py`)
    );
    testLocations.push(join(dir, `test_${nameWithoutExt}.py`));
  } else if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    const testExt = ext.replace(/x$/, "");
    testLocations.push(join(dir, `${nameWithoutExt}.test${testExt}`));
    testLocations.push(join(dir, `${nameWithoutExt}.spec${testExt}`));
    testLocations.push(
      join(dir, "__tests__", `${nameWithoutExt}.test${testExt}`)
    );
    testLocations.push(
      join(projectRoot, "tests", `${nameWithoutExt}.test${testExt}`)
    );
  } else if (ext === ".rs") {
    testLocations.push(join(projectRoot, "tests", `${nameWithoutExt}.rs`));
    testLocations.push(
      join(projectRoot, "tests", `test_${nameWithoutExt}.rs`)
    );
  }

  // --- Check if any test file exists ---
  const hasTests = testLocations.some((loc) => existsSync(loc));

  if (!hasTests) {
    const testExamples = testLocations.slice(0, 2).join("\n    or ");
    const reason =
      `TDD Gate: Blocked write to ${name}\n\n` +
      `No test file found. Before writing this implementation, create the test file first:\n` +
      `    ${testExamples}\n\n` +
      `Write failing tests that define the expected behaviour, then implement the code to make them pass.\n\n` +
      `If this is exploratory/spike work, the user can set ASTRA_TDD=off to temporarily bypass this gate.`;

    console.log(JSON.stringify({ decision: "deny", reason }));
    process.stderr.write(`TEST GATE: Blocked ${name} — no test file found\n`);
    process.exit(0);
  }

  // Tests exist — allow
  console.log("{}");
  process.exit(0);
});
