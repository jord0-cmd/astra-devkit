#!/usr/bin/env node
/**
 * Astra DevKit Installer
 * Cross-platform Node.js installer for Gemini CLI configuration.
 *
 * Usage:
 *   npx astra-devkit            Install/update Astra config
 *   npx astra-devkit --dry-run  Preview changes without modifying files
 *   npx astra-devkit --check    Check environment status
 *   npx astra-devkit --uninstall Restore pre-Astra config from backup
 */

import {
  existsSync, mkdirSync, cpSync, readFileSync, writeFileSync,
  readdirSync, statSync, rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_DIR = resolve(__dirname, "..");
const GEMINI_HOME = join(homedir(), ".gemini");
const DRY_RUN = process.argv.includes("--dry-run");
const CHECK_ONLY = process.argv.includes("--check");
const UNINSTALL = process.argv.includes("--uninstall");
const MIN_GEMINI_VERSION = "0.34.0";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function log(msg) { console.log(`${CYAN}[astra]${RESET} ${msg}`); }
function success(msg) { console.log(`${GREEN}[astra]${RESET} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}[astra]${RESET} ${msg}`); }
function error(msg) { console.log(`${RED}[astra]${RESET} ${msg}`); }

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${CYAN}[astra]${RESET} ${question} `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// --- Environment Checks ---
function checkNodeVersion() {
  const ver = process.versions.node;
  const major = parseInt(ver.split(".")[0]);
  return { version: ver, ok: major >= 20 };
}

function checkGeminiCli() {
  try {
    const version = execSync("gemini --version", { stdio: ["pipe", "pipe", "pipe"] })
      .toString().trim();
    // Strip preview/nightly suffixes for comparison
    const cleanVersion = version.replace(/-preview.*|-nightly.*/, "");
    return { version, cleanVersion, installed: true };
  } catch {
    return { version: null, cleanVersion: null, installed: false };
  }
}

function checkExistingConfig() {
  const items = {
    settings: existsSync(join(GEMINI_HOME, "settings.json")),
    geminiMd: existsSync(join(GEMINI_HOME, "GEMINI.md")),
    standards: existsSync(join(GEMINI_HOME, "standards")),
    skills: existsSync(join(GEMINI_HOME, "skills")),
    agents: existsSync(join(GEMINI_HOME, "agents")),
    hooks: existsSync(join(GEMINI_HOME, "hooks")),
    commands: existsSync(join(GEMINI_HOME, "commands")),
    userJson: existsSync(join(GEMINI_HOME, "user.json")),
  };
  items.hasAny = Object.values(items).some(Boolean);
  return items;
}

// --- Check mode ---
const nodeInfo = checkNodeVersion();
const geminiInfo = checkGeminiCli();

if (CHECK_ONLY) {
  console.log(`\n${BOLD}Astra DevKit — Environment Check${RESET}\n`);
  console.log(`  Node.js:    ${nodeInfo.ok ? GREEN : RED}v${nodeInfo.version}${RESET} ${nodeInfo.ok ? "(OK)" : "(Need 20+)"}`);
  console.log(`  Gemini CLI: ${geminiInfo.installed ? GREEN : RED}${geminiInfo.installed ? `v${geminiInfo.version}` : "Not installed"}${RESET}`);
  console.log(`  Config dir: ${existsSync(GEMINI_HOME) ? GREEN : YELLOW}${GEMINI_HOME}${RESET} ${existsSync(GEMINI_HOME) ? "(exists)" : "(not found)"}`);
  if (existsSync(GEMINI_HOME)) {
    const existing = checkExistingConfig();
    console.log(`  GEMINI.md:  ${existing.geminiMd ? GREEN + "yes" : DIM + "no"}${RESET}`);
    console.log(`  Skills:     ${existing.skills ? GREEN + "yes" : DIM + "no"}${RESET}`);
    console.log(`  Agents:     ${existing.agents ? GREEN + "yes" : DIM + "no"}${RESET}`);
    console.log(`  Hooks:      ${existing.hooks ? GREEN + "yes" : DIM + "no"}${RESET}`);
  }
  console.log("");
  process.exit(nodeInfo.ok && geminiInfo.installed ? 0 : 1);
}

// --- Uninstall mode ---
if (UNINSTALL) {
  console.log(`\n${BOLD}Astra DevKit — Uninstall${RESET}\n`);
  const backups = existsSync(GEMINI_HOME)
    ? readdirSync(GEMINI_HOME).filter((d) => d.startsWith("backup_")).sort().reverse()
    : [];

  if (backups.length === 0) {
    error("No backups found. Cannot restore previous config.");
    process.exit(1);
  }

  log(`Found ${backups.length} backup(s). Latest: ${backups[0]}`);
  const answer = await ask("Restore from latest backup and remove Astra config? (yes/no)");
  if (answer !== "yes" && answer !== "y") {
    log("Cancelled.");
    process.exit(0);
  }

  const backupDir = join(GEMINI_HOME, backups[0]);
  for (const dir of ["standards", "skills", "agents", "hooks", "commands"]) {
    const target = join(GEMINI_HOME, dir);
    if (existsSync(target)) rmSync(target, { recursive: true });
  }
  for (const file of ["GEMINI.md"]) {
    const target = join(GEMINI_HOME, file);
    if (existsSync(target)) rmSync(target);
  }

  // Restore from backup
  for (const item of readdirSync(backupDir)) {
    const src = join(backupDir, item);
    const dst = join(GEMINI_HOME, item);
    cpSync(src, dst, { recursive: true });
  }

  success("Astra removed. Previous config restored from backup.");
  log(`Backup used: ${backups[0]}`);
  process.exit(0);
}

// ===== MAIN INSTALL FLOW =====

console.log(`\n${BOLD}Astra DevKit — Installer${RESET}\n`);

// --- Step 1: Node.js check ---
if (!nodeInfo.ok) {
  error(`Node.js ${nodeInfo.version} detected — need 20+. Please upgrade Node.js.`);
  process.exit(1);
}
success(`Node.js v${nodeInfo.version}`);

// --- Step 2: Gemini CLI ---
if (!geminiInfo.installed) {
  warn("Gemini CLI not found.");
  const answer = await ask("Install Gemini CLI now? (yes/no)");
  if (answer !== "yes" && answer !== "y") {
    log("Install manually: npm install -g @google/gemini-cli@preview");
    process.exit(1);
  }

  log("Installing Gemini CLI (this may take a minute)...");
  try {
    execSync("npm install -g @google/gemini-cli@preview", {
      stdio: "inherit",
      timeout: 120000,
    });
    const check = checkGeminiCli();
    if (check.installed) {
      success(`Gemini CLI v${check.version} installed`);
    } else {
      error("Installation completed but 'gemini' command not found. Check your PATH.");
      process.exit(1);
    }
  } catch {
    error("Failed to install Gemini CLI.");
    log("Try manually: npm install -g @google/gemini-cli@preview");
    process.exit(1);
  }
} else {
  success(`Gemini CLI v${geminiInfo.version}`);

  // Check if upgrade is recommended
  if (compareVersions(geminiInfo.cleanVersion, MIN_GEMINI_VERSION) < 0) {
    warn(`Astra works best with Gemini CLI v${MIN_GEMINI_VERSION}+. You have v${geminiInfo.version}.`);
    const answer = await ask("Upgrade Gemini CLI? (yes/no)");
    if (answer === "yes" || answer === "y") {
      log("Upgrading...");
      try {
        execSync("npm install -g @google/gemini-cli@preview", {
          stdio: "inherit",
          timeout: 120000,
        });
        const check = checkGeminiCli();
        success(`Upgraded to v${check.version}`);
      } catch {
        warn("Upgrade failed. Continuing with current version.");
      }
    }
  }
}

// --- Step 3: Authentication ---
if (!existsSync(GEMINI_HOME)) {
  console.log("");
  warn("Gemini CLI needs to authenticate first.");
  console.log("");
  log("Please run this command now:");
  console.log(`\n    ${BOLD}gemini${RESET}\n`);
  log("Complete the Google OAuth login in your browser, then type /quit to exit.");
  log("After that, run this installer again.");
  console.log("");
  log(`${DIM}(OAuth requires a browser — the installer can't do this step for you.)${RESET}`);
  process.exit(1);
}

// --- Step 4: Show what will happen ---
const existing = checkExistingConfig();

if (existing.hasAny && !DRY_RUN) {
  console.log("");
  log(`${BOLD}Existing Gemini CLI configuration detected:${RESET}`);
  if (existing.settings) log("  settings.json — will be ${BOLD}merged${RESET} (your auth and custom settings preserved)");
  if (existing.geminiMd) log("  GEMINI.md — will be ${BOLD}replaced${RESET} with Astra persona");
  if (existing.standards) log("  standards/ — will be ${BOLD}replaced${RESET}");
  if (existing.skills) log("  skills/ — existing skills ${BOLD}kept${RESET}, new ones added");
  if (existing.agents) log("  agents/ — existing agents ${BOLD}kept${RESET}, new ones added");
  if (existing.hooks) log("  hooks/ — existing hooks ${BOLD}kept${RESET}, new ones added");
  if (existing.userJson) log("  user.json — ${BOLD}untouched${RESET}");
  console.log("");
  log("A backup will be created before any changes.");
  log("You can restore it with: node bin/install.mjs --uninstall");
  console.log("");

  const answer = await ask("Proceed with installation? (yes/no)");
  if (answer !== "yes" && answer !== "y") {
    log("Cancelled. No changes made.");
    process.exit(0);
  }
}

if (DRY_RUN) warn("DRY RUN — no files will be modified.\n");

// --- Step 5: Backup ---
console.log("=== Backup ===");
function backupExisting() {
  if (!existing.hasAny) {
    log("No existing config to backup — fresh install");
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(GEMINI_HOME, `backup_${timestamp}`);

  if (DRY_RUN) {
    log(`WOULD backup to: ${backupDir}`);
    return;
  }

  mkdirSync(backupDir, { recursive: true });
  for (const item of ["settings.json", "GEMINI.md"]) {
    const src = join(GEMINI_HOME, item);
    if (existsSync(src)) cpSync(src, join(backupDir, item));
  }
  for (const dir of ["standards", "skills", "agents", "hooks", "commands"]) {
    const src = join(GEMINI_HOME, dir);
    if (existsSync(src)) cpSync(src, join(backupDir, dir), { recursive: true });
  }
  success(`Backed up to: ${backupDir}`);
}
backupExisting();

// --- Step 6: Install ---
function copyFile(src, dst, label) {
  if (DRY_RUN) { log(`WOULD install: ${label}`); return; }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
  success(`Installed: ${label}`);
}

function copyDir(src, dst, label) {
  if (!existsSync(src)) return;
  const items = readdirSync(src);
  if (items.length === 0) return;
  for (const item of items) {
    const srcPath = join(src, item);
    const dstPath = join(dst, item);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, dstPath, `${label}/${item}`);
    } else {
      copyFile(srcPath, dstPath, `${label}/${item}`);
    }
  }
}

function mergeSettings() {
  const existingPath = join(GEMINI_HOME, "settings.json");
  const packagePath = join(PACKAGE_DIR, "settings.json");
  if (!existsSync(packagePath)) return;

  if (!existsSync(existingPath)) {
    copyFile(packagePath, existingPath, "settings.json (new)");
    return;
  }
  if (DRY_RUN) { log("WOULD merge settings.json (preserving auth + custom settings)"); return; }

  try {
    const existing = JSON.parse(readFileSync(existingPath, "utf-8"));
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

    function deepMerge(base, overlay) {
      const result = { ...base };
      for (const [key, value] of Object.entries(overlay)) {
        if (key in result && typeof result[key] === "object" && !Array.isArray(result[key]) && typeof value === "object" && !Array.isArray(value)) {
          result[key] = deepMerge(result[key], value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    const authBackup = existing?.security?.auth;
    const merged = deepMerge(existing, pkg);
    if (authBackup) {
      merged.security = merged.security || {};
      merged.security.auth = authBackup;
    }

    writeFileSync(existingPath, JSON.stringify(merged, null, 2) + "\n");
    success("settings.json merged (auth + custom settings preserved)");
  } catch (e) {
    warn(`Merge failed: ${e.message}. Copying package settings.`);
    cpSync(packagePath, existingPath);
  }
}

console.log("\n=== Core Config ===");
mergeSettings();
copyFile(join(PACKAGE_DIR, "GEMINI.md"), join(GEMINI_HOME, "GEMINI.md"), "GEMINI.md (Astra persona)");

// Windows: fix hook paths — replace ~ with absolute home path
// Gemini CLI expands ~ itself, but some Windows shells don't
if (process.platform === "win32" && !DRY_RUN) {
  const settingsPath = join(GEMINI_HOME, "settings.json");
  if (existsSync(settingsPath)) {
    try {
      let raw = readFileSync(settingsPath, "utf-8");
      const home = homedir().replace(/\\/g, "/"); // Forward slashes for JSON
      if (raw.includes("~/.gemini/")) {
        raw = raw.replace(/~\/\.gemini\//g, `${home}/.gemini/`);
        writeFileSync(settingsPath, raw);
        success("Hook paths resolved to absolute paths (Windows compatibility)");
      }
    } catch {
      warn("Could not resolve hook paths — hooks may need manual path fixes on Windows");
    }
  }
}

console.log("\n=== Standards ===");
copyDir(join(PACKAGE_DIR, "standards"), join(GEMINI_HOME, "standards"), "standards");

console.log("\n=== Agents ===");
copyDir(join(PACKAGE_DIR, "agents"), join(GEMINI_HOME, "agents"), "agents");

console.log("\n=== Commands ===");
copyDir(join(PACKAGE_DIR, "commands"), join(GEMINI_HOME, "commands"), "commands");

console.log("\n=== Skills ===");
copyDir(join(PACKAGE_DIR, "skills"), join(GEMINI_HOME, "skills"), "skills");

console.log("\n=== Hooks ===");
copyDir(join(PACKAGE_DIR, "hooks"), join(GEMINI_HOME, "hooks"), "hooks");

// --- Summary ---
console.log("");
console.log("═".repeat(60));
success(`${BOLD}Astra DevKit installed successfully!${RESET}`);
console.log("");
log("What's installed:");
log("  Persona:    Astra (warm, professional AI coding partner)");
log("  Standards:  11 Rules, TDD, Quality Gates (always loaded)");
log("  Skills:     17 domain skills (on-demand activation)");
log("  Agents:     4 specialists (reviewer, tester, debugger, docs)");
log("  Hooks:      5 automation hooks (security, TDD, lint, build, context)");
log("  Commands:   /review, /test, /debug, /gendocs");
console.log("");
log("Quick start:");
log(`  1. Run: ${BOLD}gemini${RESET}`);
log("  2. Astra will introduce herself and ask your name");
log(`  3. Type ${BOLD}help${RESET} for everything she can do`);
log(`  4. Type ${BOLD}kickstart${RESET} to scope a new project`);
console.log("");
if (existing.hasAny) {
  log(`${DIM}Your previous config was backed up. Restore with: node bin/install.mjs --uninstall${RESET}`);
  console.log("");
}
log("Docs: https://github.com/jord0-cmd/astra-devkit");
console.log("═".repeat(60));
