/**
 * Astra DevKit interactive setup wizard.
 * Guides user through first-time configuration.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { runInstall, runUpdate } from "./installer.mjs";
import { runMcpSelector } from "./mcp-selector.mjs";
import { runThemeSelector } from "./theme-selector.mjs";
import { ensureDir, GEMINI_HOME } from "./file-ops.mjs";

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function checkPrereqs() {
  const results = [];

  // Node.js version
  const nodeMajor = parseInt(process.version.slice(1));
  results.push({
    name: "Node.js 20+",
    ok: nodeMajor >= 20,
    detail: process.version,
    fix: "Install Node.js 20+ from https://nodejs.org",
  });

  // Gemini CLI
  try {
    execSync("gemini --version 2>/dev/null", { encoding: "utf-8" });
    results.push({ name: "Gemini CLI", ok: true, detail: "installed" });
  } catch {
    results.push({
      name: "Gemini CLI",
      ok: false,
      detail: "not found",
      fix: "npm install -g @google/gemini-cli",
    });
  }

  // Python + uv
  try {
    execSync("python3 --version 2>/dev/null", { encoding: "utf-8" });
    try {
      execSync("uv --version 2>/dev/null", { encoding: "utf-8" });
      results.push({ name: "Python + uv", ok: true, detail: "installed" });
    } catch {
      results.push({
        name: "Python + uv",
        ok: false,
        detail: "uv missing",
        fix: "curl -LsSf https://astral.sh/uv/install.sh | sh",
      });
    }
  } catch {
    results.push({
      name: "Python + uv",
      ok: false,
      detail: "not found",
      fix: "Install Python 3.11+ and uv",
    });
  }

  return results;
}

export async function runSetup(configDir) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("  AI Engineering Partner \u2014 First-Time Setup\n");

  // Step 1: Check prerequisites
  console.log("Checking prerequisites...\n");
  const prereqs = checkPrereqs();
  let canProceed = true;

  for (const p of prereqs) {
    if (p.ok) {
      console.log(`  \u2713 ${p.name}: ${p.detail}`);
    } else {
      console.log(`  \u2717 ${p.name}: ${p.detail}`);
      console.log(`    Fix: ${p.fix}`);
      if (p.name === "Node.js 20+") canProceed = false;
    }
  }
  console.log();

  if (!canProceed) {
    console.log("Cannot proceed \u2014 fix the issues above and try again.");
    rl.close();
    return;
  }

  // Install Gemini CLI if missing
  const geminiMissing = prereqs.find((p) => p.name === "Gemini CLI" && !p.ok);
  if (geminiMissing) {
    const installIt = await ask(rl, "Install Gemini CLI now? (y/n): ");
    if (installIt.toLowerCase() === "y") {
      console.log("\nInstalling Gemini CLI...");
      try {
        execSync("npm install -g @google/gemini-cli", { stdio: "inherit" });
        console.log("\u2713 Gemini CLI installed.\n");
      } catch {
        console.log("\u2717 Failed to install. Try manually: npm install -g @google/gemini-cli\n");
      }
    }
  }

  // Step 2: User profile
  console.log("Let's set up your profile.\n");

  const name = await ask(rl, "  What's your name? ");
  const experienceChoices = ["beginner", "intermediate", "senior"];
  console.log("\n  Experience level:");
  console.log("  [1] Beginner   \u2014 detailed explanations");
  console.log("  [2] Intermediate \u2014 balanced guidance");
  console.log("  [3] Senior     \u2014 concise, direct");
  const expChoice = await ask(rl, "\n  Choose (1-3): ");
  const experience = experienceChoices[parseInt(expChoice) - 1] || "intermediate";

  const focusChoices = ["backend", "frontend", "fullstack", "data", "library"];
  console.log("\n  What do you mainly build?");
  console.log("  [1] Backend (APIs, services, CLI tools)");
  console.log("  [2] Frontend (React, Vue, web apps)");
  console.log("  [3] Fullstack (end-to-end applications)");
  console.log("  [4] Data (pipelines, analysis, ML)");
  console.log("  [5] Libraries (packages, SDKs, tools)");
  const focusChoice = await ask(rl, "\n  Choose (1-5): ");
  const focus = focusChoices[parseInt(focusChoice) - 1] || "fullstack";

  // Map experience to explanation preference
  const explanationMap = {
    beginner: "detailed",
    intermediate: "balanced",
    senior: "concise",
  };

  // Save user profile
  const userProfile = {
    name: name.trim(),
    preferences: {
      experience,
      explanations: explanationMap[experience],
      focus,
      primary_language: "en",
    },
    created: new Date().toISOString(),
    devkit_version: "4.0.0",
  };

  ensureDir(GEMINI_HOME);
  writeFileSync(
    join(GEMINI_HOME, "user.json"),
    JSON.stringify(userProfile, null, 2) + "\n"
  );
  console.log(`\n  \u2713 Profile saved for ${name.trim()}.\n`);

  rl.close();

  // Step 3: Deploy components
  console.log("Deploying Astra DevKit components...\n");
  const results = runInstall(configDir);
  for (const r of results) {
    console.log(`  \u2713 ${r.component}: ${r.deployed} items deployed`);
  }
  console.log("  \u2713 settings.json: merged\n");

  // Step 4: MCP selection
  console.log("Now let's configure MCP servers.\n");
  await runMcpSelector(configDir);

  // Step 5: Theme selection
  console.log("Choose your theme.\n");
  await runThemeSelector(configDir);

  // Step 6: Summary
  console.log("\n  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("  \u2551  Astra DevKit v4.0 \u2014 Setup Complete!        \u2551");
  console.log("  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n");
  console.log(`  Welcome aboard, ${name.trim()}.`);
  console.log("  Run 'gemini' to start your first session.");
  console.log("  Run 'astra-devkit doctor' to verify everything.\n");
}
