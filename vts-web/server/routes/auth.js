const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const pool    = require('../db/pool');
const authMiddleware = require('../middleware/auth');

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // 1. Find user
    const { rows } = await pool.query(
      `SELECT user_id, email, password_hash, full_name, phone, role,
              is_active, failed_logins, locked_until
       FROM   users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];

    // 2. Active?
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated. Contact your administrator.' });
    }

    // 3. Locked?
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const t = new Date(user.locked_until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return res.status(403).json({ error: `Account locked until ${t}. Too many failed attempts.` });
    }

    // 4. Verify password
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      const newFails   = (user.failed_logins || 0) + 1;
      const lockUntil  = newFails >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;

      await pool.query(
        `UPDATE users SET failed_logins=$1, locked_until=$2, updated_at=now() WHERE user_id=$3`,
        [newFails, lockUntil, user.user_id]
      );

      if (lockUntil) {
        return res.status(401).json({ error: 'Account locked for 30 minutes after too many failed attempts.' });
      }
      return res.status(401).json({ error: `Invalid email or password. ${5 - newFails} attempt(s) remaining.` });
    }

    // 5. Reset failed logins + update last_login
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    await pool.query(
      `UPDATE users
       SET failed_logins=0, locked_until=NULL, last_login=now(), last_login_ip=$1, updated_at=now()
       WHERE user_id=$2`,
      [clientIp, user.user_id]
    );

    // 6. Create session + JWT
    const tokenHash = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    const sessionRes = await pool.query(
      `INSERT INTO user_sessions (user_id, token_hash, ip_address, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING session_id`,
      [user.user_id, tokenHash, clientIp, expiresAt]
    );

    const sessionId = sessionRes.rows[0].session_id;

    const token = jwt.sign(
      { userId: user.user_id, role: user.role, email: user.email, tokenHash },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // 7. Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, target_table, target_id, new_values, ip_address)
       VALUES ($1, 'LOGIN', 'users', $2, $3, $4)`,
      [user.user_id, String(user.user_id), JSON.stringify({ email: user.email, role: user.role }), clientIp]
    );

    return res.json({
      token,
      user: {
        user_id:   user.user_id,
        email:     user.email,
        full_name: user.full_name,
        role:      user.role,
        phone:     user.phone,
        session_id: sessionId,
      }
    });

  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE user_sessions SET is_revoked=true WHERE token_hash=$1`,
      [req.user.tokenHash]
    );
    await pool.query(
      `INSERT INTO audit_log (user_id, action) VALUES ($1, 'LOGOUT')`,
      [req.user.userId]
    );
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Logout error.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT user_id, email, full_name, role, phone, last_login FROM users WHERE user_id=$1`,
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
