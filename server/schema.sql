CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY,
  username  TEXT UNIQUE NOT NULL,
  avatar    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  parent_id   INTEGER,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  edited_at   TEXT,
  deleted_at  TEXT,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

CREATE TABLE IF NOT EXISTS votes (
  user_id     INTEGER NOT NULL,
  comment_id  INTEGER NOT NULL,
  value       INTEGER NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (user_id, comment_id),
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (comment_id) REFERENCES comments(id)
);
