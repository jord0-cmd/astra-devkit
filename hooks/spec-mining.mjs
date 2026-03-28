#!/usr/bin/env node
/**
 * BeforeAgent hook — Specification Mining (Ambiguity Detection)
 *
 * Scans build/create prompts for common ambiguity patterns and nudges
 * the agent to ask clarifying questions before writing the contract.
 * Advisory only — injects context, never blocks.
 *
 * Uses weighted ambiguity scoring with threshold.
 * Stays silent for scoped tasks (bugfix, migration, config).
 */

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = (input.prompt || "").toLowerCase();

  if (!prompt) {
    console.log("{}");
    process.exit(0);
  }

  // Escape hatch: scoped tasks don't need spec mining
  const scopedPatterns = [
    /\b(fix|bug|debug|patch|hotfix)\b/,
    /\b(migration|migrate|alembic|schema change)\b/,
    /\b(config|configure|settings|env)\b/,
    /\b(refactor|rename|move|reorgani[sz]e)\b/,
    /\b(update|upgrade|bump|version)\b/,
    /\b(delete|remove|drop|clean)\b/,
    /\b(add.*test|write.*test|test.*for)\b/,
  ];

  if (scopedPatterns.some((p) => p.test(prompt))) {
    console.log("{}");
    process.exit(0);
  }

  // Only fire on build/create prompts
  const buildPatterns = /\b(build|create|implement|develop|make|design|scaffold|set up|start.*project|new.*app|new.*api|new.*service)\b/;
  if (!buildPatterns.test(prompt)) {
    console.log("{}");
    process.exit(0);
  }

  // Ambiguity categories with weights
  const categories = [
    {
      name: "error_handling",
      weight: 0.15,
      present: /(error|fail|retry|fallback|exception|timeout|circuit.breaker|dead.letter)/.test(prompt),
      question: "What should happen when operations fail? (retry, fallback, error response?)",
    },
    {
      name: "auth",
      weight: 0.15,
      present: /(auth|login|permission|role|jwt|oauth|token|session|credential|rbac)/.test(prompt),
      question: "Does this need authentication or authorization?",
    },
    {
      name: "pagination",
      weight: 0.1,
      present: /(pagina|page.size|limit|offset|cursor|infinite.scroll)/.test(prompt),
      question: "Should list endpoints be paginated? (limit/offset, cursor-based?)",
    },
    {
      name: "concurrency",
      weight: 0.15,
      present: /(concurren|race.condition|lock|mutex|atomic|transaction|optimistic|pessimistic|conflict)/.test(prompt),
      question: "Can multiple users modify the same data simultaneously? How should conflicts be handled?",
    },
    {
      name: "validation",
      weight: 0.1,
      present: /(validat|min.length|max.length|constraint|bounds|range|format|regex)/.test(prompt),
      question: "What are the validation rules for input fields? (lengths, formats, required fields?)",
    },
    {
      name: "idempotency",
      weight: 0.1,
      present: /(idempoten|retry.safe|duplicate|dedup|exactly.once)/.test(prompt),
      question: "Should write operations be idempotent? (safe to retry without side effects?)",
    },
    {
      name: "data_lifecycle",
      weight: 0.1,
      present: /(soft.delete|hard.delete|archive|retention|gdpr|pii|purge|ttl)/.test(prompt),
      question: "How should deletion work? (soft delete, hard delete, archive?) Any data retention requirements?",
    },
    {
      name: "api_versioning",
      weight: 0.05,
      present: /(version|\/v1\/|\/v2\/|api.version|backward.compat)/.test(prompt),
      question: "Should the API be versioned? (/api/v1/ prefix?)",
    },
  ];

  // Calculate ambiguity score (sum of weights for MISSING categories)
  const missing = categories.filter((c) => !c.present);
  const score = missing.reduce((sum, c) => sum + c.weight, 0);

  // Threshold: only nudge if score > 0.5 (more than half of categories unaddressed)
  if (score <= 0.5) {
    console.log("{}");
    process.exit(0);
  }

  // Build the nudge with top missing categories
  const topMissing = missing
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  const questions = topMissing.map((c) => `  - ${c.question}`).join("\n");

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        additionalContext:
          `SPEC MINING: This build request has an ambiguity score of ${score.toFixed(2)} ` +
          `(${missing.length}/${categories.length} categories unaddressed). ` +
          `Before writing any code or contract, ask the user about:\n${questions}\n\n` +
          `Keep questions concise and decision-forcing (offer options, not open-ended). ` +
          `If the user says "just build it" or gives a detailed spec, proceed without further questions.`,
      },
    })
  );

  process.exit(0);
});
