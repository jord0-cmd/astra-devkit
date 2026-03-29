#!/usr/bin/env node
// Office mode bypass — dev hooks exit silently in office mode
import { existsSync as _exF, readFileSync as _rdF } from "node:fs";
import { join as _jn } from "node:path";
import { homedir as _hd } from "node:os";
const _uf = _jn(_hd(), ".gemini", "user.json");
if (_exF(_uf)) { try { if (JSON.parse(_rdF(_uf, "utf-8")).mode === "office") { console.log("{}"); process.exit(0); } } catch {} }

/**
 * AfterTool hook — Auto Lint
 * Runs the appropriate linter/formatter after file writes.
 * Cross-platform (Node.js).
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const file = input.tool_input?.path || input.tool_input?.file_path || "";

  if (!file || !existsSync(file)) {
    console.log("{}");
    process.exit(0);
  }

  const ext = extname(file).toLowerCase();
  let linted = false;

  function tryRun(cmd) {
    try {
      execSync(cmd, { stdio: ["pipe", "pipe", "pipe"], timeout: 10000 });
      return true;
    } catch {
      return false;
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

  switch (ext) {
    case ".py":
      if (commandExists("ruff")) {
        tryRun(`ruff check "${file}" --fix --quiet`);
        tryRun(`ruff format "${file}" --quiet`);
        linted = true;
      }
      break;

    case ".ts":
    case ".tsx":
    case ".js":
    case ".jsx":
      if (commandExists("biome")) {
        tryRun(`biome check "${file}" --fix --unsafe`);
        tryRun(`biome format "${file}" --write`);
        linted = true;
      } else if (commandExists("npx")) {
        tryRun(`npx eslint "${file}" --fix --quiet`);
        tryRun(`npx prettier "${file}" --write --log-level silent`);
        linted = true;
      }
      break;

    case ".rs":
      if (commandExists("rustfmt")) {
        tryRun(`rustfmt "${file}" --edition 2021`);
        linted = true;
      }
      break;

    case ".json":
      // JSON formatting — read, parse, rewrite with indentation
      try {
        const raw = readFileSync(file, "utf-8");
        const parsed = JSON.parse(raw);
        writeFileSync(file, JSON.stringify(parsed, null, 2) + "\n");
        linted = true;
      } catch {
        // Invalid JSON or read error — skip silently
      }
      break;
  }

  if (linted) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext: `Auto-formatted ${file} after write.`,
        },
      })
    );
  } else {
    console.log("{}");
  }
  process.exit(0);
});
