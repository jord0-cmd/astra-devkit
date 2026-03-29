#!/usr/bin/env node
/**
 * Astra DevKit CLI — AI Engineering Partner for Gemini CLI
 *
 * Commands:
 *   setup       Interactive first-time setup
 *   update      Update skills, hooks, standards to latest
 *   mcps        Enable/disable MCP servers
 *   theme       Switch between themes
 *   doctor      Check installation health
 *   uninstall   Clean removal of all Astra components
 *   help        Show this help text
 */

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configDir = join(__dirname, "..");
const libDir = join(__dirname, "..", "lib");

// Dynamic import() on Windows requires file:// URLs, not bare absolute paths
function libImport(file) {
  return import(pathToFileURL(join(libDir, file)).href);
}

const command = process.argv[2] || "help";

const BANNER = `
  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
  \u2551    \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2557   \u2551
  \u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557  \u2551
  \u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551  \u2551
  \u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u255a\u2550\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551  \u2551
  \u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551  \u2551
  \u2551   \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d   \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d  \u2551
  \u2551            DevKit v4.0                        \u2551
  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d
`;

const HELP = `Astra DevKit v4.0 \u2014 AI Engineering Partner

Commands:
  astra-devkit setup       Interactive first-time setup
  astra-devkit update      Update skills, hooks, standards to latest
  astra-devkit mcps        Enable/disable MCP servers
  astra-devkit theme       Switch between Astra / Retro Green / Retro Amber
  astra-devkit doctor      Check installation health
  astra-devkit uninstall   Clean removal of all Astra components

In Gemini CLI:
  /mcp list                Show active MCP servers
  /mcp reload              Reload MCP configuration
  /theme                   Switch theme

Components:
  Skills:    24 (kickstart, backend/frontend patterns, mutation testing, etc.)
  Hooks:     17 (build-gate, test-gate, spec-mining, fault-localiser, etc.)
  Agents:     9 (backend-builder, frontend-builder, code-reviewer, etc.)
  Rules:     21 (contract-first, DDD, Protocol ports, async testing, etc.)
  MCPs:      7  (Context7, Pandoc, PowerPoint, Excel, Word, Imagen, Playwright)
  Themes:    3  (Astra, Retro Green, Retro Amber)

Documentation: https://github.com/jord0-cmd/astra-devkit
`;

async function main() {
  switch (command) {
    case "setup": {
      console.log(BANNER);
      const { runSetup } = await libImport("setup-wizard.mjs");
      await runSetup(configDir);
      break;
    }
    case "update": {
      const { runUpdate } = await libImport("installer.mjs");
      await runUpdate(configDir);
      break;
    }
    case "mcps": {
      const { runMcpSelector } = await libImport("mcp-selector.mjs");
      await runMcpSelector(configDir);
      break;
    }
    case "theme": {
      const { runThemeSelector } = await libImport("theme-selector.mjs");
      await runThemeSelector(configDir);
      break;
    }
    case "doctor": {
      const { runDoctor } = await libImport("doctor.mjs");
      await runDoctor();
      break;
    }
    case "uninstall": {
      const { runUninstall } = await libImport("installer.mjs");
      await runUninstall();
      break;
    }
    case "help":
    case "--help":
    case "-h":
      console.log(BANNER);
      console.log(HELP);
      break;
    case "--version":
    case "-v":
      console.log("astra-devkit v4.0.0");
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "astra-devkit help" for usage.');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
