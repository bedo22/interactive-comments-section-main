# Interactive Comments Section

A full-stack comments widget where users post comments, reply (to any nesting depth), vote on comments, and edit or delete their own comments.

## Language

**Comment**:
A single piece of content posted by a User, with a Score and a timestamp. Has at most one Parent.
_Avoid_: Post, message, entry

**Reply**:
A Comment whose Parent is non-null. Not a separate entity — it lives in the same table as top-level Comments and shares every field. The only thing that makes it a "reply" is that it has a Parent.
_Avoid_: Sub-comment, nested comment, response

**Top-level Comment**:
A Comment with no Parent. Appears at the root of the Thread.
_Avoid_: Root comment, main comment

**Parent**:
The Comment that a Reply directly responds to. A Reply has exactly one Parent; a top-level Comment has none. Nesting depth is unlimited — a Reply's Parent may itself be a Reply.
_Avoid_: Ancestor (an ancestor is broader — parent, grandparent, etc.)

**replyingTo**:
The username of a Reply's Parent's Author. Derived from the Parent — never stored. Shown in the UI as "@username" at the start of a reply.
_Avoid_: Mention, addressee (a mention is a different, broader concept)

**Author**:
The User who wrote a Comment. Every Comment has exactly one Author. Only the Author may edit or delete their own Comments; the Acting User must equal the Author for those operations to be permitted.
_Avoid_: Poster, owner

**Deleted Comment** (soft delete):
A Comment whose `deleted_at` is set to a timestamp. The row and all of its descendant Replies remain intact in storage; nothing is removed or orphaned. Deleted Comments render in the UI as Tombstones. Deleting never cascades to children (that would destroy other Users' content) and is never blocked by the presence of children (that would deadlock the app).
_Avoid_: Removed comment, archived comment, hard-deleted row

**Tombstone**:
The UI render state for a Deleted Comment — a visible row standing in for the original, showing placeholder content such as "[deleted]" rather than the original text, while preserving the Comment's place in the Thread and keeping any Replies beneath it properly threaded and readable. Tombstones are shown rather than hidden, so the pattern is visible and the conversation's integrity is preserved.
_Avoid_: Placeholder, stub, ghost (too vague)

**User**:
A person identified by username and avatar who writes Comments and votes. Multiple Users exist (the seed ships four: amyrobson, maxblagun, ramsesmiron, juliusomo).
_Avoid_: Account, member

**Acting User**:
The User the UI is currently operating as — the value selected in the header user-picker. Drives authorization: only the Acting User may edit or delete their own Comments, and every Vote and Comment is attributed to the Acting User. Not authentication — the server trusts the stated identity; it does not verify it.
_Avoid_: Logged-in user, current user, session user (these imply real authentication, which is explicitly out of scope)

**Score**:
The integer net vote tally shown on a Comment — the sum of all Vote values cast on it. Not stored as a column; computed live by summing the Votes table. Single source of truth is the Votes table.
_Avoid_: Rating, likes, points, cached score

**Vote**:
A User's judgment on exactly one Comment, with a Value of +1 (upvote) or -1 (downvote). Each User may cast at most one Vote per Comment — casting again replaces the previous Value (toggle). Together, all Votes on a Comment sum to its Score.
_Avoid_: Like, reaction, rating

**Value** (of a Vote):
Either +1 or -1. A Vote always has exactly one Value, never 0.
_Avoid_: Direction, weight

**Thread**:
A top-level Comment together with all of its descendant Replies.
_Avoid_: Conversation, discussion

## API shape

**Flat Response**:
The shape of `GET /comments` — an array of Comment rows as they live in storage, each knowing only its own `parent_id`, with no nesting. The server returns this shape directly from one query; it does not build a tree, compute `replyingTo`, or attach derived presentation fields. The API speaks data (storage shape); the client decides shape (presentation).
_Avoid_: Nested response, tree response

**Comment Tree**:
The nested structure the frontend builds from a Flat Response for rendering — top-level Comments each carrying a `replies` array, whose entries may carry their own `replies`, to any depth. Built client-side by `buildCommentTree(flatComments)`, not stored or sent by the API.
_Avoid_: Comment list, comment structure (too generic)

## Frontend

**Frontend Stack**:
React. Chosen because the UI is highly stateful (per-comment score, vote, edit/reply/delete modes, tombstones, modal, user picker) and React's UI = f(state) model eliminates the manual state↔DOM sync that vanilla JS would require. Built once and reused identically across Pass 1 and Pass 2 — only the data layer (fetch URLs / Supabase client) changes between passes.
_Avoid_: UI library, view layer (too generic)

## Testing

**Integration Test**:
A test that exercises the backend (Express handlers + SQLite) together, using real dependencies rather than mocks. Sends a real HTTP request via `supertest` (which calls the Express app in-process, no real port) against a real SQLite database, and asserts on the actual JSON response and persisted state. Catches wrong SQL, broken authorization, bad status codes, and incorrect JSON shapes — things mocks cannot catch because mocks don't run real SQL.
_Avoid_: Unit test (those isolate one function with mocked dependencies), E2E test (those spin up a real browser)

**Test Database**:
An in-memory SQLite database (`new Database(':memory:')`) created fresh before every test via a `beforeEach` hook that recreates the schema and re-seeds. Runs the same SQLite engine as production (no realism gap, since SQLite is a library either way), but in RAM — fastest possible feedback, zero cleanup, no port collisions. Each test is independent and debuggable because it starts from a known pristine state.
_Avoid_: Mock database (doesn't run real SQL), production database (must never be touched by tests)

## Time

**CreatedAt** (of a Comment):
The absolute moment a Comment was first posted, stored as an ISO 8601 string in UTC (e.g. `2026-06-17T14:30:00.000Z`), generated by the server via `new Date().toISOString()`. The single source of truth for "when." Not editable.
_Avoid_: Date, time, timestamp (too generic), "X ago" string (that is the derived display value, not the stored value)

**Relative Time** (of a Comment):
The human-readable relative phrasing shown in the UI — "just now", "2 days ago", "1 month ago" — **derived** from the Comment's CreatedAt at the moment of render. Computed by the frontend, never stored and never sent by the API. The seed data's `"createdAt": "1 month ago"` field is a display artifact, not a storage format.
_Avoid_: CreatedAt, age, time-ago
