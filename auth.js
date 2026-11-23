const bcrypt = require('bcryptjs');
const db = require('./db');

function envPassword() {
  const p = process.env.ADMIN_PASSWORD;
  if (!p) return null;
  const trimmed = String(p).trim();
  if (!trimmed) return null;
  // Treat obvious placeholders as "not set" so first-login setup can run
  if (/^CHANGE_ME/i.test(trimmed)) return null;
  return trimmed;
}

function ensureAdmin() {
  const username = process.env.ADMIN_USER || 'admin';
  const pw = envPassword();

  // Remove any leftover pending (incomplete) admin rows if a completed admin already exists.
  const completed = db.prepare("SELECT COUNT(*) AS c FROM admins WHERE setup_complete = 1 AND password_hash != ''").get().c;
  if (completed > 0) {
    db.prepare("DELETE FROM admins WHERE setup_complete = 0 OR password_hash = ''").run();
  }

  const row = db.prepare('SELECT id, setup_complete FROM admins WHERE username = ?').get(username);
  if (!row) {
    if (pw) {
      const hash = bcrypt.hashSync(pw, 10);
      db.prepare('INSERT INTO admins (username, password_hash, setup_complete) VALUES (?, ?, 1)').run(username, hash);
      console.log(`Created admin user "${username}" from ADMIN_PASSWORD env.`);
    } else if (completed === 0) {
      // Only create a pending admin if none completed exists
      db.prepare('INSERT INTO admins (username, password_hash, setup_complete) VALUES (?, ?, 0)').run(username, '');
      console.log(`Created admin user "${username}" pending first-time setup (no ADMIN_PASSWORD provided).`);
    }
    return;
  }
  // Existing row: if env password provided and not yet complete, apply it
  if (pw && !row.setup_complete) {
    const hash = bcrypt.hashSync(pw, 10);
    db.prepare('UPDATE admins SET password_hash=?, setup_complete=1 WHERE id=?').run(hash, row.id);
    console.log(`Applied ADMIN_PASSWORD to existing admin "${username}".`);
  }
}

function needsSetup() {
  // Only require setup if NO admin has completed setup with a password.
  // A leftover pending row must not re-trigger setup once an account exists.
  const completed = db.prepare("SELECT COUNT(*) AS c FROM admins WHERE setup_complete = 1 AND password_hash != ''").get().c;
  return completed === 0;
}

function setupAdmin(username, password) {
  username = (username || process.env.ADMIN_USER || 'admin').trim() || 'admin';
  const hash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    db.prepare('UPDATE admins SET password_hash=?, setup_complete=1 WHERE id=?').run(hash, existing.id);
  } else {
    const pending = db.prepare('SELECT id FROM admins WHERE setup_complete = 0 LIMIT 1').get();
    if (pending) {
      db.prepare('UPDATE admins SET username=?, password_hash=?, setup_complete=1 WHERE id=?').run(username, hash, pending.id);
    } else {
      db.prepare('INSERT INTO admins (username, password_hash, setup_complete) VALUES (?, ?, 1)').run(username, hash);
    }
  }
  // Clean up any other pending/incomplete admin rows so setup won't re-trigger.
  db.prepare("DELETE FROM admins WHERE setup_complete = 0 OR password_hash = ''").run();
  const row = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  return row.id;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function login(username, password) {
  const row = db.prepare('SELECT id, password_hash, setup_complete FROM admins WHERE username = ?').get(username);
  if (!row) return null;
  if (!row.setup_complete) return null; // must set up first
  if (!row.password_hash) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  return row.id;
}

module.exports = { ensureAdmin, requireAuth, login, needsSetup, setupAdmin };
