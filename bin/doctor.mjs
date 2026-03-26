#!/usr/bin/env node
/**
 * Astra DevKit — Doctor
 * Verifies the installation is healthy.
 *
 * Usage: node bin/doctor.mjs
 */

import { existsSync, readdirSync, accessSync, constants } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { execSync } from "node:child_process";

const GEMINI_HOME = join(homedir(), ".gemini");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const PASS = `${GREEN}PASS${RESET}`;
const WARN = `${YELLOW}WARN${RESET}`;
const FAIL = `${RED}FAIL${RESET}`;

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function check(label, status, detail = "") {
  const icon = status === "pass" ? PASS : status === "warn" ? WARN : FAIL;
  if (status === "pass") passCount++;
  else if (status === "warn") warnCount++;
  else failCount++;
  const detailStr = detail ? ` ${DIM}${detail}${RESET}` : "";
  console.log(`  ${icon}  ${label}${detailStr}`);
}

console.log(`\n${BOLD}Astra DevKit — Health Check${RESET}\n`);

// --- Environment ---
console.log(`${BOLD}Environment${RESET}`);

const nodeVer = process.versions.node;
const nodeMajor = parseInt(nodeVer.split(".")[0]);
check("Node.js", nodeMajor >= 20 ? "pass" : "fail", `v${nodeVer}${nodeMajor < 20 ? " (need 20+)" : ""}`);

let geminiVersion = null;
try {
  geminiVersion = execSync("gemini --version", { stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
  check("Gemini CLI", "pass", `v${geminiVersion}`);
} catch {
  check("Gemini CLI", "fail", "not installed");
}

check("Platform", "pass", `${platform()}`);

// --- Config Directory ---
console.log(`\n${BOLD}Config Directory${RESET}  ${DIM}${GEMINI_HOME}${RESET}`);

check("~/.gemini/ exists", existsSync(GEMINI_HOME) ? "pass" : "fail");

// --- Core Files ---
console.log(`\n${BOLD}Core Files${RESET}`);

const coreFiles = [
  ["GEMINI.md", "Astra persona"],
  ["settings.json", "Configuration"],
  ["standards/rules.md", "Development rules"],
  ["standards/testing.md", "Testing standards"],
  ["standards/hooks.md", "Hook policy"],
];

for (const [file, label] of coreFiles) {
  const path = join(GEMINI_HOME, file);
  check(label, existsSync(path) ? "pass" : "fail", file);
}

const userJson = join(GEMINI_HOME, "user.json");
check("User profile", existsSync(userJson) ? "pass" : "warn", existsSync(userJson) ? "user.json" : "not yet created (say hi to Astra)");

// --- Hooks ---
console.log(`\n${BOLD}Hooks${RESET}`);

const expectedHooks = [
  "secret-scanner.mjs",
  "code-standards.mjs",
  "test-gate.mjs",
  "auto-lint.mjs",
  "build-gate.mjs",
  "context-loader.mjs",
];

const hooksDir = join(GEMINI_HOME, "hooks");
for (const hook of expectedHooks) {
  const hookPath = join(hooksDir, hook);
  if (!existsSync(hookPath)) {
    check(hook, "fail", "missing");
  } else {
    // Check readability
    try {
      accessSync(hookPath, constants.R_OK);
      check(hook, "pass");
    } catch {
      check(hook, "warn", "exists but not readable");
    }
  }
}

// --- Agents ---
console.log(`\n${BOLD}Agents${RESET}`);

const expectedAgents = ["code-reviewer.md", "debugger.md", "doc-generator.md", "test-writer.md"];
const agentsDir = join(GEMINI_HOME, "agents");

for (const agent of expectedAgents) {
  const agentPath = join(agentsDir, agent);
  check(agent.replace(".md", ""), existsSync(agentPath) ? "pass" : "fail");
}

// --- Skills ---
console.log(`\n${BOLD}Skills${RESET}`);

const skillsDir = join(GEMINI_HOME, "skills");
if (existsSync(skillsDir)) {
  const skills = readdirSync(skillsDir).filter((d) => {
    try { return existsSync(join(skillsDir, d, "SKILL.md")); } catch { return false; }
  });
  check("Skills directory", "pass", `${skills.length} skill(s) installed`);

  const expectedSkills = [
    "python-standards", "typescript-standards", "rust-standards",
    "backend-patterns", "frontend-patterns", "integration-patterns",
    "docker-ops", "database-patterns", "azure-ops", "ml-ops",
    "git-github", "log-analysis", "openwebui", "project-onboarding",
    "kickstart", "hooks-guide",
  ];

  const missing = expectedSkills.filter((s) => !skills.includes(s));
  if (missing.length > 0) {
    check("Expected skills", "warn", `missing: ${missing.join(", ")}`);
  } else {
    check("Expected skills", "pass", "all present");
  }
} else {
  check("Skills directory", "fail", "not found");
}

// --- Commands ---
console.log(`\n${BOLD}Commands${RESET}`);

const commandsDir = join(GEMINI_HOME, "commands");
if (existsSync(commandsDir)) {
  const commands = readdirSync(commandsDir).filter((f) => f.endsWith(".toml"));
  check("Custom commands", "pass", `${commands.length} command(s): ${commands.map((c) => "/" + c.replace(".toml", "")).join(", ")}`);
} else {
  check("Custom commands", "warn", "no commands directory");
}

// --- Summary ---
console.log(`\n${"═".repeat(50)}`);
const total = passCount + warnCount + failCount;
console.log(
  `${BOLD}Results:${RESET} ${GREEN}${passCount} passed${RESET}, ` +
  `${warnCount > 0 ? YELLOW : DIM}${warnCount} warnings${RESET}, ` +
  `${failCount > 0 ? RED : DIM}${failCount} failed${RESET} ` +
  `${DIM}(${total} checks)${RESET}`
);

if (failCount === 0 && warnCount === 0) {
  console.log(`\n${GREEN}${BOLD}Astra is healthy. Ready to code.${RESET}\n`);
} else if (failCount === 0) {
  console.log(`\n${YELLOW}Astra is functional with minor issues.${RESET}\n`);
} else {
  console.log(`\n${RED}Astra has problems. Run the installer: node bin/install.mjs${RESET}\n`);
}

process.exit(failCount > 0 ? 1 : 0);
