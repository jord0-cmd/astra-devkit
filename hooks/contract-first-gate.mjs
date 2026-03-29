#!/usr/bin/env node
// Office mode bypass — dev hooks exit silently in office mode
import { existsSync as _exF, readFileSync as _rdF } from "node:fs";
import { join as _jn } from "node:path";
import { homedir as _hd } from "node:os";
const _uf = _jn(_hd(), ".gemini", "user.json");
if (_exF(_uf)) { try { if (JSON.parse(_rdF(_uf, "utf-8")).mode === "office") { console.log("{}"); process.exit(0); } } catch {} }

/**
 * BeforeTool hook — Contract-First Gate
 * Warns when frontend (.tsx) files are written in a fullstack project
 * without an API contract document existing.
 * Blocks frontend file writes until API contract exists.
 */

import { existsSync } from "node:fs";
import { extname, join } from "node:path";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const file = input.tool_input?.path || input.tool_input?.file_path || "";

  if (!file) {
    console.log("{}");
    process.exit(0);
  }

  const ext = extname(file);

  // Only care about frontend file writes (.tsx, .ts in components/lib)
  if (ext !== ".tsx" && ext !== ".ts") {
    console.log("{}");
    process.exit(0);
  }

  // Check if this looks like a fullstack project (has Python files alongside frontend)
  const cwd = input.cwd || process.cwd();
  const hasPython = existsSync(join(cwd, "pyproject.toml")) ||
                    existsSync(join(cwd, "src", "api")) ||
                    existsSync(join(cwd, "src", "domain"));

  if (!hasPython) {
    // Frontend-only project — no contract needed
    console.log("{}");
    process.exit(0);
  }

  // Fullstack project — check for contract
  const contractPaths = [
    join(cwd, "docs", "api-contract.md"),
    join(cwd, "docs", "architectural-state.md"),
  ];

  const hasContract = contractPaths.some((p) => existsSync(p));

  if (!hasContract) {
    // Block — contract MUST exist before frontend code
    console.log(
      JSON.stringify({
        decision: "block",
        reason:
          "CONTRACT-FIRST GATE: You're writing frontend code in a fullstack project " +
          "but no docs/api-contract.md exists yet. Create the API contract FIRST " +
          "(domain model, endpoint definitions, enum values, shared conventions) " +
          "before writing any frontend code. This ensures TypeScript types match " +
          "Pydantic models exactly.",
      })
    );
    process.exit(0);
  }

  // Contract exists — all good
  console.log("{}");
  process.exit(0);
});
