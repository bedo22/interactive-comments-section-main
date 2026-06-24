# Pass 1 — Remaining Stages

What's already built vs what's still needed in the Express+SQLite pass, sliced
into independently shippable vertical slices.

## Current status

| Stage | Backend | Frontend | Tests |
|-------|---------|----------|-------|
| 1. Schema + seed + read API | ✅ | ✅ | ✅ |
| 2. POST comments + boxes | ✅ | ✅ | ✅ |
| 3. Voting | ✅ | ✅ | ✅ |
| **4. Edit** | ✅ done | ❌ missing | ✅ done |
| **5. Delete + tombstones + modal** | ❌ missing | ❌ missing | ❌ missing |
| **6. User picker** | ✅ done | ❌ missing | n/a |
| **7. Relative time + replyingTo** | n/a | ❌ missing | n/a |
| **8. README** | n/a | ❌ missing | n/a |

---

## Stage 4 — Edit (frontend only)

Backend `PATCH /comments/:id` exists and is tested. No backend changes needed.

### `src/api/client.js`

Add one function:

```js
export async function editComment(userId, commentId, content) {
  const res = await fetch(`/api/comments/${commentId}?userId=${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `PATCH /comments failed: ${res.status}`);
  }
  return res.json();
}
```

### `src/App.jsx`

Add `updateComment` callback:

```js
const updateComment = useCallback((row) => {
  setComments((prev) => prev.map((c) => (c.id === row.id ? row : c)));
}, []);
```

Pass `updateComment` down through `CommentList → CommentThread → Comment`.

### `src/comments/CommentThread.jsx`

In the `Comment` component:

- Import `useCurrentUser` and `editComment`
- Add `editing` state (`useState(false)`)
- Show Edit/Delete buttons only when `comment.userId === user.id`
- Edit button toggles `editing`
- When `editing`, render a `<textarea>` pre-filled with `comment.content` +
  Save/Cancel buttons
- Save calls `editComment(user.id, comment.id, newContent)`; on success calls
  `updateComment(row)` and exits edit mode
- Cancel discards and exits edit mode

**Tests:** none — backend `PATCH` is already tested.

---

## Stage 5 — Delete + tombstones + confirmation modal

### `server/app.js` — DELETE route

Add between the `PATCH` handler and `return app`:

```js
app.delete('/comments/:id', (req, res) => {
  const rawUserId = req.query.userId;
  const userId = Number(rawUserId);

  if (!rawUserId || !Number.isInteger(userId) || userId <= 0) {
    return res.status(403).json({ error: 'Missing or invalid userId' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(403).json({ error: 'Unknown userId' });
  }

  const commentId = Number(req.params.id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  const comment = db.prepare(
    'SELECT id, user_id FROM comments WHERE id = ?'
  ).get(commentId);
  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  if (comment.user_id !== userId) {
    return res.status(403).json({ error: 'Not authorized to delete this comment' });
  }

  db.prepare('UPDATE comments SET deleted_at = ? WHERE id = ?')
    .run(new Date().toISOString(), commentId);

  res.status(204).end();
});
```

Key behaviors:
- Soft delete only (`deleted_at = now()`)
- Never cascades to children; never blocks on children
- Idempotent — re-deleting an already-tombstoned comment succeeds (204)

### `tests/comments.test.js` — DELETE tests

New `describe('DELETE /comments/:id')` block. Each test runs against a fresh
in-memory DB (the existing `beforeEach` already handles this).

**7 tests:**

| # | Test | Assertion |
|---|------|-----------|
| 1 | Delete own comment | 204, `deleted_at` set in DB |
| 2 | Delete another user's comment | 403, "Not authorized" |
| 3 | Delete nonexistent comment | 404 |
| 4 | Delete comment with replies | 204, replies still returned by GET |
| 5 | Missing `userId` | 403 |
| 6 | Unknown `userId` (999) | 403 |
| 7 | Delete already-tombstoned comment | 204 (idempotent) |

Helper for test 4:

```js
it('succeeds when the comment has replies; children survive', async () => {
  // comment #2 has replies (#3, #4)
  const userId = db.prepare('SELECT user_id FROM comments WHERE id = 2').get().user_id;
  await request(app).delete(`/comments/2?userId=${userId}`).expect(204);

  const getRes = await request(app).get('/comments').expect(200);
  const childIds = getRes.body.filter(c => c.parentId === 2).map(c => c.id);
  expect(childIds).toEqual([3, 4]);
});
```

### `src/api/client.js`

```js
export async function deleteComment(userId, commentId) {
  const res = await fetch(`/api/comments/${commentId}?userId=${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `DELETE /comments failed: ${res.status}`);
  }
}
```

### `src/App.jsx`

Add `removeComment` callback:

```js
const removeComment = useCallback((commentId) => {
  setComments((prev) => prev.filter((c) => c.id !== commentId));
}, []);
```

Pass down through the component chain.

### New: `src/modal/ConfirmModal.jsx`

Reusable confirmation overlay:

```jsx
export default function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px' }}>
        <p>{message}</p>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm} style={{ background: 'hsl(358, 79%, 66%)', color: 'white' }}>Delete</button>
      </div>
    </div>
  );
}
```

### `src/comments/CommentThread.jsx` — wire delete

- Import `deleteComment` and `ConfirmModal`
- Add `deleting` state (the comment id pending confirmation, or `null`)
- Delete button (visible only when `comment.userId === user.id`) sets
  `deleting = comment.id`, rendering `<ConfirmModal>`
- Confirm: calls `deleteComment(user.id, comment.id)`, then
  `removeComment(comment.id)`
- Cancel: sets `deleting = null`

### Tombstone render state

In `Comment`, at the top:

```js
if (comment.deletedAt) {
  return (
    <div style={{ opacity: 0.5, fontStyle: 'italic', color: '#999' }}>
      <strong>{comment.author}</strong> — <span>[deleted]</span>
    </div>
  );
}
```

No edit/delete/reply buttons on a tombstone. The row stays in the thread to
preserve conversation structure.

---

## Stage 6 — User picker

Backend `GET /users` exists. `CurrentUserContext` already loads users and has
`setUser`. Only the UI is missing.

### New: `src/header/UserPicker.jsx`

Native `<select>` — zero JS for the widget, fully accessible:

```jsx
export default function UserPicker() {
  const { user, users, setUser } = useCurrentUser();
  if (!user) return null;
  return (
    <div>
      <span>Acting as: </span>
      <select value={user.id} onChange={(e) => {
        setUser(users.find(u => u.id === Number(e.target.value)));
      }}>
        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
      </select>
    </div>
  );
}
```

### `src/App.jsx`

Render `<UserPicker />` above `<CommentList />`. The existing `useEffect`
already refetches comments when `user` changes — no extra wiring.

---

## Stage 7 — Relative time + replyingTo

### New: `src/utils/relativeTime.js`

```js
export function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}
```

### `src/App.jsx`

Pass the flat `comments` array down to `CommentList` (needed for `replyingTo`
lookup). Pass `updateComment` and `removeComment` too.

### `src/comments/CommentThread.jsx`

**Relative time**: replace `{comment.createdAt}` with
`{relativeTime(comment.createdAt)}`.

**replyingTo display**: if `comment.parentId` is non-null, find the parent in
the `flatComments` array and show `"@parentAuthor"` at the start of the content:

```js
const parent = flatComments.find(c => c.id === comment.parentId);
const replyingTo = parent?.author;
```

In the JSX, before the content text:
```jsx
{replyingTo && <span style={{ color: 'hsl(238, 40%, 52%)', fontWeight: 500 }}>
  @{replyingTo}
</span>}
{' '}{comment.content}
```

---

## Stage 8 — README

Replace the template `README.md` with a project-specific one documenting:

- What the project is (interactive comments section)
- Tech stack: Express + SQLite (better-sqlite3), React + Vite, vitest + supertest
- Setup: `pnpm install`, `pnpm dev`, `pnpm test`
- Architecture overview: tables, API shape (flat response), client tree building
- Key design decisions (pickable identity, soft delete, computed score, two-pass)
- Remaining: Pass 2 (Supabase swap)

---

## Test count summary

| File | Tests added | Total after all stages |
|------|-------------|-----------------------|
| `tests/comments.test.js` | +7 (DELETE) | 44 tests |
| `tests/buildCommentTree.test.js` | 0 | 8 tests |
| **Total** | **+7** | **52 tests** |

Frontend component testing is out of scope (per the existing test strategy in
`PLAN.md` — integration tests only).

---

## File delta

| Action | File | Lines |
|--------|------|-------|
| Edit | `server/app.js` | +~35 |
| Edit | `tests/comments.test.js` | +~80 |
| Edit | `src/api/client.js` | +~20 |
| Edit | `src/App.jsx` | +~15 |
| Edit | `src/comments/CommentThread.jsx` | +~50 |
| **New** | `src/modal/ConfirmModal.jsx` | ~30 |
| **New** | `src/header/UserPicker.jsx` | ~20 |
| **New** | `src/utils/relativeTime.js` | ~20 |
| **New** | `README.md` | ~60 |
| **Total** | | **~330 lines added, 0 deleted** |

---

## Build order

Stages are independent — they can be tackled in any order. Suggested sequence:

1. Stage 5 (Delete) — backend route + tests first, then frontend
2. Stage 4 (Edit) — frontend only, quickest win
3. Stage 7 (Relative time + replyingTo) — small, visible change
4. Stage 6 (User picker) — enables author-gating in the UI
5. Stage 8 (README) — last

Each stage is fully shippable after its changes. No stage depends on a later
stage.
