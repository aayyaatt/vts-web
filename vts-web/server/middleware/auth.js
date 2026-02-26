const jwt  = require('jsonwebtoken');
const pool = require('../db/pool');

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check session is not revoked
    const { rows } = await pool.query(
      `SELECT session_id FROM user_sessions
       WHERE token_hash = $1 AND is_revoked = false AND expires_at > now()`,
      [decoded.tokenHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or revoked. Please log in again.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
};
