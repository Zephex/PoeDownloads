const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    mime TEXT DEFAULT 'application/octet-stream',
    downloads INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    setup_complete INTEGER NOT NULL DEFAULT 0
  );
`);

// Migrate older databases that lack setup_complete
const cols = db.prepare("PRAGMA table_info(admins)").all().map(c => c.name);
if (!cols.includes('setup_complete')) {
  db.exec("ALTER TABLE admins ADD COLUMN setup_complete INTEGER NOT NULL DEFAULT 0");
}
if (!cols.includes('password_hash')) {
  // unlikely, but keep safe
  db.exec("ALTER TABLE admins ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''");
}

module.exports = db;
