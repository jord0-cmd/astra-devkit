#!/usr/bin/env node
/**
 * AfterTool hook — Auto Lint
 * Runs the appropriate linter/formatter after file writes.
 * Cross-platform (Node.js).
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
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
        const { readFileSync, writeFileSync } = await import("node:fs");
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
