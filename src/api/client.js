export async function getUsers() {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error(`GET /users failed: ${res.status}`);
  return res.json();
}

export async function getComments(userId) {
  const res = await fetch(`/api/comments?userId=${userId}`);
  if (!res.ok) throw new Error(`GET /comments failed: ${res.status}`);
  return res.json();
}

export async function createComment(userId, { content, parentId }) {
  const body = { content };
  if (parentId !== undefined && parentId !== null) body.parentId = parentId;

  const res = await fetch(`/api/comments?userId=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `POST /comments failed: ${res.status}`);
  }
  return res.json();
}

export async function voteComment(userId, commentId, value) {
  const res = await fetch(`/api/comments/${commentId}/vote?userId=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `POST /vote failed: ${res.status}`);
  }
  return res.json(); // { commentId, score, yourVote }
}

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

export async function deleteComment(userId, commentId) {
  const res = await fetch(`/api/comments/${commentId}?userId=${userId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `DELETE /comments failed: ${res.status}`);
  }
}