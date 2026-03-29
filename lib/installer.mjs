/**
 * Astra DevKit installer and updater.
 * Deploys skills, hooks, agents, standards, themes, and settings.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { deployComponent, mergeSettings, countInstalled, removeAll, GEMINI_HOME } from "./file-ops.mjs";

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

/**
 * Full installation — deploy all components and merge settings.
 */
export function runInstall(configDir) {
  const results = [];
  for (const comp of ["skills", "hooks", "agents", "standards", "themes"]) {
    results.push(deployComponent(configDir, comp));
  }
  mergeSettings(configDir);
  return results;
}

/**
 * Update — re-deploy all components from latest package.
 */
export async function runUpdate(configDir) {
  console.log("\nUpdating Astra DevKit components...\n");

  const results = runInstall(configDir);
  const counts = countInstalled();

  console.log("Updated:");
  for (const r of results) {
    console.log(`  \u2713 ${r.component}: ${r.deployed} items`);
  }
  console.log(`  \u2713 settings.json: merged`);
  console.log(`\nTotal: ${counts.skills} skills \u00b7 ${counts.hooks} hooks \u00b7 ${counts.mcps} MCPs`);
  console.log("Update complete.\n");
}

/**
 * Uninstall — remove all Astra components with confirmation.
 */
export async function runUninstall() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("\nThis will remove all Astra DevKit components from ~/.gemini/");
  console.log("Your Gemini CLI installation will remain intact.\n");

  const counts = countInstalled();
  console.log("Will remove:");
  console.log(`  ${counts.skills} skills, ${counts.hooks} hooks, ${counts.agents || 0} agents`);
  console.log(`  ${counts.standards || 0} standards, ${counts.themes || 0} themes\n`);

  const answer = await ask(rl, "Are you sure? (yes/no): ");
  rl.close();

  if (answer.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    return;
  }

  const removed = removeAll();
  console.log(`\nRemoved: ${removed.join(", ")}`);
  console.log("Astra DevKit uninstalled. Gemini CLI still works without it.\n");
}
