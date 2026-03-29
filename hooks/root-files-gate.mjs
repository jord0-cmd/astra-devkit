#!/usr/bin/env node
// Office mode bypass — dev hooks exit silently in office mode
import { existsSync as _exF, readFileSync as _rdF } from "node:fs";
import { join as _jn } from "node:path";
import { homedir as _hd } from "node:os";
const _uf = _jn(_hd(), ".gemini", "user.json");
if (_exF(_uf)) { try { if (JSON.parse(_rdF(_uf, "utf-8")).mode === "office") { console.log("{}"); process.exit(0); } } catch {} }

/**
 * AfterAgent hook — Root Files Gate
 * After an agent completes, checks that required project root files exist.
 * Advisory only — injects a reminder, never blocks.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const cwd = process.cwd();

  const missing = [];

  // Python project checks
  const hasPython = existsSync(join(cwd, "pyproject.toml")) ||
                    existsSync(join(cwd, "src", "domain")) ||
                    existsSync(join(cwd, "src", "api"));

  if (hasPython) {
    if (!existsSync(join(cwd, "pyproject.toml"))) missing.push("pyproject.toml");
    if (!existsSync(join(cwd, ".gitignore"))) missing.push(".gitignore");
  }

  // Node/frontend project checks
  const hasNode = existsSync(join(cwd, "package.json")) ||
                  existsSync(join(cwd, "frontend", "package.json")) ||
                  existsSync(join(cwd, "src", "App.tsx"));

  if (hasNode) {
    const pkgExists = existsSync(join(cwd, "package.json")) ||
                      existsSync(join(cwd, "frontend", "package.json"));
    if (!pkgExists) missing.push("package.json");
    if (!existsSync(join(cwd, ".gitignore"))) {
      if (!missing.includes(".gitignore")) missing.push(".gitignore");
    }
  }

  // Fullstack — also check for docker-compose
  if (hasPython && hasNode) {
    const hasDocker = existsSync(join(cwd, "docker-compose.yml")) ||
                      existsSync(join(cwd, "docker-compose.yaml"));
    if (!hasDocker) missing.push("docker-compose.yml");
  }

  if (missing.length > 0) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext:
            `ROOT FILES REMINDER: Missing project root files: ${missing.join(", ")}. ` +
            "These are expected for a production-ready project. Consider creating them " +
            "before wrapping up.",
        },
      })
    );
    process.exit(0);
  }

  // All root files present
  console.log("{}");
  process.exit(0);
});
