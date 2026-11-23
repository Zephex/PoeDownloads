const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, login, needsSetup, setupAdmin } = require('../auth');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

router.get('/me', (req, res) => {
  const setup = needsSetup();
  if (req.session && req.session.adminId) return res.json({ loggedIn: true, username: req.session.username, needsSetup: setup });
  res.json({ loggedIn: false, needsSetup: setup });
});

router.post('/setup', (req, res) => {
  if (!needsSetup()) return res.status(403).json({ error: 'Setup already completed' });
  const { username, password } = req.body || {};
  if (!password || String(password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  const id = setupAdmin(username, password);
  const user = (username && String(username).trim()) || process.env.ADMIN_USER || 'admin';
  req.session.adminId = id;
  req.session.username = user;
  res.json({ ok: true, username: user });
});

router.post('/login', (req, res) => {
  if (needsSetup()) return res.status(403).json({ error: 'Setup required', needsSetup: true });
  const { username, password } = req.body || {};
  const id = login(username, password);
  if (!id) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.adminId = id;
  req.session.username = username;
  res.json({ ok: true, username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.use(requireAuth);

router.get('/downloads', (req, res) => {
  const rows = db.prepare('SELECT * FROM downloads ORDER BY created_at DESC, id DESC').all();
  res.json(rows);
});

router.post('/downloads', upload.single('file'), (req, res) => {
  const { title, description } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const info = db.prepare(`
    INSERT INTO downloads (title, description, filename, original_name, size, mime)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, description || '', req.file.filename, req.file.originalname, req.file.size, req.file.mimetype);
  const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/downloads/:id', upload.single('file'), (req, res) => {
  const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const title = req.body.title != null ? req.body.title : row.title;
  const description = req.body.description != null ? req.body.description : row.description;

  let filename = row.filename;
  let original_name = row.original_name;
  let size = row.size;
  let mime = row.mime;

  if (req.file) {
    const oldPath = path.join(uploadDir, row.filename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    filename = req.file.filename;
    original_name = req.file.originalname;
    size = req.file.size;
    mime = req.file.mimetype;
  }

  db.prepare(`
    UPDATE downloads SET title=?, description=?, filename=?, original_name=?, size=?, mime=?, updated_at=datetime('now') WHERE id=?
  `).run(title, description, filename, original_name, size, mime, row.id);
  const updated = db.prepare('SELECT * FROM downloads WHERE id = ?').get(row.id);
  res.json(updated);
});

router.delete('/downloads/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(uploadDir, row.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM downloads WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

module.exports = router;
