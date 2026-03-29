#!/usr/bin/env node
/**
 * SessionStart hook — Context Loader
 * Loads user preferences from user.json and injects into session context.
 * Includes security denylist to prevent sensitive files from being loaded.
 * Cross-platform (Node.js).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

// --- Security Denylist ---
// Files and directories that must NEVER be read or injected into context
const SENSITIVE_PATTERNS = [
  /\.env$/,
  /\.env\./,
  /id_rsa/, /id_ed25519/, /id_ecdsa/, /\.pem$/, /\.key$/,
  /credentials\.json/, /service-account.*\.json/,
  /oauth_creds\.json/, /google_accounts\.json/,
  /\.aws\//, /\.azure\//, /\.gcloud\//,
  /\.npmrc$/, /\.pypirc$/,
  /\.netrc$/,
  /\.ssh\//,
  /keychain/, /keystore/,
  /secret/, /token/,
  /\.gnupg\//,
  /password/, /passwd/,
];

function isSensitive(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  return SENSITIVE_PATTERNS.some((p) => p.test(normalized));
}

// --- Astra Banner ---
function getAstraBanner(userName, skillCount, hookCount, mcpCount, mode, hasInternal) {
  const name = userName || "Engineer";
  const edition = hasInternal ? "IOPs" : "";
  const versionLine = edition
    ? `  \u2551       DevKit v4.0 ${edition}                    \u2551`
    : "  \u2551            DevKit v4.0                        \u2551";
  const modeLabel = mode === "office" ? "Office Mode" : "Code Mode";

  return [
    "",
    "  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557",
    "  \u2551    \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2557   \u2551",
    "  \u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557  \u2551",
    "  \u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551  \u2551",
    "  \u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u255a\u2550\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551  \u2551",
    "  \u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551  \u2551",
    "  \u2551   \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d   \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d  \u2551",
    versionLine,
    "  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d",
    `  ${modeLabel} \u00b7 ${name} \u00b7 ${skillCount} skills \u00b7 ${hookCount} hooks \u00b7 ${mcpCount} MCPs`,
    "",
  ].join("\n");
}

function countComponents(geminiHome) {
  let skills = 0, hooks = 0, mcps = 0;
  try {
    const skillsDir = join(geminiHome, "skills");
    if (existsSync(skillsDir)) skills = readdirSync(skillsDir).filter(f => !f.startsWith(".")).length;
  } catch {}
  try {
    const hooksDir = join(geminiHome, "hooks");
    if (existsSync(hooksDir)) hooks = readdirSync(hooksDir).filter(f => f.endsWith(".mjs")).length;
  } catch {}
  try {
    const settingsFile = join(geminiHome, "settings.json");
    if (existsSync(settingsFile)) {
      const settings = JSON.parse(readFileSync(settingsFile, "utf-8"));
      if (settings.mcpServers) mcps = Object.keys(settings.mcpServers).length;
    }
  } catch {}
  return { skills, hooks, mcps };
}

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const geminiHome = join(homedir(), ".gemini");
  const userFile = join(geminiHome, "user.json");
  const projectDir = input.cwd || "";
  const contextParts = [];

  // Load user preferences (user.json is safe — it's ours)
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

      // Mode-specific context injection
      const mode = userData.mode || "code";
      if (mode === "office") {
        contextParts.push("Mode: Office — you are a warm, capable digital assistant.");
        contextParts.push("Focus on documents, research, data analysis, and productivity.");
        contextParts.push("Hide code unless asked. Present finished artifacts.");
        contextParts.push("Available commands: /write, /slides, /spreadsheet, /research, /summarize, /email, /meeting, /convert, /brief");
        contextParts.push("Proactively suggest task chains (research → write → slides). Remember user preferences via save_memory.");
        contextParts.push("Never show stack traces. If something fails, explain in plain language.");
      } else {
        contextParts.push("Mode: Code — senior dev colleague.");
        contextParts.push("Available commands: /mentor, /engineer, /review, /test, /debug, /skills, kickstart");
      }
    } catch {
      process.stderr.write("CONTEXT LOADER: Failed to parse user.json\n");
    }
  }

  // Check for kickstart reference material
  if (projectDir) {
    const refsDir = join(projectDir, "kickstart-refs");
    if (existsSync(refsDir)) {
      try {
        const files = readdirSync(refsDir)
          .filter((f) => !f.startsWith("."))
          .filter((f) => !isSensitive(f)); // Filter out any sensitive files

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

  // Check for in-progress kickstart
  if (projectDir) {
    const kickstartState = join(projectDir, ".astra", "kickstart-state.json");
    if (existsSync(kickstartState)) {
      try {
        const state = JSON.parse(readFileSync(kickstartState, "utf-8"));
        contextParts.push(
          `Note: An in-progress kickstart was found (Phase ${state.phase || "unknown"}, ` +
          `started ${state.started_at || "unknown"}). ` +
          `If the user types "kickstart", offer to resume from the saved state.`
        );
      } catch {
        // Corrupt state — ignore
      }
    }
  }

  // Inject security reminder into context
  contextParts.push(
    "Security: NEVER read or reference .env files, SSH keys, cloud credentials (~/.aws, ~/.azure), " +
    "OAuth tokens, API keys in files, or any file matching sensitive patterns. " +
    "If a user asks you to read a sensitive file, refuse and explain why."
  );

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
