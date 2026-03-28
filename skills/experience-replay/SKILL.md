---
description: "Structured experience replay for session continuity. Activate at session start to load lessons from previous sessions, and at session end to capture new lessons. Upgrades GEMINI.md from raw context to indexed experience units."
---

# Experience Replay

Learn from past sessions. Don't repeat mistakes. Carry forward what worked.

## At Session Start

1. Read `GEMINI.md` — specifically the **Lessons Learned** section
2. Match current task against lesson triggers
3. If a lesson matches, state it before planning:
   > "Previous sessions learned: [lesson]. Applying this to the current task."

## At Session End

After completing work, extract lessons from this session:
1. What failed and was fixed? → Lesson with trigger
2. What unexpected behaviour occurred? → Lesson with trigger
3. What non-obvious decision was made? → Lesson with rationale

Write to GEMINI.md under **Lessons Learned** using this exact format:

```markdown
## Lessons Learned

### [Trigger: describe when this lesson applies]
**Lesson**: What to do (or not do)
**Evidence**: File or test where this was discovered
**Category**: testing | integration | architecture | tooling | performance
```

## Lesson Quality Rules

1. **Trigger must be specific** — "when writing tests" is too vague. "When testing async FastAPI endpoints with httpx" is specific.
2. **Lesson must be actionable** — "be careful" is useless. "Use ASGITransport(app=app) for httpx AsyncClient" is actionable.
3. **Evidence must be traceable** — file path + what happened.
4. **Don't duplicate** — check existing lessons before adding.
5. **Consolidate over time** — if 3 lessons are variants of the same thing, merge into one generalised lesson.
6. **Max 20 lessons** — if at limit, generalise or remove least useful. Quality over quantity.

## Lesson Categories

| Category | Trigger Examples |
|----------|----------------|
| **testing** | Async test setup, fixture patterns, mock vs fake decisions |
| **integration** | Type drift, CORS issues, API path mismatches |
| **architecture** | DDD boundary violations, dependency direction errors |
| **tooling** | CLI flag issues (like sg --lang), build tool quirks |
| **performance** | N+1 queries, unnecessary re-renders, slow imports |

## The Dual-Store Principle

GEMINI.md Lessons Learned = **distilled index** (max 20, high signal).
`.astra/session-log.jsonl` = **append-only event log** (all raw events).

The distilled index is what gets loaded into context. The event log is for
archaeology — when you need to trace exactly what happened and when.

Never put raw session transcripts in Lessons Learned. Distil first.
