You are building Stage 2c, the final stage of slice 2. Stages 2a (read-only
frontend) and 2b (POST backend) are DONE and committed — do not redo them.

BEFORE WRITING ANY CODE, read these files in full:

- PLAN.md section 6 Stage 2c
- docs/adr/0001-pickable-identity-without-authentication.md
- docs/adr/0004-react-frontend-via-vite-proxy.md (the CurrentUserContext part)
- docs/adr/0005-identity-via-query-parameter.md
- src/App.jsx and src/comments/\* from stage 2a (understand the existing
  state shape before extending it)
- server/app.js POST route from stage 2b (know the exact request/response shape)

YOUR TASK — add the new-comment box + reply box, wired to POST:

1. Create src/api/client.js with fetch helpers. Every call appends
   ?userId=${currentUser.id} per ADR-0005. Expose at least:
   - getComments(userId) → GET /api/comments?userId=X
   - createComment(userId, { content, parentId }) → POST /api/comments?userId=X
2. Create src/context/CurrentUserContext.jsx exporting a Provider and a
   useCurrentUser() hook (throws if used outside the provider). Seed it with
   the first user from GET /api/users for now — the real picker comes in a
   later slice. Wrap the app in the provider in main.jsx.
3. Create src/boxes/NewCommentBox.jsx — always visible at the bottom/top of
   the list. Textarea + Send button.
4. Create src/boxes/ReplyBox.jsx — toggled by a "Reply" link on each comment.
5. Box behavior (both): Send is disabled when content trimmed-empty. On click,
   disable the box + show Send as loading, await the POST, then on 201 clear
   the textarea and call appendComment(returnedRow). On failure, re-enable
   and show the error. NO optimistic insert — await the round-trip.
6. Update App.jsx to own appendComment(row) → setComments(prev => [...prev, newComment])
   and thread it down to the boxes as a prop. Refactor App's fetch to use
   src/api/client.js and to pass the current user's id.
7. CommentThread renders a Reply button on each comment; clicking toggles a
   ReplyBox below it. The ReplyBox calls createComment with parentId = that
   comment's id.

DO NOT add voting, edit, delete, or the user picker. DO NOT change server code.

ACCEPTANCE: type a top-level comment in the new box → it appears in the list.
Click Reply on a comment → type → it appears threaded under that comment's
root (per ADR-0006 flattening). Reply to a reply → it lands in the SAME
thread's replies column. Empty Send stays disabled. Stop and report.

Nits continued (non-blocking) 2. Only one reply box can be open at a time (per thread). Look at CommentThread.jsx lines 6, 14-16, 26-28: there's a single replyingTo state shared between the root and all its replies. Click "Reply" on the root → opens. Click "Reply" on a reply → it closes the root's box and opens the reply's box. This is actually a reasonable UX choice (Reddit does this), but it's worth knowing it's intentional — if you ever want multiple boxes open simultaneously, each Comment would need its own isReplyOpen state instead of the shared replyingTo. Not a bug, a design decision. Leave it.

3. Missing trailing newlines (\ No newline at end of file). The diff showed this on App.jsx, CommentList.jsx, CommentThread.jsx, main.jsx. Cosmetic — most editors add one automatically on next edit. Won't fix.

4. The @{root.author} shows the author's username as their @handle (CommentThread line 42) — but in data.json, replies have a separate replyingTo field. For now this is placeholder; the real "replying to @X" display is a styling-slice concern. Fine.
