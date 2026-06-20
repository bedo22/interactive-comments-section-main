# Two-pass architecture (hand-rolled → Supabase)

The project is built in two passes against the same API contract: Pass 1 uses a hand-rolled backend (Express + SQLite) where every SQL query and handler is written by the developer; Pass 2 swaps to local Supabase (Postgres + auto-generated REST), reusing the identical frontend and test suite to verify the swap.

## Why

The two passes are **complementary**, not redundant. They teach different things:

| Skill | Pass 1 (hand-rolled) | Pass 2 (Supabase) |
|---|---|---|
| API design | ✅ You write every endpoint | ❌ Auto-generated from schema |
| Persistence / SQL | ✅ You write the schema, queries, constraints | ❌ Postgres managed, REST auto |
| Integration | ✅ Manual fetch + flat JSON | ✅ Supabase client SDK (different flavor) |

If Supabase were used alone, the developer would learn integration testing but would **never write a SQL query or design an endpoint** — those are the skills that Supabase abstracts away. Pass 1 teaches the ground truth; Pass 2 teaches whether that abstraction is worth it. The contrast between the two passes *is* the lesson.

## The frontend is built once

The React frontend talks only to the **contract** (URLs + JSON shapes), never to the specific backend. When Pass 2 swaps the backend, only the data-fetching layer changes (from `fetch('/comments')` to the Supabase client SDK). Components, tree-building, rendering, and presentation logic are untouched.

## The test suite is the contract verification

The integration test suite (~25 tests) runs against Pass 1 during development, then against Pass 2 after the swap. A green suite on Pass 2 proves the swap preserves all required behavior. Tests that fail reveal where Supabase's defaults differ from the hand-rolled behavior — those differences are the lesson.

## Pass order is mandatory

Pass 1 must come first. Supabase's abstractions are invisible until the developer has **felt the pain they solve** (writing SQL by hand, wiring handlers to routes, managing request/response shapes). Doing it in reverse would teach neither layer well.

## Known consequence

Two backends means roughly double the backend effort. This is accepted as the cost of learning both "how to build from scratch" and "what a managed service gives you." The frontend cost is NOT doubled — it is built once.

## Considered options

- **Supabase only**: rejected — skips API design and SQL entirely; the two most valuable learning skills.
- **Express + Postgres only (no Supabase)**: rejected — misses the "what does a managed service abstract away" lesson.
- **Single pass, then refactor**: rejected — the swap property (same frontend, same tests, different backend) requires conscious architecture from the start, not a retrofit.
