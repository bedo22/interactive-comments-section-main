import Database from 'better-sqlite3';
import { createApp } from './app.js';
import { runSchema, seedTestData } from './seed.js';

const DB_PATH = process.env.DATABASE_URL || 'comments.db';
const PORT = process.env.PORT || 3000;

const db = new Database(DB_PATH);
runSchema(db);
seedTestData(db);

const app = createApp(db);
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
