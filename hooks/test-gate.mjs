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

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
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
      `ASTRA-BLOCK: test-gate — No test file found for ${name}\n\n` +
      `Before writing this implementation, create the test file first:\n` +
      `    ${testExamples}\n\n` +
      `Write failing tests that define the expected behaviour, then implement the code to make them pass.\n\n` +
      `If this is exploratory/spike work, the user can set ASTRA_TDD=off to temporarily bypass.`;

    writeGateReport({
      hook: "test-gate",
      event: "BeforeTool",
      action: "denied",
      file: name,
      reason: "No test file found",
    });

    console.log(JSON.stringify({ decision: "deny", reason }));
    process.stderr.write(`TEST GATE: Blocked ${name} — no test file found\n`);
    process.exit(0);
  }

  // --- Tests exist. Check for sad path coverage (warn only, don't block) ---
  const content = input.tool_input?.content || input.tool_input?.new_string || "";

  if (content) {
    const sadPathWarnings = [];

    // Detect exception patterns in the implementation
    const exceptionPatterns = [
      { regex: /raise\s+\w*(?:Error|Exception|HTTPException)/g, lang: "python" },
      { regex: /throw\s+new\s+\w*(?:Error|Exception)/g, lang: "javascript" },
      { regex: /HTTPException\s*\(\s*status_code\s*=\s*(\d+)/g, lang: "fastapi" },
    ];

    const raisedExceptions = [];
    for (const { regex } of exceptionPatterns) {
      const matches = content.match(regex);
      if (matches) raisedExceptions.push(...matches);
    }

    if (raisedExceptions.length > 0) {
      // Check if the test file contains error-testing patterns
      const testFile = testLocations.find((loc) => existsSync(loc));
      if (testFile) {
        try {
          const testContent = readFileSync(testFile, "utf-8");
          const hasErrorTests =
            /pytest\.raises|expect\(.*\)\.toThrow|expect\(.*\)\.toReject|assert.*status_code.*[45]\d\d|\.raises\(|error|Error|exception|Exception/i.test(
              testContent
            );

          if (!hasErrorTests) {
            sadPathWarnings.push(
              `Your implementation raises ${raisedExceptions.length} exception(s) ` +
              `(${raisedExceptions.slice(0, 3).join(", ")}${raisedExceptions.length > 3 ? "..." : ""}) ` +
              `but the test file doesn't appear to test error paths. ` +
              `Consider adding tests for: invalid inputs, missing resources (404), and edge cases.`
            );
          }
        } catch {
          // Can't read test file — skip sad path check
        }
      }
    }

    if (sadPathWarnings.length > 0) {
      // Warn, don't block
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            additionalContext:
              "TEST GATE WARNING: " + sadPathWarnings.join(" "),
          },
        })
      );
      process.exit(0);
    }
  }

  // All good — allow
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
      session_id: "",
    });
    appendFileSync(join(reportDir, "gate-reports.jsonl"), entry + "\n");
  } catch {
    // Best-effort — don't crash the hook
  }
}
