import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, 'schema.sql');
const fixturePath = path.join(__dirname, '..', 'data.json');

export function runSchema(db) {
  db.exec(fs.readFileSync(schemaPath, 'utf-8'));
}

export function seedTestData(db) {
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  const allUsers = new Map(); // username -> user object
  function collectUser(user) {
    if (!allUsers.has(user.username)) {
      allUsers.set(user.username, user);
    }
  }
  collectUser(raw.currentUser);
  function walkComments(comments) {
    for (const comment of comments) {
      collectUser(comment.user);
      if (comment.replies) {
        walkComments(comment.replies);
      }
    }
  }
  walkComments(raw.comments);

  const userMap = new Map(); // username -> id
  for (const user of allUsers.values()) {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (username, avatar) VALUES (?, ?)')
      .run(user.username, user.image.png);
    userMap.set(user.username, Number(lastInsertRowid));
  }

  const insertComment = db.prepare(
    'INSERT INTO comments (id, user_id, parent_id, content, created_at, edited_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertVote = db.prepare(
    'INSERT INTO votes (user_id, comment_id, value) VALUES (?, ?, ?)'
  );

  const now = new Date();

  function insertThreaded(comments, parentId = null) {
    for (const comment of comments) {
      const userId = userMap.get(comment.user.username);
      const createdAt = approximateDate(comment.createdAt, now);
      const id = comment.id ?? null;

      insertComment.run(
        id,
        userId,
        parentId,
        comment.content,
        createdAt,
        null,
        null
      );

      const insertedId = id ?? Number(
        db.prepare('SELECT last_insert_rowid() AS id').get().id
      );

      // Seed a few votes to demonstrate the score feature.
      // Score is derived from SUM(value), so we only add a few distinct votes.
      if (comment.score && comment.score > 0) {
        const voters = [...userMap.values()].filter((uid) => uid !== userId);
        const voteCount = Math.min(comment.score, voters.length);
        for (let i = 0; i < voteCount; i++) {
          insertVote.run(voters[i], insertedId, 1);
        }
      }

      if (comment.replies) {
        insertThreaded(comment.replies, insertedId);
      }
    }
  }

  insertThreaded(raw.comments);
}

export function createDatabase(filename = ':memory:') {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  return db;
}

export function seedDatabase(filename = ':memory:') {
  const db = createDatabase(filename);
  runSchema(db);
  seedTestData(db);
  return db;
}

const RELATIVE_PATTERN = /^\s*(\d+)\s+([a-z]+)\s+ago\s*$/i;

function approximateDate(text, now) {
  const match = RELATIVE_PATTERN.exec(text);
  if (!match) return now.toISOString();

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const d = new Date(now);

  if (unit.startsWith('sec')) d.setSeconds(d.getSeconds() - amount);
  else if (unit.startsWith('min')) d.setMinutes(d.getMinutes() - amount);
  else if (unit.startsWith('hour')) d.setHours(d.getHours() - amount);
  else if (unit.startsWith('day')) d.setDate(d.getDate() - amount);
  else if (unit.startsWith('week')) d.setDate(d.getDate() - amount * 7);
  else if (unit.startsWith('month')) d.setMonth(d.getMonth() - amount);
  else if (unit.startsWith('year')) d.setFullYear(d.getFullYear() - amount);

  return d.toISOString();
}
