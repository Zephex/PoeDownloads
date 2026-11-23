const bcrypt = require('bcryptjs');
const db = require('./db');

function ensureAdmin() {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const row = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (!row) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`Created default admin user "${username}" (password from ADMIN_PASSWORD or "admin")`);
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function login(username, password) {
  const row = db.prepare('SELECT id, password_hash FROM admins WHERE username = ?').get(username);
  if (!row) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  return row.id;
}

module.exports = { ensureAdmin, requireAuth, login };
