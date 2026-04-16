const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

router.get('/stats', auth, async (req, res) => {
  try {
    const [active, available, overstay, denied] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM visits WHERE status IN ('active','overstay')`),
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


// routes/dashboard.js (or wherever your dashboard routes are)

router.get('/active-visits', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.visit_id, 
        v.status, 
        v.check_in_time, 
        v.host_employee, 
        v.floor,
        vi.full_name AS visitor_name, 
        vi.cpr_number,
        ac.card_uid,
        d.name AS department_name,
        u.full_name AS checked_in_by_name, -- 1. Added this
        EXTRACT(EPOCH FROM (COALESCE(v.check_out_time, now()) - v.check_in_time))/60 AS duration_minutes
      FROM visits v
      JOIN visitors vi ON vi.visitor_id = v.visitor_id
      LEFT JOIN access_cards ac ON ac.card_id = v.card_id
      LEFT JOIN departments d ON d.department_id = v.department_id
      LEFT JOIN users u ON u.user_id = v.issued_by -- 2. Added this JOIN
      WHERE v.status IN ('active', 'overstay')
      ORDER BY v.check_in_time DESC
    `);
    
    // Debugging line
    console.log("Dashboard Rows:", rows[0]); 
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/activity', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        al.audit_id,
        al.action,
        al.target_table,
        al.new_values,
        al.performed_at,
        u.full_name      AS staff_name,
        vi.full_name     AS visitor_name,
        vi.cpr_number    AS visitor_cpr
      FROM audit_log al
      JOIN users u ON u.user_id = al.user_id
      LEFT JOIN visits v
        ON v.visit_id::text = al.target_id
        AND al.action IN ('CHECKIN', 'CHECKOUT')
      LEFT JOIN visitors vi ON vi.visitor_id = v.visitor_id
      ORDER BY al.performed_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
