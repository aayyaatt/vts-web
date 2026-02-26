const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

// ── GET /api/dashboard/stats ──────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const [active, available, overstay, denied] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM visits WHERE status='active'`),
      pool.query(`SELECT COUNT(*) FROM access_cards WHERE status='available'`),
      pool.query(`SELECT COUNT(*) FROM visits WHERE status='overstay'`),
      pool.query(`SELECT COUNT(*) FROM audit_log WHERE action='ACCESS_DENIED' AND performed_at > now() - interval '24h'`),
    ]);
    res.json({
      visitors_inside: parseInt(active.rows[0].count),
      cards_available: parseInt(available.rows[0].count),
      overstay_alerts: parseInt(overstay.rows[0].count),
      denied_today:    parseInt(denied.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/active-visits ─────────────────────────
router.get('/active-visits', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.visit_id, v.status, v.check_in_time, v.host_employee, v.purpose, v.notes,
        vi.full_name AS visitor_name, vi.cpr_number, vi.phone, vi.company,
        ac.card_uid,
        u.full_name AS issued_by_name,
        EXTRACT(EPOCH FROM (now() - v.check_in_time))/60 AS duration_minutes
      FROM visits v
      JOIN visitors   vi ON vi.visitor_id = v.visitor_id
      LEFT JOIN access_cards ac ON ac.card_id = v.card_id
      JOIN users      u  ON u.user_id    = v.issued_by
      WHERE v.status IN ('active','overstay')
      ORDER BY v.check_in_time ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/activity ──────────────────────────────
router.get('/activity', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT action, target_table, new_values, performed_at, u.full_name
      FROM audit_log al
      JOIN users u ON u.user_id = al.user_id
      ORDER BY performed_at DESC LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
