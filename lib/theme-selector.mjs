/**
 * Theme selector for Astra DevKit.
 * Lets user choose between available themes.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

const GEMINI_HOME = join(homedir(), ".gemini");

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runThemeSelector(configDir) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const themesDir = join(GEMINI_HOME, "themes");

  if (!existsSync(themesDir)) {
    console.log("No themes directory found. Run 'astra-devkit setup' first.");
    rl.close();
    return;
  }

  const themes = readdirSync(themesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const data = JSON.parse(readFileSync(join(themesDir, f), "utf-8"));
      return { file: f, name: data.name };
    });

  // Add built-in themes
  const builtIn = ["Default", "Dracula"];
  const allThemes = [
    ...themes.map((t) => ({ name: t.name, custom: true, file: t.file })),
    ...builtIn.map((name) => ({ name, custom: false })),
  ];

  console.log("\nAvailable Themes:\n");
  allThemes.forEach((t, i) => {
    console.log(`  [${i + 1}] ${t.name}${t.custom ? " (Astra)" : ""}`);
  });
  console.log();

  const choice = await ask(rl, "Choose theme (number): ");
  rl.close();

  const idx = parseInt(choice) - 1;
  if (idx < 0 || idx >= allThemes.length) {
    console.log("Invalid selection.");
    return;
  }

  const selected = allThemes[idx];
  const settingsPath = join(GEMINI_HOME, "settings.json");

  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    settings.ui = settings.ui || {};
    settings.ui.theme = selected.name;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    console.log(`\nTheme set to: ${selected.name}`);
    console.log("Restart Gemini CLI to apply.\n");
  } else {
    console.log("settings.json not found. Run 'astra-devkit setup' first.");
  }
}
