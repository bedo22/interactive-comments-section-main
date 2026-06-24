# Interactive Comments Section

A full-stack comments widget with unlimited nesting depth, live-scored votes,
soft-delete tombstones, pickable identity, and a two-pass architecture
designed to teach what a managed backend abstracts away.

## What makes this project different

**Architecture-first design.** Every data-model decision was an explicit
trade-off, debated and documented as ADRs — not defaults. The result is a
codebase where constraints are intentional, not accidental.

| Decision | What we did | Why it matters |
|----------|-------------|----------------|
| Score | Live `SUM(value)` over votes, never cached | Zero drift — no cache to desync |
| Delete | Soft only — `deleted_at` set, row and children intact | No data loss, thread integrity preserved |
| Replies | Single `comments` table, `parent_id` points anywhere | Unlimited depth, backend stays simple |
| Identity | Pickable via `?userId=` query param, no auth | Makes voting and authorization real without dragging in passwords |
| Timeline | Relative time derived at render, never stored | Storage-format independent of display-format |
| API shape | Flat array ordered by `id ASC`; frontend builds the tree | Server returns data; client decides presentation |

**Two-pass architecture.** The frontend is built once. Pass 1 (this project)
hand-rolls Express + SQLite — every SQL query and handler is written by the
developer. Pass 2 (planned) swaps to local Supabase against the *same* API
contract and test suite. The contrast between the two passes *is* the lesson.

**Contract-gated swap.** The integration test suite passes against Pass 1;
when it passes unchanged against Pass 2, the swap is verified. Tests that fail
reveal where Supabase's defaults differ — those differences are the lesson.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Express 5 + better-sqlite3 |
| Frontend | React 18 + Vite 6 |
| Testing | Vitest 4 + supertest |
| Runtime | Node 20+, pnpm |

## Quick start

```bash
pnpm install
pnpm dev
```

Opens Vite dev server on `http://localhost:5173`, proxying `/api` to Express
on `http://localhost:3000`. A `comments.db` file is created and seeded
automatically on first run.

## Testing

```bash
pnpm test       # run once
pnpm test:watch # watch mode
```

**47 integration tests**, each running against a fresh in-memory SQLite
database in a `beforeEach` hook — zero state leaks, zero cleanup, zero
port collisions.

| Area | Tests | What's covered |
|------|-------|----------------|
| **Reading** | 8 | Flat array shape, derived fields, score accuracy, yourVote, tombstone inclusion |
| **Creating** | 7 | Top-level, reply, deep reply, userId validation, content validation, parentId validation, persistence |
| **Voting** | 8 | Upvote, downvote, toggle, swing, auth validation, value validation, 404, persistence |
| **Editing** | 8 | Own comment, authorization, tombstoned rejection, content validation, 404, editedAt preservation |
| **Deleting** | 7 | Own comment, authorization, 404, child survival, missing/unknown userId, idempotency |
| **Users** | 1 | Returns all 4 seeded users |

Unit tests for `buildCommentTree` (7 tests) cover the walk-to-root
partitioner.

---

## Architecture

### Database

Three tables, one file (`comments.db`):

```
┌─────────┐     ┌──────────────┐     ┌───────────┐
│  users  │     │   comments   │     │   votes   │
├─────────┤     ├──────────────┤     ├───────────┤
│ id      │──┐  │ id           │──┐  │ user_id   │──┐
│ username│  │  │ user_id      │  │  │ comment_id│  │
│ avatar  │  │  │ parent_id    │──┘  │ value     │  │
└─────────┘  │  │ content      │     │ (+1 / -1) │  │
             │  │ created_at   │     └───────────┘  │
             └──│ edited_at    │                    │
                │ deleted_at   │────────────────────┘
                └──────────────┘
```

Key modeling decisions:

- **A Reply is a Comment.** One table for both top-level comments and replies.
  `parent_id = NULL` means top-level; any non-null value means it's a reply.
  No separate table, no special Reply type — the only difference is a column
  value.

- **Score is computed, never stored.** The `comments` table has no `score`
  column. Every read runs `SELECT SUM(value) FROM votes WHERE comment_id = ?`.
  This is the single source of truth — no cache to drift, no transaction to
  sync, and at this scale (~10 votes per comment) it's ~50µs per query.

- **Delete is soft.** Setting `deleted_at` preserves the row and all
  descendant replies. Children belong to other users and must never be
  orphaned; the parent row must never block deletion by surviving children.
  Tombstones render as `[deleted]` placeholders in the UI, keeping the thread
  pattern visible.

- **`replyingTo` is derived, never stored.** The `@username` shown at the
  start of a reply is looked up from the parent comment's author at render
  time. No column, no sync, no stale data.

### API

All responses are camelCase JSON. Identity travels as `?userId=` on every
request (reads and mutations alike). The server trusts the stated identity —
no passwords, sessions, or tokens.

```
GET    /users                          → User[]
GET    /comments?userId=X              → Comment[]
POST   /comments?userId=X              → Comment (201)
POST   /comments/:id/vote?userId=X     → { commentId, score, yourVote }
PATCH  /comments/:id?userId=X          → Comment
DELETE /comments/:id?userId=X          → 204
```

**`GET /comments`** returns a **flat** array, not a tree. Each row carries its
own `parentId` and the server's `id ASC` order. The frontend runs
`buildCommentTree()` client-side to group descendants under their root and
collapse multi-depth chains into a single indented replies column. This means:

- The server has zero tree-building logic
- The API is embarrassingly cacheable
- True nested rendering is a frontend-only change away

### Frontend state architecture

```
CurrentUserContext ─── provides ──→ App (flat comments[] state)
                              │
                     ┌────────┴────────┐
                     │                 │
                buildCommentTree    API calls
                     │           (appendComment,
                     │            updateVote,
                     ▼            updateComment,
               CommentList         tombstoneComment)
                     │
               CommentThread
              ┌──────┴──────┐
              │             │
         ScoreControl    Comment
                     ┌────┴────┐
                     │         │
                Edit Mode   ReplyBox
                     │
                ConfirmModal ═══ Delete
```

The flat `comments` array is the single source of truth in `App`. Every
mutation (create, edit, vote, delete) maps over it via `useCallback`-wrapped
setters. The nested tree is derived each render — never stored, never synced.
This means UI always reflects the latest API state, with no optimistic-update
bugs.

---

## Project structure

```
server/
  app.js          Express app factory — all routes,
│                 validation, parameterized SQL
│
├── index.js      Entry point — opens DB, runs schema,
│                 seeds test data, starts listening
│
├── schema.sql    Three CREATE TABLE statements
│
├── seed.js       Translates data.json (frontend fixture)
│                 into SQL rows with real timestamps
│                 and demo votes
│
src/
  main.jsx        React entry — StrictMode, CurrentUserProvider
│
├── App.jsx       Root component, flat comments[] state,
│                 all mutation callbacks, buildCommentTree
│
├── api/
│   client.js     Fetch helpers — getUsers, getComments,
│                 createComment, voteComment, editComment,
│                 deleteComment
│
├── boxes/
│   NewCommentBox Top-level input, always visible
│   ReplyBox      Per-comment reply input, toggled
│
├── comments/
│   CommentList          Iterates threads, passes props
│   CommentThread        Root + replies with reply toggle
│   ScoreControl         [-] score [+] with per-comment
│                        in-flight state
│   buildCommentTree.js  Pure function: walk-to-root
│                        partition, id-ASC order
│
├── context/
│   CurrentUserContext   Provides user, users, setUser, loading
│
├── header/
│   UserPicker           Native <select> — zero custom JS,
│                        fully accessible
│
├── modal/
│   ConfirmModal         Reusable overlay for delete confirmation
│
├── utils/
│   relativeTime.js      ISO string → "X minutes ago"
│
tests/
  comments.test.js           Backend integration (47 tests)
  buildCommentTree.test.js   Pure function unit tests (7 tests)
docs/
  adr/                       Six recorded decisions
  prompts/                   Build prompts used in development
```

---

## Architectural decisions (ADRs)

Every significant design choice was deliberated and recorded. The six ADRs in
`docs/adr/` capture the *why* behind each trade-off:

| # | Decision | Key insight |
|---|----------|-------------|
| 0001 | Pickable identity without authentication | Smallest step that makes voting real — auth is its own skill, scoped out |
| 0002 | Two-pass architecture (hand-rolled → Supabase) | Double backend effort traded for learning what Supabase abstracts away |
| 0003 | Computed score via live SUM | No stored cache = zero drift; toggle/swing are free; scale-irrelevant here |
| 0004 | React frontend via Vite proxy | Same-origin in dev, same contract in prod, trivially maps to Supabase swap |
| 0005 | Identity via query parameter | Uniform across all endpoints; trivially removable when real auth arrives |
| 0006 | Flat replies with walk-to-root | Backend stays simple; true nested rendering is a client-only change |

---

## Design philosophy

This codebase was built with deliberate constraints:

**Minimal dependencies.** Express + better-sqlite3 on the backend. React on the
frontend. Zero utility libraries, zero CSS frameworks. Every line of code
earns its place — nothing is abstracted "because it might be needed later."

**Testable by construction.** The Express app factory accepts a `Database`
instance, so every handler runs against a fresh in-memory database in ~1ms
setup. No mocks, no stubs, no fixtures — real SQL, real responses, real
assertions. This is the difference between "unit tests that check the code I
wrote" and "integration tests that prove the code works."

**Contract over implementation.** The frontend knows nothing about SQLite,
Postgres, or Supabase. It talks to URLs and JSON shapes. This means the
backend can be replaced entirely and no React component changes. The test
suite is the contract verification — green on Pass 2 means the swap is
complete.

**Ponytail engineering.** Judicious laziness — a `<select>` over a custom
dropdown, a 15-line `relativeTime` over a date library, `O(n²)` scans over a
Map where the data is 10 items. The shortest correct path is the right path.

---

## What's next (Pass 2)

The second pass swaps the backend to local Supabase (Postgres + auto-REST):

1. Run `supabase start` — local Postgres + schema auto-migration
2. Port the three `CREATE TABLE` statements to Postgres
3. Supabase auto-generates the REST API — no Express, no handlers
4. Re-point the frontend data layer to the Supabase client SDK
5. Run the same 47 tests — green = swap verified

The learning is in the diffs: which tests break reveal where Supabase deviates
from the hand-rolled contract.
