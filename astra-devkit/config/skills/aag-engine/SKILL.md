---
description: "Active Architectural Graph — structural impact analysis and state drift detection. Activate BEFORE modifying domain models, route signatures, or TypeScript types in fullstack projects. Activate AFTER major refactors to verify cross-stack integrity."
---

# AAG Engine: Active Architectural Graph

Scan the codebase structure and detect State Drift between backend and frontend.

**Trust the graph, not your memory.**

---

## When to Activate
- **BEFORE** modifying any domain model (Pydantic, SQLAlchemy, TypeScript interface)
- **BEFORE** changing any FastAPI route signature
- **AFTER** any cross-stack refactor to verify structural integrity
- **WHEN** investigating a bug that spans both frontend and backend

---

## Pre-Flight Impact Analysis

Before making a change to a domain model:

1. Run: `python3 ~/.gemini/skills/aag-engine/scripts/engine.py`
2. Read `docs/architectural-graph.json`
3. Identify all **Edges** connected to the model you are about to change
4. **State the Blast Radius**: "Changing `Incident` will affect these routes, types, and components: [list them]"
5. Formulate a plan that includes updating ALL affected nodes

Do NOT proceed with the change until you have stated the blast radius.

---

## Post-Flight Drift Detection

After completing a cross-stack task:

1. Run: `python3 ~/.gemini/skills/aag-engine/scripts/engine.py`
2. Check the `drift_warnings` array in `docs/architectural-graph.json`
3. If ANY `high` severity warnings exist — you MUST fix them before declaring done
4. Medium warnings are advisory — log them but don't block

---

## What the Engine Finds

| Node Type | What It Scans |
|-----------|--------------|
| `backend_models` | Python classes (Pydantic, SQLAlchemy, Protocol) |
| `backend_routes` | FastAPI decorated endpoints |
| `frontend_types` | TypeScript interfaces |
| `frontend_components` | React function components |
| `frontend_api_calls` | API client method calls |
| `imports` | Cross-file dependencies |

## Edge Types

| Edge | Meaning |
|------|---------|
| `returns` | Route returns this model as response |
| `api_contract_binding` | TS type mirrors a Python model |
| `calls` | Frontend API call targets this route |
| `imports` | File imports this symbol |

## Drift Severities

| Severity | Action |
|----------|--------|
| `high` | MUST fix — frontend type has no backend model |
| `medium` | Should fix — route missing response_model |
| `info` | May be intentional — backend model is internal |

---

## Quality Gate Checklist
- [ ] Engine runs without errors
- [ ] No `high` severity drift warnings
- [ ] All cross-stack edges verified after changes

*The AAG is the source of truth for the project's physical structure. Trust the graph, not your memory.*
