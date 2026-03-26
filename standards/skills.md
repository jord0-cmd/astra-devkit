# Skill Compatibility

Which skills work together for common tech stacks.

Skills use progressive disclosure — only metadata loads until activated. Multiple skills can be enabled safely without context bloat.

---

## Stack Recommendations

| Project Type | Skills to Activate |
|-------------|-------------------|
| **FastAPI + PostgreSQL** | python-standards, backend-patterns, database-patterns |
| **FastAPI + Cosmos DB** | python-standards, backend-patterns, database-patterns, azure-ops |
| **React SPA** | typescript-standards, frontend-patterns |
| **React + FastAPI** | typescript-standards, frontend-patterns, python-standards, backend-patterns, integration-patterns |
| **React + Node/Express** | typescript-standards, frontend-patterns, integration-patterns |
| **Rust CLI** | rust-standards |
| **Rust + Axum API** | rust-standards, database-patterns |
| **Azure Functions** | python-standards, azure-ops |
| **Azure Full Stack** | typescript-standards, frontend-patterns, python-standards, azure-ops, database-patterns |
| **Docker Deployment** | docker-ops (+ any stack skills above) |
| **ML/GPU Work** | python-standards, ml-ops, docker-ops |
| **Local LLM Setup** | openwebui, docker-ops |

---

## Always Relevant

These skills apply regardless of tech stack:

- **git-github** — version control, CI/CD, PRs
- **project-onboarding** — GEMINI.md creation, module summaries
- **kickstart** — guided project discovery
- **log-analysis** — debugging, Docker logs, root cause
- **hooks-guide** — understanding and writing custom hooks

---

## Skill Interactions

Skills are designed to be independent — each covers its own domain. When multiple activate:

- **python-standards** provides language rules; **backend-patterns** provides architecture patterns. They complement, don't conflict.
- **frontend-patterns** + **integration-patterns** work together for full-stack — frontend handles components, integration handles the API wiring.
- **database-patterns** covers the data layer for any backend skill (FastAPI, Node, Rust).
- **docker-ops** wraps any stack — it doesn't conflict with language skills.

---

## Known Overlaps

- **backend-patterns** and **database-patterns** both cover SQLAlchemy. Backend-patterns focuses on FastAPI integration (sessions, DI), database-patterns focuses on schema design and queries. Use both for full coverage.
- **typescript-standards** and **frontend-patterns** both cover React patterns. TS-standards is language-level (types, linting), frontend-patterns is architecture-level (components, state, a11y).

---

*When in doubt, activate more skills rather than fewer. Progressive disclosure means the cost is minimal.*
