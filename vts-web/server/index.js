require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const runMigrations = require('./db/migrate');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api',           require('./routes/api'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Start ─────────────────────────────────────────────────────
async function start() {
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`[VTS] Server running on http://localhost:${PORT}`);
  });
}

start();
