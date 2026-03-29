/**
 * Astra DevKit health checker.
 * Validates all components are installed and working.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

const GEMINI_HOME = join(homedir(), ".gemini");

function check(label, fn) {
  try {
    const result = fn();
    if (result.ok) {
      console.log(`  \u2713 ${label}: ${result.detail}`);
    } else {
      console.log(`  \u2717 ${label}: ${result.detail}`);
    }
    return result.ok;
  } catch (err) {
    console.log(`  \u2717 ${label}: ${err.message}`);
    return false;
  }
}

export async function runDoctor() {
  console.log("\nAstra DevKit \u2014 Health Check\n");
  let passed = 0;
  let total = 0;

  // Node.js version
  total++;
  if (check("Node.js", () => {
    const version = process.version;
    const major = parseInt(version.slice(1));
    return { ok: major >= 20, detail: `${version} ${major >= 20 ? "(OK)" : "(need 20+)"}` };
  })) passed++;

  // Gemini CLI
  total++;
  if (check("Gemini CLI", () => {
    try {
      const version = execSync("gemini --version 2>/dev/null", { encoding: "utf-8" }).trim();
      return { ok: true, detail: version };
    } catch {
      return { ok: false, detail: "not found \u2014 run: npm install -g @google/gemini-cli" };
    }
  })) passed++;

  // Python + uv (for uvx MCPs)
  total++;
  if (check("Python + uv", () => {
    try {
      const pyVersion = execSync("python3 --version 2>/dev/null", { encoding: "utf-8" }).trim();
      try {
        execSync("uv --version 2>/dev/null");
        return { ok: true, detail: `${pyVersion} + uv installed` };
      } catch {
        return { ok: false, detail: `${pyVersion} found, but uv missing \u2014 run: curl -LsSf https://astral.sh/uv/install.sh | sh` };
      }
    } catch {
      return { ok: false, detail: "not found \u2014 needed for document MCPs" };
    }
  })) passed++;

  // Skills directory
  total++;
  if (check("Skills", () => {
    const dir = join(GEMINI_HOME, "skills");
    if (!existsSync(dir)) return { ok: false, detail: "directory missing" };
    const count = readdirSync(dir).filter(f => !f.startsWith(".")).length;
    return { ok: count >= 20, detail: `${count} installed ${count >= 20 ? "(OK)" : "(expected 20+)"}` };
  })) passed++;

  // Hooks directory
  total++;
  if (check("Hooks", () => {
    const dir = join(GEMINI_HOME, "hooks");
    if (!existsSync(dir)) return { ok: false, detail: "directory missing" };
    const count = readdirSync(dir).filter(f => f.endsWith(".mjs")).length;
    return { ok: count >= 15, detail: `${count} installed ${count >= 15 ? "(OK)" : "(expected 15+)"}` };
  })) passed++;

  // Agents
  total++;
  if (check("Agents", () => {
    const dir = join(GEMINI_HOME, "agents");
    if (!existsSync(dir)) return { ok: false, detail: "directory missing" };
    const count = readdirSync(dir).filter(f => f.endsWith(".md")).length;
    return { ok: count >= 8, detail: `${count} installed ${count >= 8 ? "(OK)" : "(expected 8+)"}` };
  })) passed++;

  // Standards
  total++;
  if (check("Standards", () => {
    const dir = join(GEMINI_HOME, "standards");
    if (!existsSync(dir)) return { ok: false, detail: "directory missing" };
    const count = readdirSync(dir).filter(f => f.endsWith(".md")).length;
    return { ok: count >= 3, detail: `${count} installed ${count >= 3 ? "(OK)" : "(expected 3+)"}` };
  })) passed++;

  // Settings + MCPs
  total++;
  if (check("Settings + MCPs", () => {
    const settingsPath = join(GEMINI_HOME, "settings.json");
    if (!existsSync(settingsPath)) return { ok: false, detail: "settings.json missing" };
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    const mcpCount = settings.mcpServers ? Object.keys(settings.mcpServers).length : 0;
    const hooksEnabled = settings.hooksConfig?.enabled !== false;
    const skillsEnabled = settings.skills?.enabled !== false;
    return {
      ok: mcpCount >= 5 && hooksEnabled && skillsEnabled,
      detail: `${mcpCount} MCPs, hooks ${hooksEnabled ? "ON" : "OFF"}, skills ${skillsEnabled ? "ON" : "OFF"}`
    };
  })) passed++;

  // Themes
  total++;
  if (check("Themes", () => {
    const dir = join(GEMINI_HOME, "themes");
    if (!existsSync(dir)) return { ok: false, detail: "directory missing" };
    const count = readdirSync(dir).filter(f => f.endsWith(".json")).length;
    return { ok: count >= 3, detail: `${count} available ${count >= 3 ? "(OK)" : "(expected 3)"}` };
  })) passed++;

  // Pandoc (for PDF reports)
  total++;
  if (check("Pandoc", () => {
    try {
      const version = execSync("pandoc --version 2>/dev/null | head -1", { encoding: "utf-8" }).trim();
      return { ok: true, detail: version };
    } catch {
      return { ok: false, detail: "not found \u2014 optional, needed for PDF reports" };
    }
  })) passed++;

  console.log(`\n${passed}/${total} checks passed.\n`);

  if (passed === total) {
    console.log("All systems operational. You're good to go.\n");
  } else {
    console.log("Some checks failed. Run 'astra-devkit setup' to fix.\n");
  }
}
