# Flat replies — reply to anything, collapse to root for display

A Reply's `parentId` may point at **any existing Comment** regardless of that comment's own depth. The backend enforces no nesting-depth limit; its only rule is "if `parentId` is supplied, it must reference a real comment." The **frontend** collapses every descendant of a top-level comment into a single indented "replies" column, so a reply-to-a-reply (stored at depth 2) renders at the same indentation as a direct reply (depth 1).

`buildCommentTree` implements this as a **walk-to-root** partition: for each non-root comment, follow `parentId` up until `parentId === null`; that terminal ancestor is the thread root. All comments sharing a root are grouped, and within each group the **server's `id ASC` order is preserved** (no client-side sort, no timestamp parsing — fresh replies land at the bottom of their thread).

## Why

**1. It matches the design.** The Frontend Mentor mockups render exactly two visual levels: top-level comments and a single indented "replies" column. `data.json` itself models replies as flat arrays (`"replies": []`), not arbitrarily nested trees. The backend staying dumb ("reply to anything") while the client flattens for display is exactly how the fixture and the design already work.

**2. It keeps the backend simple.** The only server-side rule is "`parentId`, if present, must exist" → 400 otherwise. No depth counter, no "must be a top-level comment" check, no promotion logic. A depth-limit policy would add validation complexity for a constraint the UI doesn't even visualize differently.

**3. Walk-to-root is the only correct grouping rule under "reply to anything."** A reply-to-a-reply in thread #2 still belongs to thread #2. Grouping by immediate parent would orphan depth-2+ replies into broken sub-trees. Walking to the root is O(depth) per comment and trivially correct.

**4. Preserving server order avoids a class of bugs.** Sorting client-side by `createdAt` introduces timestamp parsing and clock-skew sensitivity. The backend already returns `ORDER BY c.id ASC` (insertion order ≈ chronological for this app). Partitioning in order means a freshly POSTed reply (highest id) naturally appears at the bottom of its thread — the expected "new reply lands at the end" behavior, matching the design.

## The invariant

Walk-to-root requires every reply's ancestor chain to terminate at a `parentId === null` comment. `POST /comments` validation guarantees this: it checks that `parentId` (if supplied) points to a real comment, and real comments are either roots or themselves replies with valid chains. So the chain always terminates.

## Considered options

- **True-tree, depth-1 replies only** (`parentId` must point to a top-level comment; replies-to-replies rejected or auto-promoted): rejected — adds validation complexity to enforce a structure the UI does not render differently. Also fights the "reply to anything" simplicity.
- **Minimal validation, trust `parentId`** (let the FK constraint raise a 500 on bad references): rejected — a reply to a non-existent comment is a *client* error (400), not a server fault (500). Validating existence explicitly gives correct status codes.

## When this decision should change

If the design ever wanted **true nested rendering** (replies-to-replies indented further), the backend needs **no change at all** — it already stores arbitrary depth. Only `buildCommentTree` changes: stop collapsing to root, render the real recursive tree. The stored data and the API are forward-compatible with true nesting. This makes flat-replies the reversible choice.
