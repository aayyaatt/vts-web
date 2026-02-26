const pool = require('./pool');

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[DB] Running migrations...');

    // Add columns that may be missing from the original dump
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active      BOOLEAN     NOT NULL DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins  INT         NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until   TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login     TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip  INET;
    `);

    // Add missing tables if they don't exist yet
    await client.query(`
      CREATE TABLE IF NOT EXISTS visits (
        visit_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id       UUID         NOT NULL REFERENCES visitors(visitor_id),
        card_id          INT          REFERENCES access_cards(card_id),
        host_employee    VARCHAR(150),
        purpose          TEXT,
        check_in_time    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        check_out_time   TIMESTAMPTZ,
        issued_by        INT          NOT NULL REFERENCES users(user_id),
        checked_out_by   INT          REFERENCES users(user_id),
        status           VARCHAR(20)  NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','completed','overstay','flagged')),
        notes            TEXT,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS flagged_visitors (
        flag_id       SERIAL PRIMARY KEY,
        cpr_number    VARCHAR(20)   NOT NULL UNIQUE,
        flag_type     VARCHAR(20)   NOT NULL
                      CHECK (flag_type IN ('banned','watchlist','temporary')),
        reason        TEXT          NOT NULL,
        flagged_by    INT           NOT NULL REFERENCES users(user_id),
        expires_at    TIMESTAMPTZ,
        is_active     BOOLEAN       NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        notification_id  BIGSERIAL PRIMARY KEY,
        type             VARCHAR(30)  NOT NULL
                         CHECK (type IN ('overstay','banned_hit','access_denied','system')),
        severity         VARCHAR(10)  NOT NULL CHECK (severity IN ('info','warning','critical')),
        title            VARCHAR(200) NOT NULL,
        body             TEXT,
        related_visit_id UUID         REFERENCES visits(visit_id),
        is_dismissed     BOOLEAN      NOT NULL DEFAULT false,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
      );
    `);

    // Seed default admin if users table is empty
    const { rows } = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      const bcrypt = require('bcrypt');
      const hash   = await bcrypt.hash('Admin@1234', 12);
      await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, 'admin', true)`,
        ['admin@vts.local', hash, 'System Administrator']
      );
      console.log('[DB] Default admin created → admin@vts.local / Admin@1234');
    }

    console.log('[DB] Migrations complete.');
  } catch (err) {
    console.error('[DB] Migration error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = runMigrations;
