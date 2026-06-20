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

Base URL: `http://localhost:3000`. All requests and responses are JSON. The Acting User's `userId` travels as the **`?userId=` query parameter on every request** — reads and mutations alike (see ADR-0001 for the pickable-identity model and ADR-0005 for why a query param, not the body).

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
Returns the **flat** list of all comments (top-level + replies + tombstones), each with its derived score and the Acting User's vote. `userId` is optional; if omitted, `yourVote` is `null` everywhere. Rows return `ORDER BY id ASC` (insertion order ≈ chronological) so the frontend can partition in order without sorting (ADR-0006).

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

> **Design note — `avatar` is duplicated per comment row.** Each comment row carries `author` *and* `avatar` *and* `userId`, even though the avatar is a property of the user, not the comment. This is a deliberate choice for Pass 1 simplicity: the frontend gets everything it needs to render a comment from a single `GET /comments` response, with no second fetch and no client-side assembly.
>
> **The alternative is a "client-side join":** the API would return comments with only `userId` (no `avatar`), and the frontend would separately fetch `GET /users`, build a `Map` of `userId → avatar`, and look up each comment's avatar while rendering — the same pattern as `buildCommentTree`, applied to users. This avoids the duplication and keeps the API purely normalized, at the cost of a second fetch and one more piece of frontend state to manage.
>
> We chose duplication because (a) there are only four users, so the duplicated bytes are trivial; (b) a comment row is meaningfully "the author's words + the author's face," so co-locating them is not unnatural; (c) Pass 1 should optimize for clarity, not normalization. **This is a soft call, not an ADR** — if the user count ever grew large, the client-side-join alternative becomes obviously better, and the change is small (drop the `u.avatar AS avatar` from the query, fetch `/users` on the frontend, build the map).

### `POST /comments?userId=X` — create a comment or reply
Request body:
```json
{ "content": "New comment text", "parentId": null }
```
- `userId` (the author) comes from the query param, not the body (ADR-0005).
- `parentId: null` → top-level comment.
- `parentId: <id>` → reply. May point at **any** existing comment regardless of depth — the backend enforces no nesting limit, and the frontend collapses descendants into a single "replies" column (ADR-0006).

**Validation (all → `400`):**
- Missing or unknown `userId`.
- Empty / whitespace-only `content` (otherwise `NOT NULL` would throw).
- `parentId` present but pointing at a nonexistent comment (validate existence explicitly — a reply to a missing comment is a client error, not a 500). **Tombstoned parents are allowed** — you may reply into a thread whose root was soft-deleted.

Response: `201 Created` + the **full comment row** in the same shape as one element of `GET /comments` (id, userId, author, avatar, parentId, content, createdAt, editedAt: null, deletedAt: null, score: 0, yourVote: null). Returning the full row lets the frontend append it to local state without a refetch.

### `POST /comments/:id/vote?userId=X` — cast or change a vote
Request body:
```json
{ "value": 1 }
```
- `userId` comes from the query param (ADR-0005).
- `value` must be `-1` or `1` (CHECK constraint + app validation).
- Repeating a vote **toggles it off** (deletes the row). Same value again = remove the vote.
- Opposite value = replace (swing by 2).
Response: `200 OK`:
```json
{ "commentId": 3, "score": 5, "yourVote": 1 }
```
(`yourVote` is `null` if the vote was toggled off.)

### `PATCH /comments/:id?userId=X` — edit content
Request body:
```json
{ "content": "edited text" }
```
- `userId` comes from the query param (ADR-0005).
- Authorization: `userId` must equal the comment's `user_id` AND `deleted_at` must be null. Otherwise `403`.
- Sets `edited_at` to now on first edit (leave the existing timestamp on subsequent edits).
Response: `200 OK` + the updated comment row.

### `DELETE /comments/:id?userId=X` — soft delete (tombstone)
No request body required.
- `userId` comes from the query param (ADR-0005).
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
| `score` | Not stored directly. A handful of explicit demo votes are seeded to exercise the feature, but the fixture's `score` number is NOT reproduced — it is cosmetic display data, and `score` is derived from real votes via `SUM(value)` (ADR-0003). |

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

1. **Schema + seed + `GET /users` + `GET /comments` (flat).** First integration test: "GET returns the seeded comments with correct scores." ✅ **Backend done.** ⚠️ **The frontend half of this slice (render the tree read-only) was deferred — it is picked up as stage 2a below.**
2. **`POST /comments` + reply rendering.** This slice is built in **three staged commits** (full architecture in ADR-0004/0005/0006):
   - **Stage 2a — React skeleton, read-only (closes slice 1's frontend gap).** Bootstrap Vite (`vite.config.js` with the `/api` proxy, `index.html` at root), add React deps, create `src/main.jsx` + `App.jsx` (owns the flat `comments[]` state + `useEffect` fetch), `src/comments/buildCommentTree.js` (the walk-to-root partitioner, `.js` pure logic) with its own unit test `tests/buildCommentTree.test.js`, `CommentList.jsx` + `CommentThread.jsx` rendering the seeded tree. Run `pnpm dev`, see the seeded comments render, no boxes yet. **No backend changes.**
   - **Stage 2b — `POST /comments` backend + tests.** Add the route to `server/app.js` (validates `?userId=` exists, content non-empty, `parentId` exists if supplied; returns full row, 201). Add 8 tests in a new `describe('POST /comments')` block in `tests/comments.test.js`: top-level create, reply create, reply-to-reply (proves flat depth), missing userId →400, unknown userId →400, empty content →400, nonexistent parentId →400, persistence (POST then GET finds it). Run `pnpm test`, see 8 new green tests. **No frontend changes.**
   - **Stage 2c — Wire the two boxes.** Add `src/api/client.js` (fetch helpers appending `?userId=`), `src/context/CurrentUserContext.jsx`, `src/boxes/NewCommentBox.jsx` (top-level, always visible), `src/boxes/ReplyBox.jsx` (per-comment, toggled by a Reply button). Boxes: disable Send on trimmed-empty content, disable + loading while POST in flight, clear + `appendComment(returnedRow)` on 201, no optimistic insert. Type a reply, watch it POST and appear threaded.
3. **Voting (`POST /comments/:id/vote`).** Frontend: +/- buttons wired to score. Toggle behavior tested.
4. **Editing (`PATCH /comments/:id`).** Frontend: edit mode toggle.
5. **Deleting (`DELETE /comments/:id`) + tombstones + delete modal.** Frontend: confirmation modal, tombstone render state.
6. **User picker in the header.** Authorization (edit/delete only for the author) becomes visible. Picks the `CurrentUserContext` value.
7. **Relative-time formatting on the frontend** (can slot in anytime after slice 1).

---

## 7. ADRs written

- `docs/adr/0001-pickable-identity-without-authentication.md` — the server trusts the stated `userId`; no real auth.
- `docs/adr/0002-two-pass-architecture.md` — Pass 1 hand-rolled (Express + SQLite), Pass 2 swaps to local Supabase against the same contract. Double backend effort traded for learning what Supabase abstracts away.
- `docs/adr/0003-computed-score-via-live-sum.md` — Score is `SUM(value)` over `votes`, never stored as a column. One source of truth, no drift, scale-irrelevant for this app.
- `docs/adr/0004-react-frontend-via-vite-proxy.md` — React served by Vite in dev (proxies `/api` → Express on `:3000`) and by Express in prod. Same-origin everywhere, never any CORS, maps directly onto the Pass 2 swap. Includes the frontend state architecture (CurrentUserContext, flat-array source of truth, tree derived per-render) and file layout.
- `docs/adr/0005-identity-via-query-parameter.md` — `?userId=` on every request, reads and mutations alike. Uniform, trivially removable for Pass 2 auth. Supersedes the original "identity in the body" plan.
- `docs/adr/0006-flat-replies-with-walk-to-root.md` — `parentId` may point at any existing comment (no depth limit); `buildCommentTree` walks each reply to its root and collapses descendants into a single indented replies column, preserving server `id ASC` order.
