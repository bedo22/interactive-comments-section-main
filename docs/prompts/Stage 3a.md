You are building Slice 3a of a React + Express comments app. STOP after this
stage — do not do 3b or any other slice. This stage is backend-only.

BEFORE WRITING ANY CODE, read these files in full:

- PLAN.md section 4 (the POST /comments/:id/vote spec) and section 6 Slice 3
- docs/adr/0003-computed-score-via-live-sum.md
- docs/adr/0005-identity-via-query-parameter.md
- server/schema.sql (the votes table: composite PK on user_id+comment_id,
  CHECK value IN (-1, 1))
- server/app.js (match the existing createApp style; reuse toCamelCase and
  the prepared-statement pattern from POST /comments)
- tests/comments.test.js (match the existing POST describe block style)

YOUR TASK — add POST /comments/:id/vote:

1. In server/app.js, add a POST route for /comments/:id/vote (NO /api prefix —
   the Vite proxy and prod static server add it; tests call createApp directly).
2. Read userId from req.query.userId and value from req.body.value.
3. Validation, all returning the right status with a JSON { error } body:
   - Missing/non-numeric/unknown userId → 400.
   - :id does not match a real comment → 404.
   - value missing, or not exactly -1 or 1 → 400.
4. Vote semantics (this is the tricky part — implement carefully):
   - If the user has NO existing vote on this comment → INSERT the vote.
   - If the user HAS an existing vote with the SAME value → DELETE it (toggle off).
   - If the user HAS an existing vote with the OPPOSITE value → UPDATE it
     (swing by 2: removing -1 and adding +1 changes score by +2).
     Use INSERT ... ON CONFLICT DO UPDATE/DELETE based on the existing row, or
     SELECT-then-decide — either is fine, but the three cases must be covered.
5. After the mutation, re-query the comment's score (SUM(value)) and the
   acting user's vote, the same way GET /comments does.
6. Return 200 with { commentId, score, yourVote } where yourVote is null if
   the vote was toggled off.
7. Add a new describe('POST /comments/:id/vote') block in tests/comments.test.js
   with these 9 tests (match existing style):
   - upvotes a comment with value=1 → 200, score +1, yourVote=1
   - downvotes a comment with value=-1 → 200, score -1, yourVote=-1
   - repeating the same value toggles the vote off → yourVote=null, score back to baseline
   - opposite value swings by 2 → yourVote flips, score changes by 2
   - rejects missing userId → 400
   - rejects unknown userId → 400
   - rejects invalid value (0, 2, "foo") → 400
   - rejects vote on nonexistent comment → 404
   - persists: GET /comments?userId=X reflects the vote in both score and yourVote

DO NOT touch any src/ files. DO NOT add edit/delete. DO NOT add the /api prefix.

ACCEPTANCE: `pnpm test` shows all previous tests still green + 9 new vote tests
green. Stop and report, including the full list of test names that pass.
