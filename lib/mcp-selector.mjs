/**
 * MCP selector for Astra DevKit.
 * Interactive menu to enable/disable MCP servers.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

const GEMINI_HOME = join(homedir(), ".gemini");

const MCP_CATALOG = [
  {
    category: "DOCUMENTS",
    servers: [
      {
        key: "pandoc",
        name: "Pandoc",
        desc: "Markdown \u2192 any format (PDF, DOCX, HTML, etc.)",
        config: { command: "uvx", args: ["mcp-pandoc"], timeout: 15000 },
        requires: "Python + uv + pandoc",
      },
      {
        key: "powerpoint",
        name: "PowerPoint",
        desc: "Presentations (34 tools)",
        config: {
          command: "uvx",
          args: ["--from", "office-powerpoint-mcp-server", "ppt_mcp_server"],
          timeout: 15000,
        },
        requires: "Python + uv",
      },
      {
        key: "excel",
        name: "Excel",
        desc: "Spreadsheets (20 tools)",
        config: { command: "uvx", args: ["excel-mcp-server"], timeout: 15000 },
        requires: "Python + uv",
      },
      {
        key: "word-docs",
        name: "Word",
        desc: "Rich documents",
        config: {
          command: "uvx",
          args: ["--from", "office-word-mcp-server", "word_mcp_server"],
          timeout: 15000,
        },
        requires: "Python + uv",
      },
    ],
  },
  {
    category: "IMAGES",
    servers: [
      {
        key: "gemini-image",
        name: "Gemini Imagen",
        desc: "AI image generation",
        config: {
          command: "npx",
          args: ["-y", "mcp-image"],
          env: {
            GEMINI_API_KEY: "$GEMINI_API_KEY",
            IMAGE_OUTPUT_DIR: "./generated-images",
            IMAGE_QUALITY: "balanced",
          },
          timeout: 60000,
        },
        requires: "GEMINI_API_KEY env var",
      },
    ],
  },
  {
    category: "CODING",
    servers: [
      {
        key: "context7",
        name: "Context7",
        desc: "Live docs for 9K+ libraries",
        config: {
          command: "npx",
          args: ["-y", "@upstash/context7-mcp@latest"],
          timeout: 30000,
        },
        requires: "Node.js",
      },
      {
        key: "playwright",
        name: "Playwright",
        desc: "Browser automation",
        config: {
          command: "npx",
          args: ["-y", "@anthropic-ai/mcp-playwright"],
          timeout: 30000,
        },
        requires: "Node.js",
      },
    ],
  },
];

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runMcpSelector(configDir) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const settingsPath = join(GEMINI_HOME, "settings.json");

  let settings = {};
  if (existsSync(settingsPath)) {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  }
  const currentMcps = settings.mcpServers || {};

  // Build flat list with enabled state
  const allServers = [];
  for (const cat of MCP_CATALOG) {
    for (const srv of cat.servers) {
      allServers.push({
        ...srv,
        category: cat.category,
        enabled: srv.key in currentMcps,
      });
    }
  }

  function displayMenu() {
    console.log("\n  Astra DevKit \u2014 MCP Configuration\n");
    let idx = 1;
    let lastCat = "";
    for (const srv of allServers) {
      if (srv.category !== lastCat) {
        console.log(`  ${srv.category}`);
        lastCat = srv.category;
      }
      const check = srv.enabled ? "\u2713" : " ";
      console.log(`  [${idx}] ${check} ${srv.name.padEnd(14)} \u2014 ${srv.desc}`);
      if (!srv.enabled) {
        console.log(`       requires: ${srv.requires}`);
      }
      idx++;
    }
    console.log("\n  Enter numbers to toggle, 'a' for all, 'q' to save\n");
  }

  let done = false;
  while (!done) {
    displayMenu();
    const input = await ask(rl, "  > ");
    const trimmed = input.trim().toLowerCase();

    if (trimmed === "q") {
      done = true;
    } else if (trimmed === "a") {
      const allEnabled = allServers.every((s) => s.enabled);
      allServers.forEach((s) => (s.enabled = !allEnabled));
    } else {
      const nums = trimmed.split(/[\s,]+/).map(Number).filter(Boolean);
      for (const n of nums) {
        if (n >= 1 && n <= allServers.length) {
          allServers[n - 1].enabled = !allServers[n - 1].enabled;
        }
      }
    }
  }

  rl.close();

  // Build new mcpServers config
  const newMcps = {};
  for (const srv of allServers) {
    if (srv.enabled) {
      newMcps[srv.key] = srv.config;
    }
  }

  settings.mcpServers = newMcps;
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  const enabled = allServers.filter((s) => s.enabled);
  console.log(`\nSaved: ${enabled.length} MCP servers enabled.`);
  console.log("Restart Gemini CLI to apply.\n");
}
