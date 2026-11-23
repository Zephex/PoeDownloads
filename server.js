const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const db = require('./db');
const { ensureAdmin } = require('./auth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

ensureAdmin();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'poe-downloads-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// SPA-ish fallback: serve index.html for unknown non-api routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Downloads site running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});
