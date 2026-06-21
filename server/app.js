import express from 'express';

const toCamelCase = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value,
    ])
  );

export function createApp(db) {
  const app = express();
  app.use(express.json());

  app.get('/users', (_req, res) => {
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

  app.get('/comments', (req, res) => {
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

  app.post('/comments', (req, res) => {
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

  app.post('/comments/:id/vote', (req, res) => {
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

  return app;
}

export default createApp;
