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
  // Wide coverage — better to nudge too many skills than miss one
  const skillMap = [
    {
      keywords: ["python", "fastapi", "uvicorn", "starlette", "django", "flask", "script"],
      skills: "python-standards",
      note: "Python detected",
    },
    {
      keywords: ["fastapi", "uvicorn", "starlette", "django", "flask", "api server", "endpoint", "rest api"],
      skills: "backend-patterns and database-patterns",
      note: "Backend API detected — includes database patterns",
    },
    {
      keywords: ["typescript", "react", "next.js", "nextjs", "vite", "jsx", "tsx", "node", "express", "angular", "svelte"],
      skills: "typescript-standards",
      note: "TypeScript/JS detected",
    },
    {
      keywords: ["react", "next.js", "nextjs", "tailwind", "shadcn", "component", "frontend", "ui", "css", "accessibility"],
      skills: "frontend-patterns",
      note: "Frontend/UI detected",
    },
    {
      keywords: ["rust", "cargo", "tokio", "axum", "actix", "wasm"],
      skills: "rust-standards",
      note: "Rust detected",
    },
    {
      keywords: ["docker", "dockerfile", "compose", "container", "kubernetes", "k8s", "deploy", "devops"],
      skills: "docker-ops",
      note: "Docker/container detected",
    },
    {
      keywords: ["azure", "bicep", "cosmos", "blob storage", "key vault", "app service", "azure function", "entra", "devops pipeline"],
      skills: "azure-ops",
      note: "Azure detected",
    },
    {
      keywords: ["database", "postgresql", "postgres", "sqlite", "redis", "sqlalchemy", "prisma", "cosmos db", "mongodb", "crud", "data storage", "persistence", "migration", "alembic"],
      skills: "database-patterns",
      note: "Database/persistence detected",
    },
    {
      keywords: ["pytorch", "cuda", "gpu", "model serving", "inference", "training", "onnx", "tensorflow", "huggingface", "transformers", "fine-tune", "machine learning"],
      skills: "ml-ops",
      note: "ML/GPU work detected",
    },
    {
      keywords: ["ollama", "openwebui", "open-webui", "rag", "local llm", "vector database", "embedding"],
      skills: "openwebui",
      note: "Local LLM infrastructure detected",
    },
    {
      keywords: ["github action", "ci/cd", "pipeline", "pull request", "conventional commit", "branching", "git", "commit", "merge", "pr", "release"],
      skills: "git-github",
      note: "Git/CI workflow detected",
    },
    {
      keywords: ["frontend", "backend", "api contract", "cors", "type sync", "openapi", "websocket", "grpc", "microservice", "full-stack", "fullstack"],
      skills: "integration-patterns",
      note: "Integration work detected",
    },
    {
      keywords: ["debug", "error", "logs", "crash", "broken", "not working", "failing", "traceback", "exception", "stack trace"],
      skills: "log-analysis",
      note: "Debugging/log analysis detected",
    },
    {
      keywords: ["new project", "set up", "onboard", "scaffold", "initialize", "bootstrap", "from scratch"],
      skills: "project-onboarding",
      note: "Project setup detected",
    },
    {
      keywords: ["hook", "automation", "beforetool", "aftertool", "custom hook", "gemini hook"],
      skills: "hooks-guide",
      note: "Hook/automation work detected",
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
