#!/usr/bin/env node
// Office mode bypass — dev hooks exit silently in office mode
import { existsSync as _exF, readFileSync as _rdF } from "node:fs";
import { join as _jn } from "node:path";
import { homedir as _hd } from "node:os";
const _uf = _jn(_hd(), ".gemini", "user.json");
if (_exF(_uf)) { try { if (JSON.parse(_rdF(_uf, "utf-8")).mode === "office") { console.log("{}"); process.exit(0); } } catch {} }

/**
 * AfterAgent hook — Artifact Checker
 * Scans for required project artifacts after the agent completes work.
 * Fixes the "documentation blind spot" — agents fix code but forget docs.
 * Advisory — warns with specific list of missing artifacts.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const cwd = input.cwd || "";

  if (!cwd) {
    console.log("{}");
    process.exit(0);
  }

  // Detect project type
  const hasPython = existsSync(join(cwd, "pyproject.toml")) ||
                    existsSync(join(cwd, "src", "domain")) ||
                    existsSync(join(cwd, "src", "api"));
  const hasFrontend = existsSync(join(cwd, "package.json")) ||
                      existsSync(join(cwd, "frontend", "package.json"));
  const isFullstack = hasPython && hasFrontend;

  const missing = [];

  // Universal artifacts
  if (!existsSync(join(cwd, ".gitignore"))) {
    missing.push(".gitignore at project root");
  }

  // Python artifacts
  if (hasPython) {
    if (!existsSync(join(cwd, "pyproject.toml"))) {
      missing.push("pyproject.toml (required — never use requirements.txt)");
    }
    const hasTests = existsSync(join(cwd, "tests")) ||
                     existsSync(join(cwd, "backend", "tests"));
    if (!hasTests) {
      missing.push("tests/ directory");
    }
  }

  // Fullstack artifacts
  if (isFullstack) {
    if (!existsSync(join(cwd, "docs", "api-contract.md"))) {
      missing.push("docs/api-contract.md (contract-first required for fullstack)");
    }
    if (!existsSync(join(cwd, "docs", "architectural-state.md"))) {
      missing.push("docs/architectural-state.md (completion tracker + quality gates)");
    }
    if (!existsSync(join(cwd, "docker-compose.yml")) &&
        !existsSync(join(cwd, "docker-compose.yaml"))) {
      missing.push("docker-compose.yml");
    }
  }

  // Dev tooling
  if (hasPython) {
    if (!existsSync(join(cwd, "Makefile"))) {
      missing.push("Makefile (dev, test, lint targets)");
    }
    const hasAlembic = existsSync(join(cwd, "alembic.ini")) ||
                       existsSync(join(cwd, "alembic"));
    if (!hasAlembic) {
      missing.push("alembic.ini (database migrations)");
    }
  }

  // GEMINI.md hippocampus
  if (!existsSync(join(cwd, "GEMINI.md"))) {
    missing.push("GEMINI.md (project context for session continuity)");
  }

  if (missing.length > 0) {
    const list = missing.map((m) => `  - ${m}`).join("\n");
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext:
            `ARTIFACT CHECK: ${missing.length} required artifact(s) missing:\n${list}\n\n` +
            "Review this list and create any missing artifacts before ending the session.",
        },
      })
    );
  } else {
    console.log("{}");
  }

  process.exit(0);
});
