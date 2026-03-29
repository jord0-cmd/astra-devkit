#!/usr/bin/env node
/**
 * AfterAgent hook — Drift Check (AAG Integration)
 *
 * After an agent completes, runs the AAG engine to check for State Drift.
 * If high-severity drift is detected, injects a warning into context
 * telling Astra to fix the broken contracts before proceeding.
 *
 * Only runs if:
 * - The project has both backend/ and frontend/ directories (fullstack)
 * - ast-grep (sg) is installed
 * - The AAG engine script exists
 */

import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString());
    const cwd = process.cwd();

    // Only run for fullstack projects
    const hasBackend = existsSync(join(cwd, "backend")) || existsSync(join(cwd, "src", "domain"));
    const hasFrontend = existsSync(join(cwd, "frontend")) || existsSync(join(cwd, "src", "components"));

    if (!hasBackend || !hasFrontend) {
      console.log("{}");
      process.exit(0);
    }

    // Check if sg is available
    try {
      execSync("sg --version", { stdio: "pipe" });
    } catch {
      // ast-grep not installed — skip silently
      console.log("{}");
      process.exit(0);
    }

    // Find the engine script
    const enginePaths = [
      join(cwd, "scripts", "aag-engine", "engine.py"),
      join(process.env.HOME || "", ".gemini", "skills", "aag-engine", "scripts", "engine.py"),
    ];

    const enginePath = enginePaths.find((p) => existsSync(p));
    if (!enginePath) {
      // No engine available — skip
      console.log("{}");
      process.exit(0);
    }

    // Run the AAG engine
    try {
      execSync(`python3 "${enginePath}" "${cwd}"`, {
        stdio: "pipe",
        timeout: 30000,
        cwd,
      });
    } catch (e) {
      // Engine failed — warn but don't block
      process.stderr.write(`DRIFT-CHECK: AAG engine error: ${e.message?.slice(0, 200)}\n`);
      console.log("{}");
      process.exit(0);
    }

    // Read the graph output
    const graphPath = join(cwd, "docs", "architectural-graph.json");
    if (!existsSync(graphPath)) {
      console.log("{}");
      process.exit(0);
    }

    let graph;
    try {
      graph = JSON.parse(readFileSync(graphPath, "utf-8"));
    } catch {
      console.log("{}");
      process.exit(0);
    }

    // Check for high-severity drift
    const warnings = graph.drift_warnings || [];
    const highWarnings = warnings.filter((w) => w.severity === "high");

    if (highWarnings.length > 0) {
      const warningList = highWarnings
        .slice(0, 5)
        .map((w) => `  - ${w.message}`)
        .join("\n");

      const moreText = highWarnings.length > 5
        ? `\n  ... and ${highWarnings.length - 5} more`
        : "";

      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            additionalContext:
              `STATE DRIFT DETECTED: The AAG Engine found ${highWarnings.length} high-severity ` +
              `cross-stack drift warning(s):\n${warningList}${moreText}\n\n` +
              `You MUST fix these before declaring this task complete. ` +
              `Frontend types must match backend models. ` +
              `Run 'python3 ~/.gemini/skills/aag-engine/scripts/engine.py' to re-check after fixing.`,
          },
        })
      );
      process.exit(0);
    }

    // No high drift — report summary
    const nodes = graph.nodes || {};
    const totalNodes = Object.values(nodes).reduce(
      (sum, cat) => sum + Object.keys(cat).length,
      0
    );
    const totalEdges = (graph.edges || []).length;
    const mediumCount = warnings.filter((w) => w.severity === "medium").length;

    if (totalNodes > 0) {
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            additionalContext:
              `AAG VERIFIED: ${totalNodes} nodes, ${totalEdges} edges. ` +
              `No high-severity drift.` +
              (mediumCount > 0 ? ` (${mediumCount} medium advisory warnings)` : "") +
              ` Stacks are in sync.`,
          },
        })
      );
      process.exit(0);
    }

    console.log("{}");
    process.exit(0);
  } catch (err) {
    // Fail open — never crash the agent loop
    process.stderr.write(`DRIFT-CHECK: Hook error (non-fatal): ${err.message}\n`);
    console.log("{}");
    process.exit(0);
  }
});
