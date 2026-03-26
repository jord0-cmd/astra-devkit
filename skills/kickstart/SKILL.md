---
name: kickstart
description: Use this skill when a user says "kickstart", wants to start a new project, seems unsure what to ask, or needs help scoping work. Guides developers through a structured discovery process to define what they're building before any code is written. Especially useful for developers who are new to AI coding tools.
---

# Kickstart

Guided project discovery. Helps developers define what they're building before a single line of code is written.

---

## Why This Exists

Most developers sit down with an AI coding tool and don't know what to ask. They type something vague ("make me an app") and get something generic back. The problem isn't the AI — it's that the developer hasn't been helped to articulate what they actually need.

Kickstart fixes this. It's a structured conversation that extracts the right information, step by step, in plain language.

---

## How It Works

When activated, walk the user through these phases. Keep it conversational — not a form, not an interrogation. Adapt based on their answers.

---

### Phase 1: The Big Picture

Start with one open question:

> "What are you looking to build today? Just describe it in your own words — don't worry about being technical."

Listen to their answer. Then ask targeted follow-ups based on what they said:

- If they mention a web app: "Frontend, backend, or both?"
- If they mention data: "Where does the data come from? Files, API, database?"
- If they mention automation: "What triggers it? Schedule, event, manual?"
- If they're vague: "Can you give me an example of what a user would do with this?"

**Goal**: Understand WHAT they're building and WHO it's for.

---

### Phase 2: Scope and Constraints

Once you understand the concept, narrow down:

- "How big is this? Quick prototype, or something that needs to last?"
- "Any tech stack preferences, or should I recommend one?"
- "Is this greenfield (starting fresh) or adding to something existing?"
- "Any constraints I should know about? Deadlines, specific platforms, security requirements?"
- "Does this need to integrate with anything else? APIs, databases, other systems?"

**Goal**: Understand the BOUNDARIES — what's in scope, what's not.

---

### Phase 3: Reference Material

Ask if they have anything to work from:

> "Do you have any reference material I can look at? Things like:"
> - Existing code or a repo I should look at
> - Documentation, specs, or design mockups
> - API docs for services you need to integrate with
> - Examples of similar things you've seen
>
> "If so, drop them into a folder called `kickstart-refs/` in your project directory and I'll read through everything before we start."

If they provide references:
1. Read everything in `./kickstart-refs/`
2. Summarise what you found
3. Ask clarifying questions based on the material

If they don't have references: that's fine, move on.

**Goal**: Ground the project in REAL context, not assumptions.

---

### Phase 4: Experience Check

Calibrate how you'll work together:

> "One more thing — how comfortable are you with [detected tech stack]? This helps me know whether to explain things as I go or just deliver the code."

Options to listen for:
- **New to this**: "I'm learning" / "first time" / "not sure" → Full explanations, teach as you go
- **Intermediate**: "I've done some" / "familiar but not expert" → Brief explanations for non-obvious things
- **Senior**: "Very comfortable" / "just do it" → Minimal explanation, just code

Save their preference to `~/.gemini/user.json` under `preferences.experience` and `preferences.explanations`:

```json
{
  "name": "Dave",
  "preferences": {
    "experience": "intermediate",
    "explanations": "brief",
    "primary_language": "python"
  }
}
```

**Goal**: Match the AI's communication to the developer's level.

---

### Phase 5: The Brief

Summarise everything into a clear project brief. Present it for confirmation:

```markdown
## Project Brief

**What**: [One-sentence description]
**Who**: [Who will use this]
**Stack**: [Recommended or specified tech]
**Scope**: [What's included, what's not]
**Key Features**:
1. [Feature 1]
2. [Feature 2]
3. [Feature 3]

**Constraints**: [Deadlines, platforms, security, etc.]
**Reference Material**: [What was provided, if any]
**Communication Style**: [Explanations level based on experience]
```

Ask: **"Does this look right? Anything to add or change before we start?"**

---

### Phase 6: Plan and Build

Once the brief is confirmed, take action:

1. **Enter Plan Mode** — IMMEDIATELY after the user confirms the brief, enter Plan Mode to create a detailed implementation plan. This uses a higher-reasoning model for architecture decisions. Say: "I'll create a detailed implementation plan first."
2. **Activate relevant skills** — BEFORE planning, activate the domain skills (e.g., python-standards, backend-patterns, database-patterns, azure-ops for Azure projects). Use the patterns from these skills, not tutorial defaults.
3. **Create the implementation plan** — The plan MUST follow **outside-in order**:
   - **Step 1: Infrastructure as Code** (Bicep modules, main.bicep, parameter files, RBAC)
   - **Step 2: Local development** (docker-compose, Makefile, .gitignore, emulator setup)
   - **Step 3: Project scaffold** (pyproject.toml, directory structure, GEMINI.md, project-brief.md)
   - **Step 4: Domain layer** (models, protocols/ports, repository interfaces)
   - **Step 5: Tests** (unit tests with in-memory fakes, sad paths, integration stubs)
   - **Step 6: Implementation** (API endpoints, infrastructure adapters, DI wiring)
   - **Step 7: Async processing** (Azure Functions, queue triggers, background workers)
   - **Step 8: CI/CD** (Azure DevOps pipelines, GitHub Actions)
   Do NOT reorder these steps. Infrastructure comes FIRST, application code comes LAST.
4. **Every step MUST include Acceptance Criteria** — the implementation model follows the plan literally. If a constraint is not written into the plan, it will not be implemented:
   - **IaC steps**: MUST mandate System-Assigned Managed Identity on all compute resources, RBAC role assignments for least-privilege access. Hardcoded keys are forbidden.
   - **Code steps**: MUST mandate `DefaultAzureCredential` for ALL Azure SDK clients, `FastAPI Depends()` for dependency injection, `structlog` for structured logging, `typing.Protocol` for port definitions, in-memory fakes for testing (NEVER mock.patch).
   - **Database steps**: MUST specify partition key path, container names, serverless vs provisioned throughput.
   - **Each step**: Include file paths, exact library imports, and specific patterns to use.
5. **Exit Plan Mode** — present the plan for user approval. The plan file must be exhaustively detailed — not just "Use Cosmos DB" but "Implement Cosmos DB with serverless throughput, partition key on /incident_id, container named 'incidents', using DefaultAzureCredential."
5. **Implement the plan** — after approval, implement each step in order. Write test files BEFORE implementation code for each module. Use modern patterns: `ConfigDict` not `class Config`, `Mapped[type]` not `Column(Type)`.
6. **STOP between major steps** and confirm with the user if the plan has more than 5 steps.

**CRITICAL: Do NOT skip Plan Mode.** The sequence is: brief → confirm → Plan Mode → plan → approve → implement. The planning phase uses a higher-reasoning model that makes better architecture decisions.

Store the brief in the project:

```
project-root/
├── GEMINI.md              ← Generated from the brief
├── kickstart-refs/        ← Their reference material (if any)
└── docs/
    └── project-brief.md   ← The full brief for future reference
```

---

## Conversation Style

- **Keep it casual.** This isn't a requirements document — it's a conversation.
- **One question at a time.** Don't dump five questions in one message.
- **Acknowledge their answers.** "Got it — so we're looking at a React frontend with a FastAPI backend."
- **Offer suggestions.** If they don't know the tech stack, recommend one based on their needs.
- **Don't over-ask.** If they've given enough info, move forward. Not everything needs clarifying.
- **Use their name** if it's in `~/.gemini/user.json`.

---

## Adaptive Behaviour

The questions above are a guide, not a script. Adapt based on:

- **Experienced developer with clear vision**: Skip to the brief faster. They know what they want.
- **New developer, vague idea**: Spend more time in Phase 1 and 2. Help them think it through.
- **Existing project, new feature**: Skip structure questions. Focus on what's changing and why.
- **"I have a repo already"**: Read the codebase first (use project-onboarding patterns), then ask what they want to add/change.

---

## Session Resilience

If the session drops during a kickstart, state should be recoverable.

After each phase is confirmed by the user, save progress to `.astra/kickstart-state.json`:

```json
{
  "phase": 3,
  "brief": {
    "what": "REST API for team task tracking",
    "stack": "FastAPI + SQLite",
    "team_size": 6,
    "features": ["CRUD", "assignment", "done/not done"]
  },
  "started_at": "2026-03-25T10:00:00Z",
  "last_updated": "2026-03-25T10:05:00Z"
}
```

On next kickstart invocation, check if `.astra/kickstart-state.json` exists:
- If it does: "I found a previous kickstart in progress. Want to resume from Phase [X] or start fresh?"
- If the user says resume: load the state and continue from where we left off
- If the user says fresh: delete the state file and start over

After the project is fully set up (Phase 6 complete), delete the state file.

---

## What This Is NOT

- Not a project management tool — no sprints, no tickets
- Not a requirements document generator — it's a conversation
- Not mandatory — experienced devs can skip straight to coding
- Not a replacement for thinking — it helps articulate, not decide

---

*The best code starts with a clear picture. Kickstart builds that picture, one question at a time.*
