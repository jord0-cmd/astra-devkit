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
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const configDir = join(__dirname, "..", "config");
const libDir = join(__dirname, "..", "lib");

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
  Rules:     20 (contract-first, DDD, Protocol ports, async testing, etc.)
  MCPs:      7  (Context7, Pandoc, PowerPoint, Excel, Word, Imagen, Playwright)
  Themes:    3  (Astra, Retro Green, Retro Amber)

Documentation: https://github.com/jord0-cmd/astra-devkit
`;

async function main() {
  switch (command) {
    case "setup": {
      console.log(BANNER);
      const { runSetup } = await import(join(libDir, "setup-wizard.mjs"));
      await runSetup(configDir);
      break;
    }
    case "update": {
      const { runUpdate } = await import(join(libDir, "installer.mjs"));
      await runUpdate(configDir);
      break;
    }
    case "mcps": {
      const { runMcpSelector } = await import(join(libDir, "mcp-selector.mjs"));
      await runMcpSelector(configDir);
      break;
    }
    case "theme": {
      const { runThemeSelector } = await import(join(libDir, "theme-selector.mjs"));
      await runThemeSelector(configDir);
      break;
    }
    case "doctor": {
      const { runDoctor } = await import(join(libDir, "doctor.mjs"));
      await runDoctor();
      break;
    }
    case "uninstall": {
      const { runUninstall } = await import(join(libDir, "installer.mjs"));
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
