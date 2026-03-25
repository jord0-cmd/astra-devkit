#!/usr/bin/env node
/**
 * SessionStart hook — Context Loader
 * Loads user preferences from user.json and injects into session context.
 * Cross-platform (Node.js).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const geminiHome = join(homedir(), ".gemini");
  const userFile = join(geminiHome, "user.json");
  const projectDir = input.cwd || "";
  const contextParts = [];

  // Load user preferences
  if (existsSync(userFile)) {
    try {
      const userData = JSON.parse(readFileSync(userFile, "utf-8"));

      if (userData.name) contextParts.push(`User: ${userData.name}`);
      if (userData.preferences?.experience)
        contextParts.push(`Experience level: ${userData.preferences.experience}`);
      if (userData.preferences?.explanations)
        contextParts.push(`Explanation preference: ${userData.preferences.explanations}`);
      if (userData.preferences?.primary_language)
        contextParts.push(`Primary language: ${userData.preferences.primary_language}`);
    } catch {
      process.stderr.write("CONTEXT LOADER: Failed to parse user.json\n");
    }
  }

  // Check for kickstart reference material
  if (projectDir) {
    const refsDir = join(projectDir, "kickstart-refs");
    if (existsSync(refsDir)) {
      try {
        const files = readdirSync(refsDir).filter((f) => !f.startsWith("."));
        if (files.length > 0) {
          contextParts.push(
            `Note: kickstart-refs/ directory found with ${files.length} reference files. Read these if the user starts a new project or uses kickstart.`
          );
        }
      } catch {
        // Directory exists but unreadable — skip
      }
    }
  }

  // Build output
  if (contextParts.length > 0) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext: contextParts.join("\n"),
        },
      })
    );
  } else {
    console.log("{}");
  }
  process.exit(0);
});
