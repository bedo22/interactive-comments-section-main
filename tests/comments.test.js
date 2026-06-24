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

describe('POST /comments', () => {
  it('creates a top-level comment and returns the full row shape', async () => {
    const res = await request(app)
      .post('/comments?userId=1')
      .send({ content: 'A new top-level comment' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.parentId).toBeNull();
    expect(res.body.author).toBe('juliusomo');
    expect(res.body.content).toBe('A new top-level comment');
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body.editedAt).toBeNull();
    expect(res.body.deletedAt).toBeNull();
    expect(res.body.score).toBe(0);
    expect(res.body.yourVote).toBeNull();
    expect(res.body).toHaveProperty('avatar');
    expect(res.body).toHaveProperty('userId');
  });

  it('creates a reply and preserves parentId', async () => {
    const res = await request(app)
      .post('/comments?userId=2')
      .send({ content: 'A reply', parentId: 1 })
      .expect(201);

    expect(res.body.parentId).toBe(1);
  });

  it('creates a reply to a reply and preserves parentId', async () => {
    const res = await request(app)
      .post('/comments?userId=3')
      .send({ content: 'Deep reply', parentId: 3 })
      .expect(201);

    expect(res.body.parentId).toBe(3);
  });

  it('rejects missing userId with 400', async () => {
    const res = await request(app)
      .post('/comments')
      .send({ content: 'No userId' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('rejects unknown userId with 400', async () => {
    const res = await request(app)
      .post('/comments?userId=999')
      .send({ content: 'Unknown user' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('rejects empty or whitespace-only content with 400', async () => {
    const res = await request(app)
      .post('/comments?userId=1')
      .send({ content: '   ' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('rejects nonexistent parentId with 400', async () => {
    const res = await request(app)
      .post('/comments?userId=1')
      .send({ content: 'Valid content', parentId: 9999 })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('persists: the new comment appears in GET /comments', async () => {
    const postRes = await request(app)
      .post('/comments?userId=1')
      .send({ content: 'Should persist' })
      .expect(201);

    const getRes = await request(app).get('/comments').expect(200);
    const found = getRes.body.find((c) => c.id === postRes.body.id);
    expect(found).toBeDefined();
    expect(found.content).toBe('Should persist');
    expect(found.parentId).toBeNull();
  });
});

describe('POST /comments/:id/vote', () => {
  function baselineScore(commentId) {
    return db
      .prepare('SELECT COALESCE(SUM(value), 0) AS s FROM votes WHERE comment_id = ?')
      .get(commentId).s;
  }

  function clearVotes(commentId) {
    db.prepare('DELETE FROM votes WHERE comment_id = ?').run(commentId);
  }

  it('upvotes a comment with value=1', async () => {
    const commentId = 1;
    clearVotes(commentId);
    const baseline = baselineScore(commentId);

    const res = await request(app)
      .post(`/comments/${commentId}/vote?userId=1`)
      .send({ value: 1 })
      .expect(200);

    expect(res.body.commentId).toBe(commentId);
    expect(res.body.yourVote).toBe(1);
    expect(res.body.score).toBe(baseline + 1);
  });

  it('downvotes a comment with value=-1', async () => {
    const commentId = 1;
    clearVotes(commentId);
    const baseline = baselineScore(commentId);

    const res = await request(app)
      .post(`/comments/${commentId}/vote?userId=1`)
      .send({ value: -1 })
      .expect(200);

    expect(res.body.yourVote).toBe(-1);
    expect(res.body.score).toBe(baseline - 1);
  });

  it('repeating the same value toggles the vote off', async () => {
    const commentId = 1;
    clearVotes(commentId);
    const baseline = baselineScore(commentId);

    await request(app)
      .post(`/comments/${commentId}/vote?userId=1`)
      .send({ value: 1 })
      .expect(200);

    const res = await request(app)
      .post(`/comments/${commentId}/vote?userId=1`)
      .send({ value: 1 })
      .expect(200);

    expect(res.body.yourVote).toBeNull();
    expect(res.body.score).toBe(baseline);
  });

  it('opposite value swings the vote by 2', async () => {
    const commentId = 1;
    clearVotes(commentId);
    const baseline = baselineScore(commentId);

    await request(app)
      .post(`/comments/${commentId}/vote?userId=1`)
      .send({ value: 1 })
      .expect(200);

    const afterUp = baselineScore(commentId);

    const res = await request(app)
      .post(`/comments/${commentId}/vote?userId=1`)
      .send({ value: -1 })
      .expect(200);

    expect(res.body.yourVote).toBe(-1);
    expect(res.body.score).toBe(afterUp - 2);
  });

  it('rejects missing userId with 400', async () => {
    const res = await request(app)
      .post('/comments/1/vote')
      .send({ value: 1 })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('rejects unknown userId with 400', async () => {
    const res = await request(app)
      .post('/comments/1/vote?userId=999')
      .send({ value: 1 })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('rejects invalid value with 400', async () => {
    for (const value of [0, 2, 'foo', null]) {
      const res = await request(app)
        .post('/comments/1/vote?userId=1')
        .send({ value })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    }
  });

  it('rejects vote on nonexistent comment with 404', async () => {
    const res = await request(app)
      .post('/comments/9999/vote?userId=1')
      .send({ value: 1 })
      .expect(404);

    expect(res.body).toHaveProperty('error');
  });

  it('persists: GET /comments?userId=X reflects the vote in score and yourVote', async () => {
    const commentId = 1;
    const userId = 1;
    clearVotes(commentId);

    const voteRes = await request(app)
      .post(`/comments/${commentId}/vote?userId=${userId}`)
      .send({ value: 1 })
      .expect(200);

    const getRes = await request(app).get(`/comments?userId=${userId}`).expect(200);
    const found = getRes.body.find((c) => c.id === commentId);
    expect(found).toBeDefined();
    expect(found.yourVote).toBe(1);
    expect(found.score).toBe(voteRes.body.score);
  });
});

describe('PATCH /comments/:id', () => {
  function authorOf(commentId) {
    return db.prepare('SELECT user_id FROM comments WHERE id = ?').get(commentId).user_id;
  }

  it('edits own comment and sets editedAt', async () => {
    const commentId = 1;
    const userId = authorOf(commentId);
    const before = db.prepare('SELECT edited_at FROM comments WHERE id = ?').get(commentId);
    expect(before.edited_at).toBeNull();

    const res = await request(app)
      .patch(`/comments/${commentId}?userId=${userId}`)
      .send({ content: 'Edited content' })
      .expect(200);

    expect(res.body.id).toBe(commentId);
    expect(res.body.content).toBe('Edited content');
    expect(res.body.editedAt).not.toBeNull();
    expect(res.body.deletedAt).toBeNull();
  });

  it('rejects editing another user\'s comment with 403', async () => {
    const commentId = 1;
    const authorId = authorOf(commentId);
    const otherUserId = [1, 2, 3, 4].find((id) => id !== authorId);
    const res = await request(app)
      .patch(`/comments/${commentId}?userId=${otherUserId}`)
      .send({ content: 'Trying to edit someone else' })
      .expect(403);

    expect(res.body).toHaveProperty('error');
  });

  it('rejects missing or unknown userId with 403', async () => {
    const commentId = 1;

    const resMissing = await request(app)
      .patch(`/comments/${commentId}`)
      .send({ content: 'No userId' })
      .expect(403);
    expect(resMissing.body).toHaveProperty('error');

    const resUnknown = await request(app)
      .patch(`/comments/${commentId}?userId=999`)
      .send({ content: 'Unknown user' })
      .expect(403);
    expect(resUnknown.body).toHaveProperty('error');
  });

  it('rejects editing a tombstoned comment with 403', async () => {
    const commentId = 1;
    const userId = authorOf(commentId);
    db.prepare('UPDATE comments SET deleted_at = ? WHERE id = ?')
      .run(new Date().toISOString(), commentId);

    const res = await request(app)
      .patch(`/comments/${commentId}?userId=${userId}`)
      .send({ content: 'Trying to edit a tombstone' })
      .expect(403);

    expect(res.body).toHaveProperty('error');
  });

  it('rejects empty or whitespace content with 400', async () => {
    const commentId = 1;
    const userId = authorOf(commentId);

    const res = await request(app)
      .patch(`/comments/${commentId}?userId=${userId}`)
      .send({ content: '   ' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('rejects editing nonexistent comment with 404', async () => {
    const res = await request(app)
      .patch('/comments/9999?userId=1')
      .send({ content: 'Anything' })
      .expect(404);

    expect(res.body).toHaveProperty('error');
  });

  it('preserves the original editedAt on a second edit', async () => {
    const commentId = 1;
    const userId = authorOf(commentId);

    const first = await request(app)
      .patch(`/comments/${commentId}?userId=${userId}`)
      .send({ content: 'First edit' })
      .expect(200);
    const firstEditedAt = first.body.editedAt;
    expect(firstEditedAt).not.toBeNull();

    // Force a different timestamp on the second edit.
    await new Promise((r) => setTimeout(r, 5));

    const second = await request(app)
      .patch(`/comments/${commentId}?userId=${userId}`)
      .send({ content: 'Second edit' })
      .expect(200);

    expect(second.body.editedAt).toBe(firstEditedAt);
    expect(second.body.content).toBe('Second edit');
  });
});

describe('DELETE /comments/:id', () => {
  function authorOf(commentId) {
    return db.prepare('SELECT user_id FROM comments WHERE id = ?').get(commentId).user_id;
  }

  it('deletes own comment and sets deleted_at', async () => {
    const commentId = 1;
    const userId = authorOf(commentId);
    const before = db.prepare('SELECT deleted_at FROM comments WHERE id = ?').get(commentId);
    expect(before.deleted_at).toBeNull();

    await request(app).delete(`/comments/${commentId}?userId=${userId}`).expect(204);

    const after = db.prepare('SELECT deleted_at FROM comments WHERE id = ?').get(commentId);
    expect(after.deleted_at).not.toBeNull();
  });

  it('rejects deleting another user\'s comment with 403', async () => {
    const commentId = 1;
    const authorId = authorOf(commentId);
    const otherUserId = [1, 2, 3, 4].find((id) => id !== authorId);

    const res = await request(app)
      .delete(`/comments/${commentId}?userId=${otherUserId}`)
      .expect(403);

    expect(res.body).toHaveProperty('error');
  });

  it('rejects deleting nonexistent comment with 404', async () => {
    const res = await request(app)
      .delete('/comments/9999?userId=1')
      .expect(404);

    expect(res.body).toHaveProperty('error');
  });

  it('succeeds when the comment has replies; children survive', async () => {
    const userId = authorOf(2);
    await request(app).delete(`/comments/2?userId=${userId}`).expect(204);

    const getRes = await request(app).get('/comments').expect(200);
    const childIds = getRes.body.filter((c) => c.parentId === 2).map((c) => c.id);
    expect(childIds).toEqual([3, 4]);
  });

  it('rejects missing userId with 403', async () => {
    const res = await request(app).delete('/comments/1').expect(403);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects unknown userId with 403', async () => {
    const res = await request(app).delete('/comments/1?userId=999').expect(403);
    expect(res.body).toHaveProperty('error');
  });

  it('is idempotent on already-tombstoned comments', async () => {
    const commentId = 1;
    const userId = authorOf(commentId);

    await request(app).delete(`/comments/${commentId}?userId=${userId}`).expect(204);
    await request(app).delete(`/comments/${commentId}?userId=${userId}`).expect(204);

    const after = db.prepare('SELECT deleted_at FROM comments WHERE id = ?').get(commentId);
    expect(after.deleted_at).not.toBeNull();
  });
});
