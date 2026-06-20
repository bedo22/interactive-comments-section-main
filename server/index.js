import Database from 'better-sqlite3';
import { createApp } from './app.js';
import { runSchema, seedTestData } from './seed.js';

const DB_PATH = process.env.DATABASE_URL || 'comments.db';
const PORT = process.env.PORT || 3000;

const db = new Database(DB_PATH);
runSchema(db);

// Seed only when the database is empty. Re-seeding an existing DB would either
// crash on the UNIQUE(username) constraint or silently duplicate data.
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  seedTestData(db);
}

const app = createApp(db);
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
