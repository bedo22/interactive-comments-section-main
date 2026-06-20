You are building Stage 2a of a React + Express comments app. STOP after this
stage — do not do 2b or 2c.

BEFORE WRITING ANY CODE, read these files in full:

- PLAN.md (especially section 6, Stage 2a; and the API contract in section 4)
- docs/adr/0004-react-frontend-via-vite-proxy.md
- docs/adr/0006-flat-replies-with-walk-to-root.md
- server/app.js (the existing GET /comments endpoint you'll be fetching from)
- data.json (to understand the shape of seeded data)
- tests/comments.test.js (the existing test style to match)

YOUR TASK — bootstrap a read-only React frontend that renders the seeded comments tree:

1. Add deps: react, react-dom (runtime); vite, @vitejs/plugin-react, concurrently (dev).
2. Create vite.config.js at the repo root with the React plugin + an /api proxy that
   forwards to http://localhost:3000 and STRIPS the /api prefix (rewrite path).
3. Replace index.html at the repo root with a Vite entry that loads /src/main.jsx.
   Drop the Frontend Mentor attribution footer entirely — it is not wanted.
4. Create src/main.jsx (mounts <App/>) and src/App.jsx.
   - App owns a flat comments[] array in useState, fetched via useEffect from
     /api/comments (no userId query param yet — that's stage 2c).
   - App derives the tree by calling buildCommentTree(comments) on each render.
     Do NOT store the tree in state.
5. Create src/comments/buildCommentTree.js — a .js file (pure logic, no JSX).
   Implements walk-to-root per ADR-0006: for each comment with a parentId,
   follow the chain up to parentId === null; group all comments sharing a root.
   Preserve server id-ASC order within each group. Return an array of
   { root, replies: [] } in id-ASC order.
6. Create tests/buildCommentTree.test.js — unit tests for the partitioner,
   matching the style of tests/comments.test.js. Cover: a single root with no
   replies, a root with direct replies, a reply-to-a-reply collapsing under
   the same root, order preserved.
7. Create src/comments/CommentList.jsx (maps threads) and
   src/comments/CommentThread.jsx (renders one root + its replies).
8. Update package.json scripts: dev:server = node --watch server/index.js,
   dev:client = vite, dev = concurrently both, build = vite build,
   start = node server/index.js, test = vitest run, test:watch = vitest.
   (Add the React plugin to vitest config so .jsx test files work, if needed.)

DO NOT modify any server/ files. DO NOT add POST support. DO NOT add boxes.
DO NOT add the user picker, voting, edit, or delete.

ACCEPTANCE: `pnpm install && pnpm test` passes all tests including the new
buildCommentTree tests. `pnpm dev` shows the seeded comments tree rendering
in the browser at http://localhost:5173. Stop here and report what you built.
