const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

// ══ VISITORS ═══════════════════════════════════════════════════

// GET all visitors
router.get('/visitors', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM visitors ORDER BY created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create or upsert visitor
router.post("/visitors", auth, async (req, res) => {
  const { full_name, cpr_number, phone, email, company } = req.body;
  if (!full_name || !cpr_number) return res.status(400).json({ error: "full_name and cpr_number required." });
  try {
    const { rows } = await pool.query(
      `INSERT INTO visitors (full_name, cpr_number, phone, email, company)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (cpr_number) DO UPDATE
         SET full_name=$1, phone=$3, email=$4, company=$5, updated_at=now()
       RETURNING *`,
      [full_name, cpr_number, phone||null, email||null, company||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST check CPR against flagged list
router.post('/visitors/check-cpr', auth, async (req, res) => {
  const { cpr_number } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT flag_id, flag_type, reason FROM flagged_visitors
       WHERE cpr_number=$1 AND is_active=true
       AND (expires_at IS NULL OR expires_at > now())`,
      [cpr_number]
    );
    res.json({ flagged: rows.length > 0, flag: rows[0] || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ VISITS ═════════════════════════════════════════════════════

// GET all visits (with visitor + card info)
router.get('/visits', auth, async (req, res) => {
  const { status } = req.query;
  try {
    const { rows } = await pool.query(`
      SELECT
        v.visit_id, v.status, v.check_in_time, v.check_out_time,
        v.host_employee, v.purpose, v.notes,
        vi.full_name AS visitor_name, vi.cpr_number, vi.company,
        ac.card_uid,
        EXTRACT(EPOCH FROM (COALESCE(v.check_out_time, now()) - v.check_in_time))/60 AS duration_minutes
      FROM visits v
      JOIN visitors vi ON vi.visitor_id = v.visitor_id
      LEFT JOIN access_cards ac ON ac.card_id = v.card_id
      ${status ? 'WHERE v.status=$1' : ''}
      ORDER BY v.check_in_time DESC LIMIT 200
    `, status ? [status] : []);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// POST create new visit (check-in)
router.post('/visits', auth, async (req, res) => {
  const { visitor_id, card_id, host_employee, purpose, notes, department_id } = req.body;
  if (!visitor_id) return res.status(400).json({ error: 'visitor_id is required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Look up floor from department
    let floor = null;
    if (department_id) {
      const dRes = await client.query(
        `SELECT floor FROM departments WHERE department_id = $1`,
        [department_id]
      );
      floor = dRes.rows[0]?.floor || null;
    }

    // Insert visit with department and floor
    const { rows } = await client.query(
      `INSERT INTO visits (visitor_id, card_id, host_employee, purpose, notes, issued_by, department_id, floor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [visitor_id, card_id || null, host_employee, purpose, notes, req.user.userId, department_id || null, floor]
    );
    const visit = rows[0];

    if (card_id) {
      await client.query(
        `UPDATE access_cards SET status='assigned', visitor_id=$1 WHERE card_id=$2`,
        [visitor_id, card_id]
      );
    }

    await client.query(
      `INSERT INTO audit_log (user_id, action, target_table, target_id, new_values)
       VALUES ($1,'CHECKIN','visits',$2,$3)`,
      [req.user.userId, visit.visit_id, JSON.stringify({ visitor_id, card_id, host_employee, purpose, department_id, floor })]
    );

    await client.query('COMMIT');
    res.status(201).json(visit);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ══ CARDS ══════════════════════════════════════════════════════

// GET all cards
router.get('/cards', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ac.*, vi.full_name AS visitor_name
      FROM access_cards ac
      LEFT JOIN visitors vi ON vi.visitor_id = ac.visitor_id
      ORDER BY ac.card_id ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET next available card
router.get('/cards/next-available', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT card_id, card_uid FROM access_cards
       WHERE status='available' ORDER BY card_id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
    );
    res.json(rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ DOORS ══════════════════════════════════════════════════════

router.get('/doors', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM doors WHERE is_active=true ORDER BY door_id`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ USERS (admin only) ═════════════════════════════════════════

router.get('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT user_id, email, full_name, role, phone, is_active, last_login, created_at FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══ GOOGLE FORMS SUBMISSION ════════════════════════════════════

router.post('/visits-from-form', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.FORM_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { full_name, cpr_number, phone, email, company, host_employee, purpose, department } = req.body;
  if (!full_name || !cpr_number) {
    return res.status(400).json({ error: 'full_name and cpr_number are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert visitor
    const vRes = await client.query(
      `INSERT INTO visitors (full_name, cpr_number, phone, email, company)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (cpr_number) DO UPDATE
         SET full_name=$1, phone=$3, email=$4, company=$5, updated_at=now()
       RETURNING visitor_id`,
      [full_name, cpr_number, phone||null, email||null, company||null]
    );
    const visitor_id = vRes.rows[0].visitor_id;

    // Look up department by name and get floor
    let department_id = null;
    let floor = null;
    if (department) {
      const dRes = await client.query(
        `SELECT department_id, floor FROM departments
         WHERE LOWER(name) = LOWER($1) AND is_active = true`,
        [department]
      );
      if (dRes.rows.length > 0) {
        department_id = dRes.rows[0].department_id;
        floor         = dRes.rows[0].floor;
      }
    }

    // Get next available card
    const cardRes = await client.query(
      `SELECT card_id FROM access_cards
       WHERE status='available' ORDER BY card_id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
    );
    const card_id = cardRes.rows[0]?.card_id || null;

    // Get first admin user
    const userRes = await client.query(
      `SELECT user_id FROM users WHERE role='admin' LIMIT 1`
    );
    const issued_by = userRes.rows[0]?.user_id;

    // Create visit
    await client.query(
      `INSERT INTO visits (visitor_id, card_id, host_employee, purpose, issued_by, department_id, floor)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [visitor_id, card_id, host_employee||null, purpose||null, issued_by, department_id, floor]
    );

    // Mark card assigned
    if (card_id) {
      await client.query(
        `UPDATE access_cards SET status='assigned', visitor_id=$1 WHERE card_id=$2`,
        [visitor_id, card_id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, visitor_id, card_id, floor });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// ══ USER MANAGEMENT (admin only) ══════════════════════════════

// POST create new user
router.post('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create user accounts.' });
  }

  const { email, password, full_name, role, phone } = req.body;

  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'email, password, full_name and role are required.' });
  }

  const validRoles = ['admin', 'security', 'manager', 'reception'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const bcrypt = require('bcrypt');
    const hash   = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, phone, is_active)
       VALUES ($1,$2,$3,$4,$5,true)
       RETURNING user_id, email, full_name, role, phone, created_at`,
      [email.toLowerCase().trim(), hash, full_name, role, phone || null]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, target_table, target_id, new_values)
       VALUES ($1,'CREATE_USER','users',$2,$3)`,
      [req.user.userId, String(rows[0].user_id), JSON.stringify({ email, full_name, role })]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle user active/inactive
router.patch('/users/:id/toggle', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can modify user accounts.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET is_active = NOT is_active, updated_at = now()
       WHERE user_id = $1 RETURNING user_id, email, full_name, role, is_active`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══ DEPARTMENTS ════════════════════════════════════════════════

// GET all departments
router.get('/departments', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM departments ORDER BY floor, name`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create department (admin only)
router.post('/departments', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  const { name, floor, description } = req.body;
  if (!name || !floor) return res.status(400).json({ error: 'name and floor are required.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO departments (name, floor, description)
       VALUES ($1,$2,$3) RETURNING *`,
      [name, floor, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Department already exists.' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH update department (admin only)
router.patch('/departments/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  const { name, floor, description, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE departments SET
         name        = COALESCE($1, name),
         floor       = COALESCE($2, floor),
         description = COALESCE($3, description),
         is_active   = COALESCE($4, is_active)
       WHERE department_id = $5 RETURNING *`,
      [name, floor, description, is_active, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Department not found.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE department (admin only)
router.delete('/departments/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  try {
    await pool.query(`DELETE FROM departments WHERE department_id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

