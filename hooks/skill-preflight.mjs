#!/usr/bin/env node
/**
 * BeforeAgent hook — Skill Pre-Flight
 * Detects tech keywords in user prompts and nudges relevant skill activation.
 * Fights "tutorial gravity" by reminding Astra that domain skills exist.
 * Cross-platform (Node.js).
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

  // Tech keyword → relevant skills mapping
  const skillMap = [
    {
      keywords: ["fastapi", "uvicorn", "starlette"],
      skills: "python-standards, backend-patterns, and database-patterns",
      note: "FastAPI detected — includes database patterns (most APIs need data persistence)",
    },
    {
      keywords: ["react", "next.js", "nextjs", "vite", "jsx", "tsx"],
      skills: "typescript-standards and frontend-patterns",
      note: "React/frontend detected",
    },
    {
      keywords: ["rust", "cargo", "tokio", "axum"],
      skills: "rust-standards",
      note: "Rust detected",
    },
    {
      keywords: ["docker", "dockerfile", "compose", "container"],
      skills: "docker-ops",
      note: "Docker detected",
    },
    {
      keywords: ["azure", "bicep", "cosmos", "blob storage", "key vault", "app service", "azure function"],
      skills: "azure-ops",
      note: "Azure detected",
    },
    {
      keywords: ["database", "postgresql", "postgres", "sqlite", "redis", "sqlalchemy", "prisma", "cosmos db", "mongodb", "rest api", "crud", "data storage", "persistence"],
      skills: "database-patterns",
      note: "Database/persistence work detected",
    },
    {
      keywords: ["pytorch", "cuda", "gpu", "model serving", "inference", "training", "onnx"],
      skills: "ml-ops",
      note: "ML/GPU work detected",
    },
    {
      keywords: ["ollama", "openwebui", "open-webui", "rag", "local llm"],
      skills: "openwebui",
      note: "Local LLM infrastructure detected",
    },
    {
      keywords: ["github action", "ci/cd", "pipeline", "pull request", "conventional commit", "branching"],
      skills: "git-github",
      note: "Git/CI workflow detected",
    },
    {
      keywords: ["frontend", "backend", "api contract", "cors", "type sync", "openapi"],
      skills: "integration-patterns",
      note: "Integration work detected",
    },
  ];

  const detected = [];

  for (const { keywords, skills, note } of skillMap) {
    if (keywords.some((kw) => prompt.includes(kw))) {
      detected.push({ skills, note });
    }
  }

  if (detected.length > 0) {
    const reminders = detected
      .map((d) => `- ${d.note}: activate ${d.skills}`)
      .join("\n");

    const context =
      `SKILL PRE-FLIGHT: The following domain skills are relevant to this task:\n${reminders}\n\n` +
      `Activate these skills before writing architecture or code. ` +
      `They contain patterns and standards beyond basic tutorial implementations.`;

    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext: context,
        },
      })
    );
  } else {
    console.log("{}");
  }

  process.exit(0);
});
