#!/usr/bin/env node
/**
 * Astra DevKit Installer
 * Cross-platform Node.js installer for Gemini CLI configuration.
 *
 * Usage:
 *   npx astra-devkit          Install/update Astra config
 *   npx astra-devkit --dry-run Preview changes without modifying files
 *   npx astra-devkit --check   Check if Gemini CLI is installed
 */

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_DIR = resolve(__dirname, "..");
const GEMINI_HOME = join(homedir(), ".gemini");
const DRY_RUN = process.argv.includes("--dry-run");
const CHECK_ONLY = process.argv.includes("--check");

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function log(msg) { console.log(`${CYAN}[astra]${RESET} ${msg}`); }
function success(msg) { console.log(`${GREEN}[astra]${RESET} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}[astra]${RESET} ${msg}`); }
function error(msg) { console.log(`${RED}[astra]${RESET} ${msg}`); }

// --- Pre-checks ---
function checkGeminiCli() {
  try {
    const version = execSync("gemini --version", { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim();
    return version;
  } catch {
    return null;
  }
}

const geminiVersion = checkGeminiCli();

if (CHECK_ONLY) {
  if (geminiVersion) {
    success(`Gemini CLI v${geminiVersion} found`);
    success(`Config directory: ${GEMINI_HOME} (${existsSync(GEMINI_HOME) ? "exists" : "not found"})`);
  } else {
    error("Gemini CLI not found. Install with: npm install -g @google/gemini-cli@preview");
  }
  process.exit(geminiVersion ? 0 : 1);
}

if (!geminiVersion) {
  error("Gemini CLI not installed.");
  log("Install it first: npm install -g @google/gemini-cli@preview");
  log("Then run 'gemini' once to authenticate.");
  process.exit(1);
}

if (!existsSync(GEMINI_HOME)) {
  error(`${GEMINI_HOME} doesn't exist.`);
  log("Run 'gemini' once to initialize and authenticate, then run this installer again.");
  process.exit(1);
}

log(`Gemini CLI v${geminiVersion}`);
log(`Installing Astra DevKit from: ${PACKAGE_DIR}`);
if (DRY_RUN) warn("DRY RUN — no files will be modified.");
console.log("");

// --- Backup ---
function backupExisting() {
  const itemsToCheck = ["settings.json", "GEMINI.md", "standards", "skills", "agents", "hooks"];
  const hasExisting = itemsToCheck.some((item) => existsSync(join(GEMINI_HOME, item)));

  if (!hasExisting) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(GEMINI_HOME, `backup_${timestamp}`);

  if (DRY_RUN) {
    log(`WOULD backup existing config to: ${backupDir}`);
    return;
  }

  mkdirSync(backupDir, { recursive: true });
  for (const item of ["settings.json", "GEMINI.md"]) {
    const src = join(GEMINI_HOME, item);
    if (existsSync(src)) cpSync(src, join(backupDir, item));
  }
  if (existsSync(join(GEMINI_HOME, "standards"))) {
    cpSync(join(GEMINI_HOME, "standards"), join(backupDir, "standards"), { recursive: true });
  }
  success(`Existing config backed up to: ${backupDir}`);
}

// --- Install files ---
function copyFile(src, dst, label) {
  if (DRY_RUN) {
    log(`WOULD install: ${label}`);
    return;
  }
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
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
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

  if (DRY_RUN) {
    log("WOULD merge settings.json (preserving auth)");
    return;
  }

  try {
    const existing = JSON.parse(readFileSync(existingPath, "utf-8"));
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

    function deepMerge(base, overlay) {
      const result = { ...base };
      for (const [key, value] of Object.entries(overlay)) {
        if (
          key in result &&
          typeof result[key] === "object" &&
          !Array.isArray(result[key]) &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          result[key] = deepMerge(result[key], value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    // Preserve auth
    const authBackup = existing?.security?.auth;
    const merged = deepMerge(existing, pkg);
    if (authBackup) {
      merged.security = merged.security || {};
      merged.security.auth = authBackup;
    }

    writeFileSync(existingPath, JSON.stringify(merged, null, 2) + "\n");
    success("settings.json merged (auth preserved)");
  } catch (e) {
    warn(`Failed to merge settings.json: ${e.message}. Copying instead.`);
    cpSync(packagePath, existingPath);
  }
}

// --- Main ---
console.log("=== Backup ===");
backupExisting();

console.log("\n=== Core Config ===");
mergeSettings();
copyFile(join(PACKAGE_DIR, "GEMINI.md"), join(GEMINI_HOME, "GEMINI.md"), "GEMINI.md (Astra persona)");

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
console.log("═".repeat(50));
success("Astra DevKit installed successfully!");
console.log("");
log("What's installed:");
log("  Persona:    Astra (warm, professional AI coding partner)");
log("  Standards:  11 Rules, TDD, Quality Gates");
log("  Skills:     17 domain skills (Python, TS, Rust, Docker, Azure...)");
log("  Agents:     4 specialists (reviewer, tester, debugger, docs)");
log("  Hooks:      Secret scanner, auto-lint, build gate, context loader");
log("  Commands:   /kickstart, /review, /test, /debug, /docs");
console.log("");
log("Quick start:");
log("  1. Run: gemini");
log("  2. Astra will introduce herself and ask your name");
log("  3. Type 'help' for a full list of what she can do");
log("  4. Type '/kickstart' to scope a new project");
console.log("");
log("Docs: https://github.com/jord0-cmd/astra-devkit");
console.log("═".repeat(50));
