const express = require('express');
const router  = express.Router();
const pool = require('../db/pool');
const auth    = require('../middleware/auth');

router.get('/stats', auth, async (req, res) => {
  try {
const overstayQuery = `
  SELECT COUNT(*) FROM visits
  WHERE check_out_time IS NULL
  AND (
    (LOWER(purpose) LIKE '%delivery%' AND EXTRACT(EPOCH FROM (now() - check_in_time))/60 >= 10)
    OR
    (valid_until IS NOT NULL AND valid_until < now())
    OR
    (LOWER(purpose) NOT LIKE '%delivery%' AND (
      valid_until IS NULL AND EXTRACT(EPOCH FROM (now() - check_in_time))/60 >= 120 -- Change from 480 to 120
    ))
  )`;
    const [active, available, overstay, checkins] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM visits WHERE check_out_time IS NULL`),
      pool.query(`SELECT COUNT(*) FROM access_cards WHERE status='available'`),
      pool.query(overstayQuery),
      pool.query(`SELECT COUNT(*) FROM visits WHERE check_in_time::date = CURRENT_DATE`),
    ]);

    res.json({
      visitors_inside: parseInt(active.rows[0].count),
      cards_available: parseInt(available.rows[0].count),
      overstay_alerts: parseInt(overstay.rows[0].count),
      checkins_today:  parseInt(checkins.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/active-visits', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.visit_id,
        v.check_in_time,
        v.host_employee,
        v.floor,
        v.purpose,
        v.valid_until,
        vi.full_name AS visitor_name,
        vi.cpr_number,
        ac.card_uid,
        d.name  AS department_name,
        u.full_name AS checked_in_by_name,
        EXTRACT(EPOCH FROM (now() - v.check_in_time))/60 AS duration_minutes,
        -- Dynamic status: respects delivery (10m), valid_until, and default 8h
       CASE
  -- 1. Delivery overstay (10 minutes)
  WHEN LOWER(v.purpose) LIKE '%delivery%' 
       AND EXTRACT(EPOCH FROM (now() - v.check_in_time))/60 >= 10 
       THEN 'overstay'

  -- 2. General visitor overstay (120 minutes / 2 hours)
  WHEN LOWER(v.purpose) NOT LIKE '%delivery%' 
       AND EXTRACT(EPOCH FROM (now() - v.check_in_time))/60 >= 120 
       THEN 'overstay'

  -- 3. Explicit expiry time reached (if valid_until is set manually)
  WHEN v.valid_until IS NOT NULL AND v.valid_until < now() 
       THEN 'overstay'

  ELSE 'active'
END AS status
      FROM visits v
      JOIN visitors vi ON vi.visitor_id = v.visitor_id
      LEFT JOIN access_cards ac ON ac.card_id = v.card_id
      LEFT JOIN departments d ON d.department_id = v.department_id
      LEFT JOIN users u ON u.user_id = v.issued_by
      WHERE v.check_out_time IS NULL
      ORDER BY v.check_in_time ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/activity', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        al.audit_id, al.action, al.target_table, al.new_values, al.performed_at,
        u.full_name  AS staff_name,
        vi.full_name AS visitor_name,
        vi.cpr_number AS visitor_cpr
      FROM audit_log al
      JOIN users u ON u.user_id = al.user_id
      LEFT JOIN visits v
        ON v.visit_id::text = al.target_id
        AND al.action IN ('CHECKIN','CHECKOUT')
      LEFT JOIN visitors vi ON vi.visitor_id = v.visitor_id
      ORDER BY al.performed_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;