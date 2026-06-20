import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../server/app.js';
import { runSchema, seedTestData } from '../server/seed.js';

let db;
let app;

beforeEach(() => {
  db = new Database(':memory:');
  runSchema(db);
  seedTestData(db);
  app = createApp(db);
});

describe('GET /users', () => {
  it('returns all four seeded users', async () => {
    const res = await request(app).get('/users').expect(200);
    expect(res.body).toHaveLength(4);
    const usernames = res.body.map((u) => u.username).sort();
    expect(usernames).toEqual(['amyrobson', 'juliusomo', 'maxblagun', 'ramsesmiron']);
    for (const user of res.body) {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('avatar');
    }
  });
});

describe('GET /comments', () => {
  it('returns a flat array of all comments including replies', async () => {
    const res = await request(app).get('/comments').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('includes the derived fields on every row', async () => {
    const res = await request(app).get('/comments').expect(200);
    for (const comment of res.body) {
      expect(comment).toHaveProperty('id');
      expect(comment).toHaveProperty('userId');
      expect(comment).toHaveProperty('author');
      expect(comment).toHaveProperty('avatar');
      expect(comment).toHaveProperty('parentId');
      expect(comment).toHaveProperty('content');
      expect(comment).toHaveProperty('createdAt');
      expect(comment).toHaveProperty('editedAt');
      expect(comment).toHaveProperty('deletedAt');
      expect(comment).toHaveProperty('score');
      expect(typeof comment.score).toBe('number');
      expect(comment).toHaveProperty('yourVote');
    }
  });

  it('returns parentId null for top-level comments and a value for replies', async () => {
    const res = await request(app).get('/comments').expect(200);
    const topLevel = res.body.filter((c) => c.parentId === null);
    const replies = res.body.filter((c) => c.parentId !== null);
    expect(topLevel.length).toBeGreaterThan(0);
    expect(replies.length).toBeGreaterThan(0);
  });

  it('derives the score from votes, defaulting to 0 when there are none', async () => {
    const res = await request(app).get('/comments').expect(200);
    for (const comment of res.body) {
      const score = db
        .prepare('SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE comment_id = ?')
        .get(comment.id).score;
      expect(comment.score).toBe(score);
    }
  });

  it('returns yourVote as null when userId is not provided', async () => {
    const res = await request(app).get('/comments').expect(200);
    for (const comment of res.body) {
      expect(comment.yourVote).toBeNull();
    }
  });

  it('reflects the acting users vote in yourVote when userId is provided', async () => {
    const userId = 1;
    const comment = db.prepare('SELECT id FROM comments LIMIT 1').get();
    db.prepare('DELETE FROM votes WHERE user_id = ? AND comment_id = ?').run(userId, comment.id);
    db.prepare('INSERT INTO votes (user_id, comment_id, value) VALUES (?, ?, ?)').run(userId, comment.id, 1);

    const res = await request(app).get(`/comments?userId=${userId}`).expect(200);
    const target = res.body.find((c) => c.id === comment.id);
    expect(target.yourVote).toBe(1);
  });

  it('returns yourVote as null for comments the acting user has not voted on', async () => {
    const res = await request(app).get('/comments?userId=1').expect(200);
    const votedIds = new Set(
      db.prepare('SELECT comment_id FROM votes WHERE user_id = 1').all().map((r) => r.comment_id)
    );
    for (const comment of res.body) {
      if (!votedIds.has(comment.id)) {
        expect(comment.yourVote).toBeNull();
      }
    }
  });

  it('includes tombstoned comments in the flat list', async () => {
    db.prepare('UPDATE comments SET deleted_at = ? WHERE id = 1').run(new Date().toISOString());
    const res = await request(app).get('/comments').expect(200);
    const ids = res.body.map((c) => c.id);
    expect(ids).toContain(1);
  });
});
