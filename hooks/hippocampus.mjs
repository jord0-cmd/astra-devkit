#!/usr/bin/env node
/**
 * AfterAgent hook — Hippocampus (Session Memory)
 * Checks if GEMINI.md exists and nudges the agent to create/update it.
 * GEMINI.md is the externalized hippocampus — project context that persists
 * across sessions, enabling cold-start comprehension.
 *
 * Minimum template: Architecture, Tech Stack, Commands, Key Directories, Gotchas.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_SECTIONS = [
  "architecture",
  "tech stack",
  "commands",
  "key directories",
  "lessons learned",
];

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const cwd = input.cwd || "";

  if (!cwd) {
    console.log("{}");
    process.exit(0);
  }

  const geminiPath = join(cwd, "GEMINI.md");

  // No GEMINI.md at all — nudge to create
  if (!existsSync(geminiPath)) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext:
            "HIPPOCAMPUS: No GEMINI.md found. Before ending this session, create " +
            "GEMINI.md at the project root with at minimum:\n" +
            "  - ## Architecture (pattern, layers, key decisions)\n" +
            "  - ## Tech Stack (exact versions and libraries)\n" +
            "  - ## Commands (install, test, dev server, build, migrations)\n" +
            "  - ## Key Directories (path → what's there)\n" +
            "  - ## Gotchas (non-obvious things the next session needs to know)\n\n" +
            "This enables session continuity — your next incarnation reads this first.",
        },
      })
    );
    process.exit(0);
  }

  // GEMINI.md exists — check completeness
  let content;
  try {
    content = readFileSync(geminiPath, "utf-8").toLowerCase();
  } catch {
    console.log("{}");
    process.exit(0);
  }

  const missingSections = REQUIRED_SECTIONS.filter(
    (section) => !content.includes(section)
  );

  if (missingSections.length > 0) {
    const list = missingSections.map((s) => `  - ## ${s}`).join("\n");
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext:
            `HIPPOCAMPUS: GEMINI.md exists but is missing ${missingSections.length} section(s):\n${list}\n\n` +
            "Update GEMINI.md before ending the session to ensure continuity.",
        },
      })
    );
  } else {
    console.log("{}");
  }

  process.exit(0);
});
