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