# React frontend via Vite dev proxy with `/api` prefix

The frontend is a React app served by **Vite** in development and by **Express** in production. In development two servers run side by side: Vite on `:5173` (serves the React app with HMR) and Express on `:3000` (serves JSON). Vite proxies any request whose path starts with `/api` to Express, **stripping the `/api` prefix** — so the frontend writes `fetch('/api/comments')` and Express receives `GET /comments`. In production the proxy disappears; Express serves the built `dist/` for any non-`/api` path and answers `/api/*` directly. One string (`/api/comments`) is the contract, true in every environment.

## Why

Three reinforcing reasons:

**1. Same-origin in dev, same-origin in prod — CORS never exists.** Because Vite intercepts `/api/*` and forwards it server-to-server, the browser only ever sees same-origin requests (`localhost:5173 → localhost:5173/api/...`). No CORS headers, no preflight on `POST`/`PATCH`. In prod the same Express process serves both static and data, so it's same-origin there too. The frontend never deals with CORS in any environment.

**2. It maps directly onto Pass 2.** Supabase's auto-generated REST also lives under its own base path. Re-pointing the proxy `target` from `localhost:3000` to the Supabase URL is a one-line Vite config change. React components, `buildCommentTree`, the boxes — all untouched. This is exactly the "frontend built once, data layer swaps" property ADR-0002 commits to.

**3. Clean separation of concerns.** Vite does one thing (fast frontend dev with HMR); Express does one thing (serves data). Each is independently replaceable. The `/api` prefix removes all ambiguity between "data route" and "static asset / SPA route," even after client-side routing is added.

## Frontend state architecture

- **Acting user** lives in `CurrentUserContext` (React Context). The user picker updates it; every component reads it via `useCurrentUser()`. This is the reactive, drill-free delivery mechanism for ADR-0001's pickable identity, and the seam Pass 2's real auth plugs into (swap the provider's logic, keep every consumer).
- **Comments** live as a **flat array** in `App` state — the single source of truth. `buildCommentTree` **derives** the 2-level tree on each render; the tree is never stored in state (storing both leads to sync bugs; deriving is cheap for tens of rows).
- `App` owns the `useEffect` fetch and an `appendComment(row)` callback, threaded down to the boxes as a prop. One callback does not justify a second Context.

## File layout

Vite default: `index.html` + `vite.config.js` at the repo root, React code under `src/`. **Pure logic (no JSX) is `.js` and unit-tested directly; components are `.jsx` and verified via the running app.** Concretely: `buildCommentTree.js` is `.js` with its own Vitest test file; `CommentList.jsx`, `NewCommentBox.jsx`, etc. are `.jsx`.

```
├── index.html                # Vite entry (loads /src/main.jsx)
├── vite.config.js            # React plugin + /api proxy
├── src/
│   ├── main.jsx              # mounts <App/>
│   ├── App.jsx               # owns comments[] state + fetch + appendComment
│   ├── api/client.js         # fetch helpers
│   ├── comments/
│   │   ├── buildCommentTree.js   # .js — pure, unit-tested
│   │   ├── CommentList.jsx
│   │   └── CommentThread.jsx
│   ├── boxes/
│   │   ├── NewCommentBox.jsx
│   │   └── ReplyBox.jsx
│   └── context/CurrentUserContext.jsx
└── tests/buildCommentTree.test.js
```

## Dev commands

`pnpm dev` runs **both** servers via `concurrently`: `node --watch server/index.js` (backend, auto-restarts on save) and `vite` (frontend, HMR). Added runtime deps: `react`, `react-dom`. Added dev deps: `vite`, `@vitejs/plugin-react`, `concurrently`.

## Considered options

- **Express mounts Vite dev middleware (single process):** rejected — couples the frontend's dev harness to Express, so swapping the backend in Pass 2 means re-engineering how the frontend runs in dev. Defeats the swap property.
- **`frontend/` subfolder with pnpm workspace + two `package.json`:** rejected — more structure than this app needs; the `server/` vs `src/` split already separates concerns.
- **No `/api` prefix (frontend hits `/comments` directly):** rejected — creates ambiguity between data routes and SPA/static routes, and breaks the clean "everything under `/api` is data" rule.

## Not a one-way door

If the proxy ever needs to disappear (e.g. deploying frontend and backend to separate hosts in prod), the only change is that the frontend's `api/client.js` reads a base URL from env and the proxy is deleted. The `/api` prefix and all component code are unaffected.
