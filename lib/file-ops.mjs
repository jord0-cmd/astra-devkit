/**
 * Cross-platform file operations for Astra DevKit installer.
 * Handles copying, merging, and symlinking across Windows/Mac/Linux.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync, symlinkSync, unlinkSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";

export const GEMINI_HOME = join(homedir(), ".gemini");

export function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Copy a directory recursively, preserving structure.
 */
export function copyDir(src, dest) {
  ensureDir(dest);
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy a single file, creating parent dirs as needed.
 */
export function copyFileSafe(src, dest) {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}

/**
 * Deep merge two JSON objects. Target values win for conflicts.
 * Used for merging settings.json without clobbering user config.
 */
export function deepMerge(base, overlay) {
  const result = { ...base };
  for (const key of Object.keys(overlay)) {
    if (
      overlay[key] &&
      typeof overlay[key] === "object" &&
      !Array.isArray(overlay[key]) &&
      base[key] &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], overlay[key]);
    } else {
      result[key] = overlay[key];
    }
  }
  return result;
}

/**
 * Merge settings.json — preserves user's existing settings, adds new Astra keys.
 */
export function mergeSettings(configDir) {
  const templatePath = join(configDir, "settings-template.json");
  const targetPath = join(GEMINI_HOME, "settings.json");

  const template = JSON.parse(readFileSync(templatePath, "utf-8"));

  if (existsSync(targetPath)) {
    const existing = JSON.parse(readFileSync(targetPath, "utf-8"));
    const merged = deepMerge(existing, template);
    writeFileSync(targetPath, JSON.stringify(merged, null, 2) + "\n");
  } else {
    ensureDir(GEMINI_HOME);
    writeFileSync(targetPath, JSON.stringify(template, null, 2) + "\n");
  }
}

/**
 * Deploy a component directory (skills, hooks, agents, standards, themes).
 * Copies all contents from config/<component>/ to ~/.gemini/<component>/
 */
export function deployComponent(configDir, component) {
  const src = join(configDir, component);
  const dest = join(GEMINI_HOME, component);

  if (!existsSync(src)) {
    return { deployed: 0, component };
  }

  ensureDir(dest);
  const entries = readdirSync(src, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
    count++;
  }

  return { deployed: count, component };
}

/**
 * Count installed components for health reporting.
 */
export function countInstalled() {
  const counts = {};
  for (const comp of ["skills", "hooks", "agents", "standards", "themes"]) {
    const dir = join(GEMINI_HOME, comp);
    if (existsSync(dir)) {
      const entries = readdirSync(dir).filter((f) => !f.startsWith("."));
      counts[comp] = entries.length;
    } else {
      counts[comp] = 0;
    }
  }

  // Count MCPs from settings
  const settingsPath = join(GEMINI_HOME, "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      counts.mcps = settings.mcpServers ? Object.keys(settings.mcpServers).length : 0;
    } catch {
      counts.mcps = 0;
    }
  } else {
    counts.mcps = 0;
  }

  return counts;
}

/**
 * Clean removal of all Astra-managed components.
 */
export function removeAll() {
  const components = ["skills", "hooks", "agents", "standards", "themes"];
  const removed = [];

  for (const comp of components) {
    const dir = join(GEMINI_HOME, comp);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      removed.push(comp);
    }
  }

  return removed;
}
