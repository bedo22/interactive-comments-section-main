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

  return app;
}

export default createApp;
