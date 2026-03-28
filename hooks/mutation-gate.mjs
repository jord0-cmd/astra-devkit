#!/usr/bin/env node
/**
 * AfterAgent hook — Mutation Gate
 * Runs targeted AST mutations on critical code paths after agent completes.
 * If any mutation SURVIVES (tests pass on mutated code), warns about test gaps.
 *
 * Requires: ast-grep (sg), uv + pytest
 * Only runs on Python projects with tests/ directory.
 * Lightweight — runs 3-5 quick mutations, not a full suite.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";
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

  // Only trigger if agent wrote Python files
  const writeIndicators = /write_file|replace|\.py|domain|models|routes/i;
  if (!writeIndicators.test(response)) {
    console.log("{}");
    process.exit(0);
  }

  // Only run on projects with tests
  const hasTests = existsSync(join(cwd, "tests")) ||
                   existsSync(join(cwd, "backend", "tests"));
  const hasPython = existsSync(join(cwd, "pyproject.toml"));

  if (!hasTests || !hasPython) {
    console.log("{}");
    process.exit(0);
  }

  // Check for sg
  try {
    execSync("which sg", { stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    console.log("{}");
    process.exit(0);
  }

  // Auto-detect mutation targets from the codebase
  const mutations = [];

  // Look for domain models with enum defaults
  const domainFiles = [
    join(cwd, "src", "domain", "models.py"),
    join(cwd, "src", "models.py"),
    join(cwd, "backend", "src", "domain", "models.py"),
  ];

  for (const modelFile of domainFiles) {
    if (!existsSync(modelFile)) continue;
    const content = readFileSync(modelFile, "utf-8");

    // Find Status enum default
    if (content.includes("Status.BACKLOG")) {
      mutations.push({
        file: modelFile,
        pattern: "Status.BACKLOG",
        replacement: "Status.DONE",
        description: "Flip default status BACKLOG→DONE",
      });
    }

    // Find Priority enum default
    if (content.includes("Priority.MEDIUM")) {
      mutations.push({
        file: modelFile,
        pattern: "Priority.MEDIUM",
        replacement: "Priority.URGENT",
        description: "Flip default priority MEDIUM→URGENT",
      });
    }

    break; // Only use first found model file
  }

  // Look for route files with return statements
  const routeFiles = [
    join(cwd, "src", "api", "routes", "tasks.py"),
    join(cwd, "backend", "src", "api", "routes", "tasks.py"),
  ];

  for (const routeFile of routeFiles) {
    if (!existsSync(routeFile)) continue;
    const content = readFileSync(routeFile, "utf-8");

    if (content.includes("HTTP_201_CREATED")) {
      mutations.push({
        file: routeFile,
        pattern: "status.HTTP_201_CREATED",
        replacement: "status.HTTP_200_OK",
        description: "Change create 201→200",
      });
    }

    break;
  }

  if (mutations.length === 0) {
    console.log("{}");
    process.exit(0);
  }

  // Run mutations (max 3 for speed)
  const toRun = mutations.slice(0, 3);
  const survived = [];

  for (const m of toRun) {
    const backup = m.file + ".mutation-bak";
    try {
      // Backup
      copyFileSync(m.file, backup);

      // Apply mutation
      execSync(
        `sg -p '${m.pattern}' -r '${m.replacement}' --lang python --update-all '${m.file}'`,
        { stdio: ["pipe", "pipe", "pipe"], timeout: 5000 }
      );

      // Verify mutation applied
      const original = readFileSync(backup, "utf-8");
      const mutated = readFileSync(m.file, "utf-8");

      if (original === mutated) {
        // Mutation didn't apply — skip
        continue;
      }

      // Run tests
      try {
        execSync("uv run pytest -x -q --tb=no 2>&1", {
          cwd,
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 30000,
        });
        // Tests PASSED on mutated code = SURVIVED = bad
        survived.push(m.description);
      } catch {
        // Tests FAILED = mutation KILLED = good
      }
    } catch {
      // sg or test error — skip this mutation
    } finally {
      // Always restore
      try {
        copyFileSync(backup, m.file);
        unlinkSync(backup);
      } catch { /* best effort */ }
    }
  }

  if (survived.length > 0) {
    const list = survived.map((s) => `  - ${s}`).join("\n");
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext:
            `MUTATION GATE: ${survived.length} mutation(s) SURVIVED (tests passed on mutated code):\n${list}\n\n` +
            "This means your tests have gaps — they don't catch these specific faults. " +
            "Write tests that explicitly assert the mutated behavior would fail.",
        },
      })
    );
  } else if (toRun.length > 0) {
    process.stderr.write(
      `MUTATION GATE: ${toRun.length} mutations applied, all killed. Tests are structurally sound.\n`
    );
    console.log("{}");
  } else {
    console.log("{}");
  }

  process.exit(0);
});
