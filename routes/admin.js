const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, login, needsSetup, setupAdmin } = require('../auth');

function attachTags(rows) {
  const map = {};
  const links = db.prepare('SELECT dt.download_id, t.id, t.name FROM download_tags dt JOIN tags t ON t.id = dt.tag_id').all();
  for (const l of links) {
    if (!map[l.download_id]) map[l.download_id] = [];
    map[l.download_id].push({ id: l.id, name: l.name });
  }
  return rows.map(r => ({ ...r, tags: map[r.id] || [] }));
}

function resolveTagIds(names) {
  const ids = [];
  for (const raw of names) {
    const name = String(raw).trim();
    if (!name) continue;
    let row = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
    if (!row) {
      const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
      row = { id: info.lastInsertRowid };
    }
    ids.push(row.id);
  }
  return ids;
}

function setDownloadTags(downloadId, tagNames) {
  db.prepare('DELETE FROM download_tags WHERE download_id = ?').run(downloadId);
  const ids = resolveTagIds(tagNames);
  const ins = db.prepare('INSERT OR IGNORE INTO download_tags (download_id, tag_id) VALUES (?, ?)');
  for (const id of ids) ins.run(downloadId, id);
}

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
  res.json(attachTags(rows));
});

// Tags management
router.get('/tags', (req, res) => {
  const rows = db.prepare('SELECT id, name FROM tags ORDER BY name').all();
  res.json(rows);
});

router.post('/tags', (req, res) => {
  const name = (req.body && req.body.name) ? String(req.body.name).trim() : '';
  if (!name) return res.status(400).json({ error: 'Name required' });
  let row = db.prepare('SELECT id, name FROM tags WHERE name = ?').get(name);
  if (!row) {
    const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
    row = { id: info.lastInsertRowid, name };
  }
  res.status(201).json(row);
});

router.delete('/tags/:id', (req, res) => {
  db.prepare('DELETE FROM download_tags WHERE tag_id = ?').run(req.params.id);
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// List uploaded image files available for use as icons
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|ico)$/i;
const iconUpload = require('multer')({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
  }),
  fileFilter: (req, file, cb) => {
    if (IMAGE_EXT.test(file.originalname)) cb(null, true); else cb(new Error('Only image files allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/icons', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', 'uploads');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter(f => IMAGE_EXT.test(f));
  } catch (e) { files = []; }
  res.json(files.map(f => ({ filename: f, url: '/uploads/' + encodeURIComponent(f) })));
});

router.post('/icons', iconUpload.single('icon'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image required' });
  res.status(201).json({ filename: req.file.filename, url: '/uploads/' + encodeURIComponent(req.file.filename) });
});

router.delete('/icons/:filename', (req, res) => {
  const name = req.params.filename;
  // prevent path traversal
  if (name.includes('/') || name.includes('\\\\')) return res.status(400).json({ error: 'Invalid filename' });
  const inUse = db.prepare("SELECT COUNT(*) AS c FROM downloads WHERE icon_type='file' AND icon = ?").get(name).c;
  if (inUse > 0) return res.status(409).json({ error: 'Icon is in use by a download' });
  const fs = require('fs');
  const path = require('path');
  const p = path.join(__dirname, '..', 'uploads', name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  res.json({ ok: true });
});

router.post('/downloads', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'icon', maxCount: 1 }]), (req, res) => {
  const { title, description, url, icon_url } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });

  const files = req.files || {};
  const file = files.file ? files.file[0] : null;
  const iconFile = files.icon ? files.icon[0] : null;

  // Resolve icon
  let icon_type = 'none';
  let icon = '';
  if (iconFile) {
    icon_type = 'file';
    icon = iconFile.filename;
  } else if (icon_url && String(icon_url).trim()) {
    const iu = String(icon_url).trim();
    if (iu.startsWith('/')) {
      icon_type = 'url';
      icon = iu;
    } else {
      try { new URL(iu); } catch (e) { return res.status(400).json({ error: 'Invalid icon URL' }); }
      icon_type = 'url';
      icon = iu;
    }
  } else if (req.body.icon_existing && String(req.body.icon_existing).trim()) {
    const name = String(req.body.icon_existing).trim();
    const fs = require('fs');
    const path = require('path');
    const p = path.join(__dirname, '..', 'uploads', name);
    if (fs.existsSync(p)) {
      icon_type = 'file';
      icon = name;
    }
  }

  const linkUrl = (url || '').trim();
  if (file) {
    const info = db.prepare(`
      INSERT INTO downloads (title, description, type, url, filename, original_name, size, mime, icon_type, icon)
      VALUES (?, ?, 'file', '', ?, ?, ?, ?, ?, ?)
    `).run(title, description || '', file.filename, file.originalname, file.size, file.mimetype, icon_type, icon);
    const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(info.lastInsertRowid);
    let tagNames = [];
    if (req.body.tags) { try { tagNames = JSON.parse(req.body.tags); } catch (e) { tagNames = String(req.body.tags).split(',').map(s=>s.trim()).filter(Boolean); } }
    if (Array.isArray(tagNames)) setDownloadTags(row.id, tagNames);
    const out = db.prepare('SELECT * FROM downloads WHERE id = ?').get(row.id);
    return res.status(201).json(attachTags([out])[0]);
  }

  if (linkUrl) {
    try { new URL(linkUrl); } catch (e) { return res.status(400).json({ error: 'Invalid URL' }); }
    const info = db.prepare(`
      INSERT INTO downloads (title, description, type, url, filename, original_name, size, mime, icon_type, icon)
      VALUES (?, ?, 'link', ?, '', ?, 0, '', ?, ?)
    `).run(title, description || '', linkUrl, linkUrl, icon_type, icon);
    const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(info.lastInsertRowid);
    let tagNames = [];
    if (req.body.tags) { try { tagNames = JSON.parse(req.body.tags); } catch (e) { tagNames = String(req.body.tags).split(',').map(s=>s.trim()).filter(Boolean); } }
    if (Array.isArray(tagNames)) setDownloadTags(row.id, tagNames);
    const out = db.prepare('SELECT * FROM downloads WHERE id = ?').get(row.id);
    return res.status(201).json(attachTags([out])[0]);
  }

  return res.status(400).json({ error: 'File or link required' });
});

router.put('/downloads/:id', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'icon', maxCount: 1 }]), (req, res) => {
  const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const title = req.body.title != null ? req.body.title : row.title;
  const description = req.body.description != null ? req.body.description : row.description;

  const files = req.files || {};
  const file = files.file ? files.file[0] : null;
  const iconFile = files.icon ? files.icon[0] : null;

  let type = row.type;
  let url = row.url;
  let filename = row.filename;
  let original_name = row.original_name;
  let size = row.size;
  let mime = row.mime;

  let icon_type = row.icon_type;
  let icon = row.icon;

  // Handle icon update
  if (iconFile) {
    if (row.icon_type === 'file' && row.icon) {
      const oldIcon = path.join(uploadDir, row.icon);
      if (fs.existsSync(oldIcon)) fs.unlinkSync(oldIcon);
    }
    icon_type = 'file';
    icon = iconFile.filename;
  } else if (req.body.icon_url != null) {
    const iu = String(req.body.icon_url).trim();
    if (iu) {
      if (!iu.startsWith('/')) {
        try { new URL(iu); } catch (e) { return res.status(400).json({ error: 'Invalid icon URL' }); }
      }
      if (row.icon_type === 'file' && row.icon) {
        const oldIcon = path.join(uploadDir, row.icon);
        if (fs.existsSync(oldIcon)) fs.unlinkSync(oldIcon);
      }
      icon_type = 'url';
      icon = iu;
    } else if (req.body.icon_url === '') {
      // clear icon
      if (row.icon_type === 'file' && row.icon) {
        const oldIcon = path.join(uploadDir, row.icon);
        if (fs.existsSync(oldIcon)) fs.unlinkSync(oldIcon);
      }
      icon_type = 'none';
      icon = '';
    }
  } else if (req.body.icon_existing && String(req.body.icon_existing).trim()) {
    const name = String(req.body.icon_existing).trim();
    const p = path.join(uploadDir, name);
    if (fs.existsSync(p)) {
      // remove old uploaded icon file if different
      if (row.icon_type === 'file' && row.icon && row.icon !== name) {
        const oldIcon = path.join(uploadDir, row.icon);
        if (fs.existsSync(oldIcon)) fs.unlinkSync(oldIcon);
      }
      icon_type = 'file';
      icon = name;
    }
  }

  if (file) {
    const oldPath = path.join(uploadDir, row.filename);
    if (row.type === 'file' && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    type = 'file';
    url = '';
    filename = file.filename;
    original_name = file.originalname;
    size = file.size;
    mime = file.mimetype;
  } else if (req.body.url != null) {
    const linkUrl = String(req.body.url).trim();
    if (linkUrl) {
      try { new URL(linkUrl); } catch (e) { return res.status(400).json({ error: 'Invalid URL' }); }
      type = 'link';
      url = linkUrl;
      filename = '';
      original_name = linkUrl;
      size = 0;
      mime = '';
    }
  }

  db.prepare(`
    UPDATE downloads SET title=?, description=?, type=?, url=?, filename=?, original_name=?, size=?, mime=?, icon_type=?, icon=?, updated_at=datetime('now') WHERE id=?
  `).run(title, description, type, url, filename, original_name, size, mime, icon_type, icon, row.id);

  if (req.body.tags != null) {
    let tagNames = [];
    try { tagNames = JSON.parse(req.body.tags); } catch (e) { tagNames = String(req.body.tags).split(',').map(s=>s.trim()).filter(Boolean); }
    if (Array.isArray(tagNames)) setDownloadTags(row.id, tagNames);
  }

  const updated = db.prepare('SELECT * FROM downloads WHERE id = ?').get(row.id);
  res.json(attachTags([updated])[0]);
});

router.delete('/downloads/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.type === 'file' && row.filename) {
    const filePath = path.join(uploadDir, row.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  if (row.icon_type === 'file' && row.icon) {
    const iconPath = path.join(uploadDir, row.icon);
    if (fs.existsSync(iconPath)) fs.unlinkSync(iconPath);
  }
  db.prepare('DELETE FROM downloads WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

module.exports = router;
