const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');

router.get('/downloads', (req, res) => {
  const rows = db.prepare('SELECT id, title, description, type, url, original_name, size, mime, downloads, created_at FROM downloads ORDER BY created_at DESC, id DESC').all();
  res.json(rows);
});

router.get('/downloads/:id/file', (req, res) => {
  const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE downloads SET downloads = downloads + 1 WHERE id = ?').run(row.id);
  if (row.type === 'link' && row.url) {
    return res.redirect(302, row.url);
  }
  const filePath = path.join(__dirname, '..', 'uploads', row.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
  res.download(filePath, row.original_name);
});

module.exports = router;