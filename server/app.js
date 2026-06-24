import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const toCamelCase = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value,
    ])
  );

export function createApp(db) {
  const app = express();
  const api = express.Router();

  api.use(express.json());

  api.get('/users', (_req, res) => {
    const rows = db.prepare('SELECT id, username, avatar FROM users').all();
    res.json(rows);
  });

  const queries = {
    commentById: db.prepare(`
      SELECT
        c.id,
        c.user_id,
        u.username AS author,
        u.avatar,
        c.parent_id,
        c.content,
        c.created_at,
        c.edited_at,
        c.deleted_at,
        COALESCE((SELECT SUM(value) FROM votes WHERE comment_id = c.id), 0) AS score,
        (SELECT value FROM votes WHERE comment_id = c.id AND user_id = ?) AS your_vote
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `),
    scoreFor: db.prepare(
      'SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE comment_id = ?'
    ),
    yourVoteFor: db.prepare(
      'SELECT value FROM votes WHERE user_id = ? AND comment_id = ?'
    ),
  };

  api.get('/comments', (req, res) => {
    const actingUserId = req.query.userId ? Number(req.query.userId) : null;

    const rows = db.prepare(`
      SELECT
        c.id,
        c.user_id,
        u.username AS author,
        u.avatar,
        c.parent_id,
        c.content,
        c.created_at,
        c.edited_at,
        c.deleted_at,
        COALESCE((SELECT SUM(value) FROM votes WHERE comment_id = c.id), 0) AS score,
        (SELECT value FROM votes WHERE comment_id = c.id AND user_id = ?) AS your_vote
      FROM comments c
      JOIN users u ON u.id = c.user_id
      ORDER BY c.id ASC
    `).all(actingUserId ?? -1);

    const result = rows.map(toCamelCase).map((row) => {
      const yourVote = actingUserId == null ? null : row.yourVote ?? null;
      return { ...row, yourVote };
    });

    res.json(result);
  });

  api.post('/comments', (req, res) => {
    const rawUserId = req.query.userId;
    const userId = Number(rawUserId);

    if (!rawUserId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Missing or invalid userId' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(400).json({ error: 'Unknown userId' });
    }

    const { content, parentId } = req.body;

    if (content == null || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content must be a non-empty string' });
    }

    if (parentId !== undefined && parentId !== null) {
      const parent = db.prepare('SELECT id FROM comments WHERE id = ?').get(parentId);
      if (!parent) {
        return res.status(400).json({ error: 'parentId does not reference an existing comment' });
      }
    }

    const createdAt = new Date().toISOString();
    const insertedParentId = parentId === undefined ? null : parentId;

    const info = db.prepare(
      'INSERT INTO comments (user_id, parent_id, content, created_at, edited_at, deleted_at) VALUES (?, ?, ?, ?, NULL, NULL)'
    ).run(userId, insertedParentId, content.trim(), createdAt);

    const actingUserId = Number(rawUserId);
    const row = queries.commentById.all(actingUserId, info.lastInsertRowid)[0];
    const result = toCamelCase(row);
    result.yourVote = null;

    res.status(201).json(result);
  });

  api.post('/comments/:id/vote', (req, res) => {
    const rawUserId = req.query.userId;
    const userId = Number(rawUserId);

    if (!rawUserId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Missing or invalid userId' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(400).json({ error: 'Unknown userId' });
    }

    const commentId = Number(req.params.id);
    if (!Number.isInteger(commentId) || commentId <= 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const { value } = req.body;
    if (value !== -1 && value !== 1) {
      return res.status(400).json({ error: 'value must be -1 or 1' });
    }

    const existing = queries.yourVoteFor.get(userId, commentId);

    if (!existing) {
      db.prepare(
        'INSERT INTO votes (user_id, comment_id, value) VALUES (?, ?, ?)'
      ).run(userId, commentId, value);
    } else if (existing.value === value) {
      db.prepare(
        'DELETE FROM votes WHERE user_id = ? AND comment_id = ?'
      ).run(userId, commentId);
    } else {
      db.prepare(
        'UPDATE votes SET value = ? WHERE user_id = ? AND comment_id = ?'
      ).run(value, userId, commentId);
    }

    const score = queries.scoreFor.get(commentId).score;
    const remaining = queries.yourVoteFor.get(userId, commentId);
    const yourVote = remaining ? remaining.value : null;

    res.status(200).json({ commentId, score, yourVote });
  });

  api.patch('/comments/:id', (req, res) => {
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
      'SELECT id, user_id, edited_at, deleted_at FROM comments WHERE id = ?'
    ).get(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.deleted_at !== null) {
      return res.status(403).json({ error: 'Cannot edit a deleted comment' });
    }

    if (comment.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    const { content } = req.body;
    if (content == null || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content must be a non-empty string' });
    }

    const trimmed = content.trim();
    if (comment.edited_at === null) {
      db.prepare(
        'UPDATE comments SET content = ?, edited_at = ? WHERE id = ?'
      ).run(trimmed, new Date().toISOString(), commentId);
    } else {
      db.prepare(
        'UPDATE comments SET content = ? WHERE id = ?'
      ).run(trimmed, commentId);
    }

    const row = queries.commentById.all(userId, commentId)[0];
    const result = toCamelCase(row);
    result.yourVote = result.yourVote ?? null;

    res.status(200).json(result);
  });

  api.delete('/comments/:id', (req, res) => {
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

    const hasChildren = db.prepare(
      'SELECT COUNT(*) AS n FROM comments WHERE parent_id = ?'
    ).get(commentId).n > 0;

    if (hasChildren) {
      db.prepare('UPDATE comments SET deleted_at = ? WHERE id = ?')
        .run(new Date().toISOString(), commentId);
    } else {
      db.prepare('DELETE FROM votes WHERE comment_id = ?').run(commentId);
      db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    }

    res.status(204).end();
  });

  // Dev: API routes at root (Vite proxy strips /api prefix)
  // Prod: API routes at /api (frontend calls /api/* directly)
  const apiPrefix = process.env.NODE_ENV === 'production' ? '/api' : '/';
  app.use(apiPrefix, api);

  // Serve built frontend in production
  if (process.env.NODE_ENV === 'production') {
    const root = path.resolve(__dirname, '..');
    const distPath = path.join(root, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

export default createApp;
