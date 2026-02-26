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
  const { visitor_id, card_id, host_employee, purpose, notes } = req.body;
  if (!visitor_id) return res.status(400).json({ error: 'visitor_id is required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert visit
    const { rows } = await client.query(
      `INSERT INTO visits (visitor_id, card_id, host_employee, purpose, notes, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [visitor_id, card_id || null, host_employee, purpose, notes, req.user.userId]
    );
    const visit = rows[0];

    // Mark card as assigned
    if (card_id) {
      await client.query(
        `UPDATE access_cards SET status='assigned', visitor_id=$1 WHERE card_id=$2`,
        [visitor_id, card_id]
      );
    }

    // Audit
    await client.query(
      `INSERT INTO audit_log (user_id, action, target_table, target_id, new_values)
       VALUES ($1,'CHECKIN','visits',$2,$3)`,
      [req.user.userId, visit.visit_id, JSON.stringify({ visitor_id, card_id, host_employee, purpose })]
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

// PATCH check-out
router.patch('/visits/:id/checkout', auth, async (req, res) => {
  const { id } = req.params;
  const client  = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE visits
       SET check_out_time=now(), status='completed', checked_out_by=$1
       WHERE visit_id=$2 AND status IN ('active','overstay')
       RETURNING *`,
      [req.user.userId, id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visit not found or already checked out.' });
    }

    const visit = rows[0];

    // Release card
    if (visit.card_id) {
      await client.query(
        `UPDATE access_cards SET status='available', visitor_id=NULL WHERE card_id=$1`,
        [visit.card_id]
      );
    }

    // Audit
    await client.query(
      `INSERT INTO audit_log (user_id, action, target_table, target_id)
       VALUES ($1,'CHECKOUT','visits',$2)`,
      [req.user.userId, id]
    );

    await client.query('COMMIT');
    res.json(visit);
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

module.exports = router;
