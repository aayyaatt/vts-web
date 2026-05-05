require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const runMigrations = require('./db/migrate');

const pool = require('./db/pool');
setInterval(async () => {
  try {
    const threshold = 8; 
    await pool.query(`
      UPDATE visits
      SET status = 'overstay'
      WHERE status = 'active'
      AND check_in_time < now() - ($1 || ' hours')::interval
    `, [threshold]);
  } catch (err) {
    console.error('[OVERSTAY] Check failed:', err.message);
  }
}, 5 * 60 * 1000); 

const app  = express();
const PORT = process.env.PORT || 5000;


app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());



app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

//Start
async function start() {
  await runMigrations();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VTS] Server running on ${PORT}`);
  });
}
app.use('/api/card', require('./routes/card'));
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api',           require('./routes/api'));
const { spawn } = require('child_process');
const pathLib  = require('path');
const fsLib    = require('fs');

const erevealer = pathLib.join(__dirname, '..', 'card-reader', 'eRevealer.Gcc.exe');
if (fsLib.existsSync(erevealer)) {

const rdr = spawn(erevealer, [], {
    detached:    true,
    windowsHide: true,
    stdio:       'ignore'
  });
  
  rdr.unref();
  console.log('[CARD READER] eRevealer.Gcc started via Wine');
} else {
  console.warn('[CARD READER] eRevealer.Gcc.exe not found at:', erevealer);
}
start();