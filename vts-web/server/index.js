require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const runMigrations = require('./db/migrate');

// ── Overstay checker — runs every 5 minutes ───────────────────
const pool = require('./db/pool');
setInterval(async () => {
  try {
    const threshold = 8; // hours — matches system_config
    await pool.query(`
      UPDATE visits
      SET status = 'overstay'
      WHERE status = 'active'
      AND check_in_time < now() - ($1 || ' hours')::interval
    `, [threshold]);
  } catch (err) {
    console.error('[OVERSTAY] Check failed:', err.message);
  }
}, 5 * 60 * 1000); // every 5 minutes

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api',           require('./routes/api'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Start ─────────────────────────────────────────────────────
async function start() {
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`[VTS] Server running on http://localhost:${PORT}`);
  });
}

const { spawn } = require('child_process');
const pathLib  = require('path');
const fsLib    = require('fs');

// Auto-launch eRevealer.Gcc silently when server starts
const erevealer = pathLib.join(__dirname, '..', 'card-reader', 'eRevealer.Gcc.exe');
if (fsLib.existsSync(erevealer)) {
  const rdr = spawn(erevealer, [], {
    detached:    true,
    windowsHide: true,
    stdio:       'ignore'
  });
  rdr.unref();
  console.log('[CARD READER] eRevealer.Gcc started in background');
} else {
  console.warn('[CARD READER] eRevealer.Gcc.exe not found at:', erevealer);
  console.warn('[CARD READER] Copy it to the card-reader folder');
}

start();
