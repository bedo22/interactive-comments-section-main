# Implementation Plan

This document is the synthesis of the grilling session. Every decision here was reached through deliberate trade-off, and is recorded in `CONTEXT.md` (the glossary) and `docs/adr/` (architectural decision records). Read `CONTEXT.md` first if a term is unclear — it is the source of truth for the domain language.

---

## 0. The two-pass architecture

```
                     ┌─────────────────────────────────────────┐
                     │  FRONTEND (React) — built ONCE          │
                     │  Talks to "the contract," doesn't care  │
                     │  which backend is plugged in.           │
                     └───────────────────┬─────────────────────┘
                                         │ HTTP + JSON (the contract)
                                         │
           ┌─────────────────────────────┴─────────────────────────────┐
           │                                                           │
   ┌───────▼────────────────┐                          ┌────────────────▼─────────────┐
   │  PASS 1 (hand-rolled)  │                          │  PASS 2 (Supabase, later)   │
   │  Express + SQLite      │  ←—— same contract ——→   │  Postgres + auto-REST       │
   │  You write the SQL     │                          │  SQL is auto-generated      │
   │  You write the handlers│                          │  from the schema            │
   │  Integration tests live│                          │  Run the SAME test suite    │
   │  HERE                  │                          │  to verify the swap         │
   └────────────────────────┘                          └─────────────────────────────┘
```

**Order is mandatory:** Pass 1 first. Supabase's abstractions are invisible until you've felt the pain they solve.

**The frontend is built once.** Only the data-fetching layer changes between passes (URLs in Pass 1, Supabase client SDK in Pass 2).

---

## 1. Pass 1 — database schema

Three tables. Plain SQLite, single file (`comments.db`).

```sql
-- Users: the four seeded people, plus any future ones.
CREATE TABLE users (
  id        INTEGER PRIMARY KEY,
  username  TEXT UNIQUE NOT NULL,
  avatar    TEXT NOT NULL              -- path to the avatar image
);

-- Comments: ONE table for both top-level comments and replies.
-- A reply is just a comment whose parent_id is non-null.
CREATE TABLE comments (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  parent_id   INTEGER,                 -- NULL = top-level; a value = it's a reply
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL,           -- ISO 8601 string, UTC. Server generates.
  edited_at   TEXT,                    -- NULL = never edited; set on first edit
  deleted_at  TEXT,                    -- NULL = live; a value = tombstone (soft delete)
  FOREIGN KEY (user_id)   REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

-- Votes: one row per (user, comment). This is what the score is derived from.
CREATE TABLE votes (
  user_id     INTEGER NOT NULL,
  comment_id  INTEGER NOT NULL,
  value       INTEGER NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (user_id, comment_id),   -- enforces "one vote per user per comment"
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (comment_id) REFERENCES comments(id)
);
```

**What is deliberately NOT a column:**
- `score` — derived via `SUM(value)` on `votes`. Never stored. (See ADR candidate: "computed score".)
- `replyingTo` — derived from the parent's author. Never stored.
- A separate `replies` table — replies are comments. The `parent_id` column is the entire distinction.

---

## 2. Pass 1 — API contract (flat response)

Base URL: `http://localhost:3000`. All requests and responses are JSON. The Acting User's `userId` travels in the request body (not auth headers — see ADR-0001).

### `GET /users`
List all users (for the header user picker).
```json
[
  { "id": 1, "username": "amyrobson",    "avatar": "/images/avatars/amyrobson.png" },
  { "id": 2, "username": "maxblagun",    "avatar": "/images/avatars/maxblagun.png" },
  { "id": 3, "username": "ramsesmiron",  "avatar": "/images/avatars/ramsesmiron.png" },
  { "id": 4, "username": "juliusomo",    "avatar": "/images/avatars/juliusomo.png" }
]
```

### `GET /comments?userId=X`
Returns the **flat** list of all comments (top-level + replies + tombstones), each with its derived score and the Acting User's vote. `userId` is optional; if omitted, `yourVote` is `null` everywhere.

```json
[
  {
    "id": 2,
    "userId": 2,
    "author": "maxblagun",
    "avatar": "/images/avatars/maxblagun.png",
    "parentId": null,
    "content": "Woah, your project looks awesome! ...",
    "createdAt": "2026-05-20T09:15:00.000Z",
    "editedAt": null,
    "deletedAt": null,
    "score": 5,
    "yourVote": 1
  },
  {
    "id": 3,
    "userId": 3, "author": "ramsesmiron", "avatar": "...",
    "parentId": 2,
    "content": "@maxblagun ...",
    "createdAt": "...", "editedAt": null, "deletedAt": null,
    "score": 3, "yourVote": null
  }
]
```

The frontend calls `buildCommentTree(thisArray)` to get the nested shape for rendering.

### `POST /comments` — create a comment or reply
Request body:
```json
{ "userId": 4, "content": "New comment text", "parentId": null }
```
- `parentId: null` → top-level comment.
- `parentId: <id>` → reply.
Response: `201 Created` + the created comment row (same shape as one element of `GET /comments`, with `yourVote: null`).

### `POST /comments/:id/vote` — cast or change a vote
Request body:
```json
{ "userId": 4, "value": 1 }
```
- `value` must be `-1` or `1` (CHECK constraint + app validation).
- Repeating a vote **toggles it off** (deletes the row). Same value again = remove the vote.
- Opposite value = replace (swing by 2).
Response: `200 OK`:
```json
{ "commentId": 3, "score": 5, "yourVote": 1 }
```
(`yourVote` is `null` if the vote was toggled off.)

### `PATCH /comments/:id` — edit content
Request body:
```json
{ "userId": 4, "content": "edited text" }
```
- Authorization: `userId` must equal the comment's `user_id` AND `deleted_at` must be null. Otherwise `403`.
- Sets `edited_at` to now on first edit (leave the existing timestamp on subsequent edits).
Response: `200 OK` + the updated comment row.

### `DELETE /comments/:id` — soft delete (tombstone)
Request body:
```json
{ "userId": 4 }
```
- Authorization: `userId` must equal the comment's `user_id`. Otherwise `403`.
- Sets `deleted_at` to now. Row, content, and all descendant replies remain intact.
Response: `204 No Content`.

**Every query uses parameterized statements (`?`). No string concatenation of user input, ever.**

---

## 3. Pass 1 — test plan

Scope: **backend integration only.** Tooling: `supertest` + Vitest (or Jest) + `:memory:` SQLite, reset in `beforeEach`.

The test suite **is the contract.** When Pass 2 swaps to Supabase, you run this same suite against the new backend; green = swap verified.

### Test isolation
```js
beforeEach(async () => {
  db = new Database(':memory:');
  runSchema(db);          // CREATE TABLE users / comments / votes
  seedTestData(db);       // insert the 4 users + sample comments + sample votes
  app = createApp(db);    // Express app wired to this db
});
```

### The test list (~25 tests)

**Reading**
- `GET /comments` returns a flat array.
- Each row includes `score`, `author`, `parentId`, `createdAt`, `editedAt`, `deletedAt`.
- Deleted comments are included (tombstones travel through).
- `yourVote` reflects the Acting User's vote when `?userId=` is passed.

**Voting**
- POST +1 → score increments by 1.
- POST +1 again from same user → vote toggled off, score back to original.
- POST +1 then -1 from same user → score swings by 2.
- POST vote from non-existent user → 400/404.
- POST `value: 5` → 400 (validation rejects).

**Creating**
- POST a top-level comment → appears in `GET` with `parentId: null`, correct `userId`/`author`.
- POST a reply → appears with correct `parentId`.
- POST with empty content → 400.

**Editing**
- PATCH own comment → content updates, `editedAt` set.
- PATCH another user's comment → 403.
- PATCH a deleted comment → 403.
- PATCH a non-existent comment → 404.

**Deleting**
- DELETE own comment → `deleted_at` set, row still present, replies still present.
- DELETE another user's comment → 403.
- DELETE a comment that has replies → succeeds; replies survive and are still readable.

**Identity**
- Any mutation without `userId` → 400.
- `GET /users` returns all four seeded users.

---

## 4. Seed data migration (`data.json` → SQLite)

`data.json` is a *frontend fixture* — its shape does not match our schema. It needs translating:

| `data.json` field | Becomes |
|---|---|
| `currentUser` | Ignored — no single current user; identity is pickable. |
| `comments[].user.username` | `users.username` row |
| `comments[].user.image.png` | `users.avatar` (store the path) |
| `comments[]` (top-level) | `comments` rows with `parent_id = NULL` |
| `comments[].replies[]` | `comments` rows with `parent_id` = parent's id |
| `replyingTo` | Discarded — derived on the frontend. |
| `createdAt: "1 month ago"` | Converted to an ISO timestamp (approximate — the original is lossy). |
| `score` | Not stored directly — represented by inserting that many votes. |

**Wrinkle on scores:** each user can only cast one vote per comment (PK constraint). To reach a score of 5 you'd need 5 distinct upvoters, but we only seed 4 users. **Resolution:** don't try to match `data.json` scores exactly. Seed a handful of votes from the real users to demonstrate the feature, and let the scores be whatever they sum to. The exact seed numbers are cosmetic; what matters is that voting *works*.

---

## 5. Pass 1 → Pass 2 roadmap (Supabase)

Goal: feel what Supabase abstracts away by swapping it in for the *same* contract.

1. **Run local Supabase** (Docker-based, `supabase start`). Gives you local Postgres + auto-generated REST API + Studio (a DB UI).
2. **Port the schema** — the three `CREATE TABLE` statements run nearly verbatim in Postgres (swap `INTEGER PRIMARY KEY` for `SERIAL`/`GENERATED ALWAYS AS IDENTITY`; the rest is standard).
3. **The REST API is auto-generated.** No Express, no handlers. Supabase reads your schema and exposes `/comments`, `/votes`, etc. automatically. This is the moment you *feel* what Pass 1 taught you: all that routing, validation, and handler code is gone.
4. **Re-point the frontend's data layer** from `fetch('/comments')` to the Supabase client SDK. The React components, `buildCommentTree`, tombstone rendering, relative-time formatting — all unchanged.
5. **Run the test suite** against the Supabase-backed API. The tests are the same contract; if they pass, the swap is verified. The ones that fail reveal where Supabase's defaults differ from your hand-rolled behavior (e.g. row-level security, default ordering, error shapes) — and those differences are the lesson.

**Auth stays out of scope in both passes.** The pickable-identity model (ADR-0001) carries over to Pass 2.

---

## 6. Suggested build order (vertical slices)

Each slice is independently shippable and testable. Do not build the whole backend then the whole frontend — build one slice end-to-end.

1. **Schema + seed + `GET /users` + `GET /comments` (flat).** First integration test: "GET returns the seeded comments with correct scores." Frontend: render the tree read-only.
2. **`POST /comments` + reply rendering.** Frontend: new comment box + reply box.
3. **Voting (`POST /comments/:id/vote`).** Frontend: +/- buttons wired to score. Toggle behavior tested.
4. **Editing (`PATCH /comments/:id`).** Frontend: edit mode toggle.
5. **Deleting (`DELETE /comments/:id`) + tombstones + delete modal.** Frontend: confirmation modal, tombstone render state.
6. **User picker in the header.** Authorization (edit/delete only for the author) becomes visible.
7. **Relative-time formatting on the frontend** (can slot in anytime after slice 1).

---

## 7. ADRs written

- `docs/adr/0001-pickable-identity-without-authentication.md` — the server trusts the stated `userId`; no real auth.

**ADR candidates not yet written** (offer sparingly — these are the two most decision-worthy):
- **Two-pass architecture** (Pass 1 hand-rolled, Pass 2 Supabase). Hard to reverse, surprising, real tradeoff (double effort vs. learning contrast).
- **Computed score via live SUM, not a stored column.** Surprising (most apps cache), real tradeoff (perf vs. correctness, discussed at length).

Say the word and I'll record either or both.
