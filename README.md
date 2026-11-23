# Exile Downloads

A simple site listing downloads, managed from a backend admin panel.
Themed after Path of Exile (dark fantasy).

## Run

```bash
npm install
npm start
```

Then open http://localhost:3000

- Public downloads: http://localhost:3000
- Admin panel: http://localhost:3000/admin.html

Default admin credentials: `admin` / `admin` (override with `ADMIN_USER` and `ADMIN_PASSWORD` env vars).

## Environment variables

- `PORT` - server port (default 3000)
- `ADMIN_USER` - admin username (default admin)
- `ADMIN_PASSWORD` - admin password (default admin)
- `SESSION_SECRET` - session signing secret

## Data

- SQLite database: `data/app.db`
- Uploaded files: `uploads/`
