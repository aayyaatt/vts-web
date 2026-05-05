const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

// -- VISITORS ---------------------------------------------------

// GET all visitors
router.get('/visitors', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.*,
        EXISTS (
          SELECT 1 FROM visits vt
          WHERE vt.visitor_id = v.visitor_id
          AND vt.status IN ('active','overstay')
        ) AS is_active_visit
      FROM visitors v
      ORDER BY v.created_at DESC LIMIT 100
    `);
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

// -- VISITS ----------------------------------------------
// GET all visits (with visitor + card info)
router.get('/visits', auth, async (req, res) => {
  const { status, visit_id } = req.query;
  try {
    let whereClause = '';
    let params = [];

    if (visit_id) {
      whereClause = 'WHERE v.visit_id = $1';
      params = [visit_id];
    } else if (status) {
      whereClause = 'WHERE v.status = $1';
      params = [status];
    }

    const { rows } = await pool.query(`
      SELECT
        v.visit_id, 
        v.status, 
        v.check_in_time, 
        v.check_out_time,
        v.host_employee, 
        v.purpose, 
        v.notes, 
        v.floor,
        v.issued_by,
        vi.full_name AS visitor_name, 
        vi.cpr_number, 
        vi.company,
        ac.card_uid,
        d.name AS department_name,
        u.full_name AS checked_in_by_name,
        EXTRACT(EPOCH FROM (COALESCE(v.check_out_time, now()) - v.check_in_time))/60 AS duration_minutes
      FROM visits v
      JOIN visitors vi ON vi.visitor_id = v.visitor_id
      LEFT JOIN access_cards ac ON ac.card_id = v.card_id
      LEFT JOIN departments d ON d.department_id = v.department_id
      LEFT JOIN users u ON u.user_id = v.issued_by
      ${whereClause}
      ORDER BY v.check_in_time DESC LIMIT 200
    `, params);
    
    // 1. THIS PRINTS TO YOUR BACKEND TERMINAL
    console.log("--- DEBUG DASHBOARD DATA ---");
    if (rows.length > 0) {
      console.log("First Row:", rows[0]);
    } else {
      console.log("No rows found for query:", whereClause, params);
    }

    // 2. THIS SENDS THE DATA TO THE BROWSER (CRITICAL!)
    res.json(rows);

  } catch (err) { 
    console.error("Dashboard Fetch Error:", err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// GET visits by visitor ID
router.get('/visits/by-visitor/:visitor_id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.visit_id, v.status, v.check_in_time, v.check_out_time,
        v.host_employee, v.purpose, v.notes, v.floor,
        ac.card_uid,
        d.name AS department_name,
        u.full_name AS checked_in_by_name,
        EXTRACT(EPOCH FROM (COALESCE(v.check_out_time, now()) - v.check_in_time))/60 AS duration_minutes
      FROM visits v
      LEFT JOIN access_cards ac ON ac.card_id = v.card_id
      LEFT JOIN departments d ON d.department_id = v.department_id
      LEFT JOIN users u ON u.user_id = v.issued_by
      WHERE v.visitor_id = $1
      ORDER BY v.check_in_time DESC
    `, [req.params.visitor_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create new visit (check-in)
// POST create new visit (check-in)
router.post('/visits', auth, async (req, res) => {
  const { visitor_id, card_id, host_employee, purpose, notes, department_id } = req.body;
  if (!visitor_id) return res.status(400).json({ error: 'visitor_id is required.' });

  // FIXED: Standardize the variable for the logged-in staff member
  // Using req.user.user_id to match your definition logic
  const staffId = req.user.user_id || req.user.userId; 

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // -- Check for existing active visit ----------------------------------------
    const activeCheck = await client.query(
      `SELECT visit_id, card_id FROM visits
       WHERE visitor_id = $1 AND status IN ('active', 'overstay')
       LIMIT 1`,
      [visitor_id]
    );

    if (activeCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'This visitor is already checked in and currently inside the building. Please check them out first.',
        active_visit_id: activeCheck.rows[0].visit_id
      });
    }

    // Get floor from department -------------------------------------------------
    let floor = null;
    if (department_id) {
      const dRes = await client.query(
        `SELECT floor FROM departments WHERE department_id = $1`,
        [department_id]
      );
      floor = dRes.rows[0]?.floor || null;
    }

    // 1. Insert visit (Using staffId for issued_by)
    const { rows } = await client.query(
      `INSERT INTO visits (visitor_id, card_id, host_employee, purpose, notes, issued_by, department_id, floor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [visitor_id, card_id || null, host_employee, purpose, notes,
       staffId, department_id || null, floor]
    );
    const visit = rows[0];

    // 2. Update Card Status
    if (card_id) {
      await client.query(
        `UPDATE access_cards SET status='assigned', visitor_id=$1 WHERE card_id=$2`,
        [visitor_id, card_id]
      );
    }

    // 3. NEW: Insert into card_logs so your Log UI shows data
    await client.query(
      `INSERT INTO card_logs (card_id, user_id, action, visitor_id, notes)
       VALUES ($1, $2, 'CHECKIN', $3, $4)`,
      [card_id, staffId, visitor_id, notes || purpose]
    );

    // Mark pre-registration as completed
    await client.query(
      `UPDATE pre_registrations SET status='completed'
       WHERE visitor_id = $1 AND status = 'pending'`,
      [visitor_id]
    );

    // 4. Audit log (Using staffId)
    await client.query(
      `INSERT INTO audit_log (user_id, action, target_table, target_id, new_values)
       VALUES ($1,'CHECKIN','visits',$2,$3)`,
      [staffId, visit.visit_id,
       JSON.stringify({ visitor_id, card_id, host_employee, purpose, department_id, floor })]
    );

    await client.query('COMMIT');
    res.status(201).json(visit);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Check-in Error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// PATCH check-out
router.patch('/visits/:id/checkout', auth, async (req, res) => {
  const { id } = req.params;
  console.log('[CHECKOUT] visit:', id, 'by user:', req.user.userId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE visits
       SET check_out_time = now(), status = 'completed', checked_out_by = $1
       WHERE visit_id = $2 AND status IN ('active', 'overstay')
       RETURNING *`,
      [req.user.userId, id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visit not found or already checked out.' });
    }

    const visit = rows[0];

    // Release card back to pool
    if (visit.card_id) {
      await client.query(
        `UPDATE access_cards SET status = 'available', visitor_id = NULL WHERE card_id = $1`,
        [visit.card_id]
      );
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_log (user_id, action, target_table, target_id)
       VALUES ($1, 'CHECKOUT', 'visits', $2)`,
      [req.user.userId, id]
    );

    await client.query('COMMIT');
    res.json(visit);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CHECKOUT] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET visits by visitor ID
router.get('/visits/by-visitor/:visitor_id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.visit_id, v.status, v.check_in_time, v.check_out_time,
        v.host_employee, v.purpose, v.notes, v.floor,
        ac.card_uid,
        d.name AS department_name,
        EXTRACT(EPOCH FROM (COALESCE(v.check_out_time, now()) - v.check_in_time))/60 AS duration_minutes
      FROM visits v
      LEFT JOIN access_cards ac ON ac.card_id = v.card_id
      LEFT JOIN departments d ON d.department_id = v.department_id
      WHERE v.visitor_id = $1
      ORDER BY v.check_in_time DESC
    `, [req.params.visitor_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

//  CARDS ------------------------------------------------------------------------

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

// DOORS 

router.get('/doors', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM doors WHERE is_active=true ORDER BY door_id`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

//  USERS (admin only)

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


//-- GOOGLE FORMS SUBMISSION -------------------------------------------
router.post('/visits-from-form', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.FORM_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  const { full_name, cpr_number, phone, email, company } = req.body;
  if (!full_name || !cpr_number) return res.status(400).json({ error: 'full_name and cpr_number are required.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO visitors (full_name, cpr_number, phone, email, company)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (cpr_number) DO UPDATE
         SET full_name=$1, phone=$3, email=$4, company=$5, updated_at=now()
       RETURNING *`,
      [full_name, cpr_number, phone||null, email||null, company||null]
    );
    res.json({ success: true, visitor: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// -- USER MANAGEMENT (admin only) ------------------------------------------------------
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

const pwChecks = {
  length:  password.length >= 10,
  upper:   /[A-Z]/.test(password),
  lower:   /[a-z]/.test(password),
  number:  /[0-9]/.test(password),
  symbol:  /[^A-Za-z0-9]/.test(password),
};
if (!Object.values(pwChecks).every(Boolean)) {
  return res.status(400).json({ error: 'Password must be at least 10 characters and include an uppercase letter, lowercase letter, number, and symbol.' });
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

// -- DEPARTMENTS ---------------------------------------------------

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

// -- CARD MANAGEMENT ---------------------------------------------------------

// POST add new card (admin only)
router.post('/cards', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Admin or manager only.' });
  }
  const { card_uid } = req.body;
  if (!card_uid) return res.status(400).json({ error: 'card_uid is required.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO access_cards (card_uid, status)
       VALUES ($1, 'available') RETURNING *`,
      [card_uid.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A card with this UID already exists.' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH update card status (admin only)
router.patch('/cards/:id', auth, async (req, res) => {
  const { status, card_uid, last_note } = req.body;
  const isStaff = req.user.role !== 'admin' && req.user.role !== 'manager';

  // FIX: If they are staff, they are ONLY allowed to send 'last_note'
  if (isStaff) {
    if (status !== undefined || card_uid !== undefined) {
      return res.status(403).json({ error: 'Staff can only update notes, not status or UID.' });
    }
  }

  const validStatuses = ['available', 'assigned', 'lost', 'retired'];
  if (status && !validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status.' });

  try {
    const { rows } = await pool.query(
      `UPDATE access_cards SET
           status   = COALESCE($1, status),
           card_uid = COALESCE($2, card_uid),
           last_note = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE last_note END
         WHERE card_id = $4 RETURNING *`,
      [status || null, card_uid || null, last_note !== undefined ? last_note : null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Card not found.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE card (admin only — only if available or retired)
router.delete('/cards/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only.' });
  }
  try {
    const check = await pool.query(
      `SELECT status FROM access_cards WHERE card_id = $1`,
      [req.params.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Card not found.' });
    if (check.rows[0].status === 'assigned') {
      return res.status(409).json({ error: 'Cannot delete a card that is currently assigned to a visitor.' });
    }
    await pool.query(`DELETE FROM access_cards WHERE card_id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST card issue report (sent to audit log for admin review)
router.post('/visits/card-report', auth, async (req, res) => {
  const { card_uid, visitor_name, note } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get the name of the logged-in user (the one reporting)
    const userRes = await client.query(
      'SELECT full_name FROM users WHERE user_id = $1', 
      [req.user.userId]
    );
    const reporterName = userRes.rows[0]?.full_name || 'System';

    // 2. Format the note to show who reported it and which visitor had it
    const formattedNote = `Reported by ${reporterName}: ${note}`;

    // 3. Update the access_cards table
    await client.query(
      `UPDATE access_cards 
       SET status = 'lost', last_note = $1 
       WHERE card_uid = $2`,
      [formattedNote, card_uid]
    );

    // 4. Log to audit_log for a permanent history
    await client.query(
      `INSERT INTO audit_log (user_id, action, target_table, new_values)
       VALUES ($1, 'CARD_ISSUE_REPORT', 'access_cards', $2)`,
      [
        req.user.userId,
        JSON.stringify({ 
          card_uid, 
          visitor_name, 
          note, 
          reported_by: reporterName, 
          timestamp: new Date() 
        })
      ]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// -- CARD SKIP (Card wasn't assigned — skip to next) ------------------------------------------------------

// POST skip card — marks current card as problematic, returns next available
// POST skip card — FAST SKIP (No reason required)
router.post('/cards/skip', auth, async (req, res) => {
  const { card_id } = req.body; 
  if (!card_id) return res.status(400).json({ error: 'card_id is required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get reporter name
    const uRes = await client.query('SELECT full_name FROM users WHERE user_id=$1', [req.user.userId]);
    const reporter = uRes.rows[0]?.full_name || 'Unknown';

    // Mark as 'retired' by default for quick skipping
    const note = `Quick-skipped during check-in by ${reporter}. ${new Date().toLocaleString('en-GB')}`;
    
    await client.query(
      `UPDATE access_cards 
       SET status='retired', last_note=$1, skip_count=COALESCE(skip_count,0)+1, visitor_id=NULL 
       WHERE card_id=$2`,
      [note, card_id]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_log (user_id, action, target_table, target_id, new_values)
       VALUES ($1,'CARD_SKIP_FAST','access_cards',$2,$3)`,
      [req.user.userId, String(card_id), JSON.stringify({ card_id, action: 'fast_skip' })]
    );

    // Get the next available card immediately
const nextRes = await client.query(
  `SELECT * FROM access_cards 
   WHERE status='available' AND card_id != $1 
   ORDER BY card_id ASC LIMIT 1`,
  [card_id]
);

    await client.query('COMMIT');
    res.json({ success: true, next_card: nextRes.rows[0] || null });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// -- CARD ACTIVITY LOGS -------------------------------------------------------

// GET all card-specific activity logs
router.get('/cards/logs', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        cl.log_id,
        cl.created_at,
        cl.action,
        ac.card_uid,
        cl.notes,
        u.full_name as staff_name,
        v.full_name as visitor_name,
        v.company as visitor_company
      FROM public.card_logs cl
      JOIN public.access_cards ac ON cl.card_id = ac.card_id
      LEFT JOIN public.users u ON cl.user_id = u.user_id
      LEFT JOIN public.visitors v ON cl.visitor_id = v.visitor_id
      ORDER BY cl.created_at DESC 
      LIMIT 500
    `);
    res.json(rows);
  } catch (err) {
    console.error("Database Error:", err.message);
    res.status(500).json({ error: "Could not fetch card logs. Ensure table card_logs is populated." });
  }
});

// POST card issue report (legacy — kept for compatibility)
// router.post('/visits/card-report', auth, async (req, res) => {
//   const { card_uid, visitor_name, note } = req.body;
//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');
//     const uRes = await client.query('SELECT full_name FROM users WHERE user_id=$1', [req.user.userId]);
//     const reporter = uRes.rows[0]?.full_name || 'System';
//     const formattedNote = `Reported by ${reporter}: ${note}`;
//     if (card_uid) {
//       await client.query(
//         `UPDATE access_cards SET status='lost', last_note=$1 WHERE card_uid=$2`,
//         [formattedNote, card_uid]
//       );
//     }
//     await client.query(
//       `INSERT INTO audit_log (user_id, action, target_table, new_values)
//        VALUES ($1,'CARD_ISSUE_REPORT','access_cards',$2)`,
//       [req.user.userId, JSON.stringify({ card_uid, visitor_name, note, reported_by: reporter, timestamp: new Date() })]
//     );
//     await client.query('COMMIT');
//     res.json({ success: true });
//   } catch (err) {
//     await client.query('ROLLBACK');
//     res.status(500).json({ error: err.message });
//   } finally {
//     client.release();
//   }
// });

module.exports = router;