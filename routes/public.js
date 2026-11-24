const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');

function attachTags(rows) {
  const map = {};
  const links = db.prepare('SELECT dt.download_id, t.name FROM download_tags dt JOIN tags t ON t.id = dt.tag_id').all();
  for (const l of links) {
    if (!map[l.download_id]) map[l.download_id] = [];
    map[l.download_id].push(l.name);
  }
  return rows.map(r => ({ ...r, tags: map[r.id] || [] }));
}

router.get('/tags', (req, res) => {
  const rows = db.prepare('SELECT id, name FROM tags ORDER BY name').all();
  res.json(rows);
});

router.get('/downloads', (req, res) => {
  let sql = 'SELECT id, title, description, type, url, original_name, size, mime, downloads, created_at FROM downloads';
  const params = [];
  if (req.query.tag) {
    sql += ' WHERE id IN (SELECT download_id FROM download_tags dt JOIN tags t ON t.id=dt.tag_id WHERE t.name = ?)';
    params.push(req.query.tag);
  }
  sql += ' ORDER BY created_at DESC, id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(attachTags(rows));
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
