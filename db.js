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
    type TEXT NOT NULL DEFAULT 'file',
    url TEXT DEFAULT '',
    filename TEXT NOT NULL DEFAULT '',
    original_name TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    mime TEXT DEFAULT 'application/octet-stream',
    icon_type TEXT NOT NULL DEFAULT 'none',
    icon TEXT DEFAULT '',
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
const adminCols = db.prepare("PRAGMA table_info(admins)").all().map(c => c.name);
if (!adminCols.includes('setup_complete')) {
  db.exec("ALTER TABLE admins ADD COLUMN setup_complete INTEGER NOT NULL DEFAULT 0");
}
if (!adminCols.includes('password_hash')) {
  db.exec("ALTER TABLE admins ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''");
}

// Migrate downloads table: add type and url columns for link support
const dlCols = db.prepare("PRAGMA table_info(downloads)").all().map(c => c.name);
if (!dlCols.includes('type')) {
  db.exec("ALTER TABLE downloads ADD COLUMN type TEXT NOT NULL DEFAULT 'file'");
}
if (!dlCols.includes('url')) {
  db.exec("ALTER TABLE downloads ADD COLUMN url TEXT DEFAULT ''");
}
if (!dlCols.includes('icon_type')) {
  db.exec("ALTER TABLE downloads ADD COLUMN icon_type TEXT NOT NULL DEFAULT 'none'");
}
if (!dlCols.includes('icon')) {
  db.exec("ALTER TABLE downloads ADD COLUMN icon TEXT DEFAULT ''");
}

module.exports = db;
