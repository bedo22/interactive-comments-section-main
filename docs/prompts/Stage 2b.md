You are building Stage 2b of a React + Express comments app. STOP after this
stage — do not do 2c. This stage is backend-only.

BEFORE WRITING ANY CODE, read these files in full:

- PLAN.md section 4 (the POST /comments spec) and section 6 Stage 2b
- docs/adr/0005-identity-via-query-parameter.md
- docs/adr/0006-flat-replies-with-walk-to-root.md
- server/app.js (extend the existing createApp; match its style)
- server/schema.sql (know the columns and constraints)
- tests/comments.test.js (match the existing test setup — beforeEach reseeds
  an in-memory DB; use supertest against createApp)

YOUR TASK — add POST /comments:

1. In server/app.js, add a POST route for /comments (the /api prefix is added by
   the Vite proxy in dev and Express static in prod — do NOT put /api in the
   route itself; tests call createApp directly so the bare /comments path is correct).
2. Read userId from req.query.userId (NOT the body). Author = that user.
3. Read { content, parentId } from req.body.
4. Validation, all returning 400 with a JSON { error } body:
   - Missing or non-numeric userId, OR userId not in users table → 400.
   - content missing, not a string, or trimmed-empty → 400.
   - parentId present (not null/undefined) but no comment with that id exists → 400.
   - parentId: null is valid (top-level comment).
   - Tombstoned parents (deleted_at not null) ARE allowed as parentId.
5. Insert the row: user_id, parent_id (null if absent), content, created_at = now,
   edited_at = null, deleted_at = null.
6. Return 201 with the full comment row in the SAME shape as a GET /comments
   element: { id, userId, author, avatar, parentId, content, createdAt,
   editedAt: null, deletedAt: null, score: 0, yourVote: null }. (Re-use the
   same toCamelCase + score subquery logic GET already uses; score is 0 and
   yourVote is null because it's brand new.)
7. Add a new describe('POST /comments') block in tests/comments.test.js with
   exactly these 8 tests (match existing style):
   - creates a top-level comment (201 + full row shape)
   - creates a reply (parentId survives round-trip)
   - creates a reply to a reply (proves flat-depth works — ADR-0006)
   - rejects missing userId → 400
   - rejects unknown userId → 400
   - rejects empty/whitespace content → 400
   - rejects nonexistent parentId → 400
   - persists: POST then GET /comments finds the new comment by id

DO NOT touch any src/ files. DO NOT add the /api prefix to routes. DO NOT add
vote/edit/delete.

ACCEPTANCE: `pnpm test` shows all original tests still green + 8 new POST tests
green. Stop here and report what you built, including the full list of test
names that pass.
