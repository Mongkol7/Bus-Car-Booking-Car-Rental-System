const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'bookride-dev-secret';
const PACKAGE_ALLOWANCE_KG = 20;
const OVERWEIGHT_RATE = 0.5;

// Middleware
app.use(cors()); // Allow frontend to fetch data
app.use(express.json()); // Allow parsing JSON requests

// PostgreSQL Connection Pool
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// Test the connection
pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL Database:', process.env.DB_NAME))
  .catch(err => console.error('❌ Connection Error:', err.message));

const userSchemaReady = runUserSchemaMigration()
  .catch(err => console.error('User management migration failed:', err.message));

// ==========================================
// API ROUTES
// ==========================================

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createAuthToken(user) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    })
  );
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${header}.${payload}.${signature}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function decodeBase64UrlJson(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

async function getAuthUserFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    throw Object.assign(new Error('Authentication required.'), { status: 401 });
  }

  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    throw Object.assign(new Error('Invalid session token.'), { status: 401 });
  }

  const expected = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  if (signature !== expected) {
    throw Object.assign(new Error('Invalid session token.'), { status: 401 });
  }

  const decoded = decodeBase64UrlJson(payload);
  if (!decoded.sub || (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000))) {
    throw Object.assign(new Error('Session expired.'), { status: 401 });
  }

  const session = await pool.query(
    `SELECT id
     FROM user_sessions
     WHERE token_hash = $1
       AND is_revoked = FALSE
       AND expires_at > NOW()
     LIMIT 1`,
    [hashToken(token)]
  );
  if (!session.rowCount) {
    throw Object.assign(new Error('Session expired.'), { status: 401 });
  }

  const user = await pool.query(
    `SELECT
       u.id,
       u.first_name,
       u.last_name,
       u.email,
       u.phone,
       COALESCE(u.is_active, TRUE) AS is_active,
       r.name AS role
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [decoded.sub]
  );
  if (!user.rowCount || !user.rows[0].is_active) {
    throw Object.assign(new Error('User account is not available.'), { status: 401 });
  }

  await touchUserActivity(user.rows[0].id);
  return user.rows[0];
}

async function touchUserActivity(userId, db = pool) {
  if (!userId) return;
  await db.query(`UPDATE users SET last_activity_at = NOW() WHERE id = $1`, [userId]);
}

async function createUserSession(userId, token) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await pool.query(
    `INSERT INTO user_sessions (user_id, token_hash, session_type, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashToken(token), 'access', expiresAt]
  );
  await touchUserActivity(userId);
}

async function runUserSchemaMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      label VARCHAR(100) NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    INSERT INTO roles (name, label, description, is_system)
    VALUES
      ('user', 'User', 'Default customer account role', TRUE),
      ('admin', 'Admin', 'System administrator role', TRUE)
    ON CONFLICT (name) DO UPDATE
    SET label = EXCLUDED.label,
        description = EXCLUDED.description,
        is_system = EXCLUDED.is_system
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'`);
  await pool.query(`ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50) USING role::TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INT REFERENCES roles(id) ON DELETE RESTRICT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP`);
  await pool.query(`
    UPDATE users u
    SET last_activity_at = activity.last_activity_at
    FROM (
      SELECT user_id, MAX(activity_at) AS last_activity_at
      FROM (
        SELECT user_id, created_at AS activity_at FROM bus_bookings
        UNION ALL
        SELECT user_id, booked_at AS activity_at FROM car_rentals
      ) user_activity
      GROUP BY user_id
    ) activity
    WHERE activity.user_id = u.id
      AND u.last_activity_at IS NULL
  `);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(40)`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS passenger_first_name VARCHAR(100)`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS passenger_last_name VARCHAR(100)`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS passenger_phone VARCHAR(30)`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS passenger_email VARCHAR(150)`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS passenger_id_number VARCHAR(80)`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS round_trip_reference VARCHAR(40)`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS trip_leg VARCHAR(20) DEFAULT 'outbound'`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2)`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0`);
  await pool.query(`
    UPDATE bus_bookings
    SET trip_leg = COALESCE(NULLIF(trip_leg, ''), 'outbound'),
        original_price = COALESCE(original_price, total_price),
        discount_amount = COALESCE(discount_amount, 0)
    WHERE trip_leg IS NULL
       OR trip_leg = ''
       OR original_price IS NULL
       OR discount_amount IS NULL
  `);
  await pool.query(`
    UPDATE bus_bookings
    SET booking_reference = CONCAT('BT-', LPAD(id::TEXT, 6, '0'))
    WHERE booking_reference IS NULL OR booking_reference = ''
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_bus_bookings_active_route_seat_unique'
      ) AND NOT EXISTS (
        SELECT 1
        FROM bus_bookings
        WHERE status <> 'cancelled'
        GROUP BY route_id, UPPER(seat_number)
        HAVING COUNT(*) > 1
      ) THEN
        CREATE UNIQUE INDEX idx_bus_bookings_active_route_seat_unique
        ON bus_bookings (route_id, UPPER(seat_number))
        WHERE status <> 'cancelled';
      END IF;
    END $$;
  `);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS package_weight_kg DECIMAL(8,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE bus_bookings ADD COLUMN IF NOT EXISTS overweight_charge DECIMAL(10,2) DEFAULT 0`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bus_trip_feedback (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      bus_booking_id INT REFERENCES bus_bookings(id) ON DELETE CASCADE,
      route_id INT REFERENCES bus_routes(id) ON DELETE SET NULL,
      company_id INT REFERENCES companies(id) ON DELETE SET NULL,
      bus_id INT REFERENCES buses(id) ON DELETE SET NULL,
      feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('comment', 'report')),
      comment TEXT NOT NULL,
      admin_reply TEXT,
      admin_replied_at TIMESTAMP,
      admin_replied_by INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE bus_trip_feedback ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE bus_trip_feedback ADD COLUMN IF NOT EXISTS bus_id INT REFERENCES buses(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE bus_trip_feedback ADD COLUMN IF NOT EXISTS admin_reply TEXT`);
  await pool.query(`ALTER TABLE bus_trip_feedback ADD COLUMN IF NOT EXISTS admin_replied_at TIMESTAMP`);
  await pool.query(`ALTER TABLE bus_trip_feedback ADD COLUMN IF NOT EXISTS admin_replied_by INT REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rental_drivers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      license_number VARCHAR(50) UNIQUE NOT NULL,
      phone VARCHAR(30),
      rating NUMERIC(3,2) DEFAULT 5.00,
      review_count INT DEFAULT 0,
      hourly_rate DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'inactive')),
      profile_photo TEXT,
      background TEXT,
      experience_years INT DEFAULT 0,
      languages TEXT[] DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rental_driver_reviews (
      id SERIAL PRIMARY KEY,
      driver_id INT REFERENCES rental_drivers(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      rating INT CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      review_type VARCHAR(20) DEFAULT 'review' CHECK (review_type IN ('review', 'report')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE rental_driver_reviews ADD COLUMN IF NOT EXISTS car_rental_id INT`);
  await pool.query(`ALTER TABLE rental_driver_reviews ADD COLUMN IF NOT EXISTS admin_reply TEXT`);
  await pool.query(`ALTER TABLE rental_driver_reviews ADD COLUMN IF NOT EXISTS admin_replied_at TIMESTAMP`);
  await pool.query(`ALTER TABLE rental_driver_reviews ADD COLUMN IF NOT EXISTS admin_replied_by INT REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`
    INSERT INTO rental_drivers (name, license_number, phone, rating, review_count, hourly_rate, status, profile_photo, background, experience_years, languages)
    VALUES
      ('Sok Dara', 'DRV-1001', '+855 12 345 678', 4.90, 38, 6.50, 'available', '', 'Professional city and province driver with airport transfer experience.', 7, ARRAY['Khmer','English']),
      ('Chan Mony', 'DRV-1002', '+855 15 456 789', 4.70, 24, 5.75, 'available', '', 'Careful long-distance driver familiar with family trips and tourism routes.', 5, ARRAY['Khmer','English']),
      ('Vannak Lim', 'DRV-1003', '+855 17 567 890', 4.50, 18, 5.25, 'available', '', 'Flexible local driver with strong Phnom Penh and Siem Reap route knowledge.', 4, ARRAY['Khmer'])
    ON CONFLICT (license_number) DO NOTHING
  `);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS pickup_datetime TIMESTAMP`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS return_datetime TIMESTAMP`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS rental_hours NUMERIC(8,2)`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS hourly_charge DECIMAL(10,2)`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30)`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS hired_driver_id INT REFERENCES rental_drivers(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS rental_base_price DECIMAL(10,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS driver_fee DECIMAL(10,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS late_return_hours NUMERIC(8,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS late_return_charge DECIMAL(10,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS damage_description TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS damage_charge DECIMAL(10,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE car_rentals ADD COLUMN IF NOT EXISTS damage_responsibility VARCHAR(20) DEFAULT 'renter'`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rental_car_replacement_events (
      id SERIAL PRIMARY KEY,
      affected_rental_id INT REFERENCES car_rentals(id) ON DELETE CASCADE,
      source_rental_id INT REFERENCES car_rentals(id) ON DELETE SET NULL,
      old_car_id INT REFERENCES rental_cars(id) ON DELETE SET NULL,
      new_car_id INT REFERENCES rental_cars(id) ON DELETE SET NULL,
      admin_id INT REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT NOT NULL DEFAULT 'late return replacement',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refund_claims (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      refund_type VARCHAR(20) NOT NULL CHECK (refund_type IN ('bus_ticket', 'car_rental')),
      bus_booking_ids INT[] DEFAULT ARRAY[]::INT[],
      car_rental_id INT REFERENCES car_rentals(id) ON DELETE CASCADE,
      booking_reference VARCHAR(80),
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'voided')),
      claim_token VARCHAR(80) UNIQUE NOT NULL,
      claimed_at TIMESTAMP,
      voided_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE refund_claims ADD COLUMN IF NOT EXISTS bus_booking_ids INT[] DEFAULT ARRAY[]::INT[]`);
  await pool.query(`ALTER TABLE refund_claims ADD COLUMN IF NOT EXISTS car_rental_id INT REFERENCES car_rentals(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE refund_claims ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(80)`);
  await pool.query(`ALTER TABLE refund_claims ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP`);
  await pool.query(`ALTER TABLE refund_claims ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP`);
  await pool.query(`ALTER TABLE refund_claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`
    UPDATE car_rentals
    SET damage_responsibility = CASE WHEN hired_driver_id IS NULL THEN 'renter' ELSE 'driver' END
    WHERE damage_responsibility IS NULL
       OR damage_charge IS NULL
       OR COALESCE(damage_charge, 0) = 0
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      car_rental_id INT REFERENCES car_rentals(id) ON DELETE CASCADE,
      bus_booking_id INT REFERENCES bus_bookings(id) ON DELETE CASCADE,
      booking_reference VARCHAR(80),
      type VARCHAR(50) NOT NULL,
      title VARCHAR(150) NOT NULL,
      message TEXT NOT NULL,
      action_url TEXT,
      action_type VARCHAR(50),
      metadata JSONB DEFAULT '{}'::JSONB,
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS bus_booking_id INT REFERENCES bus_bookings(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(80)`);
  await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS action_url TEXT`);
  await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS action_type VARCHAR(50)`);
  await pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB`);
  await pool.query(`
    UPDATE user_notifications
    SET action_url = COALESCE(
          action_url,
          CASE
            WHEN type LIKE 'bus_%' THEN '/bookings?tab=trips'
            WHEN type IN ('driver_deactivated', 'driver_reactivated', 'rental_cancelled', 'rental_changed') THEN '/bookings?tab=rentals'
            ELSE '/bookings'
          END
        ),
        action_type = COALESCE(
          action_type,
          CASE
            WHEN type LIKE 'bus_%' THEN 'view_trip'
            WHEN type IN ('driver_deactivated', 'driver_reactivated', 'rental_cancelled', 'rental_changed') THEN 'view_rental'
            ELSE 'view_booking'
          END
        ),
        metadata = COALESCE(metadata, '{}'::JSONB)
    WHERE action_url IS NULL
       OR action_type IS NULL
       OR metadata IS NULL
  `);
  await pool.query(`
    UPDATE car_rentals
    SET pickup_datetime = COALESCE(pickup_datetime, pickup_date + TIME '09:00:00'),
        return_datetime = COALESCE(return_datetime, return_date + TIME '09:00:00')
    WHERE pickup_datetime IS NULL
       OR return_datetime IS NULL
  `);
  await pool.query(`
    UPDATE car_rentals cr
    SET rental_hours = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (cr.return_datetime - cr.pickup_datetime)) / 3600.0)),
        hourly_charge = ROUND((GREATEST(1, CEIL(EXTRACT(EPOCH FROM (cr.return_datetime - cr.pickup_datetime)) / 3600.0)) * (rc.daily_rate / 24.0))::NUMERIC, 2),
        rental_base_price = ROUND((GREATEST(1, CEIL(EXTRACT(EPOCH FROM (cr.return_datetime - cr.pickup_datetime)) / 3600.0)) * (rc.daily_rate / 24.0))::NUMERIC, 2),
        driver_fee = COALESCE(cr.driver_fee, 0),
        total_price = ROUND((GREATEST(1, CEIL(EXTRACT(EPOCH FROM (cr.return_datetime - cr.pickup_datetime)) / 3600.0)) * (rc.daily_rate / 24.0))::NUMERIC, 2)
    FROM rental_cars rc
    WHERE rc.id = cr.car_id
      AND cr.pickup_datetime IS NOT NULL
      AND cr.return_datetime IS NOT NULL
      AND cr.return_datetime > cr.pickup_datetime
      AND (cr.rental_hours IS NULL OR cr.hourly_charge IS NULL)
  `);
  await pool.query(`
    UPDATE car_rentals
    SET returned_at = COALESCE(returned_at, return_datetime, booked_at)
    WHERE (status = 'completed' OR status = 'returned')
      AND returned_at IS NULL
  `);
  await pool.query(`UPDATE car_rentals SET status = 'returned' WHERE status = 'completed'`);
  await pool.query(`ALTER TABLE car_rentals DROP CONSTRAINT IF EXISTS car_rentals_status_rental_only`);
  await pool.query(`
    ALTER TABLE car_rentals
    ADD CONSTRAINT car_rentals_status_rental_only
    CHECK (status::TEXT IN ('pending', 'confirmed', 'cancelled', 'returned'))
  `);
  await pool.query(`
    UPDATE transactions t
    SET amount = bb.total_price,
        payment_method = LOWER(bb.payment_method)::payment_method,
        status = CASE
          WHEN bb.status = 'cancelled'::booking_status THEN 'cancelled'
          ELSE 'success'
        END
    FROM bus_bookings bb
    WHERE t.bus_booking_id = bb.id
      AND (
        t.amount IS DISTINCT FROM bb.total_price
        OR t.payment_method::TEXT IS DISTINCT FROM LOWER(bb.payment_method)
        OR t.status IS DISTINCT FROM CASE
          WHEN bb.status = 'cancelled'::booking_status THEN 'cancelled'
          ELSE 'success'
        END
      )
  `);
  await pool.query(`
    UPDATE transactions t
    SET amount = cr.total_price,
        payment_method = cr.payment_method,
        status = CASE
          WHEN cr.status = 'cancelled'::booking_status THEN 'cancelled'
          ELSE 'success'
        END
    FROM car_rentals cr
    WHERE t.car_rental_id = cr.id
      AND (
        t.amount IS DISTINCT FROM cr.total_price
        OR t.payment_method IS DISTINCT FROM cr.payment_method
        OR t.status IS DISTINCT FROM CASE
          WHEN cr.status = 'cancelled'::booking_status THEN 'cancelled'
          ELSE 'success'
        END
      )
  `);

  const legacyRole = await pool.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'role'
  `);

  if (legacyRole.rowCount) {
    await pool.query(`
      UPDATE users u
      SET role_id = r.id
      FROM roles r
      WHERE u.role_id IS NULL
        AND r.name = u.role::TEXT
    `);
  }

  const defaultRole = await pool.query(`SELECT id FROM roles WHERE name = 'user'`);
  const defaultRoleId = defaultRole.rows[0]?.id;
  if (defaultRoleId) {
    await pool.query(`UPDATE users SET role_id = $1 WHERE role_id IS NULL`, [defaultRoleId]);
    await pool.query(`
      UPDATE users u
      SET role = r.name
      FROM roles r
      WHERE r.id = u.role_id
    `);
    await pool.query(`ALTER TABLE users ALTER COLUMN role_id SET DEFAULT ${Number(defaultRoleId)}`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dashboard_monthly_expenses (
      id SERIAL PRIMARY KEY,
      month_key VARCHAR(7) UNIQUE NOT NULL,
      total_expense DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bus_seat_map_templates (
      id SERIAL PRIMARY KEY,
      company_id INT REFERENCES companies(id) ON DELETE CASCADE,
      vehicle_type VARCHAR(100) NOT NULL,
      name VARCHAR(120) NOT NULL,
      rows INT NOT NULL,
      columns INT NOT NULL,
      seat_count INT NOT NULL DEFAULT 0,
      layout_json JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bus_seat_map_history (
      id SERIAL PRIMARY KEY,
      company_id INT REFERENCES companies(id) ON DELETE SET NULL,
      bus_id INT REFERENCES buses(id) ON DELETE SET NULL,
      template_id INT REFERENCES bus_seat_map_templates(id) ON DELETE SET NULL,
      vehicle_type VARCHAR(100) NOT NULL,
      name VARCHAR(120) NOT NULL,
      rows INT NOT NULL,
      columns INT NOT NULL,
      seat_count INT NOT NULL DEFAULT 0,
      layout_json JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE buses ADD COLUMN IF NOT EXISTS seat_map_template_id INT REFERENCES bus_seat_map_templates(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE buses ADD COLUMN IF NOT EXISTS seat_map_override JSONB`);
  await pool.query(`ALTER TABLE buses ADD COLUMN IF NOT EXISTS maintenance_start TIMESTAMP`);
  await pool.query(`ALTER TABLE buses ADD COLUMN IF NOT EXISTS maintenance_end TIMESTAMP`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_route_templates (
      id SERIAL PRIMARY KEY,
      bus_id INT REFERENCES buses(id) ON DELETE CASCADE,
      origin VARCHAR(100) NOT NULL,
      destination VARCHAR(100) NOT NULL,
      departure_time TIME NOT NULL,
      arrival_time TIME NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS daily_template_id INT REFERENCES daily_route_templates(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS service_date DATE`);
  await pool.query(`ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS is_generated BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'available'`);
  await pool.query(`ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS maintenance_start TIMESTAMP`);
  await pool.query(`ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS maintenance_end TIMESTAMP`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_recovery_events (
      id SERIAL PRIMARY KEY,
      booking_id INT REFERENCES bus_bookings(id) ON DELETE SET NULL,
      old_route_id INT REFERENCES bus_routes(id) ON DELETE SET NULL,
      new_route_id INT REFERENCES bus_routes(id) ON DELETE SET NULL,
      old_seat_number VARCHAR(10),
      new_seat_number VARCHAR(10),
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_routes_daily_template_date
    ON bus_routes(daily_template_id, service_date)
    WHERE daily_template_id IS NOT NULL
  `);
  await releaseExpiredBusMaintenance();
}

const USER_SELECT = `
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    CONCAT(u.first_name, ' ', u.last_name) AS full_name,
    u.email,
    u.phone,
    u.national_id,
    u.role_id,
    r.name AS role,
    r.label AS role_label,
    r.description AS role_description,
    COALESCE(u.is_active, TRUE) AS is_active,
    CASE
      WHEN u.password_hash IS NULL OR u.password_hash = '' THEN 'No password saved'
      ELSE 'Password saved in database'
    END AS password_label,
    u.created_at,
    COALESCE(bb.bus_bookings_count, 0)::INT AS bus_bookings_count,
    COALESCE(cr.car_rentals_count, 0)::INT AS car_rentals_count,
    COALESCE(uf.comments_count, 0)::INT AS comments_count,
    COALESCE(uf.reports_count, 0)::INT AS reports_count,
    (COALESCE(bb.bus_bookings_count, 0) + COALESCE(cr.car_rentals_count, 0))::INT AS total_activity_count,
    COALESCE(bb.bus_total, 0) + COALESCE(cr.rental_total, 0) AS total_spent,
    CASE
      WHEN u.last_activity_at IS NULL
       AND bb.last_bus_booking_at IS NULL
       AND cr.last_car_rental_at IS NULL THEN NULL
      ELSE GREATEST(
        COALESCE(u.last_activity_at, TIMESTAMP '1970-01-01'),
        COALESCE(bb.last_bus_booking_at, TIMESTAMP '1970-01-01'),
        COALESCE(cr.last_car_rental_at, TIMESTAMP '1970-01-01')
      )
    END AS last_activity_at
  FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS bus_bookings_count,
      COALESCE(SUM(total_price) FILTER (WHERE status <> 'cancelled'), 0) AS bus_total,
      MAX(created_at) AS last_bus_booking_at
    FROM bus_bookings
    GROUP BY user_id
  ) bb ON bb.user_id = u.id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS car_rentals_count,
      COALESCE(SUM(total_price) FILTER (WHERE status <> 'cancelled'), 0) AS rental_total,
      MAX(booked_at) AS last_car_rental_at
    FROM car_rentals
    GROUP BY user_id
  ) cr ON cr.user_id = u.id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE feedback_kind = 'comment') AS comments_count,
      COUNT(*) FILTER (WHERE feedback_kind = 'report') AS reports_count
    FROM (
      SELECT user_id, feedback_type AS feedback_kind
      FROM bus_trip_feedback
      UNION ALL
      SELECT user_id, CASE WHEN review_type = 'review' THEN 'comment' ELSE 'report' END AS feedback_kind
      FROM rental_driver_reviews
    ) feedback
    GROUP BY user_id
  ) uf ON uf.user_id = u.id
`;

function normalizeUserPayload(body, { isCreate = false } = {}) {
  const firstName = String(body.first_name || '').trim();
  const lastName = String(body.last_name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const nationalId = String(body.national_id || '').trim();
  const roleId = Number(body.role_id);
  const password = String(body.password || '');
  const isActive = body.is_active === undefined ? (isCreate ? true : null) : Boolean(body.is_active);

  if (!firstName || !lastName || !email || !phone) {
    return { error: 'First name, last name, email, and phone are required.' };
  }

  if (!roleId) {
    return { error: 'Role is required.' };
  }

  if ((isCreate || password) && password.length < 3) {
    return { error: 'Password must be at least 3 characters.' };
  }

  return {
    value: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      national_id: nationalId || null,
      role_id: roleId,
      password,
      is_active: isActive
    }
  };
}

function normalizeRolePayload(body) {
  const name = String(body.name || '').trim().toLowerCase();
  const label = String(body.label || '').trim();
  const description = String(body.description || '').trim();

  if (!name || !label) {
    return { error: 'Role name and label are required.' };
  }

  if (!/^[a-z][a-z0-9_-]{1,49}$/.test(name)) {
    return { error: 'Role name must start with a letter and use lowercase letters, numbers, hyphens, or underscores.' };
  }

  return {
    value: {
      name,
      label,
      description: description || null
    }
  };
}

function formatRoleRow(row) {
  return {
    ...row,
    user_count: Number(row.user_count || 0),
    can_delete: !row.is_system && Number(row.user_count || 0) === 0
  };
}

async function fetchAdminRoles() {
  const result = await pool.query(`
    SELECT
      r.id,
      r.name,
      r.label,
      r.description,
      r.is_system,
      r.created_at,
      COUNT(u.id)::INT AS user_count
    FROM roles r
    LEFT JOIN users u ON u.role_id = r.id
    GROUP BY r.id
    ORDER BY r.is_system DESC, r.name ASC
  `);
  return result.rows.map(formatRoleRow);
}

async function fetchRoleById(roleId) {
  const result = await pool.query(`SELECT * FROM roles WHERE id = $1`, [roleId]);
  return result.rows[0] || null;
}

async function fetchDefaultRoleId(roleName = 'user') {
  const result = await pool.query(`SELECT id FROM roles WHERE name = $1`, [roleName]);
  return result.rows[0]?.id || null;
}

const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const RENTAL_STATUSES = ['pending', 'confirmed', 'cancelled', 'returned'];
const PAYMENT_METHODS = ['aba', 'khqr', 'cash'];
const VEHICLE_STATUSES = ['available', 'rented', 'maintenance'];
const ROUTE_AVAILABILITY_STATUSES = ['available', 'maintenance'];
const SEAT_MAP_CELL_TYPES = ['seat', 'empty', 'door', 'bathroom', 'driver', 'note'];
const DRIVER_STATUSES = ['available', 'inactive'];
const RENTAL_TURNOVER_BUFFER_MINUTES = 30;
const DAILY_ROUTE_WINDOW_DAYS = 30;

async function syncBusBookingTransactions(bookingIds, db = pool) {
  const ids = Array.isArray(bookingIds) ? bookingIds.map(Number).filter(Boolean) : [Number(bookingIds)].filter(Boolean);
  if (!ids.length) return 0;
  const result = await db.query(
    `UPDATE transactions t
     SET amount = bb.total_price,
         payment_method = LOWER(bb.payment_method)::payment_method,
         status = CASE
           WHEN bb.status = 'cancelled'::booking_status THEN 'cancelled'
           ELSE 'success'
         END
     FROM bus_bookings bb
     WHERE t.bus_booking_id = bb.id
       AND bb.id = ANY($1::INT[])`,
    [ids]
  );
  return result.rowCount || 0;
}

async function syncRentalTransactions(rentalIds, db = pool) {
  const ids = Array.isArray(rentalIds) ? rentalIds.map(Number).filter(Boolean) : [Number(rentalIds)].filter(Boolean);
  if (!ids.length) return 0;
  const result = await db.query(
    `UPDATE transactions t
     SET amount = cr.total_price,
         payment_method = cr.payment_method,
         status = CASE
           WHEN cr.status = 'cancelled'::booking_status THEN 'cancelled'
           ELSE 'success'
         END
     FROM car_rentals cr
     WHERE t.car_rental_id = cr.id
       AND cr.id = ANY($1::INT[])`,
    [ids]
  );
  return result.rowCount || 0;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeRouteName(value) {
  return normalizeText(value).replace(/\s+/g, ' ').toLowerCase();
}

function normalizeMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
}

function normalizeLanguages(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  return normalizeText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDateTime(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRentalDateTime(value) {
  const raw = normalizeText(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!match) return { error: 'Pickup and return date-times must be valid.' };
  const normalized = `${match[1]} ${match[2]}:${match[3] || '00'}`;
  const date = new Date(raw.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return { error: 'Pickup and return date-times must be valid.' };
  return {
    value: normalized,
    dateKey: match[1],
    date
  };
}

function calculateRentalPricing(pickupDateTime, returnDateTime, dailyRate, driverHourlyRate = 0) {
  const hours = Math.max(1, Math.ceil((returnDateTime.date - pickupDateTime.date) / 3600000));
  const hourlyRate = Number(dailyRate || 0) / 24;
  const basePrice = Number((hours * hourlyRate).toFixed(2));
  const driverFee = Number((hours * Number(driverHourlyRate || 0)).toFixed(2));
  return {
    hours,
    hourlyRate: Number(hourlyRate.toFixed(2)),
    basePrice,
    driverFee,
    totalPrice: Number((basePrice + driverFee).toFixed(2))
  };
}

function formatRentalConflictTime(value) {
  if (!value) return 'unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatLocalTimestamp(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

function buildRentalDateTimeFromDate(date) {
  return {
    value: formatLocalTimestamp(date),
    dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    date
  };
}

function effectiveRentalReturnDateTime(status, returnDateTime, now = new Date()) {
  if (['confirmed', 'returned'].includes(status) && now > returnDateTime.date) {
    return buildRentalDateTimeFromDate(now);
  }
  return returnDateTime;
}

async function findCarRentalScheduleConflict({ carId, pickupDateTime, returnDateTime, excludeRentalId = null, db = pool }) {
  const params = [
    pickupDateTime.value,
    returnDateTime.value,
    RENTAL_TURNOVER_BUFFER_MINUTES,
    excludeRentalId || 0
  ];
  const carConflict = await db.query(
    `SELECT
       cr.id,
       cr.status,
       COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
       COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
       rc.name AS car_name
     FROM car_rentals cr
     JOIN rental_cars rc ON rc.id = cr.car_id
     WHERE cr.car_id = $5
       AND cr.status IN ('pending', 'confirmed')
       AND cr.id <> $4
       AND COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') < (($2)::TIMESTAMP + ($3 || ' minutes')::INTERVAL)
       AND COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') > (($1)::TIMESTAMP - ($3 || ' minutes')::INTERVAL)
     ORDER BY COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') ASC, cr.id ASC
     LIMIT 1`,
    [...params, carId]
  );

  if (carConflict.rowCount) {
    const conflict = carConflict.rows[0];
    return {
      type: 'car',
      rental: conflict,
      message: `${conflict.car_name || 'Selected car'} already has rental #${conflict.id} from ${formatRentalConflictTime(conflict.pickup_datetime)} to ${formatRentalConflictTime(conflict.return_datetime)}. Please choose a time at least ${RENTAL_TURNOVER_BUFFER_MINUTES} minutes apart.`
    };
  }

  return null;
}

async function findDriverRentalScheduleConflict({ driverId = null, pickupDateTime, returnDateTime, excludeRentalId = null, db = pool }) {
  if (!driverId) return null;
  const params = [
    pickupDateTime.value,
    returnDateTime.value,
    RENTAL_TURNOVER_BUFFER_MINUTES,
    excludeRentalId || 0
  ];

  const driverConflict = await db.query(
    `SELECT
       cr.id,
       cr.status,
       COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
       COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
       rd.name AS driver_name
     FROM car_rentals cr
     JOIN rental_drivers rd ON rd.id = cr.hired_driver_id
     WHERE cr.hired_driver_id = $5
       AND cr.status IN ('pending', 'confirmed')
       AND cr.id <> $4
       AND COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') < (($2)::TIMESTAMP + ($3 || ' minutes')::INTERVAL)
       AND COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') > (($1)::TIMESTAMP - ($3 || ' minutes')::INTERVAL)
     ORDER BY COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') ASC, cr.id ASC
     LIMIT 1`,
    [...params, driverId]
  );

  if (driverConflict.rowCount) {
    const conflict = driverConflict.rows[0];
    return {
      type: 'driver',
      rental: conflict,
      message: `${conflict.driver_name || 'Selected driver'} already has rental #${conflict.id} from ${formatRentalConflictTime(conflict.pickup_datetime)} to ${formatRentalConflictTime(conflict.return_datetime)}. Please choose a time at least ${RENTAL_TURNOVER_BUFFER_MINUTES} minutes apart.`
    };
  }

  return null;
}

async function findRentalScheduleConflict({ carId, driverId = null, pickupDateTime, returnDateTime, excludeRentalId = null, db = pool }) {
  const carConflict = await findCarRentalScheduleConflict({ carId, pickupDateTime, returnDateTime, excludeRentalId, db });
  if (carConflict) return carConflict;
  return findDriverRentalScheduleConflict({ driverId, pickupDateTime, returnDateTime, excludeRentalId, db });
}

async function findAvailableReplacementCarsForRental(rental, oldCarId, db = pool) {
  const result = await db.query(
    `SELECT
       rc.id,
       rc.name,
       rc.type,
       rc.plate_number,
       rc.total_seats,
       rc.transmission,
       rc.daily_rate,
       rc.status
     FROM rental_cars rc
     WHERE rc.id <> $1
       AND rc.status = 'available'
       AND NOT EXISTS (
         SELECT 1
         FROM car_rentals cr
         WHERE cr.car_id = rc.id
           AND cr.id <> $2
           AND cr.status IN ('pending', 'confirmed')
           AND COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') < (($4)::TIMESTAMP + ($5 || ' minutes')::INTERVAL)
           AND COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') > (($3)::TIMESTAMP - ($5 || ' minutes')::INTERVAL)
       )
     ORDER BY rc.name, rc.id`,
    [
      oldCarId,
      rental.id,
      rental.pickup_datetime,
      rental.return_datetime,
      RENTAL_TURNOVER_BUFFER_MINUTES
    ]
  );
  return result.rows;
}

async function buildLateReturnImpact(sourceRental, pickupDateTime, effectiveReturnDateTime, db = pool) {
  const affected = await db.query(
    `SELECT
       cr.id,
       cr.user_id,
       cr.car_id,
       cr.status,
       COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
       COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
       cr.total_price,
       CONCAT(u.first_name, ' ', u.last_name) AS user_name,
       u.email,
       u.phone,
       old_car.name AS old_car_name,
       old_car.type AS old_car_type,
       old_car.plate_number AS old_plate_number,
       old_car.daily_rate AS old_daily_rate
     FROM car_rentals cr
     JOIN users u ON u.id = cr.user_id
     JOIN rental_cars old_car ON old_car.id = cr.car_id
     WHERE cr.car_id = $1
       AND cr.id <> $2
       AND cr.status IN ('pending', 'confirmed')
       AND COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') < (($4)::TIMESTAMP + ($5 || ' minutes')::INTERVAL)
       AND COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') > (($3)::TIMESTAMP - ($5 || ' minutes')::INTERVAL)
     ORDER BY COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') ASC, cr.id ASC`,
    [
      sourceRental.car_id,
      sourceRental.id,
      pickupDateTime.value,
      effectiveReturnDateTime.value,
      RENTAL_TURNOVER_BUFFER_MINUTES
    ]
  );

  const affectedRentals = [];
  for (const rental of affected.rows) {
    const replacementOptions = await findAvailableReplacementCarsForRental(rental, sourceRental.car_id, db);
    affectedRentals.push({
      ...rental,
      replacement_options: replacementOptions
    });
  }

  return {
    buffer_minutes: RENTAL_TURNOVER_BUFFER_MINUTES,
    effective_return_datetime: effectiveReturnDateTime.value,
    affected_rentals: affectedRentals
  };
}

function normalizeReplacementPlan(value) {
  const items = Array.isArray(value) ? value : [];
  const plan = new Map();
  items.forEach((item) => {
    const rentalId = Number(item?.rental_id);
    const replacementCarId = Number(item?.replacement_car_id);
    if (rentalId && replacementCarId) plan.set(rentalId, replacementCarId);
  });
  return plan;
}

function rentalWindowsOverlapWithBuffer(left, right) {
  const leftPickup = new Date(left.pickup_datetime);
  const leftReturn = new Date(left.return_datetime);
  const rightPickup = new Date(right.pickup_datetime);
  const rightReturn = new Date(right.return_datetime);
  if ([leftPickup, leftReturn, rightPickup, rightReturn].some((date) => Number.isNaN(date.getTime()))) return false;
  const bufferMs = RENTAL_TURNOVER_BUFFER_MINUTES * 60 * 1000;
  return leftPickup.getTime() < rightReturn.getTime() + bufferMs && leftReturn.getTime() > rightPickup.getTime() - bufferMs;
}

async function releaseExpiredBusMaintenance() {
  await pool.query(`
    UPDATE buses
    SET status = 'available',
        maintenance_start = NULL,
        maintenance_end = NULL
    WHERE status = 'maintenance'
      AND maintenance_end IS NOT NULL
      AND maintenance_end <= NOW()
  `);
}

function buildMonthRange(month) {
  const fallback = new Date();
  const [yearRaw, monthRaw] = String(month || '').split('-');
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);
  const valid = year >= 2000 && year <= 2100 && monthNumber >= 1 && monthNumber <= 12;
  const start = valid ? new Date(year, monthNumber - 1, 1) : new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  return {
    key,
    start: `${key}-01`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`,
    days: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  };
}

function buildPreviousMonthRange(monthRange) {
  const [year, month] = String(monthRange.key).split('-').map(Number);
  const previous = new Date(year, month - 2, 1);
  return buildMonthRange(`${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`);
}

function calculatePercent(part, total) {
  if (!total) return 0;
  return Number(((Number(part || 0) / Number(total || 0)) * 100).toFixed(1));
}

function calculateChange(current, previous) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  const change = currentValue - previousValue;
  return {
    current: currentValue,
    previous: previousValue,
    change,
    percent: previousValue ? Number(((change / previousValue) * 100).toFixed(1)) : (currentValue ? 100 : 0)
  };
}

function formatDateKey(date) {
  if (date instanceof Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return String(date).slice(0, 10);
}

function getCambodiaDateTimeKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function buildDailySeries(monthRange, bookingRows, rentalRows) {
  const bookingMap = new Map(bookingRows.map(row => [formatDateKey(row.day), Number(row.revenue || 0)]));
  const rentalMap = new Map(rentalRows.map(row => [formatDateKey(row.day), Number(row.revenue || 0)]));
  const [year, month] = monthRange.key.split('-').map(Number);
  return Array.from({ length: monthRange.days }, (_, index) => {
    const date = new Date(year, month - 1, index + 1);
    const key = formatDateKey(date);
    return {
      date: key,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      booking_revenue: bookingMap.get(key) || 0,
      rental_revenue: rentalMap.get(key) || 0
    };
  });
}

function buildRecentDayRange(totalDays = 12) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (totalDays - 1));
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return {
    start: formatDateKey(start),
    end: formatDateKey(end),
    totalDays
  };
}

function buildCountSeries(dayRange, bookingRows, rentalRows) {
  const bookingMap = new Map(bookingRows.map(row => [formatDateKey(row.day), Number(row.count || 0)]));
  const rentalMap = new Map(rentalRows.map(row => [formatDateKey(row.day), Number(row.count || 0)]));
  const start = new Date(`${dayRange.start}T00:00:00`);

  return Array.from({ length: dayRange.totalDays }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = formatDateKey(date);
    const bookingCount = bookingMap.get(key) || 0;
    const rentalCount = rentalMap.get(key) || 0;

    return {
      date: key,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      booking_count: bookingCount,
      rental_count: rentalCount,
      total_count: bookingCount + rentalCount
    };
  });
}

async function fetchAdminBookingById(bookingId) {
  const result = await pool.query(
    `SELECT
       bb.id,
       bb.user_id,
       bb.route_id,
       bb.seat_number,
       bb.total_price,
       bb.package_weight_kg,
       bb.overweight_charge,
       bb.payment_method,
       bb.status,
       bb.created_at,
       CONCAT(u.first_name, ' ', u.last_name) AS user_name,
       u.email,
       u.phone,
       br.origin,
       br.destination,
       br.departure_time,
       br.arrival_time,
       b.name AS bus_name,
       b.type AS bus_type,
       c.id AS company_id,
       c.name AS company_name,
       c.theme_color AS color
     FROM bus_bookings bb
     JOIN users u ON u.id = bb.user_id
     JOIN bus_routes br ON br.id = bb.route_id
     JOIN buses b ON b.id = br.bus_id
     LEFT JOIN companies c ON c.id = b.company_id
     WHERE bb.id = $1`,
    [bookingId]
  );
  return result.rows[0] || null;
}

async function fetchAdminRentalById(rentalId) {
  const result = await pool.query(
    `SELECT
       cr.id,
       cr.user_id,
       cr.car_id,
       cr.pickup_date,
       cr.return_date,
       COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
       COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
       COALESCE(cr.rental_hours, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') - COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00'))) / 3600.0))) AS rental_hours,
       ROUND((rc.daily_rate / 24.0)::NUMERIC, 2) AS hourly_rate,
       COALESCE(cr.hourly_charge, ROUND((GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') - COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00'))) / 3600.0)) * (rc.daily_rate / 24.0))::NUMERIC, 2)) AS hourly_charge,
       cr.customer_phone,
       cr.hired_driver_id,
       cr.rental_base_price,
       cr.driver_fee,
       COALESCE(cr.late_return_hours, 0) AS late_return_hours,
       COALESCE(cr.late_return_charge, 0) AS late_return_charge,
       COALESCE(cr.damage_description, '') AS damage_description,
       COALESCE(cr.damage_charge, 0) AS damage_charge,
       COALESCE(cr.damage_responsibility, CASE WHEN cr.hired_driver_id IS NULL THEN 'renter' ELSE 'driver' END) AS damage_responsibility,
       cr.driver_name,
       cr.driver_license,
       cr.total_price,
       cr.payment_method,
       cr.status,
       cr.returned_at,
       cr.booked_at,
       CONCAT(u.first_name, ' ', u.last_name) AS user_name,
       u.email,
       u.phone,
       rc.name AS car_name,
       rc.type AS car_type,
       rc.plate_number,
       rc.daily_rate,
       rd.name AS hired_driver_name,
       rd.rating AS hired_driver_rating,
       rd.hourly_rate AS hired_driver_hourly_rate,
       (
         SELECT JSON_BUILD_OBJECT(
           'id', rcre.id,
           'source_rental_id', rcre.source_rental_id,
           'old_car_id', rcre.old_car_id,
           'new_car_id', rcre.new_car_id,
           'old_car_name', old_car.name,
           'old_plate_number', old_car.plate_number,
           'new_car_name', new_car.name,
           'new_plate_number', new_car.plate_number,
           'reason', rcre.reason,
           'created_at', rcre.created_at
         )
         FROM rental_car_replacement_events rcre
         LEFT JOIN rental_cars old_car ON old_car.id = rcre.old_car_id
         LEFT JOIN rental_cars new_car ON new_car.id = rcre.new_car_id
         WHERE rcre.affected_rental_id = cr.id
         ORDER BY rcre.created_at DESC, rcre.id DESC
         LIMIT 1
       ) AS replacement_summary,
       (
         SELECT COUNT(*)::INT
         FROM rental_car_replacement_events rcre
         WHERE rcre.source_rental_id = cr.id
       ) AS replacement_count
     FROM car_rentals cr
     JOIN users u ON u.id = cr.user_id
     JOIN rental_cars rc ON rc.id = cr.car_id
     LEFT JOIN rental_drivers rd ON rd.id = cr.hired_driver_id
     WHERE cr.id = $1`,
    [rentalId]
  );
  return result.rows[0] || null;
}

async function getOptionalAuthUserFromRequest(req) {
  try {
    return await getAuthUserFromRequest(req);
  } catch (error) {
    return null;
  }
}

function buildDriverPayload(body) {
  const name = normalizeText(body.name);
  const licenseNumber = normalizeText(body.license_number);
  const phone = normalizeText(body.phone);
  const hourlyRate = normalizeMoney(body.hourly_rate);
  const status = normalizeText(body.status || 'available').toLowerCase();
  const profilePhoto = normalizeText(body.profile_photo);
  const background = normalizeText(body.background);
  const experienceYears = Number(body.experience_years || 0);
  const languages = normalizeLanguages(body.languages);

  if (!name) return { error: 'Driver name is required.' };
  if (!licenseNumber) return { error: 'License number is required.' };
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return { error: 'Hourly rate must be greater than zero.' };
  if (!DRIVER_STATUSES.includes(status)) return { error: 'Invalid driver status.' };
  if (!Number.isInteger(experienceYears) || experienceYears < 0) return { error: 'Experience years must be zero or greater.' };

  return {
    name,
    licenseNumber,
    phone,
    hourlyRate,
    status,
    profilePhoto,
    background,
    experienceYears,
    languages
  };
}

async function createUserNotification(notification, db = pool) {
  const metadata = notification.metadata && typeof notification.metadata === 'object' ? notification.metadata : {};
  await db.query(
    `INSERT INTO user_notifications (
       user_id,
       car_rental_id,
       bus_booking_id,
       booking_reference,
       type,
       title,
       message,
       action_url,
       action_type,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::JSONB)`,
    [
      notification.user_id,
      notification.car_rental_id || null,
      notification.bus_booking_id || null,
      notification.booking_reference || null,
      notification.type,
      notification.title,
      notification.message,
      notification.action_url || null,
      notification.action_type || null,
      JSON.stringify(metadata)
    ]
  );
}

function parsePgIntArray(value) {
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .replace(/[{}]/g, '')
      .split(',')
      .map((item) => Number(item))
      .filter(Boolean);
  }
  return [];
}

function formatRefundClaim(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    refund_type: row.refund_type,
    bus_booking_ids: parsePgIntArray(row.bus_booking_ids),
    car_rental_id: row.car_rental_id ? Number(row.car_rental_id) : null,
    booking_reference: row.booking_reference || '',
    amount: Number(Number(row.amount || 0).toFixed(2)),
    status: row.status,
    claim_token: row.claim_token,
    created_at: row.created_at,
    claimed_at: row.claimed_at,
    voided_at: row.voided_at
  };
}

function createRefundClaimToken() {
  return `RFD-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
}

function refundClaimActionUrl(claimRow) {
  const claim = formatRefundClaim(claimRow);
  if (!claim) return '/bookings';
  const params = new URLSearchParams({
    tab: claim.refund_type === 'car_rental' ? 'rentals' : 'trips',
    refund: String(claim.id)
  });
  if (claim.refund_type === 'car_rental' && claim.car_rental_id) params.set('rental', String(claim.car_rental_id));
  if (claim.refund_type === 'bus_ticket' && claim.booking_reference) params.set('ticket', claim.booking_reference);
  return `/bookings?${params.toString()}`;
}

async function insertRefundClaim(values, db = pool) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await db.query(
        `INSERT INTO refund_claims (
           user_id,
           refund_type,
           bus_booking_ids,
           car_rental_id,
           booking_reference,
           amount,
           status,
           claim_token
         )
         VALUES ($1, $2, $3::INT[], $4, $5, $6, 'pending', $7)
         RETURNING *`,
        [
          values.user_id,
          values.refund_type,
          values.bus_booking_ids || [],
          values.car_rental_id || null,
          values.booking_reference || null,
          Number(values.amount || 0).toFixed(2),
          createRefundClaimToken()
        ]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code !== '23505' || attempt === 2) throw error;
    }
  }
  return null;
}

async function createBusRefundClaimsForBookingGroups(bookingIds, db = pool) {
  const ids = Array.from(new Set((Array.isArray(bookingIds) ? bookingIds : [bookingIds]).map(Number).filter(Boolean)));
  if (!ids.length) return [];

  const result = await db.query(
    `SELECT
       bb.id,
       bb.user_id,
       bb.total_price,
       COALESCE(bb.round_trip_reference, bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0'))) AS ticket_reference,
       bb.seat_number,
       br.origin,
       br.destination,
       br.departure_time,
       b.name AS bus_name,
       c.name AS company_name
     FROM bus_bookings bb
     JOIN bus_routes br ON br.id = bb.route_id
     JOIN buses b ON b.id = br.bus_id
     LEFT JOIN companies c ON c.id = b.company_id
     WHERE bb.id = ANY($1::INT[])
     ORDER BY bb.id`,
    [ids]
  );
  if (!result.rowCount) return [];

  const groups = new Map();
  result.rows.forEach((row) => {
    const key = `${row.user_id}-${row.ticket_reference}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const claims = [];
  for (const rows of groups.values()) {
    const first = rows[0];
    const groupIds = rows.map((row) => Number(row.id));
    const amount = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    const existing = await db.query(
      `SELECT *
       FROM refund_claims
       WHERE refund_type = 'bus_ticket'
         AND user_id = $1
         AND booking_reference = $2
         AND status = 'pending'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [first.user_id, first.ticket_reference]
    );

    if (existing.rowCount) {
      const updated = await db.query(
        `UPDATE refund_claims
         SET bus_booking_ids = $1::INT[],
             amount = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [groupIds, amount.toFixed(2), existing.rows[0].id]
      );
      claims.push(updated.rows[0]);
    } else {
      const inserted = await insertRefundClaim({
        user_id: first.user_id,
        refund_type: 'bus_ticket',
        bus_booking_ids: groupIds,
        car_rental_id: null,
        booking_reference: first.ticket_reference,
        amount
      }, db);
      if (inserted) claims.push(inserted);
    }
  }

  return claims;
}

async function createRentalRefundClaim(rentalId, db = pool) {
  const result = await db.query(
    `SELECT
       cr.id,
       cr.user_id,
       cr.total_price,
       rc.name AS car_name
     FROM car_rentals cr
     JOIN rental_cars rc ON rc.id = cr.car_id
     WHERE cr.id = $1`,
    [rentalId]
  );
  if (!result.rowCount) return null;
  const rental = result.rows[0];
  const reference = `CR-${String(rental.id).padStart(6, '0')}`;
  const existing = await db.query(
    `SELECT *
     FROM refund_claims
     WHERE refund_type = 'car_rental'
       AND car_rental_id = $1
       AND user_id = $2
       AND status = 'pending'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [rental.id, rental.user_id]
  );

  if (existing.rowCount) {
    const updated = await db.query(
      `UPDATE refund_claims
       SET amount = $1,
           booking_reference = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [Number(rental.total_price || 0).toFixed(2), reference, existing.rows[0].id]
    );
    return updated.rows[0];
  }

  return insertRefundClaim({
    user_id: rental.user_id,
    refund_type: 'car_rental',
    bus_booking_ids: [],
    car_rental_id: rental.id,
    booking_reference: reference,
    amount: Number(rental.total_price || 0)
  }, db);
}

async function createRefundClaimNotification(claimRow, context = {}, db = pool) {
  const claim = formatRefundClaim(claimRow);
  if (!claim || claim.status !== 'pending') return 0;

  const existing = await db.query(
    `SELECT id
     FROM user_notifications
     WHERE user_id = $1
       AND type = 'refund_claim_available'
       AND COALESCE(metadata->>'refund_claim_id', '') = $2
     LIMIT 1`,
    [claim.user_id, String(claim.id)]
  );
  if (existing.rowCount) return 0;

  const isRental = claim.refund_type === 'car_rental';
  const label = isRental
    ? `rental ${claim.booking_reference || `#${claim.car_rental_id}`}`
    : `bus ticket ${claim.booking_reference || ''}`.trim();
  await createUserNotification({
    user_id: claim.user_id,
    car_rental_id: isRental ? claim.car_rental_id : null,
    bus_booking_id: isRental ? null : claim.bus_booking_ids[0],
    booking_reference: isRental ? null : claim.booking_reference,
    type: 'refund_claim_available',
    title: 'Refund claim available',
    message: `${label} was cancelled. Open this notice to scan the refund QR for $${claim.amount.toFixed(2)}.`,
    action_url: refundClaimActionUrl(claim),
    action_type: 'claim_refund',
    metadata: {
      ...(context.metadata || {}),
      refund_claim_id: claim.id,
      refund_amount: claim.amount,
      refund_type: claim.refund_type,
      action_type: 'claim_refund',
      booking_reference: claim.booking_reference,
      bus_booking_ids: claim.bus_booking_ids,
      car_rental_id: claim.car_rental_id
    }
  }, db);
  return 1;
}

async function deleteRefundClaimNotifications(claimIds, db = pool) {
  const ids = (Array.isArray(claimIds) ? claimIds : [claimIds]).map(Number).filter(Boolean);
  if (!ids.length) return 0;
  const result = await db.query(
    `DELETE FROM user_notifications
     WHERE type = 'refund_claim_available'
       AND COALESCE(metadata->>'refund_claim_id', '') = ANY($1::TEXT[])`,
    [ids.map(String)]
  );
  return result.rowCount || 0;
}

async function assertBusRefundRestoreAllowed(bookingIds, db = pool) {
  const ids = Array.from(new Set((Array.isArray(bookingIds) ? bookingIds : [bookingIds]).map(Number).filter(Boolean)));
  if (!ids.length) return;
  const claimed = await db.query(
    `SELECT id, booking_reference
     FROM refund_claims
     WHERE refund_type = 'bus_ticket'
       AND status = 'claimed'
       AND bus_booking_ids && $1::INT[]
     LIMIT 1`,
    [ids]
  );
  if (claimed.rowCount) {
    throw Object.assign(new Error('Refund already claimed, cannot restore this cancelled bus ticket.'), { status: 409 });
  }
}

async function assertRentalRefundRestoreAllowed(rentalId, db = pool) {
  if (!rentalId) return;
  const claimed = await db.query(
    `SELECT id
     FROM refund_claims
     WHERE refund_type = 'car_rental'
       AND car_rental_id = $1
       AND status = 'claimed'
     LIMIT 1`,
    [rentalId]
  );
  if (claimed.rowCount) {
    throw Object.assign(new Error('Refund already claimed, cannot restore this cancelled rental.'), { status: 409 });
  }
}

async function voidPendingBusRefundClaims(bookingIds, db = pool) {
  const ids = Array.from(new Set((Array.isArray(bookingIds) ? bookingIds : [bookingIds]).map(Number).filter(Boolean)));
  if (!ids.length) return [];
  const result = await db.query(
    `UPDATE refund_claims
     SET status = 'voided',
         voided_at = NOW(),
         updated_at = NOW()
     WHERE refund_type = 'bus_ticket'
       AND status = 'pending'
       AND bus_booking_ids && $1::INT[]
     RETURNING id`,
    [ids]
  );
  const claimIds = result.rows.map((row) => row.id);
  await deleteRefundClaimNotifications(claimIds, db);
  return claimIds;
}

async function voidPendingRentalRefundClaims(rentalId, db = pool) {
  if (!rentalId) return [];
  const result = await db.query(
    `UPDATE refund_claims
     SET status = 'voided',
         voided_at = NOW(),
         updated_at = NOW()
     WHERE refund_type = 'car_rental'
       AND car_rental_id = $1
       AND status = 'pending'
     RETURNING id`,
    [rentalId]
  );
  const claimIds = result.rows.map((row) => row.id);
  await deleteRefundClaimNotifications(claimIds, db);
  return claimIds;
}

async function fetchUserRefundClaim(claimId, userId, db = pool) {
  const result = await db.query(
    `SELECT *
     FROM refund_claims
     WHERE id = $1
       AND user_id = $2`,
    [claimId, userId]
  );
  return result.rows[0] || null;
}

async function createBusTicketNotifications(bookingIds, options = {}, db = pool) {
  const ids = Array.from(new Set((Array.isArray(bookingIds) ? bookingIds : [bookingIds]).map(Number).filter(Boolean)));
  if (!ids.length) return;

  const result = await db.query(
    `SELECT
       bb.id,
       bb.user_id,
       COALESCE(bb.round_trip_reference, bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0'))) AS ticket_reference,
       bb.booking_reference,
       bb.round_trip_reference,
       bb.seat_number,
       br.origin,
       br.destination,
       br.departure_time,
       br.arrival_time,
       b.name AS bus_name,
       b.plate_number,
       c.name AS company_name
     FROM bus_bookings bb
     JOIN bus_routes br ON br.id = bb.route_id
     JOIN buses b ON b.id = br.bus_id
     LEFT JOIN companies c ON c.id = b.company_id
     WHERE bb.id = ANY($1::INT[])`,
    [ids]
  );

  const groups = new Map();
  result.rows.forEach((row) => {
    const key = `${row.user_id}-${row.ticket_reference}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  for (const rows of groups.values()) {
    const first = rows[0];
    const seats = rows.map((row) => row.seat_number).filter(Boolean).join(', ');
    const metadata = {
      ...(options.metadata || {}),
      booking_ids: rows.map((row) => row.id),
      seats,
      departure_time: first.departure_time,
      route: `${first.origin} -> ${first.destination}`,
      bus_name: first.bus_name,
      company_name: first.company_name
    };
    await createUserNotification({
      user_id: first.user_id,
      bus_booking_id: first.id,
      booking_reference: first.ticket_reference,
      type: options.type || 'bus_ticket_update',
      title: options.title || 'Bus ticket update',
      message: options.message || `${first.origin} to ${first.destination} was updated. Seats: ${seats || 'N/A'}.`,
      action_url: options.action_url || `/bookings?tab=trips&ticket=${encodeURIComponent(first.ticket_reference)}`,
      action_type: options.action_type || 'view_trip',
      metadata
    }, db);
  }
}

async function createRouteCancellationNotifications(routeId, options = {}, db = pool) {
  const result = await db.query(
    `SELECT
       bb.id,
       bb.user_id,
       COALESCE(bb.round_trip_reference, bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0'))) AS ticket_reference,
       br.origin,
       br.destination,
       br.departure_time,
       b.name AS bus_name
     FROM bus_bookings bb
     JOIN bus_routes br ON br.id = bb.route_id
     JOIN buses b ON b.id = br.bus_id
     WHERE bb.route_id = $1
       AND bb.status <> 'cancelled'`,
    [routeId]
  );

  const groups = new Map();
  result.rows.forEach((row) => {
    const key = `${row.user_id}-${row.ticket_reference}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  for (const rows of groups.values()) {
    const first = rows[0];
    await createUserNotification({
      user_id: first.user_id,
      booking_reference: first.ticket_reference,
      type: options.type || 'bus_trip_cancelled',
      title: options.title || 'Trip cancelled',
      message: options.message || `${first.origin} to ${first.destination} on ${first.bus_name} was cancelled by admin.`,
      action_url: '/bookings?tab=trips',
      action_type: 'view_trip',
      metadata: {
        route_id: routeId,
        booking_ids: rows.map((row) => row.id),
        departure_time: first.departure_time
      }
    }, db);
  }
}

async function createDriverDeactivationNotifications(driverId, driverName, db = pool) {
  const result = await db.query(
    `INSERT INTO user_notifications (user_id, car_rental_id, type, title, message, action_url, action_type, metadata)
     SELECT
       cr.user_id,
       cr.id,
       'driver_deactivated',
       'Driver update for your rental',
       $2::TEXT,
       '/bookings?tab=rentals',
       'view_rental',
       JSON_BUILD_OBJECT(
         'rental_id', cr.id,
         'driver_id', $1::INT,
         'driver_name', $3::TEXT,
         'previous_status', cr.status::TEXT,
         'pickup_datetime', COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00'),
         'return_datetime', COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00')
       )::JSONB
     FROM car_rentals cr
     WHERE cr.hired_driver_id = $1::INT
       AND cr.status IN ('pending', 'confirmed')
       AND cr.user_id IS NOT NULL`,
    [
      driverId,
      `Your assigned driver ${driverName} is no longer available. Admin will follow up with you about this rental.`,
      driverName
    ]
  );
  return result.rowCount || 0;
}

async function applyDriverDeactivation(driverId, driverName, db = pool) {
  const notificationCount = await createDriverDeactivationNotifications(driverId, driverName, db);
  const cancelled = await db.query(
    `UPDATE car_rentals
     SET status = 'cancelled'::booking_status
     WHERE hired_driver_id = $1::INT
       AND status IN ('pending', 'confirmed')
     RETURNING id`,
    [driverId]
  );
  await syncRentalTransactions(cancelled.rows.map((row) => row.id), db);
  for (const row of cancelled.rows) {
    const claim = await createRentalRefundClaim(row.id, db);
    await createRefundClaimNotification(claim, {
      metadata: {
        reason: 'driver deactivated',
        driver_id: driverId,
        driver_name: driverName
      }
    }, db);
  }
  return {
    notificationCount,
    cancelledCount: cancelled.rowCount || 0
  };
}

async function restoreDriverRentalsBeforePickup(driverId, driverName, db = pool) {
  const eligible = await db.query(
    `SELECT
       cr.id,
       cr.user_id,
       COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
       COALESCE(NULLIF(deactivation.metadata->>'previous_status', ''), 'confirmed') AS previous_status
     FROM car_rentals cr
     JOIN LATERAL (
       SELECT un.id, un.metadata, un.created_at
       FROM user_notifications un
       WHERE un.car_rental_id = cr.id
         AND un.user_id = cr.user_id
         AND un.type = 'driver_deactivated'
       ORDER BY un.created_at DESC, un.id DESC
       LIMIT 1
     ) deactivation ON TRUE
     WHERE cr.hired_driver_id = $1::INT
       AND cr.status = 'cancelled'
       AND cr.user_id IS NOT NULL
       AND COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') > NOW() + INTERVAL '1 hour'
       AND NOT EXISTS (
         SELECT 1
         FROM user_notifications restored
         WHERE restored.car_rental_id = cr.id
           AND restored.user_id = cr.user_id
           AND restored.type = 'driver_reactivated'
           AND restored.created_at > deactivation.created_at
       )`,
    [driverId]
  );

  let restoredCount = 0;
  let notificationCount = 0;
  for (const rental of eligible.rows) {
    await assertRentalRefundRestoreAllowed(rental.id, db);
    const previousStatus = ['pending', 'confirmed'].includes(String(rental.previous_status || '').toLowerCase())
      ? String(rental.previous_status).toLowerCase()
      : 'confirmed';

    await createUserNotification({
      user_id: rental.user_id,
      car_rental_id: rental.id,
      type: 'driver_reactivated',
      title: 'Driver restored for your rental',
      message: `Your assigned driver ${driverName} is available again. Your rental has been restored.`,
      action_url: '/bookings?tab=rentals',
      action_type: 'view_rental',
      metadata: {
        rental_id: rental.id,
        driver_id: driverId,
        driver_name: driverName,
        restored_status: previousStatus,
        pickup_datetime: rental.pickup_datetime
      }
    }, db);
    notificationCount += 1;

    const updated = await db.query(
      `UPDATE car_rentals
       SET status = ($1)::booking_status
       WHERE id = $2
         AND status = 'cancelled'
       RETURNING id`,
      [previousStatus, rental.id]
    );
    await syncRentalTransactions(updated.rows.map((row) => row.id), db);
    await voidPendingRentalRefundClaims(rental.id, db);
    restoredCount += updated.rowCount || 0;
  }

  return { restoredCount, notificationCount };
}

function routeChangedMessage(existingRoute, updatedRoute) {
  const changes = [];
  if (Number(existingRoute.bus_id) !== Number(updatedRoute.bus_id)) {
    changes.push(`bus changed from ${existingRoute.bus_name || 'the previous bus'} to ${updatedRoute.bus_name || 'the new bus'}`);
  }
  if (
    new Date(existingRoute.departure_time).getTime() !== new Date(updatedRoute.departure_time).getTime() ||
    new Date(existingRoute.arrival_time).getTime() !== new Date(updatedRoute.arrival_time).getTime()
  ) {
    changes.push('departure or arrival time changed');
  }
  if (existingRoute.origin !== updatedRoute.origin || existingRoute.destination !== updatedRoute.destination) {
    changes.push(`route changed to ${updatedRoute.origin} to ${updatedRoute.destination}`);
  }
  if (Number(existingRoute.price) !== Number(updatedRoute.price)) {
    changes.push('fare changed');
  }
  if (!changes.length) return `${updatedRoute.origin} to ${updatedRoute.destination} was updated by admin.`;
  return `${updatedRoute.origin} to ${updatedRoute.destination} was updated: ${changes.join(', ')}.`;
}

async function createRouteUpdateNotifications(routeId, existingRoute, updatedRoute, db = pool) {
  const bookingIds = (Array.isArray(existingRoute?.passengers) ? existingRoute.passengers : [])
    .filter((passenger) => ['pending', 'confirmed'].includes(String(passenger.status || '').toLowerCase()))
    .map((passenger) => Number(passenger.booking_id))
    .filter(Boolean);
  if (!bookingIds.length) return 0;

  await createBusTicketNotifications(bookingIds, {
    type: Number(existingRoute.bus_id) !== Number(updatedRoute.bus_id) ? 'bus_trip_moved' : 'bus_schedule_changed',
    title: Number(existingRoute.bus_id) !== Number(updatedRoute.bus_id) ? 'Your trip bus changed' : 'Your trip schedule changed',
    message: `${routeChangedMessage(existingRoute, updatedRoute)} Open My Bookings for details.`,
    action_type: 'view_trip',
    metadata: {
      reason: 'admin route update',
      route_id: routeId,
      old_bus_id: existingRoute.bus_id,
      new_bus_id: updatedRoute.bus_id,
      old_bus_name: existingRoute.bus_name,
      new_bus_name: updatedRoute.bus_name,
      old_origin: existingRoute.origin,
      new_origin: updatedRoute.origin,
      old_destination: existingRoute.destination,
      new_destination: updatedRoute.destination,
      old_departure_time: existingRoute.departure_time,
      new_departure_time: updatedRoute.departure_time,
      old_arrival_time: existingRoute.arrival_time,
      new_arrival_time: updatedRoute.arrival_time
    }
  }, db);
  return bookingIds.length;
}

function formatUserRow(row) {
  const lastActivity = row.last_activity_at ? new Date(row.last_activity_at) : null;
  const activeWindowMs = 1000 * 60 * 60 * 24 * 12;
  const isRecent =
    lastActivity &&
    !Number.isNaN(lastActivity.getTime()) &&
    Date.now() - lastActivity.getTime() <= activeWindowMs;
  const status = !row.is_active || !isRecent ? 'Inactive' : 'Active';

  return {
    ...row,
    user_code: `U-${String(row.id).padStart(4, '0')}`,
    status,
    total_spent: Number(row.total_spent || 0)
  };
}

async function fetchAdminUsers() {
  const users = await pool.query(`${USER_SELECT} ORDER BY u.created_at DESC, u.id DESC`);
  const rows = users.rows.map(formatUserRow);
  const now = new Date();
  const stats = rows.reduce(
    (acc, user) => {
      const createdAt = new Date(user.created_at);
      acc.totalUsers += 1;
      if (user.status === 'Active') acc.activeUsers += 1;
      else acc.inactiveUsers += 1;
      if (
        createdAt.getFullYear() === now.getFullYear() &&
        createdAt.getMonth() === now.getMonth()
      ) {
        acc.newThisMonth += 1;
      }
      acc.totalBusBookings += user.bus_bookings_count;
      acc.totalCarRentals += user.car_rentals_count;
      acc.totalActivity += user.total_activity_count;
      return acc;
    },
    {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      newThisMonth: 0,
      totalBusBookings: 0,
      totalCarRentals: 0,
      totalActivity: 0
    }
  );

  return { stats, users: rows };
}

async function fetchAdminUserById(userId) {
  const result = await pool.query(`${USER_SELECT} WHERE u.id = $1`, [userId]);
  return result.rows[0] ? formatUserRow(result.rows[0]) : null;
}

async function wouldDeactivateLastAdmin(userId, nextRoleId, nextIsActive) {
  const current = await pool.query(`
    SELECT r.name AS role, COALESCE(u.is_active, TRUE) AS is_active
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = $1
  `, [userId]);
  if (!current.rowCount) return false;

  const currentUser = current.rows[0];
  const nextRole = await fetchRoleById(nextRoleId);
  const removesAdminAccess =
    currentUser.role === 'admin' &&
    currentUser.is_active &&
    (nextRole?.name !== 'admin' || !nextIsActive);

  if (!removesAdminAccess) return false;

  const admins = await pool.query(
    `SELECT COUNT(*)::INT AS count
     FROM users
     JOIN roles ON roles.id = users.role_id
     WHERE roles.name = 'admin'
       AND COALESCE(users.is_active, TRUE) = TRUE
       AND users.id <> $1`,
    [userId]
  );
  return admins.rows[0].count === 0;
}

async function isLastActiveAdmin(userId) {
  const result = await pool.query(
    `SELECT COUNT(*)::INT AS count
     FROM users
     JOIN roles ON roles.id = users.role_id
     WHERE roles.name = 'admin'
       AND COALESCE(users.is_active, TRUE) = TRUE
       AND users.id <> $1`,
    [userId]
  );
  return result.rows[0].count === 0;
}

const ROUTE_SELECT = `
  SELECT
    r.id,
    r.bus_id,
    r.origin,
    r.destination,
    r.departure_time,
    r.arrival_time,
    r.price,
    r.daily_template_id,
    r.service_date,
    COALESCE(r.is_generated, FALSE) AS is_generated,
    CASE WHEN COALESCE(r.is_generated, FALSE) THEN 'daily' ELSE 'manual' END AS route_type,
    COALESCE(r.availability_status, 'available') AS availability_status,
    r.maintenance_start,
    r.maintenance_end,
    r.created_at,
    b.name AS bus_name,
    b.type AS bus_type,
    b.plate_number,
    b.total_seats,
    b.status AS bus_status,
    b.maintenance_start AS bus_maintenance_start,
    b.maintenance_end AS bus_maintenance_end,
    c.id AS company_id,
    c.name AS company_name,
    c.theme_color AS color,
    c.theme_bg AS bg,
    (
      SELECT COUNT(*)::INT
      FROM bus_bookings bb
      WHERE bb.route_id = r.id
        AND bb.status <> 'cancelled'
    ) AS booking_count,
    COALESCE((
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'booking_id', bb.id,
          'user_id', u.id,
          'user_name', CONCAT(u.first_name, ' ', u.last_name),
          'email', u.email,
          'phone', u.phone,
          'seat_number', bb.seat_number,
          'status', bb.status,
          'payment_method', bb.payment_method,
          'total_price', bb.total_price
        )
        ORDER BY bb.seat_number, bb.id
      )
      FROM bus_bookings bb
      JOIN users u ON u.id = bb.user_id
      WHERE bb.route_id = r.id
        AND bb.status <> 'cancelled'
    ), '[]'::JSON) AS passengers
  FROM bus_routes r
  JOIN buses b ON r.bus_id = b.id
  LEFT JOIN companies c ON b.company_id = c.id
`;

const BUS_SELECT = `
  SELECT
    b.id,
    b.name,
    b.type,
    b.plate_number,
    b.total_seats,
    b.status,
    b.maintenance_start,
    b.maintenance_end,
    c.id AS company_id,
    c.name AS company_name,
    c.theme_color AS color,
    c.theme_bg AS bg
  FROM buses b
  LEFT JOIN companies c ON b.company_id = c.id
  ORDER BY c.name NULLS LAST, b.name
`;

const DESTINATION_SELECT = `
  SELECT id, name, created_at
  FROM destinations
  ORDER BY name
`;

function normalizeRoutePayload(body) {
  const busId = Number(body.bus_id);
  const origin = String(body.origin || '').trim();
  const destination = String(body.destination || '').trim();
  const departureRaw = String(body.departure_time || '').trim();
  const arrivalRaw = String(body.arrival_time || '').trim();
  const departure = new Date(departureRaw);
  const arrival = new Date(arrivalRaw);
  const price = Number(body.price);
  const availabilityStatus = normalizeText(body.availability_status || 'available').toLowerCase();
  const maintenanceStart = normalizeDateTime(body.maintenance_start);
  const maintenanceEnd = normalizeDateTime(body.maintenance_end);

  if (!busId || !origin || !destination || !departureRaw || !arrivalRaw || Number.isNaN(price)) {
    return { error: 'All schedule fields are required.' };
  }

  if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime())) {
    return { error: 'Departure and arrival time must be valid.' };
  }

  if (arrival <= departure) {
    return { error: 'Arrival time must be after departure time.' };
  }

  if (price <= 0) {
    return { error: 'Price must be greater than zero.' };
  }
  if (!ROUTE_AVAILABILITY_STATUSES.includes(availabilityStatus)) {
    return { error: 'Invalid schedule availability status.' };
  }
  if (availabilityStatus === 'maintenance') {
    if (!maintenanceStart || !maintenanceEnd) {
      return { error: 'Maintenance start and end date/time are required.' };
    }
    if (maintenanceEnd <= maintenanceStart) {
      return { error: 'Maintenance end date/time must be after the start date/time.' };
    }
    if (!(maintenanceStart < arrival && maintenanceEnd > departure)) {
      return { error: 'Maintenance duration must overlap this scheduled trip.' };
    }
  }

  const departureLocal = departureRaw.replace('T', ' ') + (departureRaw.length === 16 ? ':00' : '');
  const arrivalLocal = arrivalRaw.replace('T', ' ') + (arrivalRaw.length === 16 ? ':00' : '');

  return {
    value: {
      bus_id: busId,
      origin,
      destination,
      departure_time: departureLocal,
      arrival_time: arrivalLocal,
      price: price.toFixed(2),
      availability_status: availabilityStatus,
      maintenance_start: availabilityStatus === 'maintenance' ? maintenanceStart : null,
      maintenance_end: availabilityStatus === 'maintenance' ? maintenanceEnd : null
    }
  };
}

function normalizeTimeOfDay(value, label = 'Time') {
  const raw = normalizeText(value);
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return { error: `${label} must be a valid time.` };
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) {
    return { error: `${label} must be a valid time.` };
  }
  return { value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` };
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return (hours * 60) + minutes;
}

function addDateDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function todayDateKey() {
  return formatDateKey(new Date());
}

function buildTemplateDateTimes(template, serviceDate) {
  const departureTime = String(template.departure_time || '').slice(0, 8);
  const arrivalTime = String(template.arrival_time || '').slice(0, 8);
  const arrivalDate = timeToMinutes(arrivalTime) <= timeToMinutes(departureTime)
    ? addDateDays(serviceDate, 1)
    : serviceDate;
  return {
    departure_time: `${serviceDate} ${departureTime}`,
    arrival_time: `${arrivalDate} ${arrivalTime}`
  };
}

function normalizeDailyRouteTemplatePayload(body) {
  const busId = Number(body.bus_id);
  const origin = normalizeText(body.origin);
  const destination = normalizeText(body.destination);
  const departure = normalizeTimeOfDay(body.departure_time, 'Departure time');
  const arrival = normalizeTimeOfDay(body.arrival_time, 'Arrival time');
  const price = normalizeMoney(body.price);
  const isActive = body.is_active === undefined ? true : Boolean(body.is_active);

  if (!busId || !origin || !destination || !normalizeText(body.departure_time) || !normalizeText(body.arrival_time) || Number.isNaN(price)) {
    return { error: 'Bus, origin, destination, departure time, arrival time, and price are required.' };
  }
  if (departure.error) return { error: departure.error };
  if (arrival.error) return { error: arrival.error };
  if (departure.value === arrival.value) {
    return { error: 'Arrival time must be different from departure time.' };
  }
  if (price <= 0) {
    return { error: 'Price must be greater than zero.' };
  }

  return {
    value: {
      bus_id: busId,
      origin,
      destination,
      departure_time: departure.value,
      arrival_time: arrival.value,
      price: price.toFixed(2),
      is_active: isActive
    }
  };
}

function normalizeDestinationPayload(body) {
  const name = String(body.name || '').trim();
  if (!name) {
    return { error: 'Destination name is required.' };
  }
  return { value: { name } };
}

async function ensureBusExists(busId) {
  const result = await pool.query(`SELECT id FROM buses WHERE id = $1`, [busId]);
  return result.rowCount > 0;
}

async function hasOverlappingSchedule(busId, departureTime, arrivalTime, excludeId = null) {
  const values = [busId, departureTime, arrivalTime];
  let query = `
    SELECT id
    FROM bus_routes
    WHERE bus_id = $1
      AND $2 < arrival_time
      AND $3 > departure_time
  `;

  if (excludeId !== null) {
    values.push(excludeId);
    query += ` AND id <> $4`;
  }

  const result = await pool.query(query, values);
  return result.rowCount > 0;
}

async function fetchDailyRouteTemplates() {
  const result = await pool.query(`
    SELECT
      t.id,
      t.bus_id,
      t.origin,
      t.destination,
      t.departure_time,
      t.arrival_time,
      t.price,
      t.is_active,
      t.created_at,
      t.updated_at,
      b.name AS bus_name,
      b.type AS bus_type,
      b.plate_number,
      c.name AS company_name,
      c.theme_color AS color,
      c.theme_bg AS bg,
      COUNT(r.id)::INT AS generated_count
    FROM daily_route_templates t
    JOIN buses b ON b.id = t.bus_id
    LEFT JOIN companies c ON c.id = b.company_id
    LEFT JOIN bus_routes r ON r.daily_template_id = t.id
    GROUP BY t.id, b.id, c.id
    ORDER BY t.origin, t.destination, t.departure_time
  `);
  return result.rows;
}

async function fetchDailyRouteTemplateById(templateId) {
  const result = await pool.query(`SELECT * FROM daily_route_templates WHERE id = $1`, [templateId]);
  return result.rows[0] || null;
}

async function generateDailyRoutes(db = pool) {
  const templates = await db.query(`SELECT * FROM daily_route_templates WHERE is_active = TRUE ORDER BY id`);
  const start = todayDateKey();

  for (const template of templates.rows) {
    for (let offset = 0; offset < DAILY_ROUTE_WINDOW_DAYS; offset += 1) {
      const serviceDate = addDateDays(start, offset);
      const exists = await db.query(
        `SELECT id FROM bus_routes WHERE daily_template_id = $1 AND service_date = $2`,
        [template.id, serviceDate]
      );
      if (exists.rowCount) continue;

      const times = buildTemplateDateTimes(template, serviceDate);
      const overlaps = await hasOverlappingSchedule(template.bus_id, times.departure_time, times.arrival_time);
      if (overlaps) continue;

      await db.query(
        `INSERT INTO bus_routes (bus_id, origin, destination, departure_time, arrival_time, price, daily_template_id, service_date, is_generated, availability_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'available')
         ON CONFLICT DO NOTHING`,
        [
          template.bus_id,
          template.origin,
          template.destination,
          times.departure_time,
          times.arrival_time,
          template.price,
          template.id,
          serviceDate
        ]
      );
    }
  }
}

async function ensureTemplateFutureRowsCanUpdate(templateId, effectiveDate) {
  const booked = await pool.query(
    `SELECT r.id, r.origin, r.destination, r.departure_time, COUNT(bb.id)::INT AS booking_count
     FROM bus_routes r
     JOIN bus_bookings bb ON bb.route_id = r.id AND bb.status <> 'cancelled'
     WHERE r.daily_template_id = $1
       AND COALESCE(r.is_generated, FALSE) = TRUE
       AND r.service_date >= $2
     GROUP BY r.id
     ORDER BY r.departure_time`,
    [templateId, effectiveDate]
  );

  if (booked.rowCount) {
    const error = new Error('Cannot update future daily routes because one or more affected trips already have bookings.');
    error.status = 409;
    error.code = 'DAILY_ROUTE_BOOKING_CONFLICT';
    error.routes = booked.rows;
    throw error;
  }
}

async function syncTemplateFutureRows(template, effectiveDate) {
  await ensureTemplateFutureRowsCanUpdate(template.id, effectiveDate);

  const rows = await pool.query(
    `SELECT id, service_date
     FROM bus_routes
     WHERE daily_template_id = $1
       AND COALESCE(is_generated, FALSE) = TRUE
       AND service_date >= $2
     ORDER BY service_date`,
    [template.id, effectiveDate]
  );

  for (const row of rows.rows) {
    const serviceDate = formatDateKey(row.service_date);
    const times = buildTemplateDateTimes(template, serviceDate);
    const overlaps = await hasOverlappingSchedule(template.bus_id, times.departure_time, times.arrival_time, row.id);
    if (overlaps) {
      const error = new Error(`Cannot sync route ${row.id}; the assigned bus has another trip during that time.`);
      error.status = 409;
      throw error;
    }

    await pool.query(
      `UPDATE bus_routes
       SET bus_id = $1,
           origin = $2,
           destination = $3,
           departure_time = $4,
           arrival_time = $5,
           price = $6
       WHERE id = $7`,
      [
        template.bus_id,
        template.origin,
        template.destination,
        times.departure_time,
        times.arrival_time,
        template.price,
        row.id
      ]
    );
  }
}

async function fetchBookedMaintenanceRoutes(busId, maintenanceStart, maintenanceEnd) {
  const result = await pool.query(
    `SELECT
       r.id,
       r.bus_id,
       r.origin,
       r.destination,
       r.departure_time,
       r.arrival_time,
       r.price,
       COUNT(bb.id)::INT AS booking_count,
       ARRAY_AGG(DISTINCT bb.seat_number ORDER BY bb.seat_number) AS booked_seats
     FROM bus_routes r
     JOIN bus_bookings bb ON bb.route_id = r.id AND bb.status <> 'cancelled'
     WHERE r.bus_id = $1
       AND r.departure_time < $2
       AND r.arrival_time > $3
     GROUP BY r.id
     ORDER BY r.departure_time`,
    [busId, maintenanceEnd, maintenanceStart]
  );
  return result.rows;
}

async function fetchRouteWithSeatMap(routeId) {
  const result = await pool.query(
    `SELECT
       r.*,
       b.total_seats,
       b.maintenance_start AS bus_maintenance_start,
       b.maintenance_end AS bus_maintenance_end,
       b.seat_map_override,
       t.layout_json AS template_layout
     FROM bus_routes r
     JOIN buses b ON b.id = r.bus_id
     LEFT JOIN bus_seat_map_templates t ON t.id = b.seat_map_template_id
     WHERE r.id = $1`,
    [routeId]
  );
  return result.rows[0] || null;
}

async function ensureRouteCanReceiveSeats(routeId, requiredSeats) {
  const route = await fetchRouteWithSeatMap(routeId);
  if (!route) throw Object.assign(new Error('Replacement route not found.'), { status: 400 });
  const routeBlocked = route.availability_status === 'maintenance' && route.maintenance_start && route.maintenance_end && new Date(route.departure_time) < new Date(route.maintenance_end) && new Date(route.arrival_time) > new Date(route.maintenance_start);
  const busBlocked = route.bus_maintenance_start && route.bus_maintenance_end && new Date(route.departure_time) < new Date(route.bus_maintenance_end) && new Date(route.arrival_time) > new Date(route.bus_maintenance_start);
  if (routeBlocked || busBlocked) {
    throw Object.assign(new Error('Replacement route bus is under maintenance during that trip.'), { status: 400 });
  }

  const layout = resolveSeatMap(route);
  const seatLabels = new Set((layout.cells || [])
    .filter((cell) => cell.type === 'seat')
    .map((cell) => String(cell.label || '').toUpperCase()));
  const booked = await pool.query(
    `SELECT seat_number FROM bus_bookings WHERE route_id = $1 AND status <> 'cancelled'`,
    [routeId]
  );
  const taken = new Set(booked.rows.map((row) => String(row.seat_number || '').toUpperCase()));
  const missing = requiredSeats.filter((seat) => !seatLabels.has(String(seat).toUpperCase()));
  const unavailable = requiredSeats.filter((seat) => taken.has(String(seat).toUpperCase()));

  if (missing.length) {
    throw Object.assign(new Error(`Replacement bus does not have these seat labels: ${missing.join(', ')}.`), { status: 400 });
  }
  if (unavailable.length) {
    throw Object.assign(new Error(`Replacement route already has these seats booked: ${unavailable.join(', ')}.`), { status: 400 });
  }

  return route;
}

function routeIsMaintenanceBlocked(route) {
  const routeBlocked =
    route?.availability_status === 'maintenance' &&
    route.maintenance_start &&
    route.maintenance_end &&
    new Date(route.departure_time) < new Date(route.maintenance_end) &&
    new Date(route.arrival_time) > new Date(route.maintenance_start);
  const busBlocked =
    route?.bus_maintenance_start &&
    route.bus_maintenance_end &&
    new Date(route.departure_time) < new Date(route.bus_maintenance_end) &&
    new Date(route.arrival_time) > new Date(route.bus_maintenance_start);
  return Boolean(routeBlocked || busBlocked);
}

function getBookableSeatLabels(layout) {
  return (layout?.cells || [])
    .filter((cell) => cell.type === 'seat' && normalizeText(cell.label))
    .map((cell) => normalizeText(cell.label).toUpperCase());
}

async function fetchRouteSeatInventory(routeId) {
  const route = await fetchRouteWithSeatMap(routeId);
  if (!route) return null;

  const labels = getBookableSeatLabels(resolveSeatMap(route));
  const booked = await pool.query(
    `SELECT seat_number FROM bus_bookings WHERE route_id = $1 AND status <> 'cancelled'`,
    [routeId]
  );
  const taken = new Set(booked.rows.map((row) => normalizeText(row.seat_number).toUpperCase()).filter(Boolean));
  const free = labels.filter((label) => !taken.has(label));

  return { route, labels, taken, free, capacity: free.length };
}

async function fetchBusSeatLabels(busId) {
  const result = await pool.query(
    `SELECT
       b.id,
       b.total_seats,
       b.maintenance_start,
       b.maintenance_end,
       b.seat_map_override,
       t.layout_json AS template_layout
     FROM buses b
     LEFT JOIN bus_seat_map_templates t ON t.id = b.seat_map_template_id
     WHERE b.id = $1`,
    [busId]
  );
  const bus = result.rows[0];
  if (!bus) {
    throw Object.assign(new Error('Replacement bus not found.'), { status: 400 });
  }
  return getBookableSeatLabels(resolveSeatMap(bus));
}

async function fetchRouteBookedSeats(routeId) {
  const result = await pool.query(
    `SELECT seat_number
     FROM bus_bookings
     WHERE route_id = $1
       AND status <> 'cancelled'
     ORDER BY seat_number`,
    [routeId]
  );
  return result.rows.map((row) => normalizeText(row.seat_number).toUpperCase()).filter(Boolean);
}

async function validateReplacementSchedule(sourceRoute, backup) {
  const backupBusId = Number(backup.bus_id);
  const departure = normalizeText(backup.departure_time || sourceRoute.departure_time);
  const arrival = normalizeText(backup.arrival_time || sourceRoute.arrival_time);
  const departureDate = new Date(departure);
  const arrivalDate = new Date(arrival);
  const sourceDepartureDate = new Date(sourceRoute.departure_time);

  if (!backupBusId || !departure || !arrival) {
    throw Object.assign(new Error('Replacement bus, departure time, and arrival time are required.'), { status: 400 });
  }
  if (Number.isNaN(departureDate.getTime()) || Number.isNaN(arrivalDate.getTime())) {
    throw Object.assign(new Error('Replacement departure and arrival must be valid date/time values.'), { status: 400 });
  }
  if (backupBusId === Number(sourceRoute.bus_id)) {
    throw Object.assign(new Error('Replacement bus must be different from the maintenance bus.'), { status: 400 });
  }
  if (formatDateKey(departure) !== formatDateKey(sourceRoute.departure_time)) {
    throw Object.assign(new Error('Replacement schedule must depart on the same date as the affected route.'), { status: 400 });
  }
  if (departureDate < sourceDepartureDate) {
    throw Object.assign(new Error('Replacement schedule must depart at the same time or later than the affected route.'), { status: 400 });
  }
  if (arrivalDate <= departureDate) {
    throw Object.assign(new Error('Replacement schedule arrival must be after departure.'), { status: 400 });
  }

  const backupBus = await pool.query(
    `SELECT maintenance_start, maintenance_end
     FROM buses
     WHERE id = $1`,
    [backupBusId]
  );
  if (!backupBus.rowCount) {
    throw Object.assign(new Error('Replacement bus not found.'), { status: 400 });
  }
  const backupBusMaintenance = backupBus.rows[0];
  if (
    backupBusMaintenance.maintenance_start &&
    backupBusMaintenance.maintenance_end &&
    departureDate < new Date(backupBusMaintenance.maintenance_end) &&
    arrivalDate > new Date(backupBusMaintenance.maintenance_start)
  ) {
    throw Object.assign(new Error('Replacement bus is under maintenance during that schedule.'), { status: 409 });
  }

  const overlaps = await hasOverlappingSchedule(backupBusId, departure, arrival, sourceRoute.id);
  if (overlaps) {
    throw Object.assign(new Error('Replacement bus already has a trip during that time.'), { status: 409 });
  }

  return { backupBusId, departure, arrival };
}

async function buildReplacementSeatPlan(sourceRoute, backup, routeBookings, providedAssignments = null) {
  const { backupBusId, departure, arrival } = await validateReplacementSchedule(sourceRoute, backup);
  const labels = await fetchBusSeatLabels(backupBusId);
  const seatLabels = new Set(labels);
  const bookings = routeBookings.map((booking) => ({
    ...booking,
    old_seat_number: normalizeText(booking.seat_number).toUpperCase()
  }));

  if (bookings.length > labels.length) {
    throw Object.assign(new Error('Replacement bus does not have enough bookable seats for every affected booking.'), { status: 409 });
  }

  const requested = new Map(
    (Array.isArray(providedAssignments) ? providedAssignments : [])
      .map((assignment) => [Number(assignment.booking_id), normalizeText(assignment.target_seat_number).toUpperCase()])
      .filter(([, seat]) => seat)
  );
  const used = new Set();
  const assignments = [];

  if (requested.size) {
    for (const booking of bookings) {
      const targetSeat = requested.get(Number(booking.booking_id));
      if (!targetSeat) {
        throw Object.assign(new Error('Replacement seat plan is missing one or more affected bookings.'), { status: 400 });
      }
      if (!seatLabels.has(targetSeat)) {
        throw Object.assign(new Error(`Replacement bus does not have seat ${targetSeat}.`), { status: 400 });
      }
      if (used.has(targetSeat)) {
        throw Object.assign(new Error(`Replacement seat ${targetSeat} is assigned more than once.`), { status: 400 });
      }
      used.add(targetSeat);
      assignments.push({
        booking_id: booking.booking_id,
        user_name: booking.user_name,
        user_email: booking.user_email,
        old_route_id: booking.route_id,
        target_route_id: booking.route_id,
        old_seat_number: booking.old_seat_number,
        target_seat_number: targetSeat,
        reassigned_seat: booking.old_seat_number !== targetSeat,
        preserved_seat: booking.old_seat_number === targetSeat
      });
    }
  } else {
    const needsSeat = [];
    for (const booking of bookings) {
      if (seatLabels.has(booking.old_seat_number) && !used.has(booking.old_seat_number)) {
        used.add(booking.old_seat_number);
        assignments.push({
          booking_id: booking.booking_id,
          user_name: booking.user_name,
          user_email: booking.user_email,
          old_route_id: booking.route_id,
          target_route_id: booking.route_id,
          old_seat_number: booking.old_seat_number,
          target_seat_number: booking.old_seat_number,
          reassigned_seat: false,
          preserved_seat: true
        });
      } else {
        needsSeat.push(booking);
      }
    }

    const freeSeats = labels.filter((label) => !used.has(label));
    for (const booking of needsSeat) {
      if (!freeSeats.length) {
        throw Object.assign(new Error('Replacement bus does not have enough available seats for every affected booking.'), { status: 409 });
      }
      const index = Number(booking.booking_id || 0) % freeSeats.length;
      const targetSeat = freeSeats.splice(index, 1)[0];
      used.add(targetSeat);
      assignments.push({
        booking_id: booking.booking_id,
        user_name: booking.user_name,
        user_email: booking.user_email,
        old_route_id: booking.route_id,
        target_route_id: booking.route_id,
        old_seat_number: booking.old_seat_number,
        target_seat_number: targetSeat,
        reassigned_seat: true,
        preserved_seat: false
      });
    }
  }

  assignments.sort((a, b) => Number(a.booking_id) - Number(b.booking_id));
  return {
    source_route_id: sourceRoute.id,
    route_id: sourceRoute.id,
    bus_id: backupBusId,
    departure_time: departure,
    arrival_time: arrival,
    assignments
  };
}

async function fetchMaintenanceAffectedBookings(busId, maintenanceStart, maintenanceEnd) {
  const result = await pool.query(
    `SELECT
       bb.id AS booking_id,
       bb.user_id,
       bb.route_id,
       bb.seat_number,
       bb.total_price,
       bb.payment_method,
       bb.status,
       CONCAT(u.first_name, ' ', u.last_name) AS user_name,
       u.email AS user_email,
       r.bus_id,
       r.origin,
       r.destination,
       r.departure_time,
       r.arrival_time,
       r.price
     FROM bus_bookings bb
     JOIN bus_routes r ON r.id = bb.route_id
     JOIN users u ON u.id = bb.user_id
     WHERE r.bus_id = $1
       AND r.departure_time < $2
       AND r.arrival_time > $3
       AND bb.status <> 'cancelled'
     ORDER BY r.departure_time, bb.id`,
    [busId, maintenanceEnd, maintenanceStart]
  );
  return result.rows;
}

async function fetchMaintenanceAffectedRoutes(busId, maintenanceStart, maintenanceEnd) {
  const cambodiaNow = getCambodiaDateTimeKey();
  const result = await pool.query(
    `SELECT
       r.id,
       r.bus_id,
       r.origin,
       r.destination,
       r.departure_time,
       r.arrival_time,
       r.price,
       COUNT(bb.id)::INT AS booking_count,
       COALESCE(
         ARRAY_AGG(bb.seat_number ORDER BY bb.seat_number) FILTER (WHERE bb.id IS NOT NULL),
         ARRAY[]::VARCHAR[]
       ) AS booked_seats
     FROM bus_routes r
     LEFT JOIN bus_bookings bb ON bb.route_id = r.id AND bb.status <> 'cancelled'
     WHERE r.bus_id = $1
       AND r.departure_time < $2
       AND r.arrival_time > $3
       AND r.departure_time > $4
     GROUP BY r.id
     ORDER BY r.departure_time, r.id`,
    [busId, maintenanceEnd, maintenanceStart, cambodiaNow]
  );
  return result.rows;
}

async function findCompatibleRoutesWithCapacity(route) {
  const candidates = await findMaintenanceRecoveryOptions(route);
  const enriched = [];

  for (const candidate of candidates) {
    const inventory = await fetchRouteSeatInventory(candidate.id);
    if (!inventory || inventory.capacity <= 0) continue;
    enriched.push({
      ...candidate,
      free_seats: inventory.free,
      free_seat_count: inventory.capacity
    });
  }

  return enriched;
}

async function fetchBackupBusCandidates(excludeBusId, departureTime, arrivalTime) {
  const result = await pool.query(
    `SELECT
       b.id,
       b.name,
       b.type,
       b.plate_number,
       b.total_seats,
       c.name AS company_name
     FROM buses b
     LEFT JOIN companies c ON c.id = b.company_id
     WHERE b.id <> $1
     ORDER BY c.name NULLS LAST, b.name`,
    [excludeBusId]
  );
  return result.rows;
}

function assignBookingsToCapacities(bookings, routeCapacities) {
  const capacities = routeCapacities.map((route) => ({
    ...route,
    available: [...(route.free_seats || [])]
  }));
  const assignments = [];
  const unassigned = [];

  bookings.forEach((booking) => {
    const oldSeat = normalizeText(booking.seat_number).toUpperCase();
    let target = capacities.find((route) => route.available.includes(oldSeat));
    let seat = oldSeat;

    if (!target) {
      target = capacities.find((route) => route.available.length > 0);
      seat = target?.available[0];
    }

    if (!target || !seat) {
      unassigned.push(booking);
      return;
    }

    target.available = target.available.filter((item) => item !== seat);
    assignments.push({
      booking_id: booking.booking_id,
      old_route_id: booking.route_id,
      old_seat_number: booking.seat_number,
      target_route_id: target.id,
      target_seat_number: seat,
      reassigned_seat: oldSeat !== seat
    });
  });

  return { assignments, unassigned };
}

function expandMaintenanceReplacementRoutes(backupRoutes, affectedRoutes) {
  const requested = Array.isArray(backupRoutes)
    ? backupRoutes.filter((backup) => Number(backup.bus_id))
    : [];
  if (!requested.length) return [];

  const expanded = [...requested];
  const defaultReplacement = requested[0];
  const coveredRouteIds = new Set(
    requested
      .map((backup) => Number(backup.source_route_id || backup.route_id))
      .filter(Boolean)
  );

  for (const affectedRoute of affectedRoutes || []) {
    if (coveredRouteIds.has(Number(affectedRoute.id))) continue;
    expanded.push({
      source_route_id: Number(affectedRoute.id),
      temp_id: `auto-replacement-${affectedRoute.id}`,
      bus_id: Number(defaultReplacement.bus_id),
      departure_time: affectedRoute.departure_time,
      arrival_time: affectedRoute.arrival_time
    });
    coveredRouteIds.add(Number(affectedRoute.id));
  }

  return expanded;
}

async function buildMaintenanceImpactPreview(routeId, maintenanceStart, maintenanceEnd, options = {}) {
  const route = await fetchAdminRouteById(routeId);
  if (!route) {
    const error = new Error('Schedule not found.');
    error.status = 404;
    throw error;
  }

  const affectedBookings = await fetchMaintenanceAffectedBookings(route.bus_id, maintenanceStart, maintenanceEnd);
  const affectedRoutes = await fetchMaintenanceAffectedRoutes(route.bus_id, maintenanceStart, maintenanceEnd);
  const routeOptions = {};
  const backupCandidates = {};
  const replacementSeatPlans = {};
  const backupRoutes = expandMaintenanceReplacementRoutes(options.backup_routes, affectedRoutes);
  const selectedAssignments = Array.isArray(options.assignments) ? options.assignments : [];
  const selectedBookingIds = new Set(selectedAssignments.map((assignment) => Number(assignment.booking_id)).filter(Boolean));
  const affectedRouteIds = new Set(affectedRoutes.map((affectedRoute) => Number(affectedRoute.id)));
  const allAssignments = [];
  const allUnassigned = [];

  for (const affectedRoute of affectedRoutes) {
    const routeBookings = affectedBookings.filter((booking) => Number(booking.route_id) === Number(affectedRoute.id));
    const unresolvedRouteBookings = routeBookings.filter((booking) => !selectedBookingIds.has(Number(booking.booking_id)));
    const selectedBackup = backupRoutes.find((backup) => Number(backup.source_route_id || backup.route_id) === Number(affectedRoute.id));
    const options = (await findCompatibleRoutesWithCapacity(affectedRoute))
      .filter((option) => !affectedRouteIds.has(Number(option.id)));
    const split = assignBookingsToCapacities(routeBookings, options);
    routeOptions[affectedRoute.id] = options;
    backupCandidates[affectedRoute.id] = await fetchBackupBusCandidates(
      affectedRoute.bus_id,
      affectedRoute.departure_time,
      affectedRoute.arrival_time
    );
    if (selectedBackup?.bus_id) {
      replacementSeatPlans[affectedRoute.id] = await buildReplacementSeatPlan(
        affectedRoute,
        selectedBackup,
        unresolvedRouteBookings,
        selectedBackup.replacement_seat_plan || selectedBackup.seat_plan
      );
    }
    allAssignments.push(...split.assignments);
    allUnassigned.push(...split.unassigned);
  }

  return {
    sync_bus_status: true,
    maintenance_start: maintenanceStart,
    maintenance_end: maintenanceEnd,
    affected_routes: affectedRoutes,
    affected_bookings: affectedBookings,
    compatible_routes: routeOptions,
    backup_bus_candidates: backupCandidates,
    replacement_seat_plans: replacementSeatPlans,
    auto_plan: {
      assignments: allAssignments,
      unassigned_bookings: allUnassigned
    }
  };
}

async function createBackupRouteForRecovery(sourceRoute, backup) {
  const backupBusId = Number(backup.bus_id);
  const departure = normalizeText(backup.departure_time || sourceRoute.departure_time);
  const arrival = normalizeText(backup.arrival_time || sourceRoute.arrival_time);
  const departureDate = new Date(departure);
  const arrivalDate = new Date(arrival);
  const sourceDepartureDate = new Date(sourceRoute.departure_time);
  if (!backupBusId || !departure || !arrival) {
    throw Object.assign(new Error('Backup bus, departure time, and arrival time are required.'), { status: 400 });
  }
  if (Number.isNaN(departureDate.getTime()) || Number.isNaN(arrivalDate.getTime())) {
    throw Object.assign(new Error('Backup departure and arrival must be valid date/time values.'), { status: 400 });
  }
  if (backupBusId === Number(sourceRoute.bus_id)) {
    throw Object.assign(new Error('Backup route must use a different bus.'), { status: 400 });
  }
  if (formatDateKey(departure) !== formatDateKey(sourceRoute.departure_time)) {
    throw Object.assign(new Error('Backup route must depart on the same date as the affected route.'), { status: 400 });
  }
  if (departureDate < sourceDepartureDate) {
    throw Object.assign(new Error('Backup route must depart at the same time or later than the affected route.'), { status: 400 });
  }
  if (arrivalDate <= departureDate) {
    throw Object.assign(new Error('Backup route arrival must be after departure.'), { status: 400 });
  }
  const overlaps = await hasOverlappingSchedule(backupBusId, departure, arrival);
  if (overlaps) {
    throw Object.assign(new Error('Backup bus already has a trip during that time.'), { status: 409 });
  }

  const created = await pool.query(
    `INSERT INTO bus_routes (bus_id, origin, destination, departure_time, arrival_time, price, is_generated, service_date, availability_status)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, 'available')
     RETURNING id`,
    [backupBusId, sourceRoute.origin, sourceRoute.destination, departure, arrival, sourceRoute.price, formatDateKey(departure)]
  );
  return created.rows[0].id;
}

async function replaceRouteBusForMaintenanceRecovery(sourceRoute, backup, routeBookings) {
  const seatPlan = await buildReplacementSeatPlan(
    sourceRoute,
    backup,
    routeBookings,
    backup.replacement_seat_plan || backup.seat_plan
  );

  await pool.query(
    `UPDATE bus_routes
     SET bus_id = $1,
         departure_time = $2,
         arrival_time = $3,
         service_date = $4,
         is_generated = FALSE,
         availability_status = 'available',
         maintenance_start = NULL,
         maintenance_end = NULL
     WHERE id = $5`,
    [seatPlan.bus_id, seatPlan.departure_time, seatPlan.arrival_time, formatDateKey(seatPlan.departure_time), sourceRoute.id]
  );

  for (const assignment of seatPlan.assignments) {
    await pool.query(
      `UPDATE bus_bookings
       SET seat_number = $1
       WHERE id = $2
         AND route_id = $3
         AND status <> 'cancelled'`,
      [assignment.target_seat_number, assignment.booking_id, sourceRoute.id]
    );
    await pool.query(
      `INSERT INTO booking_recovery_events (booking_id, old_route_id, new_route_id, old_seat_number, new_seat_number, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        assignment.booking_id,
        sourceRoute.id,
        sourceRoute.id,
        assignment.old_seat_number,
        assignment.target_seat_number,
        assignment.reassigned_seat ? 'maintenance replacement bus and seat swap' : 'maintenance replacement bus'
      ]
    );
  }

  await createBusTicketNotifications(
    seatPlan.assignments.map((assignment) => assignment.booking_id),
    {
      type: 'bus_maintenance_moved',
      title: 'Your bus was changed',
      message: 'Your trip was moved to another bus because of maintenance. Review your updated ticket. You can cancel until 30 minutes before departure.',
      action_type: 'cancel_moved_trip',
      metadata: { reason: 'maintenance replacement bus', route_id: sourceRoute.id }
    }
  );

  return { routeId: sourceRoute.id, seatPlan };
}

async function buildOriginalBusSeatRestorePlan(routeId, originalBusId) {
  const labels = await fetchBusSeatLabels(originalBusId);
  const labelSet = new Set(labels);
  const bookings = await pool.query(
    `SELECT
       bb.id AS booking_id,
       bb.seat_number AS current_seat_number,
       latest.old_seat_number AS original_seat_number
     FROM bus_bookings bb
     LEFT JOIN LATERAL (
       SELECT bre.old_seat_number
       FROM booking_recovery_events bre
       WHERE bre.booking_id = bb.id
         AND bre.old_route_id = $1
         AND bre.new_route_id = $1
         AND bre.reason IN ('maintenance replacement bus', 'maintenance replacement bus and seat swap')
       ORDER BY bre.created_at DESC, bre.id DESC
       LIMIT 1
     ) latest ON TRUE
     WHERE bb.route_id = $1
       AND bb.status <> 'cancelled'
     ORDER BY bb.id`,
    [routeId]
  );

  if (bookings.rows.length > labels.length) {
    throw Object.assign(new Error('Original bus does not have enough bookable seats to restore every passenger.'), { status: 409 });
  }

  const assignments = [];
  const needsSeat = [];
  const used = new Set();

  for (const booking of bookings.rows) {
    const currentSeat = normalizeText(booking.current_seat_number).toUpperCase();
    const originalSeat = normalizeText(booking.original_seat_number).toUpperCase();
    const preferredSeat = originalSeat || currentSeat;
    if (preferredSeat && labelSet.has(preferredSeat) && !used.has(preferredSeat)) {
      used.add(preferredSeat);
      assignments.push({
        booking_id: booking.booking_id,
        old_seat_number: currentSeat,
        new_seat_number: preferredSeat
      });
    } else {
      needsSeat.push({ booking_id: booking.booking_id, old_seat_number: currentSeat });
    }
  }

  const freeSeats = labels.filter((label) => !used.has(label));
  for (const booking of needsSeat) {
    if (!freeSeats.length) {
      throw Object.assign(new Error('Original bus does not have enough available seats to restore every passenger.'), { status: 409 });
    }
    const index = Number(booking.booking_id || 0) % freeSeats.length;
    const targetSeat = freeSeats.splice(index, 1)[0];
    used.add(targetSeat);
    assignments.push({
      booking_id: booking.booking_id,
      old_seat_number: booking.old_seat_number,
      new_seat_number: targetSeat
    });
  }

  assignments.sort((a, b) => Number(a.booking_id) - Number(b.booking_id));
  return assignments;
}

async function restoreTemporaryBusReplacements(originalBusId) {
  if (!originalBusId) return [];

  const cambodiaNow = getCambodiaDateTimeKey();
  const temporaryRoutes = await pool.query(
    `SELECT
       r.id,
       r.bus_id AS temporary_bus_id,
       r.daily_template_id,
       r.departure_time,
       r.arrival_time,
       r.service_date,
       t.bus_id AS original_bus_id
     FROM bus_routes r
     JOIN daily_route_templates t ON t.id = r.daily_template_id
     WHERE t.bus_id = $1
       AND r.bus_id <> t.bus_id
       AND COALESCE(r.is_generated, FALSE) = FALSE
       AND r.departure_time > $2
     ORDER BY r.departure_time, r.id`,
    [originalBusId, cambodiaNow]
  );

  const restoredRouteIds = [];
  for (const route of temporaryRoutes.rows) {
    const overlaps = await hasOverlappingSchedule(originalBusId, route.departure_time, route.arrival_time, route.id);
    if (overlaps) {
      throw Object.assign(new Error(`Original bus already has another trip during replacement route #${route.id}.`), { status: 409 });
    }

    const assignments = await buildOriginalBusSeatRestorePlan(route.id, originalBusId);
    for (const assignment of assignments) {
      await pool.query(
        `UPDATE bus_bookings
         SET seat_number = $1
         WHERE id = $2
           AND route_id = $3
           AND status <> 'cancelled'`,
        [assignment.new_seat_number, assignment.booking_id, route.id]
      );
      await pool.query(
        `INSERT INTO booking_recovery_events (booking_id, old_route_id, new_route_id, old_seat_number, new_seat_number, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          assignment.booking_id,
          route.id,
          route.id,
          assignment.old_seat_number,
          assignment.new_seat_number,
          'maintenance original bus restored'
        ]
      );
    }

    await pool.query(
      `UPDATE bus_routes
       SET bus_id = $1,
           is_generated = TRUE,
           availability_status = 'available',
           maintenance_start = NULL,
           maintenance_end = NULL
       WHERE id = $2`,
      [originalBusId, route.id]
    );
    restoredRouteIds.push(Number(route.id));
  }

  return restoredRouteIds;
}

async function restoreSplitBookingsForAvailableBus(originalBusId) {
  if (!originalBusId) return [];

  const cambodiaNow = getCambodiaDateTimeKey();
  const result = await pool.query(
    `SELECT DISTINCT ON (bb.id)
       bb.id AS booking_id,
       bb.route_id AS current_route_id,
       bb.seat_number AS current_seat_number,
       bre.old_route_id,
       bre.new_route_id,
       bre.old_seat_number,
       bre.new_seat_number,
       old_route.bus_id AS original_bus_id,
       old_route.departure_time AS original_departure_time,
       new_route.departure_time AS current_departure_time
     FROM booking_recovery_events bre
     JOIN bus_bookings bb ON bb.id = bre.booking_id
     JOIN bus_routes old_route ON old_route.id = bre.old_route_id
     JOIN bus_routes new_route ON new_route.id = bre.new_route_id
     WHERE bre.reason = 'maintenance'
       AND old_route.bus_id = $1
       AND bb.route_id = bre.new_route_id
       AND bb.status <> 'cancelled'
       AND old_route.departure_time > $2
       AND new_route.departure_time > $2
       AND NOT EXISTS (
         SELECT 1
         FROM booking_recovery_events restored
         WHERE restored.booking_id = bb.id
           AND restored.reason = 'maintenance split restored'
           AND restored.new_route_id = bre.old_route_id
           AND restored.old_route_id = bre.new_route_id
           AND restored.created_at > bre.created_at
       )
     ORDER BY bb.id, bre.created_at DESC, bre.id DESC`,
    [originalBusId, cambodiaNow]
  );

  const byRoute = new Map();
  result.rows.forEach((row) => {
    const routeId = Number(row.old_route_id);
    if (!byRoute.has(routeId)) byRoute.set(routeId, []);
    byRoute.get(routeId).push(row);
  });

  const restoredBookingIds = [];
  for (const [routeId, rows] of byRoute.entries()) {
    const inventory = await fetchRouteSeatInventory(routeId);
    if (!inventory) {
      throw Object.assign(new Error(`Original route #${routeId} was not found for split restore.`), { status: 409 });
    }

    const taken = new Set(
      Array.from(inventory.taken)
        .map((seat) => normalizeText(seat).toUpperCase())
        .filter(Boolean)
    );
    const labels = inventory.labels.map((seat) => normalizeText(seat).toUpperCase()).filter(Boolean);
    const assignments = [];

    for (const row of rows) {
      const currentSeat = normalizeText(row.current_seat_number).toUpperCase();
      const oldSeat = normalizeText(row.old_seat_number).toUpperCase();
      let targetSeat = oldSeat && labels.includes(oldSeat) && !taken.has(oldSeat)
        ? oldSeat
        : '';

      if (!targetSeat) {
        targetSeat = labels.find((seat) => !taken.has(seat));
      }
      if (!targetSeat) {
        const details = rows.map((item) => `booking #${item.booking_id}`).join(', ');
        throw Object.assign(new Error(`Original route #${routeId} does not have enough seats to restore ${details}.`), { status: 409 });
      }

      taken.add(targetSeat);
      assignments.push({
        booking_id: row.booking_id,
        current_route_id: row.current_route_id,
        current_seat_number: currentSeat,
        target_seat_number: targetSeat
      });
    }

    for (const assignment of assignments) {
      await pool.query(
        `UPDATE bus_bookings
         SET route_id = $1,
             seat_number = $2
         WHERE id = $3
           AND status <> 'cancelled'`,
        [routeId, assignment.target_seat_number, assignment.booking_id]
      );
      await pool.query(
        `INSERT INTO booking_recovery_events (booking_id, old_route_id, new_route_id, old_seat_number, new_seat_number, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          assignment.booking_id,
          assignment.current_route_id,
          routeId,
          assignment.current_seat_number,
          assignment.target_seat_number,
          'maintenance split restored'
        ]
      );
      restoredBookingIds.push(Number(assignment.booking_id));
    }
  }

  return restoredBookingIds;
}

async function clearFutureRouteMaintenanceForBus(busId) {
  if (!busId) return;
  const cambodiaNow = getCambodiaDateTimeKey();
  await pool.query(
    `UPDATE bus_routes
     SET availability_status = 'available',
         maintenance_start = NULL,
         maintenance_end = NULL
     WHERE bus_id = $1
       AND availability_status = 'maintenance'
       AND departure_time > $2`,
    [busId, cambodiaNow]
  );
}

async function restoreRouteToDailyTemplate(routeId) {
  const route = await fetchAdminRouteById(routeId);
  if (!route) {
    throw Object.assign(new Error('Schedule not found.'), { status: 404 });
  }
  if (!route.daily_template_id) {
    throw Object.assign(new Error('Only schedules linked to a daily template can be reverted.'), { status: 400 });
  }

  const template = await fetchDailyRouteTemplateById(route.daily_template_id);
  if (!template) {
    throw Object.assign(new Error('Original daily template not found.'), { status: 400 });
  }

  const serviceDate = formatDateKey(route.service_date || route.departure_time);
  const times = buildTemplateDateTimes(template, serviceDate);
  const overlaps = await hasOverlappingSchedule(template.bus_id, times.departure_time, times.arrival_time, routeId);
  if (overlaps) {
    throw Object.assign(new Error('Original bus already has another trip during this daily schedule time.'), { status: 409 });
  }

  const assignments = await buildOriginalBusSeatRestorePlan(routeId, template.bus_id);
  for (const assignment of assignments) {
    await pool.query(
      `UPDATE bus_bookings
       SET seat_number = $1
       WHERE id = $2
         AND route_id = $3
         AND status <> 'cancelled'`,
      [assignment.new_seat_number, assignment.booking_id, routeId]
    );
    await pool.query(
      `INSERT INTO booking_recovery_events (booking_id, old_route_id, new_route_id, old_seat_number, new_seat_number, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        assignment.booking_id,
        routeId,
        routeId,
        assignment.old_seat_number,
        assignment.new_seat_number,
        'daily schedule reverted'
      ]
    );
  }

  await pool.query(
    `UPDATE bus_routes
     SET bus_id = $1,
         origin = $2,
         destination = $3,
         departure_time = $4,
         arrival_time = $5,
         price = $6,
         service_date = $7,
         is_generated = TRUE,
         availability_status = 'available',
         maintenance_start = NULL,
         maintenance_end = NULL
     WHERE id = $8`,
    [
      template.bus_id,
      template.origin,
      template.destination,
      times.departure_time,
      times.arrival_time,
      template.price,
      serviceDate,
      routeId
    ]
  );

  return fetchAdminRouteById(routeId);
}

async function applyMaintenanceImpactPlan(routeId, maintenanceStart, maintenanceEnd, plan = {}) {
  const preview = await buildMaintenanceImpactPreview(routeId, maintenanceStart, maintenanceEnd);
  if (!preview.affected_routes.length) return { preview, assignments: [], replacedRouteIds: [], replacementSeatPlans: {} };

  const sourceRouteById = new Map(preview.affected_routes.map((route) => [Number(route.id), route]));
  const replacedRouteIds = new Set();
  const replacedBookingIds = new Set();
  const replacementSeatPlans = {};

  const assignments = Array.isArray(plan.assignments) ? plan.assignments : [];
  const assignedIds = new Set();

  for (const assignment of assignments) {
    const booking = preview.affected_bookings.find((item) => Number(item.booking_id) === Number(assignment.booking_id));
    if (!booking) {
      throw Object.assign(new Error('Recovery assignment references an invalid booking.'), { status: 400 });
    }

    const targetRouteId = Number(assignment.target_route_id);
    const targetSeat = normalizeText(assignment.target_seat_number).toUpperCase();
    if (!targetRouteId || !targetSeat) {
      throw Object.assign(new Error('Every assignment needs a target route and seat.'), { status: 400 });
    }

    const inventory = await fetchRouteSeatInventory(targetRouteId);
    if (!inventory) {
      throw Object.assign(new Error('Target route not found.'), { status: 400 });
    }
    if (inventory.route.origin !== booking.origin || inventory.route.destination !== booking.destination) {
      throw Object.assign(new Error('Target route must use the same origin and destination.'), { status: 400 });
    }
    if (new Date(inventory.route.departure_time) < new Date(booking.departure_time)) {
      throw Object.assign(new Error('Target route must depart at the same time or later.'), { status: 400 });
    }
    if (!inventory.labels.includes(targetSeat)) {
      throw Object.assign(new Error(`Target route does not have seat ${targetSeat}.`), { status: 400 });
    }
    if (inventory.taken.has(targetSeat)) {
      throw Object.assign(new Error(`Seat ${targetSeat} is no longer available on the target route.`), { status: 400 });
    }

    await pool.query(
      `UPDATE bus_bookings
       SET route_id = $1,
           seat_number = $2
       WHERE id = $3
         AND status <> 'cancelled'`,
      [targetRouteId, targetSeat, booking.booking_id]
    );
    await pool.query(
      `INSERT INTO booking_recovery_events (booking_id, old_route_id, new_route_id, old_seat_number, new_seat_number, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [booking.booking_id, booking.route_id, targetRouteId, booking.seat_number, targetSeat, 'maintenance']
    );
    await createBusTicketNotifications(booking.booking_id, {
      type: 'bus_maintenance_moved',
      title: 'Your trip was moved',
      message: 'Your trip was moved to another schedule because of maintenance. Review your updated ticket. You can cancel until 30 minutes before departure.',
      action_type: 'cancel_moved_trip',
      metadata: {
        reason: 'maintenance',
        old_route_id: booking.route_id,
        new_route_id: targetRouteId,
        old_seat_number: booking.seat_number,
        new_seat_number: targetSeat
      }
    });
    assignedIds.add(Number(booking.booking_id));
  }

  const missingBookings = preview.affected_bookings.filter((booking) => !assignedIds.has(Number(booking.booking_id)));
  const backupRoutes = expandMaintenanceReplacementRoutes(plan.backup_routes, preview.affected_routes)
    .filter((backup) => missingBookings.some((booking) => Number(booking.route_id) === Number(backup.source_route_id || backup.route_id)));

  for (const backup of backupRoutes) {
    const sourceRoute = sourceRouteById.get(Number(backup.source_route_id || backup.route_id));
    if (!sourceRoute) {
      throw Object.assign(new Error('Backup route source is invalid.'), { status: 400 });
    }
    const routeBookings = missingBookings.filter((booking) => Number(booking.route_id) === Number(sourceRoute.id));
    if (!routeBookings.length) continue;
    const replacement = await replaceRouteBusForMaintenanceRecovery(sourceRoute, backup, routeBookings);
    replacedRouteIds.add(Number(replacement.routeId));
    replacementSeatPlans[sourceRoute.id] = replacement.seatPlan;
    replacement.seatPlan.assignments.forEach((assignment) => replacedBookingIds.add(Number(assignment.booking_id)));
  }

  const stillMissing = preview.affected_bookings.filter((booking) => (
    !assignedIds.has(Number(booking.booking_id)) &&
    !replacedBookingIds.has(Number(booking.booking_id))
  ));
  if (stillMissing.length) {
    const details = stillMissing
      .map((booking) => `booking #${booking.booking_id} on schedule #${booking.route_id}`)
      .join(', ');
    throw Object.assign(new Error(`Every affected booking needs a target route and seat before saving maintenance. Missing: ${details}.`), { status: 400 });
  }

  return { preview, assignments, replacedRouteIds: Array.from(replacedRouteIds), replacementSeatPlans };
}

async function syncFutureRoutesForBusMaintenance(busId, maintenanceStart, maintenanceEnd, excludeRouteIds = []) {
  const excluded = Array.from(new Set(excludeRouteIds.map(Number).filter(Boolean)));
  const cambodiaNow = getCambodiaDateTimeKey();
  const values = [busId, maintenanceEnd, maintenanceStart, cambodiaNow];
  let exclusionClause = '';

  if (excluded.length) {
    values.push(excluded);
    exclusionClause = `AND NOT (id = ANY($5::int[]))`;
  }

  await pool.query(
    `UPDATE bus_routes
     SET availability_status = 'maintenance',
         maintenance_start = $3,
         maintenance_end = $2
     WHERE bus_id = $1
       AND departure_time < $2
       AND arrival_time > $3
       AND departure_time > $4
       ${exclusionClause}`,
    values
  );
}

async function clearRouteMaintenanceWindow(busId, maintenanceStart, maintenanceEnd) {
  await pool.query(
    `UPDATE bus_routes
     SET availability_status = 'available',
         maintenance_start = NULL,
         maintenance_end = NULL
     WHERE bus_id = $1
       AND availability_status = 'maintenance'
       AND maintenance_start = $2
       AND maintenance_end = $3`,
    [busId, maintenanceStart, maintenanceEnd]
  );
}

async function syncBusMaintenanceFromRoute(busId, status, maintenanceStart, maintenanceEnd, previousRoute = null) {
  if (status === 'maintenance') {
    await pool.query(
      `UPDATE buses
       SET status = 'maintenance',
           maintenance_start = $1,
           maintenance_end = $2
       WHERE id = $3`,
      [maintenanceStart, maintenanceEnd, busId]
    );
    await syncFutureRoutesForBusMaintenance(busId, maintenanceStart, maintenanceEnd);
    return;
  }

  if (previousRoute?.availability_status === 'maintenance' && previousRoute.maintenance_start && previousRoute.maintenance_end) {
    await pool.query(
      `UPDATE buses
       SET status = 'available',
           maintenance_start = NULL,
           maintenance_end = NULL
       WHERE id = $1
         AND status = 'maintenance'
         AND maintenance_start = $2
         AND maintenance_end = $3`,
      [previousRoute.bus_id, previousRoute.maintenance_start, previousRoute.maintenance_end]
    );
    await clearRouteMaintenanceWindow(previousRoute.bus_id, previousRoute.maintenance_start, previousRoute.maintenance_end);
  }
}

async function findMaintenanceRecoveryOptions(route) {
  const cambodiaNow = getCambodiaDateTimeKey();
  const result = await pool.query(
    `SELECT
       r.id,
       r.bus_id,
       r.origin,
       r.destination,
       r.departure_time,
       r.arrival_time,
       r.price,
       b.name AS bus_name,
       b.type AS bus_type,
       b.plate_number,
       COUNT(bb.id)::INT AS booking_count
     FROM bus_routes r
     JOIN buses b ON b.id = r.bus_id
     LEFT JOIN bus_bookings bb ON bb.route_id = r.id AND bb.status <> 'cancelled'
     WHERE r.id <> $1
       AND r.origin = $2
       AND r.destination = $3
       AND r.departure_time >= $4
       AND r.departure_time > $5
       AND NOT (
         COALESCE(r.availability_status, 'available') = 'maintenance'
         AND r.maintenance_start IS NOT NULL
         AND r.maintenance_end IS NOT NULL
         AND r.departure_time < r.maintenance_end
         AND r.arrival_time > r.maintenance_start
       )
       AND NOT (
         b.maintenance_start IS NOT NULL
         AND b.maintenance_end IS NOT NULL
         AND r.departure_time < b.maintenance_end
         AND r.arrival_time > b.maintenance_start
       )
     GROUP BY r.id, b.id
     ORDER BY r.departure_time
     LIMIT 12`,
    [route.id, route.origin, route.destination, route.departure_time, cambodiaNow]
  );
  return result.rows;
}

async function fetchBookedRouteForRecovery(routeId) {
  const result = await pool.query(
    `SELECT
       r.id,
       r.bus_id,
       r.origin,
       r.destination,
       r.departure_time,
       r.arrival_time,
       r.price,
       COUNT(bb.id)::INT AS booking_count,
       ARRAY_AGG(DISTINCT bb.seat_number ORDER BY bb.seat_number) AS booked_seats
     FROM bus_routes r
     JOIN bus_bookings bb ON bb.route_id = r.id AND bb.status <> 'cancelled'
     WHERE r.id = $1
     GROUP BY r.id`,
    [routeId]
  );
  return result.rows[0] || null;
}

async function buildRouteMaintenanceConflictPayload(routeId) {
  const route = await fetchBookedRouteForRecovery(routeId);
  if (!route) return null;
  return {
    ...route,
    recovery_options: await findMaintenanceRecoveryOptions(route)
  };
}

async function applyRouteMaintenanceRecoveryPlan(routeId, plan) {
  const route = await fetchBookedRouteForRecovery(routeId);
  if (!route) return;

  const actions = Array.isArray(plan?.actions) ? plan.actions : [];
  const action = actions.find((item) => Number(item.route_id) === Number(routeId)) || actions[0];
  if (!action) {
    throw Object.assign(new Error('This booked route needs a recovery option before saving maintenance.'), { status: 400 });
  }

  const requiredSeats = (route.booked_seats || []).map((seat) => String(seat || '').toUpperCase()).filter(Boolean);
  let replacementRouteId = Number(action.replacement_route_id);

  if (action.mode === 'backup') {
    const backupBusId = Number(action.bus_id);
    const departure = normalizeText(action.departure_time || route.departure_time);
    const arrival = normalizeText(action.arrival_time || route.arrival_time);
    if (!backupBusId || !departure || !arrival) {
      throw Object.assign(new Error('Backup bus, departure time, and arrival time are required.'), { status: 400 });
    }
    if (backupBusId === Number(route.bus_id)) {
      throw Object.assign(new Error('Backup route must use a different bus.'), { status: 400 });
    }
    if (new Date(departure) < new Date(route.departure_time)) {
      throw Object.assign(new Error('Backup route must depart at the same time or later than the affected route.'), { status: 400 });
    }
    const overlaps = await hasOverlappingSchedule(backupBusId, departure, arrival);
    if (overlaps) {
      throw Object.assign(new Error('Backup bus already has a trip during that time.'), { status: 409 });
    }
    const created = await pool.query(
      `INSERT INTO bus_routes (bus_id, origin, destination, departure_time, arrival_time, price, is_generated, service_date, availability_status)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, 'available')
       RETURNING id`,
      [backupBusId, route.origin, route.destination, departure, arrival, route.price, formatDateKey(departure)]
    );
    replacementRouteId = created.rows[0].id;
  }

  if (!replacementRouteId) {
    throw Object.assign(new Error('Replacement route is required.'), { status: 400 });
  }

  const replacement = await ensureRouteCanReceiveSeats(replacementRouteId, requiredSeats);
  if (replacement.origin !== route.origin || replacement.destination !== route.destination) {
    throw Object.assign(new Error('Replacement route must use the same origin and destination.'), { status: 400 });
  }
  if (new Date(replacement.departure_time) < new Date(route.departure_time)) {
    throw Object.assign(new Error('Replacement route must depart at the same time or later.'), { status: 400 });
  }

  await pool.query(
    `UPDATE bus_bookings
     SET route_id = $1
     WHERE route_id = $2
       AND status <> 'cancelled'`,
    [replacementRouteId, route.id]
  );
}

async function buildMaintenanceConflictPayload(busId, maintenanceStart, maintenanceEnd) {
  const affectedRoutes = await fetchBookedMaintenanceRoutes(busId, maintenanceStart, maintenanceEnd);
  const affected = [];
  for (const route of affectedRoutes) {
    affected.push({
      ...route,
      recovery_options: await findMaintenanceRecoveryOptions(route)
    });
  }
  return affected;
}

async function applyMaintenanceRecoveryPlan(busId, maintenanceStart, maintenanceEnd, plan) {
  const affectedRoutes = await fetchBookedMaintenanceRoutes(busId, maintenanceStart, maintenanceEnd);
  if (!affectedRoutes.length) return;

  const actions = Array.isArray(plan?.actions) ? plan.actions : [];
  const actionByRoute = new Map(actions.map((action) => [Number(action.route_id), action]));
  const missing = affectedRoutes.filter((route) => !actionByRoute.has(Number(route.id)));
  if (missing.length) {
    throw Object.assign(new Error('Every affected booked route needs a recovery option before saving maintenance.'), { status: 400 });
  }

  for (const route of affectedRoutes) {
    const action = actionByRoute.get(Number(route.id));
    const requiredSeats = (route.booked_seats || []).map((seat) => String(seat || '').toUpperCase()).filter(Boolean);
    let replacementRouteId = Number(action.replacement_route_id);

    if (action.mode === 'backup') {
      const backupBusId = Number(action.bus_id);
      const departure = normalizeText(action.departure_time || route.departure_time);
      const arrival = normalizeText(action.arrival_time || route.arrival_time);
      if (!backupBusId || !departure || !arrival) {
        throw Object.assign(new Error('Backup bus, departure time, and arrival time are required.'), { status: 400 });
      }
      if (backupBusId === Number(busId)) {
        throw Object.assign(new Error('Backup route must use a different bus.'), { status: 400 });
      }
      if (new Date(departure) < new Date(route.departure_time)) {
        throw Object.assign(new Error('Backup route must depart at the same time or later than the affected route.'), { status: 400 });
      }
      const overlaps = await hasOverlappingSchedule(backupBusId, departure, arrival);
      if (overlaps) {
        throw Object.assign(new Error('Backup bus already has a trip during that time.'), { status: 409 });
      }
      const created = await pool.query(
        `INSERT INTO bus_routes (bus_id, origin, destination, departure_time, arrival_time, price, is_generated, service_date)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
         RETURNING id`,
        [backupBusId, route.origin, route.destination, departure, arrival, route.price, formatDateKey(departure)]
      );
      replacementRouteId = created.rows[0].id;
    }

    if (!replacementRouteId) {
      throw Object.assign(new Error('Replacement route is required.'), { status: 400 });
    }

    const replacement = await ensureRouteCanReceiveSeats(replacementRouteId, requiredSeats);
    if (replacement.origin !== route.origin || replacement.destination !== route.destination) {
      throw Object.assign(new Error('Replacement route must use the same origin and destination.'), { status: 400 });
    }
    if (new Date(replacement.departure_time) < new Date(route.departure_time)) {
      throw Object.assign(new Error('Replacement route must depart at the same time or later.'), { status: 400 });
    }

    await pool.query(
      `UPDATE bus_bookings
       SET route_id = $1
       WHERE route_id = $2
         AND status <> 'cancelled'`,
      [replacementRouteId, route.id]
    );
  }
}

async function fetchAdminRoutes() {
  await generateDailyRoutes();
  const routes = await pool.query(`${ROUTE_SELECT} ORDER BY r.departure_time ASC`);
  const buses = await pool.query(BUS_SELECT);
  const destinations = await pool.query(DESTINATION_SELECT);
  const daily_templates = await fetchDailyRouteTemplates();
  return { routes: routes.rows, buses: buses.rows, destinations: destinations.rows, daily_templates };
}

async function fetchAdminRouteById(routeId) {
  const result = await pool.query(`${ROUTE_SELECT} WHERE r.id = $1`, [routeId]);
  return result.rows[0] || null;
}

async function fetchDestinationById(destinationId) {
  const result = await pool.query(`SELECT id, name, created_at FROM destinations WHERE id = $1`, [destinationId]);
  return result.rows[0] || null;
}

async function fetchAdminVehicles() {
  await releaseExpiredBusMaintenance();

  const [buses, cars, companies] = await Promise.all([
    pool.query(
      `SELECT
         b.id,
         b.company_id,
         b.name,
         b.type,
         b.plate_number,
         b.total_seats,
         b.status,
         b.maintenance_start,
         b.maintenance_end,
         b.seat_map_template_id,
         b.seat_map_override IS NOT NULL AS has_seat_map_override,
         b.created_at,
         t.name AS seat_map_template_name,
         t.rows AS seat_map_rows,
         t.columns AS seat_map_columns,
         t.seat_count AS seat_map_seat_count,
         c.name AS company_name,
         c.theme_color AS color,
         c.theme_bg AS bg,
         COUNT(br.id)::INT AS route_count
       FROM buses b
       LEFT JOIN companies c ON c.id = b.company_id
       LEFT JOIN bus_seat_map_templates t ON t.id = b.seat_map_template_id
       LEFT JOIN bus_routes br ON br.bus_id = b.id
       GROUP BY b.id, c.id, t.id
       ORDER BY c.name NULLS LAST, b.name`
    ),
    pool.query(
      `SELECT
         rc.id,
         rc.name,
         rc.type,
         rc.plate_number,
         rc.total_seats,
         rc.transmission,
         rc.daily_rate,
         rc.status,
         COALESCE(rc.photos, ARRAY[]::TEXT[]) AS photos,
         rc.created_at,
         COUNT(cr.id)::INT AS rental_count,
         COALESCE(
           (
             SELECT JSON_AGG(rental_window ORDER BY rental_window.pickup_datetime ASC, rental_window.id ASC)
             FROM (
               SELECT
                 active_cr.id,
                 active_cr.status,
                 COALESCE(active_cr.pickup_datetime, active_cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
                 COALESCE(active_cr.return_datetime, active_cr.return_date + TIME '09:00:00') AS return_datetime,
                 CONCAT(u.first_name, ' ', u.last_name) AS customer_name
               FROM car_rentals active_cr
               LEFT JOIN users u ON u.id = active_cr.user_id
               WHERE active_cr.car_id = rc.id
                 AND active_cr.status IN ('pending', 'confirmed')
               ORDER BY COALESCE(active_cr.pickup_datetime, active_cr.pickup_date + TIME '09:00:00') ASC, active_cr.id ASC
               LIMIT 8
             ) rental_window
           ),
           '[]'::JSON
         ) AS rental_windows
       FROM rental_cars rc
       LEFT JOIN car_rentals cr ON cr.car_id = rc.id
       GROUP BY rc.id
       ORDER BY rc.name`
    ),
    pool.query(
      `SELECT
         c.id,
         c.name,
         c.theme_color,
         c.theme_bg,
         c.created_at,
         COUNT(b.id)::INT AS bus_count
       FROM companies c
       LEFT JOIN buses b ON b.company_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    )
  ]);

  return { buses: buses.rows, cars: cars.rows, companies: companies.rows };
}

async function fetchAdminBusById(busId) {
  const result = await pool.query(
    `SELECT
       b.id,
       b.company_id,
       b.name,
       b.type,
       b.plate_number,
       b.total_seats,
       b.status,
       b.maintenance_start,
       b.maintenance_end,
       b.seat_map_template_id,
       b.seat_map_override,
       b.seat_map_override IS NOT NULL AS has_seat_map_override,
       b.created_at,
       t.name AS seat_map_template_name,
       t.layout_json AS template_layout,
       t.rows AS seat_map_rows,
       t.columns AS seat_map_columns,
       t.seat_count AS seat_map_seat_count,
       c.name AS company_name,
       c.theme_color AS color,
       c.theme_bg AS bg,
       COUNT(br.id)::INT AS route_count
     FROM buses b
     LEFT JOIN companies c ON c.id = b.company_id
     LEFT JOIN bus_seat_map_templates t ON t.id = b.seat_map_template_id
     LEFT JOIN bus_routes br ON br.bus_id = b.id
     WHERE b.id = $1
     GROUP BY b.id, c.id, t.id`,
    [busId]
  );
  return result.rows[0] || null;
}

async function fetchAdminRentalCarById(carId) {
  const result = await pool.query(
    `SELECT
       rc.id,
       rc.name,
       rc.type,
       rc.plate_number,
       rc.total_seats,
       rc.transmission,
       rc.daily_rate,
       rc.status,
       COALESCE(rc.photos, ARRAY[]::TEXT[]) AS photos,
       rc.created_at,
       COUNT(cr.id)::INT AS rental_count,
       COALESCE(
         (
           SELECT JSON_AGG(rental_window ORDER BY rental_window.pickup_datetime ASC, rental_window.id ASC)
           FROM (
             SELECT
               active_cr.id,
               active_cr.status,
               COALESCE(active_cr.pickup_datetime, active_cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
               COALESCE(active_cr.return_datetime, active_cr.return_date + TIME '09:00:00') AS return_datetime,
               CONCAT(u.first_name, ' ', u.last_name) AS customer_name
             FROM car_rentals active_cr
             LEFT JOIN users u ON u.id = active_cr.user_id
             WHERE active_cr.car_id = rc.id
               AND active_cr.status IN ('pending', 'confirmed')
             ORDER BY COALESCE(active_cr.pickup_datetime, active_cr.pickup_date + TIME '09:00:00') ASC, active_cr.id ASC
             LIMIT 8
           ) rental_window
         ),
         '[]'::JSON
       ) AS rental_windows
     FROM rental_cars rc
     LEFT JOIN car_rentals cr ON cr.car_id = rc.id
     WHERE rc.id = $1
     GROUP BY rc.id`,
    [carId]
  );
  return result.rows[0] || null;
}

async function fetchAdminCompanyById(companyId) {
  const result = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.theme_color,
       c.theme_bg,
       c.created_at,
       COUNT(b.id)::INT AS bus_count
     FROM companies c
     LEFT JOIN buses b ON b.company_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [companyId]
  );
  return result.rows[0] || null;
}

function normalizeBusPayload(body) {
  const companyId = Number(body.company_id);
  const name = normalizeText(body.name);
  const type = normalizeText(body.type);
  const plateNumber = normalizeText(body.plate_number).toUpperCase();
  const totalSeats = Number(body.total_seats);
  const status = normalizeText(body.status).toLowerCase();
  const maintenanceStart = normalizeDateTime(body.maintenance_start);
  const maintenanceEnd = normalizeDateTime(body.maintenance_end);

  if (!companyId || !name || !type || !plateNumber || !status) {
    return { error: 'Company, name, type, plate number, seats, and status are required.' };
  }
  if (!Number.isInteger(totalSeats) || totalSeats <= 0) {
    return { error: 'Total seats must be a positive whole number.' };
  }
  if (!VEHICLE_STATUSES.includes(status)) {
    return { error: 'Invalid vehicle status.' };
  }
  if (status === 'maintenance') {
    if (!maintenanceStart || !maintenanceEnd) {
      return { error: 'Maintenance start and end date/time are required.' };
    }
    if (maintenanceEnd <= maintenanceStart) {
      return { error: 'Maintenance end date/time must be after the start date/time.' };
    }
  }

  return {
    value: {
      company_id: companyId,
      name,
      type,
      plate_number: plateNumber,
      total_seats: totalSeats,
      status,
      maintenance_start: status === 'maintenance' ? maintenanceStart : null,
      maintenance_end: status === 'maintenance' ? maintenanceEnd : null
    }
  };
}

function normalizeRentalCarPayload(body) {
  const name = normalizeText(body.name);
  const type = normalizeText(body.type);
  const plateNumber = normalizeText(body.plate_number).toUpperCase();
  const totalSeats = Number(body.total_seats);
  const transmission = normalizeText(body.transmission);
  const dailyRate = normalizeMoney(body.daily_rate);
  const status = normalizeText(body.status).toLowerCase();
  const photos = Array.isArray(body.photos)
    ? body.photos.map(normalizeText).filter(Boolean)
    : String(body.photos || '').split(/\r?\n/).map(normalizeText).filter(Boolean);

  if (!name || !type || !plateNumber || !transmission || !status) {
    return { error: 'Name, type, plate number, seats, transmission, daily rate, and status are required.' };
  }
  if (!Number.isInteger(totalSeats) || totalSeats <= 0) {
    return { error: 'Total seats must be a positive whole number.' };
  }
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
    return { error: 'Daily rate must be greater than zero.' };
  }
  if (!VEHICLE_STATUSES.includes(status)) {
    return { error: 'Invalid vehicle status.' };
  }

  return {
    value: {
      name,
      type,
      plate_number: plateNumber,
      total_seats: totalSeats,
      transmission,
      daily_rate: dailyRate.toFixed(2),
      status,
      photos
    }
  };
}

function normalizeCompanyPayload(body) {
  const name = normalizeText(body.name);
  const themeColor = normalizeText(body.theme_color) || '#60a5fa';
  const themeBg = normalizeText(body.theme_bg) || 'rgba(96,165,250,0.16)';

  if (!name) {
    return { error: 'Company name is required.' };
  }

  return {
    value: {
      name,
      theme_color: themeColor,
      theme_bg: themeBg
    }
  };
}

function rowLabel(index) {
  let label = '';
  let value = index + 1;
  while (value > 0) {
    const mod = (value - 1) % 26;
    label = String.fromCharCode(65 + mod) + label;
    value = Math.floor((value - mod) / 26);
  }
  return label;
}

function buildFallbackSeatMap(totalSeats = 0) {
  const seatTotal = Math.max(0, Number(totalSeats || 0));
  const columns = 4;
  const rows = Math.max(1, Math.ceil(seatTotal / columns));
  const cells = [];
  let seatIndex = 0;

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      seatIndex += 1;
      cells.push({
        row,
        column,
        type: seatIndex <= seatTotal ? 'seat' : 'empty',
        label: seatIndex <= seatTotal ? `${rowLabel(row - 1)}${column}` : '',
        color: '',
        note: ''
      });
    }
  }

  return { rows, columns, cells };
}

function normalizeSeatMap(layout) {
  const rows = Number(layout?.rows);
  const columns = Number(layout?.columns);

  if (!Number.isInteger(rows) || rows <= 0 || rows > 30 || !Number.isInteger(columns) || columns <= 0 || columns > 12) {
    return { error: 'Seat map rows and columns must be valid whole numbers.' };
  }

  const sourceCells = Array.isArray(layout?.cells) ? layout.cells : [];
  const sourceByPosition = new Map(sourceCells.map((cell) => [`${Number(cell.row)}-${Number(cell.column)}`, cell]));
  const cells = [];
  const seatLabels = new Set();

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      const source = sourceByPosition.get(`${row}-${column}`) || {};
      const type = SEAT_MAP_CELL_TYPES.includes(normalizeText(source.type).toLowerCase())
        ? normalizeText(source.type).toLowerCase()
        : 'seat';
      const label = normalizeText(source.label);
      const color = normalizeText(source.color);
      const note = normalizeText(source.note);

      if (type === 'seat') {
        if (!label) return { error: 'Every seat cell needs a seat label.' };
        if (seatLabels.has(label.toUpperCase())) return { error: `Duplicate seat label: ${label}.` };
        seatLabels.add(label.toUpperCase());
      }

      cells.push({
        row,
        column,
        type,
        label: type === 'seat' ? label : label,
        color,
        note
      });
    }
  }

  return {
    value: {
      rows,
      columns,
      cells
    },
    seatCount: cells.filter((cell) => cell.type === 'seat').length,
    seatLabels: Array.from(seatLabels)
  };
}

function resolveSeatMap(bus) {
  const override = bus?.seat_map_override;
  const templateLayout = bus?.template_layout || bus?.layout_json;
  return override || templateLayout || buildFallbackSeatMap(bus?.total_seats);
}

async function getBookedSeatLabelsForBus(busId) {
  const result = await pool.query(
    `SELECT DISTINCT bb.seat_number
     FROM bus_bookings bb
     JOIN bus_routes br ON br.id = bb.route_id
     WHERE br.bus_id = $1
       AND bb.status <> 'cancelled'`,
    [busId]
  );
  return result.rows.map((row) => String(row.seat_number || '').toUpperCase()).filter(Boolean);
}

async function ensureBookedSeatsStillExist(busId, seatLabels) {
  const bookedLabels = await getBookedSeatLabelsForBus(busId);
  const nextLabels = new Set(seatLabels.map((label) => String(label || '').toUpperCase()));
  const missing = bookedLabels.filter((label) => !nextLabels.has(label));
  if (missing.length) {
    return { error: `Cannot remove or rename booked seats: ${missing.join(', ')}.` };
  }
  return { ok: true };
}

async function fetchSeatMapTemplates(filters = {}) {
  const params = [];
  const where = [];

  if (filters.company_id) {
    params.push(Number(filters.company_id));
    where.push(`t.company_id = $${params.length}`);
  }
  if (filters.vehicle_type) {
    params.push(normalizeText(filters.vehicle_type));
    where.push(`LOWER(t.vehicle_type) = LOWER($${params.length})`);
  }
  if (filters.rows) {
    params.push(Number(filters.rows));
    where.push(`t.rows = $${params.length}`);
  }
  if (filters.columns) {
    params.push(Number(filters.columns));
    where.push(`t.columns = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT
       t.id,
       t.company_id,
       c.name AS company_name,
       t.vehicle_type,
       t.name,
       t.rows,
       t.columns,
       t.seat_count,
       t.layout_json,
       t.created_at,
       t.updated_at,
       COUNT(b.id)::INT AS bus_count
     FROM bus_seat_map_templates t
     LEFT JOIN companies c ON c.id = t.company_id
     LEFT JOIN buses b ON b.seat_map_template_id = t.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY t.id, c.id
     ORDER BY t.updated_at DESC, t.name`,
    params
  );

  return result.rows;
}

async function createSeatMapHistory({ companyId, busId = null, templateId = null, vehicleType, name, layout, seatCount }) {
  await pool.query(
    `INSERT INTO bus_seat_map_history (company_id, bus_id, template_id, vehicle_type, name, rows, columns, seat_count, layout_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [companyId, busId, templateId, vehicleType, name, layout.rows, layout.columns, seatCount, layout]
  );
}

async function createSeatMapTemplate({ companyId, vehicleType, name, layout, seatCount }) {
  const existing = await pool.query(
    `SELECT id FROM bus_seat_map_templates WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  if (existing.rowCount) {
    const error = new Error('Duplicate template name. Please choose a different Template/history name.');
    error.status = 409;
    throw error;
  }

  const result = await pool.query(
    `INSERT INTO bus_seat_map_templates (company_id, vehicle_type, name, rows, columns, seat_count, layout_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [companyId, vehicleType, name, layout.rows, layout.columns, seatCount, layout]
  );
  return { id: result.rows[0].id };
}

app.get('/api/rental-drivers', async (req, res) => {
  const pickupInput = normalizeText(req.query.pickup_datetime);
  const returnInput = normalizeText(req.query.return_datetime);
  const pickupDateTime = pickupInput ? normalizeRentalDateTime(pickupInput) : null;
  const returnDateTime = returnInput ? normalizeRentalDateTime(returnInput) : null;

  if (pickupDateTime?.error) return res.status(400).json({ error: pickupDateTime.error });
  if (returnDateTime?.error) return res.status(400).json({ error: returnDateTime.error });
  if (pickupDateTime && returnDateTime && returnDateTime.date <= pickupDateTime.date) {
    return res.status(400).json({ error: 'Return date-time must be after pickup date-time.' });
  }

  try {
    const params = [];
    let availabilityFilter = '';
    if (pickupDateTime && returnDateTime) {
      params.push(returnDateTime.value, pickupDateTime.value, RENTAL_TURNOVER_BUFFER_MINUTES);
      availabilityFilter = `
        AND NOT EXISTS (
          SELECT 1
          FROM car_rentals cr
          WHERE cr.hired_driver_id = rd.id
            AND cr.status IN ('pending', 'confirmed')
            AND COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') < (($1)::TIMESTAMP + ($3 || ' minutes')::INTERVAL)
            AND COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') > (($2)::TIMESTAMP - ($3 || ' minutes')::INTERVAL)
        )
      `;
    }

    const result = await pool.query(
      `SELECT
         rd.id,
         rd.name,
         rd.license_number,
         rd.phone,
         rd.rating,
         rd.review_count,
         rd.hourly_rate,
         rd.status,
         rd.profile_photo,
         rd.background,
         rd.experience_years,
         COALESCE(rd.languages, ARRAY[]::TEXT[]) AS languages,
         (
           SELECT COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00')
           FROM car_rentals cr
           WHERE cr.hired_driver_id = rd.id
             AND cr.status IN ('pending', 'confirmed')
             AND COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') <= NOW()
             AND COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') > NOW()
           ORDER BY COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') ASC, cr.id ASC
           LIMIT 1
         ) AS current_rental_end,
         (
           SELECT COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00')
           FROM car_rentals cr
           WHERE cr.hired_driver_id = rd.id
             AND cr.status IN ('pending', 'confirmed')
             AND COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') > ${pickupDateTime && returnDateTime ? '($2)::TIMESTAMP' : 'NOW()'}
           ORDER BY COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') ASC, cr.id ASC
           LIMIT 1
         ) AS next_rental_start,
         (
           SELECT COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00')
           FROM car_rentals cr
           WHERE cr.hired_driver_id = rd.id
             AND cr.status IN ('pending', 'confirmed')
             AND COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') > ${pickupDateTime && returnDateTime ? '($2)::TIMESTAMP' : 'NOW()'}
           ORDER BY COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') ASC, cr.id ASC
           LIMIT 1
         ) AS next_rental_end,
         (
           SELECT rdr.comment
           FROM rental_driver_reviews rdr
           WHERE rdr.driver_id = rd.id
             AND rdr.review_type = 'review'
         ORDER BY rdr.created_at DESC, rdr.id DESC
          LIMIT 1
        ) AS latest_comment,
        COALESCE(
          (
            SELECT JSON_AGG(review_row ORDER BY review_row.created_at DESC, review_row.id DESC)
            FROM (
              SELECT
                rdr.id,
                rdr.rating,
                rdr.comment,
                rdr.created_at,
                CONCAT(u.first_name, ' ', u.last_name) AS user_name
              FROM rental_driver_reviews rdr
              LEFT JOIN users u ON u.id = rdr.user_id
              WHERE rdr.driver_id = rd.id
                AND rdr.review_type = 'review'
              ORDER BY rdr.created_at DESC, rdr.id DESC
            ) review_row
          ),
          '[]'::JSON
        ) AS reviews
       FROM rental_drivers rd
       WHERE rd.status = 'available'
       ${availabilityFilter}
       ORDER BY rd.rating DESC, rd.review_count DESC, rd.hourly_rate DESC, rd.name ASC`,
      params
    );

    res.json({ drivers: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rental-drivers/:id/reviews', async (req, res) => {
  res.status(410).json({ error: 'Driver reviews must be submitted from a returned rental ticket.' });
});

app.post('/api/rental-drivers/:id/reports', async (req, res) => {
  res.status(410).json({ error: 'Driver reports must be submitted from a returned rental ticket.' });
});

async function refreshDriverRating(driverId) {
  await pool.query(
    `UPDATE rental_drivers rd
     SET rating = stats.rating,
         review_count = stats.review_count
     FROM (
       SELECT driver_id, ROUND(AVG(rating)::NUMERIC, 2) AS rating, COUNT(*)::INT AS review_count
       FROM rental_driver_reviews
       WHERE driver_id = $1
         AND review_type = 'review'
         AND rating IS NOT NULL
       GROUP BY driver_id
     ) stats
     WHERE rd.id = stats.driver_id`,
    [driverId]
  );
}

async function fetchUserRentalForFeedback(rentalId, userId) {
  const result = await pool.query(
    `SELECT
       cr.id,
       cr.user_id,
       cr.hired_driver_id,
       cr.status,
       COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
       COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
       rd.id AS driver_id
     FROM car_rentals cr
     LEFT JOIN rental_drivers rd ON rd.id = cr.hired_driver_id
     WHERE cr.id = $1
       AND cr.user_id = $2`,
    [rentalId, userId]
  );
  return result.rows[0] || null;
}

function rentalFeedbackIsOpen(rental) {
  const status = String(rental?.status || '').toLowerCase();
  if (status === 'returned') return true;
  if (status === 'cancelled') return false;
  const pickup = new Date(rental.pickup_datetime);
  return !Number.isNaN(pickup.getTime()) && pickup <= new Date();
}

app.get('/api/my/rentals', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    const result = await pool.query(
      `SELECT
         cr.id,
         cr.user_id,
         cr.car_id,
         cr.pickup_date,
         cr.return_date,
         COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
         COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
         COALESCE(cr.rental_hours, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') - COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00'))) / 3600.0))) AS rental_hours,
         ROUND((rc.daily_rate / 24.0)::NUMERIC, 2) AS hourly_rate,
         COALESCE(cr.hourly_charge, ROUND((GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') - COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00'))) / 3600.0)) * (rc.daily_rate / 24.0))::NUMERIC, 2)) AS hourly_charge,
         cr.customer_phone,
         cr.hired_driver_id,
         cr.rental_base_price,
         cr.driver_fee,
         COALESCE(cr.late_return_hours, 0) AS late_return_hours,
         COALESCE(cr.late_return_charge, 0) AS late_return_charge,
         COALESCE(cr.damage_description, '') AS damage_description,
         COALESCE(cr.damage_charge, 0) AS damage_charge,
         COALESCE(cr.damage_responsibility, CASE WHEN cr.hired_driver_id IS NULL THEN 'renter' ELSE 'driver' END) AS damage_responsibility,
         cr.driver_name,
         cr.driver_license,
         cr.total_price,
         cr.payment_method,
         cr.status,
         cr.returned_at,
         cr.booked_at,
         rc.name AS car_name,
         rc.type AS car_type,
         rc.plate_number,
         rc.daily_rate,
         rd.name AS hired_driver_name,
         rd.rating AS hired_driver_rating,
         rd.review_count AS hired_driver_review_count,
         rd.hourly_rate AS hired_driver_hourly_rate,
         rd.phone AS hired_driver_phone,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', rcre.id,
             'source_rental_id', rcre.source_rental_id,
             'old_car_id', rcre.old_car_id,
             'new_car_id', rcre.new_car_id,
             'old_car_name', old_car.name,
             'old_plate_number', old_car.plate_number,
             'new_car_name', new_car.name,
             'new_plate_number', new_car.plate_number,
             'reason', rcre.reason,
             'created_at', rcre.created_at
           )
           FROM rental_car_replacement_events rcre
           LEFT JOIN rental_cars old_car ON old_car.id = rcre.old_car_id
           LEFT JOIN rental_cars new_car ON new_car.id = rcre.new_car_id
           WHERE rcre.affected_rental_id = cr.id
           ORDER BY rcre.created_at DESC, rcre.id DESC
           LIMIT 1
         ) AS replacement_summary,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', rcx.id,
             'refund_type', rcx.refund_type,
             'booking_reference', rcx.booking_reference,
             'amount', rcx.amount,
             'status', rcx.status,
             'claim_token', rcx.claim_token,
             'created_at', rcx.created_at,
             'claimed_at', rcx.claimed_at,
             'voided_at', rcx.voided_at
           )
           FROM refund_claims rcx
           WHERE rcx.refund_type = 'car_rental'
             AND rcx.car_rental_id = cr.id
             AND rcx.user_id = cr.user_id
             AND rcx.status <> 'voided'
           ORDER BY rcx.created_at DESC, rcx.id DESC
           LIMIT 1
         ) AS refund_claim,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', rdr.id,
             'rating', rdr.rating,
             'comment', rdr.comment,
             'created_at', rdr.created_at,
             'admin_reply', rdr.admin_reply,
             'admin_replied_at', rdr.admin_replied_at
           )
           FROM rental_driver_reviews rdr
           WHERE rdr.car_rental_id = cr.id
             AND rdr.user_id = cr.user_id
             AND rdr.review_type = 'review'
           ORDER BY rdr.created_at DESC, rdr.id DESC
           LIMIT 1
         ) AS my_driver_review,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', rdr.id,
             'comment', rdr.comment,
             'created_at', rdr.created_at,
             'admin_reply', rdr.admin_reply,
             'admin_replied_at', rdr.admin_replied_at
           )
           FROM rental_driver_reviews rdr
           WHERE rdr.car_rental_id = cr.id
             AND rdr.user_id = cr.user_id
             AND rdr.review_type = 'report'
           ORDER BY rdr.created_at DESC, rdr.id DESC
           LIMIT 1
         ) AS my_driver_report,
         COALESCE(
           (
             SELECT JSON_AGG(notification_row ORDER BY notification_row.created_at DESC, notification_row.id DESC)
             FROM (
               SELECT
                 un.id,
                 un.type,
                 un.title,
                 un.message,
                 un.action_url,
                 un.action_type,
                 COALESCE(un.metadata, '{}'::JSONB) AS metadata,
                 un.is_read,
                 un.created_at
               FROM user_notifications un
               WHERE un.car_rental_id = cr.id
                 AND un.user_id = cr.user_id
               ORDER BY un.created_at DESC, un.id DESC
             ) notification_row
           ),
           '[]'::JSON
         ) AS notifications
       FROM car_rentals cr
       JOIN rental_cars rc ON rc.id = cr.car_id
       LEFT JOIN rental_drivers rd ON rd.id = cr.hired_driver_id
       WHERE cr.user_id = $1
       ORDER BY cr.booked_at DESC, cr.id DESC`,
      [user.id]
    );
    res.json({ rentals: result.rows });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/my/notifications', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    const result = await pool.query(
      `SELECT
         id,
         user_id,
         car_rental_id,
         bus_booking_id,
         booking_reference,
         type,
         title,
         message,
         action_url,
         action_type,
         COALESCE(metadata, '{}'::JSONB) AS metadata,
         is_read,
         read_at,
         created_at
       FROM user_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 30`,
      [user.id]
    );
    const unread = await pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM user_notifications
       WHERE user_id = $1
         AND is_read = FALSE`,
      [user.id]
    );
    res.json({ notifications: result.rows, unread_count: Number(unread.rows[0].count || 0) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/my/notifications/read-all', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    await pool.query(
      `UPDATE user_notifications
       SET is_read = TRUE,
           read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1
         AND is_read = FALSE`,
      [user.id]
    );
    res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/my/notifications/:id/read', async (req, res) => {
  const notificationId = Number(req.params.id);
  if (!notificationId) return res.status(400).json({ error: 'Invalid notification id.' });

  try {
    const user = await getAuthUserFromRequest(req);
    const result = await pool.query(
      `UPDATE user_notifications
       SET is_read = TRUE,
           read_at = COALESCE(read_at, NOW())
       WHERE id = $1
         AND user_id = $2
       RETURNING id`,
      [notificationId, user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ id: notificationId, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/my/rentals/:id/notifications/read', async (req, res) => {
  const rentalId = Number(req.params.id);
  if (!rentalId) return res.status(400).json({ error: 'Invalid rental id.' });

  try {
    const user = await getAuthUserFromRequest(req);
    await pool.query(
      `UPDATE user_notifications
       SET is_read = TRUE,
           read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1
         AND car_rental_id = $2
         AND is_read = FALSE`,
      [user.id, rentalId]
    );
    res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/my/refund-claims/:id', async (req, res) => {
  const claimId = Number(req.params.id);
  if (!claimId) return res.status(400).json({ error: 'Invalid refund claim id.' });

  try {
    const user = await getAuthUserFromRequest(req);
    const claim = await fetchUserRefundClaim(claimId, user.id);
    if (!claim) return res.status(404).json({ error: 'Refund claim not found.' });
    if (claim.status === 'voided') return res.status(410).json({ error: 'This refund claim is no longer available.' });
    res.json({ refund_claim: formatRefundClaim(claim) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/my/refund-claims/:id/confirm', async (req, res) => {
  const claimId = Number(req.params.id);
  if (!claimId) return res.status(400).json({ error: 'Invalid refund claim id.' });

  try {
    const user = await getAuthUserFromRequest(req);
    const claim = await fetchUserRefundClaim(claimId, user.id);
    if (!claim) return res.status(404).json({ error: 'Refund claim not found.' });
    if (claim.status === 'voided') return res.status(410).json({ error: 'This refund claim was voided because the booking was restored.' });
    if (claim.status === 'claimed') return res.status(409).json({ error: 'This refund was already claimed.' });

    const result = await pool.query(
      `UPDATE refund_claims
       SET status = 'claimed',
           claimed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND status = 'pending'
       RETURNING *`,
      [claimId, user.id]
    );
    if (!result.rowCount) return res.status(409).json({ error: 'This refund claim is no longer pending.' });

    await pool.query(
      `UPDATE user_notifications
       SET is_read = TRUE,
           read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1
         AND type = 'refund_claim_available'
         AND COALESCE(metadata->>'refund_claim_id', '') = $2`,
      [user.id, String(claimId)]
    );

    res.json({
      message: 'Refund claim confirmed.',
      refund_claim: formatRefundClaim(result.rows[0])
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/my/rentals/:id/cancel', async (req, res) => {
  const rentalId = Number(req.params.id);
  if (!rentalId) return res.status(400).json({ error: 'Invalid rental id.' });

  const client = await pool.connect();
  try {
    const user = await getAuthUserFromRequest(req);
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT
         id,
         user_id,
         status,
         COALESCE(pickup_datetime, pickup_date + TIME '09:00:00') AS pickup_datetime
       FROM car_rentals
       WHERE id = $1
         AND user_id = $2
       FOR UPDATE`,
      [rentalId, user.id]
    );

    if (!existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rental ticket not found.' });
    }
    const rental = existing.rows[0];
    if (!['pending', 'confirmed'].includes(String(rental.status || '').toLowerCase())) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only pending or confirmed rentals can be cancelled.' });
    }

    const cancelable = await client.query(
      `UPDATE car_rentals
       SET status = 'cancelled',
           returned_at = NULL
       WHERE id = $1
         AND user_id = $2
         AND status IN ('pending', 'confirmed')
         AND COALESCE(pickup_datetime, pickup_date + TIME '09:00:00')::DATE > CURRENT_DATE
       RETURNING id`,
      [rentalId, user.id]
    );

    if (!cancelable.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Rentals can only be cancelled before the pickup date.' });
    }
    await syncRentalTransactions(cancelable.rows.map((row) => row.id), client);
    const claim = await createRentalRefundClaim(rentalId, client);

    await client.query('COMMIT');
    res.json({
      id: rentalId,
      message: 'Rental cancelled successfully.',
      refund_claim: formatRefundClaim(claim)
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/my/rentals/:id/driver-review', async (req, res) => {
  const rentalId = Number(req.params.id);
  const rating = Number(req.body.rating);
  const comment = normalizeText(req.body.comment);
  if (!rentalId) return res.status(400).json({ error: 'Invalid rental id.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  if (!comment) return res.status(400).json({ error: 'Review comment is required.' });

  try {
    const user = await getAuthUserFromRequest(req);
    const rental = await fetchUserRentalForFeedback(rentalId, user.id);
    if (!rental) return res.status(404).json({ error: 'Rental ticket not found.' });
    if (!rental.hired_driver_id) return res.status(400).json({ error: 'This rental does not have a hired driver.' });
    if (!rentalFeedbackIsOpen(rental)) return res.status(400).json({ error: 'You can review the driver once the rental has started or after it is returned.' });

    await pool.query(
      `INSERT INTO rental_driver_reviews (driver_id, user_id, car_rental_id, rating, comment, review_type)
       VALUES ($1, $2, $3, $4, $5, 'review')`,
      [rental.hired_driver_id, user.id, rentalId, rating, comment]
    );
    await refreshDriverRating(rental.hired_driver_id);

    res.status(201).json({ message: 'Review saved successfully.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/my/rentals/:id/driver-report', async (req, res) => {
  const rentalId = Number(req.params.id);
  const comment = normalizeText(req.body.comment || req.body.report);
  if (!rentalId) return res.status(400).json({ error: 'Invalid rental id.' });
  if (!comment) return res.status(400).json({ error: 'Report detail is required.' });

  try {
    const user = await getAuthUserFromRequest(req);
    const rental = await fetchUserRentalForFeedback(rentalId, user.id);
    if (!rental) return res.status(404).json({ error: 'Rental ticket not found.' });
    if (!rental.hired_driver_id) return res.status(400).json({ error: 'This rental does not have a hired driver.' });
    if (!rentalFeedbackIsOpen(rental)) return res.status(400).json({ error: 'You can report the driver once the rental has started or after it is returned.' });

    await pool.query(
      `INSERT INTO rental_driver_reviews (driver_id, user_id, car_rental_id, comment, review_type)
       VALUES ($1, $2, $3, $4, 'report')`,
      [rental.hired_driver_id, user.id, rentalId, comment]
    );

    res.status(201).json({ message: 'Report submitted successfully.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/rentals', async (req, res) => {
  const carId = Number(req.body.car_id);
  const pickupDateTime = normalizeRentalDateTime(req.body.pickup_datetime);
  const returnDateTime = normalizeRentalDateTime(req.body.return_datetime);
  const paymentMethod = normalizeText(req.body.payment_method).toLowerCase();
  const needDriver = Boolean(req.body.need_driver);
  const hiredDriverId = needDriver ? Number(req.body.hired_driver_id) : null;
  const customerPhone = normalizeText(req.body.customer_phone);
  let driverName = normalizeText(req.body.driver_name);
  let driverLicense = normalizeText(req.body.driver_license);

  if (!carId) return res.status(400).json({ error: 'Car is required.' });
  if (pickupDateTime.error) return res.status(400).json({ error: pickupDateTime.error });
  if (returnDateTime.error) return res.status(400).json({ error: returnDateTime.error });
  if (pickupDateTime.date < new Date()) return res.status(400).json({ error: 'Pickup date-time cannot be in the past.' });
  if (returnDateTime.date <= pickupDateTime.date) return res.status(400).json({ error: 'Return date-time must be after pickup date-time.' });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method.' });

  try {
    const user = await getAuthUserFromRequest(req);
    const car = await pool.query(
      `SELECT id, name, daily_rate, status
       FROM rental_cars
       WHERE id = $1`,
      [carId]
    );
    if (!car.rowCount) return res.status(404).json({ error: 'Rental car not found.' });
    if (car.rows[0].status !== 'available') return res.status(400).json({ error: 'Selected car is not available.' });

    let hiredDriver = null;
    if (needDriver) {
      if (!hiredDriverId) return res.status(400).json({ error: 'Please choose a driver.' });
      const driver = await pool.query(
        `SELECT id, name, license_number, hourly_rate, status
         FROM rental_drivers
         WHERE id = $1`,
        [hiredDriverId]
      );
      if (!driver.rowCount) return res.status(404).json({ error: 'Driver not found.' });
      hiredDriver = driver.rows[0];
      if (hiredDriver.status !== 'available') return res.status(400).json({ error: 'Selected driver is not available.' });

      driverName = hiredDriver.name;
      driverLicense = hiredDriver.license_number;
    } else if (!driverName || !driverLicense) {
      return res.status(400).json({ error: 'Driver name and license are required.' });
    }

    const scheduleConflict = await findRentalScheduleConflict({
      carId,
      driverId: hiredDriverId,
      pickupDateTime,
      returnDateTime
    });
    if (scheduleConflict) return res.status(409).json({ error: scheduleConflict.message, conflict: scheduleConflict });

    const pricing = calculateRentalPricing(pickupDateTime, returnDateTime, car.rows[0].daily_rate, hiredDriver?.hourly_rate || 0);
    const result = await pool.query(
      `INSERT INTO car_rentals (
         user_id,
         car_id,
         pickup_date,
         return_date,
         pickup_datetime,
         return_datetime,
         rental_hours,
         hourly_charge,
         customer_phone,
         hired_driver_id,
         rental_base_price,
         driver_fee,
         driver_name,
         driver_license,
         total_price,
         payment_method,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, ($16)::payment_method, 'pending')
       RETURNING id`,
      [
        user.id,
        carId,
        pickupDateTime.dateKey,
        returnDateTime.dateKey,
        pickupDateTime.value,
        returnDateTime.value,
        pricing.hours,
        pricing.basePrice,
        customerPhone || user.phone || '',
        hiredDriverId || null,
        pricing.basePrice,
        pricing.driverFee,
        driverName,
        driverLicense,
        pricing.totalPrice,
        paymentMethod
      ]
    );

    await pool.query(
      `INSERT INTO transactions (user_id, car_rental_id, amount, payment_method, status)
       VALUES ($1, $2, $3, ($4)::payment_method, 'success')`,
      [user.id, result.rows[0].id, pricing.totalPrice, paymentMethod]
    );

    res.status(201).json({
      rental: await fetchAdminRentalById(result.rows[0].id),
      pricing
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// 1. Fetch all Rental Cars
app.get('/api/cars', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rc.*,
        COALESCE(rc.photos, ARRAY[]::TEXT[]) AS photos,
        COALESCE(
          (
            SELECT JSON_AGG(rental_window ORDER BY rental_window.pickup_datetime ASC, rental_window.id ASC)
            FROM (
              SELECT
                cr.id,
                cr.status,
                COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
                COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime
              FROM car_rentals cr
              WHERE cr.car_id = rc.id
                AND cr.status IN ('pending', 'confirmed')
              ORDER BY COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') ASC, cr.id ASC
              LIMIT 8
            ) rental_window
          ),
          '[]'::JSON
        ) AS rental_windows
      FROM rental_cars rc
      ORDER BY rc.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code, routes: err.routes });
  }
});

// 2. Fetch all Bus Routes (For BusSearch.jsx)
app.get('/api/routes', async (req, res) => {
  try {
    await releaseExpiredBusMaintenance();
    await generateDailyRoutes();

    const result = await pool.query(`
      SELECT
        r.*,
        b.name AS vehicle,
        b.type AS vehicle_type,
        b.total_seats,
        b.maintenance_start AS bus_maintenance_start,
        b.maintenance_end AS bus_maintenance_end,
        b.seat_map_override,
        t.layout_json AS template_layout,
        c.name AS company_name,
        c.theme_color AS color,
        c.theme_bg AS bg,
        COUNT(bb.id)::INT AS booked_count,
        COALESCE(
          ARRAY_AGG(bb.seat_number ORDER BY bb.seat_number) FILTER (WHERE bb.id IS NOT NULL),
          ARRAY[]::TEXT[]
        ) AS booked_seats
      FROM bus_routes r
      JOIN buses b ON r.bus_id = b.id
      LEFT JOIN bus_seat_map_templates t ON t.id = b.seat_map_template_id
      LEFT JOIN companies c ON b.company_id = c.id
      LEFT JOIN bus_bookings bb ON bb.route_id = r.id AND bb.status <> 'cancelled'
      WHERE r.departure_time >= NOW()
      GROUP BY r.id, b.id, t.id, c.id
      ORDER BY r.departure_time ASC
    `);
    res.json(result.rows.map((row) => ({
      ...row,
      route_type: row.is_generated ? 'daily' : 'manual',
      is_maintenance_blocked: Boolean(
        (
          row.availability_status === 'maintenance' &&
          row.maintenance_start &&
          row.maintenance_end &&
          new Date(row.departure_time) < new Date(row.maintenance_end) &&
          new Date(row.arrival_time) > new Date(row.maintenance_start)
        ) ||
        (
          row.bus_maintenance_start &&
          row.bus_maintenance_end &&
          new Date(row.departure_time) < new Date(row.bus_maintenance_end) &&
          new Date(row.arrival_time) > new Date(row.bus_maintenance_start)
        )
      ),
      unavailable_reason: row.availability_status === 'maintenance' && row.maintenance_start && row.maintenance_end && new Date(row.departure_time) < new Date(row.maintenance_end) && new Date(row.arrival_time) > new Date(row.maintenance_start)
        ? 'Trip is under maintenance.'
        : row.bus_maintenance_start && row.bus_maintenance_end && new Date(row.departure_time) < new Date(row.bus_maintenance_end) && new Date(row.arrival_time) > new Date(row.bus_maintenance_start)
        ? 'Bus is under maintenance during this trip.'
        : '',
      seat_map: resolveSeatMap(row)
    })));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code, routes: err.routes });
  }
});

app.get('/api/admin/routes', async (req, res) => {
  try {
    const data = await fetchAdminRoutes();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/daily-route-templates', async (req, res) => {
  try {
    await generateDailyRoutes();
    res.json(await fetchDailyRouteTemplates());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/daily-route-templates', async (req, res) => {
  const parsed = normalizeDailyRouteTemplatePayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payload = parsed.value;

  try {
    const busExists = await ensureBusExists(payload.bus_id);
    if (!busExists) return res.status(400).json({ error: 'Assigned vehicle does not exist.' });

    const result = await pool.query(
      `INSERT INTO daily_route_templates (bus_id, origin, destination, departure_time, arrival_time, price, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING id`,
      [payload.bus_id, payload.origin, payload.destination, payload.departure_time, payload.arrival_time, payload.price, payload.is_active]
    );

    await generateDailyRoutes();
    res.status(201).json(await fetchDailyRouteTemplateById(result.rows[0].id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/admin/daily-route-templates/:id', async (req, res) => {
  const templateId = Number(req.params.id);
  const parsed = normalizeDailyRouteTemplatePayload(req.body);
  if (!templateId) return res.status(400).json({ error: 'Invalid daily route template id.' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payload = parsed.value;
  const effectiveDate = normalizeText(req.body?.effective_date) || todayDateKey();

  try {
    const existing = await fetchDailyRouteTemplateById(templateId);
    if (!existing) return res.status(404).json({ error: 'Daily route template not found.' });

    const busExists = await ensureBusExists(payload.bus_id);
    if (!busExists) return res.status(400).json({ error: 'Assigned vehicle does not exist.' });

    await ensureTemplateFutureRowsCanUpdate(templateId, effectiveDate);

    const result = await pool.query(
      `UPDATE daily_route_templates
       SET bus_id = $1,
           origin = $2,
           destination = $3,
           departure_time = $4,
           arrival_time = $5,
           price = $6,
           is_active = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [payload.bus_id, payload.origin, payload.destination, payload.departure_time, payload.arrival_time, payload.price, payload.is_active, templateId]
    );

    if (payload.is_active) {
      await syncTemplateFutureRows(result.rows[0], effectiveDate);
      await generateDailyRoutes();
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code, routes: err.routes });
  }
});

app.delete('/api/admin/daily-route-templates/:id', async (req, res) => {
  const templateId = Number(req.params.id);
  if (!templateId) return res.status(400).json({ error: 'Invalid daily route template id.' });

  try {
    const existing = await fetchDailyRouteTemplateById(templateId);
    if (!existing) return res.status(404).json({ error: 'Daily route template not found.' });

    await pool.query(`UPDATE daily_route_templates SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [templateId]);
    await pool.query(
      `DELETE FROM bus_routes r
       WHERE r.daily_template_id = $1
         AND COALESCE(r.is_generated, FALSE) = TRUE
         AND r.service_date >= $2
         AND NOT EXISTS (
           SELECT 1 FROM bus_bookings bb WHERE bb.route_id = r.id AND bb.status <> 'cancelled'
         )`,
      [templateId, todayDateKey()]
    );

    res.json({ id: templateId, message: 'Daily route template deactivated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/destinations', async (req, res) => {
  const parsed = normalizeDestinationPayload(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const result = await pool.query(
      `INSERT INTO destinations (name)
       VALUES ($1)
       RETURNING id, name, created_at`,
      [parsed.value.name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This destination already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/destinations/:id', async (req, res) => {
  const destinationId = Number(req.params.id);
  const parsed = normalizeDestinationPayload(req.body);
  if (!destinationId) {
    return res.status(400).json({ error: 'Invalid destination id.' });
  }
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const client = await pool.connect();
  try {
    const existing = await fetchDestinationById(destinationId);
    if (!existing) {
      return res.status(404).json({ error: 'Destination not found.' });
    }

    await client.query('BEGIN');
    await client.query(`UPDATE destinations SET name = $1 WHERE id = $2`, [parsed.value.name, destinationId]);
    await client.query(`UPDATE bus_routes SET origin = $1 WHERE origin = $2`, [parsed.value.name, existing.name]);
    await client.query(`UPDATE bus_routes SET destination = $1 WHERE destination = $2`, [parsed.value.name, existing.name]);
    await client.query('COMMIT');

    res.json(await fetchDestinationById(destinationId));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This destination already exists.' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/destinations/:id', async (req, res) => {
  const destinationId = Number(req.params.id);
  if (!destinationId) {
    return res.status(400).json({ error: 'Invalid destination id.' });
  }

  try {
    const existing = await fetchDestinationById(destinationId);
    if (!existing) {
      return res.status(404).json({ error: 'Destination not found.' });
    }

    const usage = await pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM bus_routes
       WHERE origin = $1 OR destination = $1`,
      [existing.name]
    );
    if (Number(usage.rows[0].count || 0) > 0) {
      return res.status(400).json({ error: 'Cannot delete a destination that is used by schedules.' });
    }

    await pool.query(`DELETE FROM destinations WHERE id = $1`, [destinationId]);
    res.json({ id: destinationId, message: 'Destination deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/vehicles', async (req, res) => {
  try {
    const data = await fetchAdminVehicles();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/seat-map-templates', async (req, res) => {
  try {
    const templates = await fetchSeatMapTemplates(req.query);
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/seat-map-templates', async (req, res) => {
  const companyId = Number(req.body.company_id);
  const vehicleType = normalizeText(req.body.vehicle_type);
  const name = normalizeText(req.body.name) || `${vehicleType || 'Bus'} layout`;
  const parsed = normalizeSeatMap(req.body.layout_json || req.body.layout);
  if (!companyId || !vehicleType) return res.status(400).json({ error: 'Company and vehicle type are required.' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const company = await fetchAdminCompanyById(companyId);
    if (!company) return res.status(400).json({ error: 'Selected company does not exist.' });

    const savedTemplate = await createSeatMapTemplate({
      companyId,
      vehicleType,
      name,
      layout: parsed.value,
      seatCount: parsed.seatCount
    });

    await createSeatMapHistory({
      companyId,
      templateId: savedTemplate.id,
      vehicleType,
      name,
      layout: parsed.value,
      seatCount: parsed.seatCount
    });

    const templates = await fetchSeatMapTemplates({ company_id: companyId, vehicle_type: vehicleType });
    res.status(201).json(templates.find((template) => template.id === savedTemplate.id));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.put('/api/admin/seat-map-templates/:id', async (req, res) => {
  const templateId = Number(req.params.id);
  const companyId = Number(req.body.company_id);
  const vehicleType = normalizeText(req.body.vehicle_type);
  const name = normalizeText(req.body.name) || `${vehicleType || 'Bus'} layout`;
  const parsed = normalizeSeatMap(req.body.layout_json || req.body.layout);
  if (!templateId) return res.status(400).json({ error: 'Invalid template id.' });
  if (!companyId || !vehicleType) return res.status(400).json({ error: 'Company and vehicle type are required.' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const existing = await pool.query(`SELECT id FROM bus_seat_map_templates WHERE id = $1`, [templateId]);
    if (!existing.rowCount) return res.status(404).json({ error: 'Seat map template not found.' });

    const duplicateName = await pool.query(
      `SELECT id
       FROM bus_seat_map_templates
       WHERE LOWER(name) = LOWER($1)
         AND id <> $2
       LIMIT 1`,
      [name, templateId]
    );
    if (duplicateName.rowCount) {
      return res.status(409).json({ error: 'Duplicate template name. Please choose a different Template/history name.' });
    }

    const assignedBuses = await pool.query(
      `SELECT id FROM buses WHERE seat_map_template_id = $1 AND seat_map_override IS NULL`,
      [templateId]
    );
    for (const bus of assignedBuses.rows) {
      const safety = await ensureBookedSeatsStillExist(bus.id, parsed.seatLabels);
      if (safety.error) return res.status(400).json({ error: safety.error });
    }

    await pool.query(
      `UPDATE bus_seat_map_templates
       SET company_id = $1,
           vehicle_type = $2,
           name = $3,
           rows = $4,
           columns = $5,
           seat_count = $6,
           layout_json = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [companyId, vehicleType, name, parsed.value.rows, parsed.value.columns, parsed.seatCount, parsed.value, templateId]
    );

    await createSeatMapHistory({
      companyId,
      templateId,
      vehicleType,
      name,
      layout: parsed.value,
      seatCount: parsed.seatCount
    });

    const templates = await fetchSeatMapTemplates({ company_id: companyId, vehicle_type: vehicleType });
    res.json(templates.find((template) => template.id === templateId));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.delete('/api/admin/seat-map-templates/:id', async (req, res) => {
  const templateId = Number(req.params.id);
  if (!templateId) return res.status(400).json({ error: 'Invalid template id.' });

  try {
    const busCount = await pool.query(`SELECT COUNT(*)::INT AS count FROM buses WHERE seat_map_template_id = $1`, [templateId]);
    if (Number(busCount.rows[0].count || 0) > 0) {
      return res.status(400).json({ error: 'Cannot delete a template assigned to buses.' });
    }

    const result = await pool.query(`DELETE FROM bus_seat_map_templates WHERE id = $1 RETURNING id`, [templateId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Seat map template not found.' });
    res.json({ id: templateId, message: 'Seat map template deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/seat-map-history', async (req, res) => {
  const rows = Number(req.query.rows);
  const columns = Number(req.query.columns);
  const companyId = Number(req.query.company_id);
  const vehicleType = normalizeText(req.query.vehicle_type);
  const params = [];
  const where = [];

  if (Number.isInteger(rows) && rows > 0) {
    params.push(rows);
    where.push(`h.rows = $${params.length}`);
  }
  if (Number.isInteger(columns) && columns > 0) {
    params.push(columns);
    where.push(`h.columns = $${params.length}`);
  }
  if (companyId) {
    params.push(companyId);
    where.push(`h.company_id = $${params.length}`);
  }
  if (vehicleType) {
    params.push(vehicleType);
    where.push(`LOWER(h.vehicle_type) = LOWER($${params.length})`);
  }

  try {
    const result = await pool.query(
      `SELECT
         h.id,
         h.company_id,
         c.name AS company_name,
         h.bus_id,
         b.name AS bus_name,
         h.template_id,
         h.vehicle_type,
         h.name,
         h.rows,
         h.columns,
         h.seat_count,
         h.layout_json,
         h.created_at
       FROM bus_seat_map_history h
       LEFT JOIN companies c ON c.id = h.company_id
       LEFT JOIN buses b ON b.id = h.bus_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY h.created_at DESC
       LIMIT 20`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/seat-map-history', async (req, res) => {
  const companyId = Number(req.body.company_id);
  const vehicleType = normalizeText(req.body.vehicle_type);
  const name = normalizeText(req.body.name) || `${vehicleType || 'Bus'} history`;
  const parsed = normalizeSeatMap(req.body.layout_json || req.body.layout);
  if (!companyId || !vehicleType) return res.status(400).json({ error: 'Company and vehicle type are required.' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    await createSeatMapHistory({
      companyId,
      vehicleType,
      name,
      layout: parsed.value,
      seatCount: parsed.seatCount
    });
    res.status(201).json({ message: 'Seat map history saved successfully.' });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.get('/api/admin/buses/:id/seat-map', async (req, res) => {
  const busId = Number(req.params.id);
  if (!busId) return res.status(400).json({ error: 'Invalid bus id.' });

  try {
    const bus = await fetchAdminBusById(busId);
    if (!bus) return res.status(404).json({ error: 'Bus not found.' });

    const layout = resolveSeatMap(bus);
    const templates = await fetchSeatMapTemplates({ rows: layout.rows, columns: layout.columns });
    const history = await pool.query(
      `SELECT h.*, c.name AS company_name
       FROM bus_seat_map_history h
       LEFT JOIN companies c ON c.id = h.company_id
       WHERE h.rows = $1 AND h.columns = $2
       ORDER BY
         CASE WHEN h.company_id = $3 THEN 0 ELSE 1 END,
         CASE WHEN LOWER(h.vehicle_type) = LOWER($4) THEN 0 ELSE 1 END,
         h.created_at DESC
       LIMIT 20`,
      [layout.rows, layout.columns, bus.company_id, bus.type]
    );

    res.json({
      bus: {
        id: bus.id,
        company_id: bus.company_id,
        company_name: bus.company_name,
        name: bus.name,
        type: bus.type,
        total_seats: bus.total_seats,
        seat_map_template_id: bus.seat_map_template_id,
        seat_map_template_name: bus.seat_map_template_name,
        has_seat_map_override: bus.has_seat_map_override
      },
      layout,
      templates,
      history: history.rows,
      booked_seats: await getBookedSeatLabelsForBus(busId)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/buses/:id/seat-map', async (req, res) => {
  const busId = Number(req.params.id);
  const templateId = Number(req.body.template_id);
  const saveAsTemplate = Boolean(req.body.save_as_template);
  const templateName = normalizeText(req.body.template_name);
  const useTemplateOnly = Boolean(req.body.use_template_only);
  if (!busId) return res.status(400).json({ error: 'Invalid bus id.' });

  try {
    const bus = await fetchAdminBusById(busId);
    if (!bus) return res.status(404).json({ error: 'Bus not found.' });

    if (templateId && useTemplateOnly) {
      const templateResult = await pool.query(`SELECT * FROM bus_seat_map_templates WHERE id = $1`, [templateId]);
      const template = templateResult.rows[0];
      if (!template) return res.status(404).json({ error: 'Seat map template not found.' });

      const safety = await ensureBookedSeatsStillExist(busId, template.layout_json.cells.filter((cell) => cell.type === 'seat').map((cell) => cell.label));
      if (safety.error) return res.status(400).json({ error: safety.error });

      await pool.query(
        `UPDATE buses
         SET seat_map_template_id = $1,
             seat_map_override = NULL,
             total_seats = $2
         WHERE id = $3`,
        [templateId, template.seat_count, busId]
      );
      return res.json(await fetchAdminBusById(busId));
    }

    const parsed = normalizeSeatMap(req.body.layout_json || req.body.layout);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const safety = await ensureBookedSeatsStillExist(busId, parsed.seatLabels);
    if (safety.error) return res.status(400).json({ error: safety.error });

    let assignedTemplateId = templateId || null;
    const name = templateName || `${bus.company_name || 'Bus'} ${bus.type} layout`;

    if (saveAsTemplate) {
      const savedTemplate = await createSeatMapTemplate({
        companyId: bus.company_id,
        vehicleType: bus.type,
        name,
        layout: parsed.value,
        seatCount: parsed.seatCount
      });
      assignedTemplateId = savedTemplate.id;
    }

    await pool.query(
      `UPDATE buses
       SET seat_map_template_id = COALESCE($1, seat_map_template_id),
           seat_map_override = $2,
           total_seats = $3
       WHERE id = $4`,
      [assignedTemplateId, saveAsTemplate ? null : parsed.value, parsed.seatCount, busId]
    );

    await createSeatMapHistory({
      companyId: bus.company_id,
      busId,
      templateId: assignedTemplateId,
      vehicleType: bus.type,
      name,
      layout: parsed.value,
      seatCount: parsed.seatCount
    });

    res.json(await fetchAdminBusById(busId));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.post('/api/admin/buses', async (req, res) => {
  const parsed = normalizeBusPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payload = parsed.value;

  try {
    const company = await fetchAdminCompanyById(payload.company_id);
    if (!company) return res.status(400).json({ error: 'Selected company does not exist.' });

    const result = await pool.query(
      `INSERT INTO buses (company_id, name, type, plate_number, total_seats, status, maintenance_start, maintenance_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        payload.company_id,
        payload.name,
        payload.type,
        payload.plate_number,
        payload.total_seats,
        payload.status,
        payload.maintenance_start,
        payload.maintenance_end
      ]
    );

    res.status(201).json(await fetchAdminBusById(result.rows[0].id));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Plate number already exists.' });
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/buses/:id', async (req, res) => {
  const busId = Number(req.params.id);
  const parsed = normalizeBusPayload(req.body);
  if (!busId) return res.status(400).json({ error: 'Invalid bus id.' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payload = parsed.value;

  try {
    const existing = await fetchAdminBusById(busId);
    if (!existing) return res.status(404).json({ error: 'Bus not found.' });

    const company = await fetchAdminCompanyById(payload.company_id);
    if (!company) return res.status(400).json({ error: 'Selected company does not exist.' });

    if (payload.status === 'maintenance') {
      const recoveryPlan = req.body?.maintenance_recovery_plan;
      if (recoveryPlan) {
        await applyMaintenanceRecoveryPlan(busId, payload.maintenance_start, payload.maintenance_end, recoveryPlan);
      }

      const affectedRoutes = await buildMaintenanceConflictPayload(busId, payload.maintenance_start, payload.maintenance_end);
      if (affectedRoutes.length) {
        return res.status(409).json({
          error: 'Maintenance overlaps booked trips. Move those bookings to another route or create backup routes first.',
          code: 'MAINTENANCE_BOOKING_CONFLICT',
          affected_routes: affectedRoutes
        });
      }
    }

    if (
      existing.status === 'maintenance' &&
      payload.status !== 'maintenance' &&
      existing.maintenance_start &&
      existing.maintenance_end
    ) {
      await restoreSplitBookingsForAvailableBus(busId);
      await restoreTemporaryBusReplacements(busId);
      await clearFutureRouteMaintenanceForBus(busId);
    }

    await pool.query(
      `UPDATE buses
       SET company_id = $1,
           name = $2,
           type = $3,
           plate_number = $4,
           total_seats = $5,
           status = $6,
           maintenance_start = $7,
           maintenance_end = $8
       WHERE id = $9`,
      [
        payload.company_id,
        payload.name,
        payload.type,
        payload.plate_number,
        payload.total_seats,
        payload.status,
        payload.maintenance_start,
        payload.maintenance_end,
        busId
      ]
    );

    res.json(await fetchAdminBusById(busId));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Plate number already exists.' });
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/buses/:id', async (req, res) => {
  const busId = Number(req.params.id);
  if (!busId) return res.status(400).json({ error: 'Invalid bus id.' });

  try {
    const routeCount = await pool.query(`SELECT COUNT(*)::INT AS count FROM bus_routes WHERE bus_id = $1`, [busId]);
    if (Number(routeCount.rows[0].count || 0) > 0) {
      return res.status(400).json({ error: 'Cannot delete a bus assigned to routes.' });
    }

    const result = await pool.query(`DELETE FROM buses WHERE id = $1 RETURNING id`, [busId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Bus not found.' });
    res.json({ id: busId, message: 'Bus deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/rental-cars', async (req, res) => {
  const parsed = normalizeRentalCarPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payload = parsed.value;

  try {
    const result = await pool.query(
      `INSERT INTO rental_cars (name, type, plate_number, total_seats, transmission, daily_rate, status, photos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [payload.name, payload.type, payload.plate_number, payload.total_seats, payload.transmission, payload.daily_rate, payload.status, payload.photos]
    );

    res.status(201).json(await fetchAdminRentalCarById(result.rows[0].id));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Plate number already exists.' });
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/rental-cars/:id', async (req, res) => {
  const carId = Number(req.params.id);
  const parsed = normalizeRentalCarPayload(req.body);
  if (!carId) return res.status(400).json({ error: 'Invalid rental car id.' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payload = parsed.value;

  try {
    const existing = await fetchAdminRentalCarById(carId);
    if (!existing) return res.status(404).json({ error: 'Rental car not found.' });

    await pool.query(
      `UPDATE rental_cars
       SET name = $1,
           type = $2,
           plate_number = $3,
           total_seats = $4,
           transmission = $5,
           daily_rate = $6,
           status = $7,
           photos = $8
       WHERE id = $9`,
      [payload.name, payload.type, payload.plate_number, payload.total_seats, payload.transmission, payload.daily_rate, payload.status, payload.photos, carId]
    );

    res.json(await fetchAdminRentalCarById(carId));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Plate number already exists.' });
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/rental-cars/:id', async (req, res) => {
  const carId = Number(req.params.id);
  if (!carId) return res.status(400).json({ error: 'Invalid rental car id.' });

  try {
    const rentalCount = await pool.query(`SELECT COUNT(*)::INT AS count FROM car_rentals WHERE car_id = $1`, [carId]);
    if (Number(rentalCount.rows[0].count || 0) > 0) {
      return res.status(400).json({ error: 'Cannot delete a rental car with rental records.' });
    }

    const result = await pool.query(`DELETE FROM rental_cars WHERE id = $1 RETURNING id`, [carId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Rental car not found.' });
    res.json({ id: carId, message: 'Rental car deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/companies', async (req, res) => {
  const parsed = normalizeCompanyPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payload = parsed.value;

  try {
    const result = await pool.query(
      `INSERT INTO companies (name, theme_color, theme_bg)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [payload.name, payload.theme_color, payload.theme_bg]
    );

    res.status(201).json(await fetchAdminCompanyById(result.rows[0].id));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Company name already exists.' });
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/companies/:id', async (req, res) => {
  const companyId = Number(req.params.id);
  const parsed = normalizeCompanyPayload(req.body);
  if (!companyId) return res.status(400).json({ error: 'Invalid company id.' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payload = parsed.value;

  try {
    const existing = await fetchAdminCompanyById(companyId);
    if (!existing) return res.status(404).json({ error: 'Company not found.' });

    await pool.query(
      `UPDATE companies
       SET name = $1,
           theme_color = $2,
           theme_bg = $3
       WHERE id = $4`,
      [payload.name, payload.theme_color, payload.theme_bg, companyId]
    );

    res.json(await fetchAdminCompanyById(companyId));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Company name already exists.' });
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/companies/:id', async (req, res) => {
  const companyId = Number(req.params.id);
  if (!companyId) return res.status(400).json({ error: 'Invalid company id.' });

  try {
    const busCount = await pool.query(`SELECT COUNT(*)::INT AS count FROM buses WHERE company_id = $1`, [companyId]);
    if (Number(busCount.rows[0].count || 0) > 0) {
      return res.status(400).json({ error: 'Cannot delete a company assigned to buses.' });
    }

    const result = await pool.query(`DELETE FROM companies WHERE id = $1 RETURNING id`, [companyId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Company not found.' });
    res.json({ id: companyId, message: 'Company deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/routes', async (req, res) => {
  const parsed = normalizeRoutePayload(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const payload = parsed.value;

  try {
    const busExists = await ensureBusExists(payload.bus_id);
    if (!busExists) {
      return res.status(400).json({ error: 'Assigned vehicle does not exist.' });
    }

    const overlaps = await hasOverlappingSchedule(
      payload.bus_id,
      payload.departure_time,
      payload.arrival_time
    );
    if (overlaps) {
      return res.status(409).json({ error: 'This bus already has a trip during that time.' });
    }

    const insertResult = await pool.query(
      `INSERT INTO bus_routes (bus_id, origin, destination, departure_time, arrival_time, price, availability_status, maintenance_start, maintenance_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        payload.bus_id,
        payload.origin,
        payload.destination,
        payload.departure_time,
        payload.arrival_time,
        payload.price,
        payload.availability_status,
        payload.maintenance_start,
        payload.maintenance_end
      ]
    );

    const route = await fetchAdminRouteById(insertResult.rows[0].id);
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/routes/:id/maintenance-preview', async (req, res) => {
  const routeId = Number(req.params.id);
  const maintenanceStart = normalizeDateTime(req.body?.maintenance_start);
  const maintenanceEnd = normalizeDateTime(req.body?.maintenance_end);

  if (!routeId) return res.status(400).json({ error: 'Invalid route id.' });
  if (!maintenanceStart || !maintenanceEnd) {
    return res.status(400).json({ error: 'Maintenance start and end date/time are required.' });
  }
  if (maintenanceEnd <= maintenanceStart) {
    return res.status(400).json({ error: 'Maintenance end date/time must be after the start date/time.' });
  }

  try {
    const route = await fetchAdminRouteById(routeId);
    if (!route) return res.status(404).json({ error: 'Schedule not found.' });
    if (!(maintenanceStart < new Date(route.arrival_time) && maintenanceEnd > new Date(route.departure_time))) {
      return res.status(400).json({ error: 'Maintenance duration must overlap this scheduled trip.' });
    }

    const preview = await buildMaintenanceImpactPreview(routeId, maintenanceStart, maintenanceEnd, {
      backup_routes: Array.isArray(req.body?.backup_routes) ? req.body.backup_routes : []
    });
    res.json(preview);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/admin/routes/:id/revert-daily', async (req, res) => {
  const routeId = Number(req.params.id);
  if (!routeId) return res.status(400).json({ error: 'Invalid schedule id.' });

  try {
    const route = await restoreRouteToDailyTemplate(routeId);
    res.json(route);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/admin/routes/:id', async (req, res) => {
  const routeId = Number(req.params.id);
  const parsed = normalizeRoutePayload(req.body);
  if (!routeId) {
    return res.status(400).json({ error: 'Invalid route id.' });
  }
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const payload = parsed.value;

  try {
    const existing = await fetchAdminRouteById(routeId);
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }

    const busExists = await ensureBusExists(payload.bus_id);
    if (!busExists) {
      return res.status(400).json({ error: 'Assigned vehicle does not exist.' });
    }

    let maintenanceRecoveryResult = null;

    if (payload.availability_status === 'maintenance') {
      const recoveryPlan = req.body?.maintenance_recovery_plan;
      if (recoveryPlan) {
        maintenanceRecoveryResult = await applyMaintenanceImpactPlan(routeId, payload.maintenance_start, payload.maintenance_end, recoveryPlan);
      } else {
        const preview = await buildMaintenanceImpactPreview(routeId, payload.maintenance_start, payload.maintenance_end);
        if (preview.affected_bookings.length) {
          return res.status(409).json({
            error: 'This maintenance window affects booked passengers. Preview the impact and confirm a recovery plan before saving.',
            code: 'ROUTE_MAINTENANCE_BOOKING_CONFLICT',
            preview,
            affected_routes: preview.affected_routes
          });
        }
      }
    }

    const coreChanged =
      Number(existing.bus_id) !== Number(payload.bus_id) ||
      existing.origin !== payload.origin ||
      existing.destination !== payload.destination ||
      new Date(existing.departure_time).getTime() !== new Date(payload.departure_time).getTime() ||
      new Date(existing.arrival_time).getTime() !== new Date(payload.arrival_time).getTime() ||
      Number(existing.price) !== Number(payload.price);

    if (existing.daily_template_id && existing.is_generated && coreChanged) {
      const effectiveDate = formatDateKey(existing.service_date || payload.departure_time);
      await ensureTemplateFutureRowsCanUpdate(existing.daily_template_id, effectiveDate);

      const departureTime = String(payload.departure_time).split(' ')[1] || '';
      const arrivalTime = String(payload.arrival_time).split(' ')[1] || '';
      const templatePayload = normalizeDailyRouteTemplatePayload({
        bus_id: payload.bus_id,
        origin: payload.origin,
        destination: payload.destination,
        departure_time: departureTime,
        arrival_time: arrivalTime,
        price: payload.price,
        is_active: true
      });
      if (templatePayload.error) {
        return res.status(400).json({ error: templatePayload.error });
      }

      const updatedTemplate = await pool.query(
        `UPDATE daily_route_templates
         SET bus_id = $1,
             origin = $2,
             destination = $3,
             departure_time = $4,
             arrival_time = $5,
             price = $6,
             is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [
          templatePayload.value.bus_id,
          templatePayload.value.origin,
          templatePayload.value.destination,
          templatePayload.value.departure_time,
          templatePayload.value.arrival_time,
          templatePayload.value.price,
          existing.daily_template_id
        ]
      );

      await syncTemplateFutureRows(updatedTemplate.rows[0], effectiveDate);
      await generateDailyRoutes();
    }

    await syncBusMaintenanceFromRoute(
      payload.bus_id,
      payload.availability_status,
      payload.maintenance_start,
      payload.maintenance_end,
      existing
    );

    const replacedRouteIds = new Set((maintenanceRecoveryResult?.replacedRouteIds || []).map(Number));
    if (!replacedRouteIds.has(routeId)) {
      await pool.query(
        `UPDATE bus_routes
         SET bus_id = $1,
             origin = $2,
             destination = $3,
             departure_time = $4,
             arrival_time = $5,
             price = $6,
             availability_status = $7,
             maintenance_start = $8,
             maintenance_end = $9
         WHERE id = $10`,
        [
          payload.bus_id,
          payload.origin,
          payload.destination,
          payload.departure_time,
          payload.arrival_time,
          payload.price,
          payload.availability_status,
          payload.maintenance_start,
          payload.maintenance_end,
          routeId
        ]
      );
    }

    const route = await fetchAdminRouteById(routeId);
    if (coreChanged && route) {
      await createRouteUpdateNotifications(routeId, existing, route);
    }
    res.json(route);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code, routes: err.routes });
  }
});

app.delete('/api/admin/routes/:id', async (req, res) => {
  const routeId = Number(req.params.id);
  if (!routeId) {
    return res.status(400).json({ error: 'Invalid route id.' });
  }

  try {
    await createRouteCancellationNotifications(routeId);
    const result = await pool.query(`DELETE FROM bus_routes WHERE id = $1 RETURNING id`, [routeId]);
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }

    res.json({ id: routeId, message: 'Schedule deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const data = await fetchAdminUsers();
    const roles = await fetchAdminRoles();
    res.json({ ...data, roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users/:id/activity', async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ error: 'Invalid user id.' });

  try {
    const user = await fetchAdminUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const busBookings = await pool.query(
      `SELECT
         bb.id,
         COALESCE(bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0'))) AS booking_reference,
         bb.round_trip_reference,
         COALESCE(bb.trip_leg, 'outbound') AS trip_leg,
         bb.seat_number,
         bb.total_price,
         bb.payment_method,
         bb.status,
         bb.created_at,
         br.origin,
         br.destination,
         br.departure_time,
         br.arrival_time,
         b.name AS bus_name,
         b.type AS bus_type,
         b.plate_number,
         c.name AS company_name,
         c.theme_color AS color
       FROM bus_bookings bb
       JOIN bus_routes br ON br.id = bb.route_id
       JOIN buses b ON b.id = br.bus_id
       LEFT JOIN companies c ON c.id = b.company_id
       WHERE bb.user_id = $1
       ORDER BY bb.created_at DESC, bb.id DESC`,
      [userId]
    );

    const carRentals = await pool.query(
      `SELECT
         cr.id,
         cr.total_price,
         cr.payment_method,
         cr.status,
         cr.booked_at,
         COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
         COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
         COALESCE(cr.rental_hours, 0) AS rental_hours,
         cr.hired_driver_id,
         cr.driver_name,
         rc.name AS car_name,
         rc.type AS car_type,
         rc.plate_number
       FROM car_rentals cr
       JOIN rental_cars rc ON rc.id = cr.car_id
       WHERE cr.user_id = $1
       ORDER BY cr.booked_at DESC, cr.id DESC`,
      [userId]
    );

    const comments = await pool.query(
      `SELECT *
       FROM (
         SELECT
           btf.id,
           'trip' AS source_type,
           'Trip comment' AS source_label,
           COALESCE(bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0'))) AS item_reference,
           CONCAT(br.origin, ' to ', br.destination) AS context_title,
           CONCAT(COALESCE(c.name, b.name, 'Bus'), COALESCE(' | ' || b.plate_number, '')) AS context_subtitle,
           NULL::INT AS rating,
           btf.comment,
           btf.admin_reply,
           btf.admin_replied_at,
           btf.created_at
         FROM bus_trip_feedback btf
         LEFT JOIN bus_bookings bb ON bb.id = btf.bus_booking_id
         LEFT JOIN bus_routes br ON br.id = btf.route_id
         LEFT JOIN buses b ON b.id = btf.bus_id
         LEFT JOIN companies c ON c.id = btf.company_id
         WHERE btf.user_id = $1
           AND btf.feedback_type = 'comment'

         UNION ALL

         SELECT
           rdr.id,
           'driver' AS source_type,
           'Driver comment' AS source_label,
           CONCAT('R-', cr.id) AS item_reference,
           COALESCE(rd.name, 'Rental driver') AS context_title,
           CONCAT(COALESCE(rc.name, 'Rental car'), COALESCE(' | ' || rc.plate_number, '')) AS context_subtitle,
           rdr.rating,
           rdr.comment,
           rdr.admin_reply,
           rdr.admin_replied_at,
           rdr.created_at
         FROM rental_driver_reviews rdr
         LEFT JOIN rental_drivers rd ON rd.id = rdr.driver_id
         LEFT JOIN car_rentals cr ON cr.id = rdr.car_rental_id
         LEFT JOIN rental_cars rc ON rc.id = cr.car_id
         WHERE rdr.user_id = $1
           AND rdr.review_type = 'review'
       ) feedback
       ORDER BY created_at DESC, id DESC`,
      [userId]
    );

    const reports = await pool.query(
      `SELECT *
       FROM (
         SELECT
           btf.id,
           'trip' AS source_type,
           'Trip report' AS source_label,
           COALESCE(bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0'))) AS item_reference,
           CONCAT(br.origin, ' to ', br.destination) AS context_title,
           CONCAT(COALESCE(c.name, b.name, 'Bus'), COALESCE(' | ' || b.plate_number, '')) AS context_subtitle,
           NULL::INT AS rating,
           btf.comment,
           btf.admin_reply,
           btf.admin_replied_at,
           btf.created_at
         FROM bus_trip_feedback btf
         LEFT JOIN bus_bookings bb ON bb.id = btf.bus_booking_id
         LEFT JOIN bus_routes br ON br.id = btf.route_id
         LEFT JOIN buses b ON b.id = btf.bus_id
         LEFT JOIN companies c ON c.id = btf.company_id
         WHERE btf.user_id = $1
           AND btf.feedback_type = 'report'

         UNION ALL

         SELECT
           rdr.id,
           'driver' AS source_type,
           'Driver report' AS source_label,
           CONCAT('R-', cr.id) AS item_reference,
           COALESCE(rd.name, 'Rental driver') AS context_title,
           CONCAT(COALESCE(rc.name, 'Rental car'), COALESCE(' | ' || rc.plate_number, '')) AS context_subtitle,
           rdr.rating,
           rdr.comment,
           rdr.admin_reply,
           rdr.admin_replied_at,
           rdr.created_at
         FROM rental_driver_reviews rdr
         LEFT JOIN rental_drivers rd ON rd.id = rdr.driver_id
         LEFT JOIN car_rentals cr ON cr.id = rdr.car_rental_id
         LEFT JOIN rental_cars rc ON rc.id = cr.car_id
         WHERE rdr.user_id = $1
           AND rdr.review_type = 'report'
       ) feedback
       ORDER BY created_at DESC, id DESC`,
      [userId]
    );

    res.json({
      user,
      bus_bookings: busBookings.rows,
      car_rentals: carRentals.rows,
      comments: comments.rows,
      reports: reports.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/roles', async (req, res) => {
  try {
    const roles = await fetchAdminRoles();
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/roles', async (req, res) => {
  const parsed = normalizeRolePayload(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const payload = parsed.value;

  try {
    const result = await pool.query(
      `INSERT INTO roles (name, label, description, is_system)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id`,
      [payload.name, payload.label, payload.description]
    );
    const role = (await fetchAdminRoles()).find(item => item.id === result.rows[0].id);
    res.status(201).json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/roles/:id', async (req, res) => {
  const roleId = Number(req.params.id);
  const parsed = normalizeRolePayload(req.body);

  if (!roleId) {
    return res.status(400).json({ error: 'Invalid role id.' });
  }

  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const payload = parsed.value;

  try {
    const existing = await fetchRoleById(roleId);
    if (!existing) {
      return res.status(404).json({ error: 'Role not found.' });
    }

    if (existing.is_system && existing.name !== payload.name) {
      return res.status(400).json({ error: 'System role names cannot be changed.' });
    }

    await pool.query(
      `UPDATE roles
       SET name = $1,
           label = $2,
           description = $3
       WHERE id = $4`,
      [payload.name, payload.label, payload.description, roleId]
    );

    const role = (await fetchAdminRoles()).find(item => item.id === roleId);
    res.json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/roles/:id', async (req, res) => {
  const roleId = Number(req.params.id);
  if (!roleId) {
    return res.status(400).json({ error: 'Invalid role id.' });
  }

  try {
    const role = (await fetchAdminRoles()).find(item => item.id === roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found.' });
    }
    if (role.is_system) {
      return res.status(400).json({ error: 'System roles cannot be deleted.' });
    }
    if (role.user_count > 0) {
      return res.status(400).json({ error: 'Cannot delete a role assigned to users.' });
    }

    await pool.query(`DELETE FROM roles WHERE id = $1`, [roleId]);
    res.json({ id: roleId, message: 'Role deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', async (req, res) => {
  const parsed = normalizeUserPayload(req.body, { isCreate: true });
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const payload = parsed.value;

  try {
    const role = await fetchRoleById(payload.role_id);
    if (!role) {
      return res.status(400).json({ error: 'Selected role does not exist.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(payload.password, salt);
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, national_id, password_hash, role, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.phone,
        payload.national_id,
        passwordHash,
        role.name,
        payload.role_id,
        payload.is_active
      ]
    );

    const user = await fetchAdminUserById(result.rows[0].id);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  const userId = Number(req.params.id);
  const parsed = normalizeUserPayload(req.body);

  if (!userId) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const payload = parsed.value;

  try {
    const existing = await fetchAdminUserById(userId);
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const nextIsActive = payload.is_active === null ? existing.is_active : payload.is_active;
    const role = await fetchRoleById(payload.role_id);
    if (!role) {
      return res.status(400).json({ error: 'Selected role does not exist.' });
    }

    if (await wouldDeactivateLastAdmin(userId, payload.role_id, nextIsActive)) {
      return res.status(400).json({ error: 'At least one active admin account is required.' });
    }

    const passwordHash = payload.password ? await bcrypt.hash(payload.password, await bcrypt.genSalt(10)) : null;
    await pool.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           email = $3,
           phone = $4,
           national_id = $5,
           role = $6,
           role_id = $7,
           is_active = COALESCE($8, is_active),
           password_hash = COALESCE($9, password_hash)
       WHERE id = $10`,
      [
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.phone,
        payload.national_id,
        role.name,
        payload.role_id,
        payload.is_active,
        passwordHash,
        userId
      ]
    );

    if (payload.is_active === false) {
      await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`, [userId]);
    }

    const user = await fetchAdminUserById(userId);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  try {
    const existing = await fetchAdminUserById(userId);
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (existing.role === 'admin' && existing.is_active && await isLastActiveAdmin(userId)) {
      return res.status(400).json({ error: 'At least one active admin account is required.' });
    }

    await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

    res.json({ id: userId, message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/dashboard', async (req, res) => {
  const monthRange = buildMonthRange();
  const monthParams = [monthRange.start, monthRange.end];
  const recentRange = buildRecentDayRange(12);
  const recentParams = [recentRange.start, recentRange.end];

  try {
    await releaseExpiredBusMaintenance();

    const [
      bookingMonth,
      rentalMonth,
      activeBookings,
      cancelledTickets,
      cancelledRentals,
      monthlyExpense,
      activeRentals,
      usersSummary,
      bookingActivity,
      rentalActivity,
      recentBookings,
      recentRentals,
      busFleet,
      carFleet,
      routeFleet,
      topCustomers,
      topCompanies
    ] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_price), 0) AS revenue, COUNT(*)::INT AS count FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2`, monthParams),
      pool.query(`SELECT COALESCE(SUM(total_price), 0) AS revenue, COUNT(*)::INT AS count FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2`, monthParams),
      pool.query(`SELECT COUNT(*)::INT AS count FROM bus_bookings WHERE status = 'confirmed' AND created_at >= $1 AND created_at < $2`, monthParams),
      pool.query(`SELECT COUNT(*)::INT AS count FROM bus_bookings WHERE status = 'cancelled' AND created_at >= $1 AND created_at < $2`, monthParams),
      pool.query(`SELECT COUNT(*)::INT AS count FROM car_rentals WHERE status = 'cancelled' AND booked_at >= $1 AND booked_at < $2`, monthParams),
      pool.query(`SELECT total_expense FROM dashboard_monthly_expenses WHERE month_key = $1`, [monthRange.key]),
      pool.query(`SELECT COUNT(*)::INT AS count FROM car_rentals WHERE status = 'confirmed'`),
      pool.query(`SELECT COUNT(*)::INT AS total, COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::INT AS new_this_month FROM users`, monthParams),
      pool.query(`SELECT created_at::DATE AS day, COUNT(*)::INT AS count FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2 GROUP BY created_at::DATE ORDER BY day`, recentParams),
      pool.query(`SELECT booked_at::DATE AS day, COUNT(*)::INT AS count FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2 GROUP BY booked_at::DATE ORDER BY day`, recentParams),
      pool.query(
        `SELECT
           bb.id,
           bb.seat_number,
           bb.total_price,
           bb.payment_method,
           bb.status,
           bb.created_at,
           br.origin,
           br.destination,
           b.name AS bus_name,
           COALESCE(c.name, 'Unknown company') AS company_name,
           c.theme_color AS color,
           CONCAT(u.first_name, ' ', u.last_name) AS user_name
         FROM bus_bookings bb
         JOIN users u ON u.id = bb.user_id
         JOIN bus_routes br ON br.id = bb.route_id
         JOIN buses b ON b.id = br.bus_id
         LEFT JOIN companies c ON c.id = b.company_id
         ORDER BY bb.created_at DESC, bb.id DESC
         LIMIT 5`
      ),
      pool.query(
        `SELECT
           cr.id,
           cr.total_price,
           cr.payment_method,
           cr.status,
           cr.booked_at,
           rc.name AS car_name,
           rc.type AS car_type,
           CONCAT(u.first_name, ' ', u.last_name) AS user_name,
           u.email AS user_email
         FROM car_rentals cr
         JOIN users u ON u.id = cr.user_id
         JOIN rental_cars rc ON rc.id = cr.car_id
         ORDER BY cr.booked_at DESC, cr.id DESC
         LIMIT 5`
      ),
      pool.query(`SELECT COUNT(*)::INT AS total, COUNT(*) FILTER (WHERE status = 'available')::INT AS available FROM buses`),
      pool.query(`SELECT COUNT(*)::INT AS total, COUNT(*) FILTER (WHERE status = 'available')::INT AS available FROM rental_cars`),
      pool.query(`SELECT COUNT(*)::INT AS total, COUNT(*) FILTER (WHERE departure_time >= NOW())::INT AS active FROM bus_routes`),
      pool.query(
        `SELECT user_id, user_name, email, COUNT(*)::INT AS trips, COALESCE(SUM(total_spent), 0) AS spend
         FROM (
           SELECT u.id AS user_id, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email, bb.total_price AS total_spent
           FROM bus_bookings bb
           JOIN users u ON u.id = bb.user_id
           WHERE bb.status <> 'cancelled' AND bb.created_at >= $1 AND bb.created_at < $2
           UNION ALL
           SELECT u.id AS user_id, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email, cr.total_price AS total_spent
           FROM car_rentals cr
           JOIN users u ON u.id = cr.user_id
           WHERE cr.status <> 'cancelled' AND cr.booked_at >= $1 AND cr.booked_at < $2
         ) activity
         GROUP BY user_id, user_name, email
         ORDER BY trips DESC, spend DESC
         LIMIT 5`,
        monthParams
      ),
      pool.query(
        `SELECT COALESCE(c.name, 'Unknown company') AS name, c.theme_color AS color, COUNT(*)::INT AS count, COALESCE(SUM(bb.total_price), 0) AS revenue
         FROM bus_bookings bb
         JOIN bus_routes br ON br.id = bb.route_id
         JOIN buses b ON b.id = br.bus_id
         LEFT JOIN companies c ON c.id = b.company_id
         WHERE bb.status <> 'cancelled' AND bb.created_at >= $1 AND bb.created_at < $2
         GROUP BY COALESCE(c.name, 'Unknown company'), c.theme_color
         ORDER BY count DESC, revenue DESC
         LIMIT 5`,
        monthParams
      )
    ]);

    const bookingCount = Number(bookingMonth.rows[0].count || 0);
    const rentalCount = Number(rentalMonth.rows[0].count || 0);
    const bookingRevenue = Number(bookingMonth.rows[0].revenue || 0);
    const rentalRevenue = Number(rentalMonth.rows[0].revenue || 0);
    const totalRevenue = bookingRevenue + rentalRevenue;
    const totalExpense = Number(monthlyExpense.rows[0]?.total_expense || 0);
    const busTotal = Number(busFleet.rows[0].total || 0);
    const busAvailable = Number(busFleet.rows[0].available || 0);
    const carTotal = Number(carFleet.rows[0].total || 0);
    const carAvailable = Number(carFleet.rows[0].available || 0);
    const routeTotal = Number(routeFleet.rows[0].total || 0);
    const routeActive = Number(routeFleet.rows[0].active || 0);
    const percent = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;

    res.json({
      month: monthRange.key,
      metrics: {
        total_bookings: bookingCount + rentalCount,
        booking_count: bookingCount,
        rental_count: rentalCount,
        active_bookings: Number(activeBookings.rows[0].count || 0),
        active_rentals: Number(activeRentals.rows[0].count || 0),
        total_revenue: totalRevenue,
        cancelled_tickets: Number(cancelledTickets.rows[0].count || 0),
        cancelled_rentals: Number(cancelledRentals.rows[0].count || 0),
        total_expense: totalExpense,
        net_revenue: totalRevenue - totalExpense,
        total_users: Number(usersSummary.rows[0].total || 0),
        new_users: Number(usersSummary.rows[0].new_this_month || 0)
      },
      activity: buildCountSeries(recentRange, bookingActivity.rows, rentalActivity.rows),
      booking_activity: buildCountSeries(recentRange, bookingActivity.rows, []),
      rental_activity: buildCountSeries(recentRange, [], rentalActivity.rows),
      recent_bookings: recentBookings.rows,
      recent_rentals: recentRentals.rows,
      fleet: {
        buses: { available: busAvailable, total: busTotal, percent: percent(busAvailable, busTotal) },
        cars: { available: carAvailable, total: carTotal, percent: percent(carAvailable, carTotal) },
        routes: { active: routeActive, total: routeTotal, percent: percent(routeActive, routeTotal) }
      },
      top_customers: topCustomers.rows,
      top_companies: topCompanies.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/dashboard/expense', async (req, res) => {
  const { month, total_expense: totalExpenseInput } = req.body || {};

  let monthRange;
  try {
    monthRange = buildMonthRange(month);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid month.' });
  }

  const totalExpense = Number(totalExpenseInput);
  if (!Number.isFinite(totalExpense) || totalExpense < 0) {
    return res.status(400).json({ error: 'Total expense must be a valid non-negative number.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO dashboard_monthly_expenses (month_key, total_expense, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (month_key)
       DO UPDATE SET
         total_expense = EXCLUDED.total_expense,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, month_key, total_expense, created_at, updated_at`,
      [monthRange.key, totalExpense]
    );

    res.json({
      message: 'Dashboard expense saved successfully.',
      expense: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/bookings', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         bb.id,
         bb.user_id,
         bb.route_id,
         bb.booking_reference,
         bb.round_trip_reference,
         COALESCE(bb.trip_leg, 'outbound') AS trip_leg,
         bb.seat_number,
         bb.total_price,
         bb.package_weight_kg,
         bb.overweight_charge,
         bb.payment_method,
         bb.status,
         bb.created_at,
         CONCAT(u.first_name, ' ', u.last_name) AS user_name,
         u.email,
         u.phone,
         br.origin,
         br.destination,
         br.departure_time,
         br.arrival_time,
         b.name AS bus_name,
         b.type AS bus_type,
         b.plate_number,
         c.id AS company_id,
         c.name AS company_name,
         c.theme_color AS color,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', btf.id,
             'feedback_type', btf.feedback_type,
             'comment', btf.comment,
             'admin_reply', btf.admin_reply,
             'admin_replied_at', btf.admin_replied_at,
             'created_at', btf.created_at,
             'route_id', btf.route_id,
             'bus_id', btf.bus_id,
             'company_id', btf.company_id
           )
           FROM bus_trip_feedback btf
           WHERE btf.bus_booking_id = bb.id
             AND btf.feedback_type = 'comment'
           ORDER BY btf.created_at DESC, btf.id DESC
           LIMIT 1
         ) AS trip_feedback_comment,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', btf.id,
             'feedback_type', btf.feedback_type,
             'comment', btf.comment,
             'admin_reply', btf.admin_reply,
             'admin_replied_at', btf.admin_replied_at,
             'created_at', btf.created_at,
             'route_id', btf.route_id,
             'bus_id', btf.bus_id,
             'company_id', btf.company_id
           )
           FROM bus_trip_feedback btf
           WHERE btf.bus_booking_id = bb.id
             AND btf.feedback_type = 'report'
           ORDER BY btf.created_at DESC, btf.id DESC
           LIMIT 1
         ) AS trip_feedback_report
       FROM bus_bookings bb
       JOIN users u ON u.id = bb.user_id
       JOIN bus_routes br ON br.id = bb.route_id
       JOIN buses b ON b.id = br.bus_id
       LEFT JOIN companies c ON c.id = b.company_id
       ORDER BY bb.created_at DESC, bb.id DESC`
    );
    res.json({ bookings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/bookings/group', async (req, res) => {
  const bookingIds = Array.from(new Set((Array.isArray(req.body.booking_ids) ? req.body.booking_ids : []).map(Number).filter(Boolean)));
  const packageWeightKg = normalizeMoney(req.body.package_weight_kg ?? 0);
  const paymentMethod = normalizeText(req.body.payment_method).toLowerCase();
  const status = normalizeText(req.body.status).toLowerCase();

  if (!bookingIds.length) return res.status(400).json({ error: 'Booking ids are required.' });
  if (!Number.isFinite(packageWeightKg) || packageWeightKg < 0) return res.status(400).json({ error: 'Package weight must be zero or greater.' });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method.' });
  if (!BOOKING_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid booking status.' });

  try {
    const existingResult = await pool.query(
      `SELECT bb.*, br.origin, br.destination
       FROM bus_bookings bb
       JOIN bus_routes br ON br.id = bb.route_id
       WHERE bb.id = ANY($1::INT[])
       ORDER BY bb.id`,
      [bookingIds]
    );
    const existingRows = existingResult.rows;
    if (existingRows.length !== bookingIds.length) {
      return res.status(404).json({ error: 'One or more booking seats were not found.' });
    }
    const restoredIds = existingRows
      .filter((row) => row.status === 'cancelled' && status !== 'cancelled')
      .map((row) => row.id);
    await assertBusRefundRestoreAllowed(restoredIds);

    const activeRows = existingRows.filter((row) => row.status !== 'cancelled');
    const currentPackageWeight = existingRows.reduce((sum, row) => sum + Number(row.package_weight_kg || 0), 0);
    const currentOverweightCharge = existingRows.reduce((sum, row) => sum + Number(row.overweight_charge || 0), 0);
    const basePrices = existingRows.map((row) => Math.max(Number(row.total_price || 0) - Number(row.overweight_charge || 0), 0));
    const baseTotal = basePrices.reduce((sum, value) => sum + value, 0);
    const packageWeightForUpdate = status === 'cancelled' ? currentPackageWeight : packageWeightKg;
    const allowanceKg = PACKAGE_ALLOWANCE_KG * existingRows.length;
    const overweightKg = Math.max(packageWeightForUpdate - allowanceKg, 0);
    const overweightCharge = overweightKg * OVERWEIGHT_RATE;

    if (baseTotal <= 0) return res.status(400).json({ error: 'Total price must be greater than zero.' });

    const allocatedWeights = existingRows.map((_, index) => {
      const remainingRows = existingRows.length - index;
      const used = existingRows.slice(0, index).reduce((sum, __, usedIndex) => sum + Number((packageWeightForUpdate / existingRows.length).toFixed(2)), 0);
      if (remainingRows === 1) return Number((packageWeightForUpdate - used).toFixed(2));
      return Number((packageWeightForUpdate / existingRows.length).toFixed(2));
    });
    const allocatedCharges = existingRows.map((_, index) => {
      const remainingRows = existingRows.length - index;
      const used = existingRows.slice(0, index).reduce((sum, __, usedIndex) => sum + Number((overweightCharge / existingRows.length).toFixed(2)), 0);
      if (remainingRows === 1) return Number((overweightCharge - used).toFixed(2));
      return Number((overweightCharge / existingRows.length).toFixed(2));
    });

    for (let index = 0; index < existingRows.length; index += 1) {
      const row = existingRows[index];
      const rowWeight = status === 'cancelled' ? Number(row.package_weight_kg || 0) : allocatedWeights[index];
      const rowCharge = status === 'cancelled' ? Number(row.overweight_charge || 0) : allocatedCharges[index];
      const rowTotal = basePrices[index] + rowCharge;
      await pool.query(
        `UPDATE bus_bookings
         SET total_price = $1,
             package_weight_kg = $2,
             overweight_charge = $3,
             payment_method = $4,
             status = $5
         WHERE id = $6`,
        [rowTotal.toFixed(2), rowWeight.toFixed(2), rowCharge.toFixed(2), paymentMethod, status, row.id]
      );
    }

    await syncBusBookingTransactions(bookingIds);
    if (restoredIds.length) {
      await voidPendingBusRefundClaims(restoredIds);
    }

    const cancelledIds = existingRows
      .filter((row) => row.status !== 'cancelled' && status === 'cancelled')
      .map((row) => row.id);
    if (cancelledIds.length) {
      const refundClaims = await createBusRefundClaimsForBookingGroups(cancelledIds);
      for (const claim of refundClaims) {
        await createRefundClaimNotification(claim, {
          metadata: { reason: 'admin grouped booking status cancelled' }
        });
      }
    }

    const packageChanged =
      activeRows.length > 0 &&
      status !== 'cancelled' &&
      (
        Math.abs(currentPackageWeight - packageWeightForUpdate) >= 0.01 ||
        Math.abs(currentOverweightCharge - overweightCharge) >= 0.01
      );
    if (packageChanged) {
      const first = existingRows[0];
      await createBusTicketNotifications(bookingIds, {
        type: 'bus_overweight_updated',
        title: 'Package overweight charge updated',
        message: `${first.origin} to ${first.destination}: package weight ${packageWeightForUpdate.toFixed(2)} kg, overweight charge $${overweightCharge.toFixed(2)}. Your ticket total was updated.`,
        action_type: 'view_trip',
        metadata: {
          reason: 'admin grouped package overweight update',
          package_weight_kg: Number(packageWeightForUpdate.toFixed(2)),
          overweight_charge: Number(overweightCharge.toFixed(2)),
          previous_package_weight_kg: Number(currentPackageWeight.toFixed(2)),
          previous_overweight_charge: Number(currentOverweightCharge.toFixed(2)),
          total_price: Number((baseTotal + overweightCharge).toFixed(2))
        }
      });
    }

    res.json({ updated_ids: bookingIds });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/bookings/:id', async (req, res) => {
  const bookingId = Number(req.params.id);
  const seatNumber = normalizeText(req.body.seat_number);
  const packageWeightKg = normalizeMoney(req.body.package_weight_kg ?? 0);
  const paymentMethod = normalizeText(req.body.payment_method).toLowerCase();
  const status = normalizeText(req.body.status).toLowerCase();

  if (!bookingId) return res.status(400).json({ error: 'Invalid booking id.' });
  if (!seatNumber) return res.status(400).json({ error: 'Seat number is required.' });
  if (!Number.isFinite(packageWeightKg) || packageWeightKg < 0) return res.status(400).json({ error: 'Package weight must be zero or greater.' });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method.' });
  if (!BOOKING_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid booking status.' });

  try {
    const existing = await fetchAdminBookingById(bookingId);
    if (!existing) return res.status(404).json({ error: 'Booking not found.' });
    const currentTotal = Number(existing.total_price || 0);
    const currentOverweightCharge = Number(existing.overweight_charge || 0);
    const currentPackageWeight = Number(existing.package_weight_kg || 0);
    const baseBookingPrice = Math.max(currentTotal - currentOverweightCharge, 0);
    const packageWeightForUpdate = status === 'cancelled'
      ? Number(existing.package_weight_kg || 0)
      : packageWeightKg;
    const overweightKg = Math.max(packageWeightForUpdate - PACKAGE_ALLOWANCE_KG, 0);
    const overweightCharge = overweightKg * OVERWEIGHT_RATE;
    const totalPrice = baseBookingPrice + overweightCharge;

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) return res.status(400).json({ error: 'Total price must be greater than zero.' });
    if (existing.status === 'cancelled' && status !== 'cancelled') {
      await assertBusRefundRestoreAllowed(bookingId);
    }

    await pool.query(
      `UPDATE bus_bookings
       SET seat_number = $1,
           total_price = $2,
           package_weight_kg = $3,
           overweight_charge = $4,
           payment_method = $5,
           status = $6
       WHERE id = $7`,
      [seatNumber, totalPrice.toFixed(2), packageWeightForUpdate.toFixed(2), overweightCharge.toFixed(2), paymentMethod, status, bookingId]
    );
    await syncBusBookingTransactions(bookingId);
    if (existing.status === 'cancelled' && status !== 'cancelled') {
      await voidPendingBusRefundClaims(bookingId);
    }

    if (existing.status !== 'cancelled' && status === 'cancelled') {
      const refundClaims = await createBusRefundClaimsForBookingGroups(bookingId);
      for (const claim of refundClaims) {
        await createRefundClaimNotification(claim, {
          metadata: { reason: 'admin booking status cancelled' }
        });
      }
    }

    const packageChanged =
      existing.status !== 'cancelled' &&
      status !== 'cancelled' &&
      (
        Math.abs(currentPackageWeight - packageWeightForUpdate) >= 0.01 ||
        Math.abs(currentOverweightCharge - overweightCharge) >= 0.01
      );

    if (packageChanged) {
      await createBusTicketNotifications(bookingId, {
        type: 'bus_overweight_updated',
        title: 'Package overweight charge updated',
        message: `${existing.origin} to ${existing.destination}: package weight ${packageWeightForUpdate.toFixed(2)} kg, overweight charge $${overweightCharge.toFixed(2)}. Your ticket total was updated.`,
        action_type: 'view_trip',
        metadata: {
          reason: 'admin package overweight update',
          package_weight_kg: Number(packageWeightForUpdate.toFixed(2)),
          overweight_charge: Number(overweightCharge.toFixed(2)),
          previous_package_weight_kg: Number(currentPackageWeight.toFixed(2)),
          previous_overweight_charge: Number(currentOverweightCharge.toFixed(2)),
          total_price: Number(totalPrice.toFixed(2))
        }
      });
    }

    res.json(await fetchAdminBookingById(bookingId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/bookings/:id', async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!bookingId) return res.status(400).json({ error: 'Invalid booking id.' });

  try {
    const existing = await fetchAdminBookingById(bookingId);
    if (!existing) return res.status(404).json({ error: 'Booking not found.' });
    await createUserNotification({
      user_id: existing.user_id,
      booking_reference: existing.booking_reference || `BT-${String(existing.id).padStart(6, '0')}`,
      type: 'bus_ticket_cancelled',
      title: 'Your bus ticket was removed',
      message: `${existing.origin} to ${existing.destination} was removed by admin. Open My Bookings for details.`,
      action_url: '/bookings?tab=trips',
      action_type: 'view_trip',
      metadata: {
        booking_id: existing.id,
        route_id: existing.route_id,
        departure_time: existing.departure_time
      }
    });
    const result = await pool.query(`DELETE FROM bus_bookings WHERE id = $1 RETURNING id`, [bookingId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ id: bookingId, message: 'Booking deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/bus-trip-feedback/:id/reply', async (req, res) => {
  const feedbackId = Number(req.params.id);
  const reply = normalizeText(req.body.admin_reply || req.body.reply);
  if (!feedbackId) return res.status(400).json({ error: 'Invalid feedback id.' });
  if (!reply) return res.status(400).json({ error: 'Reply is required.' });

  try {
    const admin = await getOptionalAuthUserFromRequest(req);
    const result = await pool.query(
      `UPDATE bus_trip_feedback
       SET admin_reply = $1,
           admin_replied_at = NOW(),
           admin_replied_by = $2
       WHERE id = $3
       RETURNING id, admin_reply, admin_replied_at`,
      [reply, admin?.id || null, feedbackId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Trip feedback not found.' });

    const details = await pool.query(
      `SELECT
         btf.id,
         btf.user_id,
         btf.bus_booking_id,
         btf.feedback_type,
         COALESCE(bb.round_trip_reference, bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0'))) AS ticket_reference,
         br.origin,
         br.destination,
         b.name AS bus_name,
         c.name AS company_name
       FROM bus_trip_feedback btf
       JOIN bus_bookings bb ON bb.id = btf.bus_booking_id
       JOIN bus_routes br ON br.id = bb.route_id
       JOIN buses b ON b.id = br.bus_id
       LEFT JOIN companies c ON c.id = b.company_id
       WHERE btf.id = $1`,
      [feedbackId]
    );
    const feedback = details.rows[0];
    if (feedback?.user_id && feedback?.bus_booking_id) {
      const isReport = feedback.feedback_type === 'report';
      await createUserNotification({
        user_id: feedback.user_id,
        bus_booking_id: feedback.bus_booking_id,
        booking_reference: feedback.ticket_reference,
        type: 'bus_trip_feedback_reply',
        title: isReport ? 'Admin replied to your trip report' : 'Admin replied to your trip comment',
        message: `Admin replied about ${feedback.origin} to ${feedback.destination}${feedback.company_name ? ` with ${feedback.company_name}` : ''}.`,
        action_url: `/bookings?tab=trips&ticket=${encodeURIComponent(feedback.ticket_reference || feedback.bus_booking_id)}`,
        action_type: 'view_trip',
        metadata: {
          feedback_id: feedback.id,
          feedback_type: feedback.feedback_type,
          bus_name: feedback.bus_name,
          admin_reply: reply
        }
      });
    }

    res.json({ feedback: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/rental-drivers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         rd.id,
         rd.name,
         rd.license_number,
         rd.phone,
         rd.rating,
         rd.review_count,
         rd.hourly_rate,
         rd.status,
         rd.profile_photo,
         rd.background,
         rd.experience_years,
         COALESCE(rd.languages, ARRAY[]::TEXT[]) AS languages,
         rd.created_at,
         (SELECT COUNT(*)::INT FROM car_rentals cr WHERE cr.hired_driver_id = rd.id AND cr.status IN ('pending', 'confirmed')) AS active_rentals,
         (SELECT COUNT(*)::INT FROM car_rentals cr WHERE cr.hired_driver_id = rd.id) AS total_rentals,
         COALESCE((SELECT SUM(cr.driver_fee) FROM car_rentals cr WHERE cr.hired_driver_id = rd.id AND cr.status <> 'cancelled'), 0) AS driver_total_revenue,
         COALESCE((SELECT SUM(cr.damage_charge) FROM car_rentals cr WHERE cr.hired_driver_id = rd.id AND cr.damage_responsibility = 'driver' AND cr.status <> 'cancelled'), 0) AS driver_damage_total,
         (
           COALESCE((SELECT SUM(cr.driver_fee) FROM car_rentals cr WHERE cr.hired_driver_id = rd.id AND cr.status <> 'cancelled'), 0)
           - COALESCE((SELECT SUM(cr.damage_charge) FROM car_rentals cr WHERE cr.hired_driver_id = rd.id AND cr.damage_responsibility = 'driver' AND cr.status <> 'cancelled'), 0)
         ) AS driver_net_revenue,
         (SELECT COUNT(*)::INT FROM rental_driver_reviews rdr WHERE rdr.driver_id = rd.id AND rdr.review_type = 'review') AS reviews_count,
         (SELECT COUNT(*)::INT FROM rental_driver_reviews rdr WHERE rdr.driver_id = rd.id AND rdr.review_type = 'report') AS reports_count,
         COALESCE(
           (
             SELECT JSON_AGG(damage_row ORDER BY damage_row.returned_at DESC NULLS LAST, damage_row.id DESC)
             FROM (
               SELECT
                 cr.id,
                 cr.status,
                 COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
                 COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
                 cr.returned_at,
                 cr.damage_charge,
                 COALESCE(cr.damage_description, '') AS damage_description,
                 CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
                 u.email AS customer_email,
                 rc.name AS car_name,
                 rc.plate_number
               FROM car_rentals cr
               JOIN users u ON u.id = cr.user_id
               JOIN rental_cars rc ON rc.id = cr.car_id
               WHERE cr.hired_driver_id = rd.id
                 AND cr.damage_responsibility = 'driver'
                 AND COALESCE(cr.damage_charge, 0) > 0
                 AND cr.status <> 'cancelled'
               ORDER BY cr.returned_at DESC NULLS LAST, cr.id DESC
             ) damage_row
           ),
           '[]'::JSON
         ) AS driver_damage_details,
         COALESCE(
           (
             SELECT JSON_AGG(active_rental_row ORDER BY active_rental_row.pickup_datetime ASC, active_rental_row.id ASC)
             FROM (
               SELECT
                 cr.id,
                 cr.status,
                 COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
                 COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
                 cr.total_price,
                 cr.driver_fee,
                 CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
                 u.email AS customer_email,
                 u.phone AS customer_phone,
                 rc.name AS car_name,
                 rc.plate_number
               FROM car_rentals cr
               JOIN users u ON u.id = cr.user_id
               JOIN rental_cars rc ON rc.id = cr.car_id
               WHERE cr.hired_driver_id = rd.id
                 AND cr.status IN ('pending', 'confirmed')
               ORDER BY COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') ASC, cr.id ASC
               LIMIT 8
             ) active_rental_row
           ),
           '[]'::JSON
         ) AS active_rental_details
       FROM rental_drivers rd
       ORDER BY rd.status ASC, rd.rating DESC, rd.name ASC`
    );
    res.json({ drivers: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/rental-drivers', async (req, res) => {
  const payload = buildDriverPayload(req.body);
  if (payload.error) return res.status(400).json({ error: payload.error });

  try {
    const result = await pool.query(
      `INSERT INTO rental_drivers (name, license_number, phone, hourly_rate, status, profile_photo, background, experience_years, languages)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        payload.name,
        payload.licenseNumber,
        payload.phone,
        payload.hourlyRate,
        payload.status,
        payload.profilePhoto,
        payload.background,
        payload.experienceYears,
        payload.languages
      ]
    );
    res.status(201).json({ driver: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'License number already exists.' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/rental-drivers/:id', async (req, res) => {
  const driverId = Number(req.params.id);
  const payload = buildDriverPayload(req.body);
  if (!driverId) return res.status(400).json({ error: 'Invalid driver id.' });
  if (payload.error) return res.status(400).json({ error: payload.error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id, name, status
       FROM rental_drivers
       WHERE id = $1
       FOR UPDATE`,
      [driverId]
    );
    if (!existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Driver not found.' });
    }

    const result = await client.query(
      `UPDATE rental_drivers
       SET name = $1,
           license_number = $2,
           phone = $3,
           hourly_rate = $4,
           status = $5,
           profile_photo = $6,
           background = $7,
           experience_years = $8,
           languages = $9
       WHERE id = $10
       RETURNING *`,
      [
        payload.name,
        payload.licenseNumber,
        payload.phone,
        payload.hourlyRate,
        payload.status,
        payload.profilePhoto,
        payload.background,
        payload.experienceYears,
        payload.languages,
        driverId
      ]
    );

    let notificationCount = 0;
    let cancelledRentalCount = 0;
    let restoredRentalCount = 0;
    if (result.rows[0].status === 'inactive') {
      const deactivation = await applyDriverDeactivation(driverId, result.rows[0].name, client);
      notificationCount = deactivation.notificationCount;
      cancelledRentalCount = deactivation.cancelledCount;
    } else if (existing.rows[0].status === 'inactive' && result.rows[0].status === 'available') {
      const restoration = await restoreDriverRentalsBeforePickup(driverId, result.rows[0].name, client);
      notificationCount = restoration.notificationCount;
      restoredRentalCount = restoration.restoredCount;
    }

    await client.query('COMMIT');
    res.json({
      driver: result.rows[0],
      notification_count: notificationCount,
      cancelled_rental_count: cancelledRentalCount,
      restored_rental_count: restoredRentalCount
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'License number already exists.' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/rental-drivers/:id', async (req, res) => {
  const driverId = Number(req.params.id);
  if (!driverId) return res.status(400).json({ error: 'Invalid driver id.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const driver = await client.query(`SELECT id, name, status FROM rental_drivers WHERE id = $1 FOR UPDATE`, [driverId]);
    if (!driver.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Driver not found.' });
    }

    const usage = await client.query(
      `SELECT
         (SELECT COUNT(*)::INT FROM car_rentals WHERE hired_driver_id = $1) AS rentals_count,
         (SELECT COUNT(*)::INT FROM rental_driver_reviews WHERE driver_id = $1) AS feedback_count`,
      [driverId]
    );
    const hasHistory = Number(usage.rows[0].rentals_count || 0) > 0 || Number(usage.rows[0].feedback_count || 0) > 0;

    if (!hasHistory) {
      await client.query(`DELETE FROM rental_drivers WHERE id = $1`, [driverId]);
      await client.query('COMMIT');
      return res.json({ id: driverId, action: 'deleted', message: 'Driver deleted successfully.' });
    }

    await client.query(`UPDATE rental_drivers SET status = 'inactive' WHERE id = $1`, [driverId]);
    const deactivation = await applyDriverDeactivation(driverId, driver.rows[0].name, client);

    await client.query('COMMIT');
    res.json({
      id: driverId,
      action: 'deactivated',
      notification_count: deactivation.notificationCount,
      cancelled_rental_count: deactivation.cancelledCount,
      message: 'Driver deactivated because rental or feedback history exists.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/admin/rental-drivers/:id/feedback', async (req, res) => {
  const driverId = Number(req.params.id);
  const type = normalizeText(req.query.type || 'review').toLowerCase();
  if (!driverId) return res.status(400).json({ error: 'Invalid driver id.' });
  if (!['review', 'report'].includes(type)) return res.status(400).json({ error: 'Invalid feedback type.' });

  try {
    const result = await pool.query(
      `SELECT
         rdr.id,
         rdr.driver_id,
         rdr.user_id,
         rdr.car_rental_id,
         rdr.rating,
         rdr.comment,
         rdr.review_type,
         rdr.admin_reply,
         rdr.admin_replied_at,
         rdr.created_at,
         CONCAT(u.first_name, ' ', u.last_name) AS user_name,
         u.email AS user_email,
         cr.status AS rental_status,
         cr.pickup_datetime,
         cr.return_datetime,
         rc.name AS car_name,
         rc.plate_number,
         admin.email AS admin_email
       FROM rental_driver_reviews rdr
       LEFT JOIN users u ON u.id = rdr.user_id
       LEFT JOIN car_rentals cr ON cr.id = rdr.car_rental_id
       LEFT JOIN rental_cars rc ON rc.id = cr.car_id
       LEFT JOIN users admin ON admin.id = rdr.admin_replied_by
       WHERE rdr.driver_id = $1
         AND rdr.review_type = $2
       ORDER BY rdr.created_at DESC, rdr.id DESC`,
      [driverId, type]
    );
    res.json({ feedback: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/rental-driver-feedback/:id/reply', async (req, res) => {
  const feedbackId = Number(req.params.id);
  const reply = normalizeText(req.body.admin_reply || req.body.reply);
  if (!feedbackId) return res.status(400).json({ error: 'Invalid feedback id.' });
  if (!reply) return res.status(400).json({ error: 'Reply is required.' });

  try {
    const admin = await getOptionalAuthUserFromRequest(req);
    const result = await pool.query(
      `UPDATE rental_driver_reviews
       SET admin_reply = $1,
           admin_replied_at = NOW(),
           admin_replied_by = $2
       WHERE id = $3
       RETURNING id, admin_reply, admin_replied_at`,
      [reply, admin?.id || null, feedbackId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Feedback not found.' });
    const details = await pool.query(
      `SELECT
         rdr.id,
         rdr.user_id,
         rdr.car_rental_id,
         rdr.review_type,
         rd.name AS driver_name,
         rc.name AS car_name
       FROM rental_driver_reviews rdr
       LEFT JOIN rental_drivers rd ON rd.id = rdr.driver_id
       LEFT JOIN car_rentals cr ON cr.id = rdr.car_rental_id
       LEFT JOIN rental_cars rc ON rc.id = cr.car_id
       WHERE rdr.id = $1`,
      [feedbackId]
    );
    const feedback = details.rows[0];
    if (feedback?.user_id && feedback?.car_rental_id) {
      const isReport = feedback.review_type === 'report';
      await createUserNotification({
        user_id: feedback.user_id,
        car_rental_id: feedback.car_rental_id,
        type: 'driver_feedback_reply',
        title: isReport ? 'Admin replied to your driver report' : 'Admin replied to your driver comment',
        message: `Admin replied about ${feedback.driver_name || 'your driver'}${feedback.car_name ? ` for ${feedback.car_name}` : ''}.`,
        action_url: `/bookings?tab=rentals&rental=${feedback.car_rental_id}`,
        action_type: 'view_rental',
        metadata: {
          feedback_id: feedback.id,
          review_type: feedback.review_type,
          admin_reply: reply
        }
      });
    }
    res.json({ feedback: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/rentals', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         cr.id,
         cr.user_id,
         cr.car_id,
         cr.pickup_date,
         cr.return_date,
         COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00') AS pickup_datetime,
         COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') AS return_datetime,
         COALESCE(cr.rental_hours, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') - COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00'))) / 3600.0))) AS rental_hours,
         ROUND((rc.daily_rate / 24.0)::NUMERIC, 2) AS hourly_rate,
         COALESCE(cr.hourly_charge, ROUND((GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE(cr.return_datetime, cr.return_date + TIME '09:00:00') - COALESCE(cr.pickup_datetime, cr.pickup_date + TIME '09:00:00'))) / 3600.0)) * (rc.daily_rate / 24.0))::NUMERIC, 2)) AS hourly_charge,
         cr.customer_phone,
         cr.hired_driver_id,
         cr.rental_base_price,
         cr.driver_fee,
         COALESCE(cr.late_return_hours, 0) AS late_return_hours,
         COALESCE(cr.late_return_charge, 0) AS late_return_charge,
         COALESCE(cr.damage_description, '') AS damage_description,
         COALESCE(cr.damage_charge, 0) AS damage_charge,
         COALESCE(cr.damage_responsibility, CASE WHEN cr.hired_driver_id IS NULL THEN 'renter' ELSE 'driver' END) AS damage_responsibility,
         cr.driver_name,
         cr.driver_license,
         cr.total_price,
         cr.payment_method,
         cr.status,
         cr.returned_at,
         cr.booked_at,
         CONCAT(u.first_name, ' ', u.last_name) AS user_name,
         u.email,
         u.phone,
         rc.name AS car_name,
         rc.type AS car_type,
         rc.plate_number,
         rc.daily_rate,
         rd.name AS hired_driver_name,
         rd.license_number AS hired_driver_license_number,
         rd.phone AS hired_driver_phone,
         rd.rating AS hired_driver_rating,
         rd.review_count AS hired_driver_review_count,
         rd.hourly_rate AS hired_driver_hourly_rate,
         rd.background AS hired_driver_background,
         rd.experience_years AS hired_driver_experience_years,
         rd.languages AS hired_driver_languages,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', rcre.id,
             'source_rental_id', rcre.source_rental_id,
             'old_car_id', rcre.old_car_id,
             'new_car_id', rcre.new_car_id,
             'old_car_name', old_car.name,
             'old_plate_number', old_car.plate_number,
             'new_car_name', new_car.name,
             'new_plate_number', new_car.plate_number,
             'reason', rcre.reason,
             'created_at', rcre.created_at
           )
           FROM rental_car_replacement_events rcre
           LEFT JOIN rental_cars old_car ON old_car.id = rcre.old_car_id
           LEFT JOIN rental_cars new_car ON new_car.id = rcre.new_car_id
           WHERE rcre.affected_rental_id = cr.id
           ORDER BY rcre.created_at DESC, rcre.id DESC
           LIMIT 1
         ) AS replacement_summary,
         (
           SELECT COUNT(*)::INT
           FROM rental_car_replacement_events rcre
           WHERE rcre.source_rental_id = cr.id
         ) AS replacement_count
       FROM car_rentals cr
       JOIN users u ON u.id = cr.user_id
       JOIN rental_cars rc ON rc.id = cr.car_id
       LEFT JOIN rental_drivers rd ON rd.id = cr.hired_driver_id
       ORDER BY cr.booked_at DESC, cr.id DESC`
    );
    res.json({ rentals: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/rentals/:id/late-return-impact', async (req, res) => {
  const rentalId = Number(req.params.id);
  const pickupInput = req.body.pickup_datetime || (req.body.pickup_date ? `${normalizeText(req.body.pickup_date)}T09:00` : '');
  const returnInput = req.body.return_datetime || (req.body.return_date ? `${normalizeText(req.body.return_date)}T09:00` : '');
  const pickupDateTime = normalizeRentalDateTime(pickupInput);
  const returnDateTime = normalizeRentalDateTime(returnInput);
  const status = normalizeText(req.body.status || '').toLowerCase();

  if (!rentalId) return res.status(400).json({ error: 'Invalid rental id.' });
  if (pickupDateTime.error) return res.status(400).json({ error: pickupDateTime.error });
  if (returnDateTime.error) return res.status(400).json({ error: returnDateTime.error });
  if (returnDateTime.date <= pickupDateTime.date) return res.status(400).json({ error: 'Return date-time must be after pickup date-time.' });

  try {
    const existing = await fetchAdminRentalById(rentalId);
    if (!existing) return res.status(404).json({ error: 'Rental not found.' });
    if (String(existing.status || '').toLowerCase() === 'cancelled' || status === 'cancelled') {
      return res.json({ buffer_minutes: RENTAL_TURNOVER_BUFFER_MINUTES, affected_rentals: [] });
    }

    const effectiveReturnDateTime = effectiveRentalReturnDateTime(status, returnDateTime);
    const impact = await buildLateReturnImpact(existing, pickupDateTime, effectiveReturnDateTime);
    res.json({
      source_rental_id: existing.id,
      source_car_id: existing.car_id,
      source_car_name: existing.car_name,
      ...impact
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/rentals/:id', async (req, res) => {
  const rentalId = Number(req.params.id);
  const pickupInput = req.body.pickup_datetime || (req.body.pickup_date ? `${normalizeText(req.body.pickup_date)}T09:00` : '');
  const returnInput = req.body.return_datetime || (req.body.return_date ? `${normalizeText(req.body.return_date)}T09:00` : '');
  const pickupDateTime = normalizeRentalDateTime(pickupInput);
  const returnDateTime = normalizeRentalDateTime(returnInput);
  const driverName = normalizeText(req.body.driver_name);
  const driverLicense = normalizeText(req.body.driver_license);
  const paymentMethod = normalizeText(req.body.payment_method).toLowerCase();
  const status = normalizeText(req.body.status).toLowerCase();
  const damageDescription = normalizeText(req.body.damage_description);
  const damageCharge = normalizeMoney(req.body.damage_charge ?? 0);

  if (!rentalId) return res.status(400).json({ error: 'Invalid rental id.' });
  if (pickupDateTime.error) return res.status(400).json({ error: pickupDateTime.error });
  if (returnDateTime.error) return res.status(400).json({ error: returnDateTime.error });
  if (returnDateTime.date <= pickupDateTime.date) return res.status(400).json({ error: 'Return date-time must be after pickup date-time.' });
  if (!driverName || !driverLicense) return res.status(400).json({ error: 'Driver name and license are required.' });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method.' });
  if (!RENTAL_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid rental status.' });
  if (!Number.isFinite(damageCharge) || damageCharge < 0) return res.status(400).json({ error: 'Damage charge must be zero or greater.' });

  const replacementPlan = normalizeReplacementPlan(req.body.replacement_plan);
  const client = await pool.connect();
  try {
    const admin = await getOptionalAuthUserFromRequest(req);
    await client.query('BEGIN');
    const lock = await client.query(`SELECT id FROM car_rentals WHERE id = $1 FOR UPDATE`, [rentalId]);
    if (!lock.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rental not found.' });
    }

    const existing = await fetchAdminRentalById(rentalId);
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rental not found.' });
    }
    const restoringCancelledRental = existing.status === 'cancelled' && status !== 'cancelled';
    if (restoringCancelledRental) {
      await assertRentalRefundRestoreAllowed(rentalId, client);
    }

    const effectiveReturnDateTime = effectiveRentalReturnDateTime(status, returnDateTime);
    const driverConflict = status === 'cancelled' ? null : await findDriverRentalScheduleConflict({
      driverId: existing.hired_driver_id || null,
      pickupDateTime,
      returnDateTime: effectiveReturnDateTime,
      excludeRentalId: rentalId,
      db: client
    });
    if (driverConflict) {
      throw Object.assign(new Error(driverConflict.message), { status: 409, conflict: driverConflict });
    }

    const lateImpact = status === 'cancelled'
      ? { affected_rentals: [] }
      : await buildLateReturnImpact(existing, pickupDateTime, effectiveReturnDateTime, client);
    const affectedRentals = lateImpact.affected_rentals || [];
    if (affectedRentals.length) {
      await client.query(
        `SELECT id FROM car_rentals WHERE id = ANY($1::INT[]) FOR UPDATE`,
        [affectedRentals.map((rental) => rental.id)]
      );
    }

    const replacementSelections = [];
    for (const affected of affectedRentals) {
      const replacementCarId = replacementPlan.get(Number(affected.id));
      if (!replacementCarId) {
        throw Object.assign(
          new Error(`Replacement car is required for affected rental(s): ${affectedRentals.map((rental) => `#${rental.id}`).join(', ')}.`),
          { status: 409, code: 'RENTAL_REPLACEMENT_REQUIRED', affected_rentals: affectedRentals }
        );
      }

      const replacementOptions = await findAvailableReplacementCarsForRental(affected, existing.car_id, client);
      const selectedCar = replacementOptions.find((car) => Number(car.id) === replacementCarId);
      if (!selectedCar) {
        throw Object.assign(
          new Error(`Replacement car #${replacementCarId} is not available for rental #${affected.id}.`),
          { status: 409, code: 'RENTAL_REPLACEMENT_UNAVAILABLE', affected_rentals: affectedRentals }
        );
      }

      replacementSelections.push({
        affected,
        selectedCar
      });
    }

    for (let index = 0; index < replacementSelections.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < replacementSelections.length; compareIndex += 1) {
        const left = replacementSelections[index];
        const right = replacementSelections[compareIndex];
        if (
          Number(left.selectedCar.id) === Number(right.selectedCar.id) &&
          rentalWindowsOverlapWithBuffer(left.affected, right.affected)
        ) {
          throw Object.assign(
            new Error(`${left.selectedCar.name} cannot cover affected rentals #${left.affected.id} and #${right.affected.id} because their schedules overlap.`),
            { status: 409, code: 'RENTAL_REPLACEMENT_PLAN_OVERLAP', affected_rentals: affectedRentals }
          );
        }
      }
    }

    const driverHourlyRate = Number(existing.hired_driver_hourly_rate || 0);
    const pricing = calculateRentalPricing(pickupDateTime, returnDateTime, existing.daily_rate, driverHourlyRate);
    const returnedAtDate = status === 'returned'
      ? (existing.status === 'returned' && existing.returned_at ? new Date(existing.returned_at) : new Date())
      : null;
    const returnedAtValue = returnedAtDate
      ? formatLocalTimestamp(returnedAtDate)
      : null;
    const lateHours = returnedAtDate && returnedAtDate > returnDateTime.date
      ? Math.max(1, Math.ceil((returnedAtDate - returnDateTime.date) / 3600000))
      : 0;
    const lateHourlyRate = Number(existing.daily_rate || 0) / 24 + (existing.hired_driver_id ? driverHourlyRate : 0);
    const lateReturnCharge = Number((lateHours * lateHourlyRate).toFixed(2));
    const damageResponsibility = existing.hired_driver_id ? 'driver' : 'renter';
    const renterDamageCharge = damageResponsibility === 'renter' ? damageCharge : 0;
    const totalPrice = Number((pricing.basePrice + pricing.driverFee + lateReturnCharge + renterDamageCharge).toFixed(2));

    await client.query(
      `UPDATE car_rentals
       SET pickup_date = $1,
           return_date = $2,
           pickup_datetime = $3,
           return_datetime = $4,
           rental_hours = $5,
           hourly_charge = $6,
           rental_base_price = $6,
           driver_fee = $7,
           late_return_hours = $8,
           late_return_charge = $9,
           damage_description = $10,
           damage_charge = $11,
           damage_responsibility = $12,
           total_price = $13,
           driver_name = $14,
           driver_license = $15,
           payment_method = ($16)::payment_method,
           status = ($17)::booking_status,
           returned_at = $18
       WHERE id = $19`,
      [
        pickupDateTime.dateKey,
        returnDateTime.dateKey,
        pickupDateTime.value,
        returnDateTime.value,
        pricing.hours,
        pricing.basePrice,
        pricing.driverFee,
        lateHours,
        lateReturnCharge,
        damageDescription,
        damageCharge,
        damageResponsibility,
        totalPrice,
        driverName,
        driverLicense,
        paymentMethod,
        status,
        returnedAtValue,
        rentalId
      ]
    );
    await syncRentalTransactions(rentalId, client);
    if (restoringCancelledRental) {
      await voidPendingRentalRefundClaims(rentalId, client);
    }

    for (const selection of replacementSelections) {
      const { affected, selectedCar } = selection;
      await client.query(
        `UPDATE car_rentals
         SET car_id = $1
         WHERE id = $2`,
        [selectedCar.id, affected.id]
      );
      await client.query(
        `INSERT INTO rental_car_replacement_events (
           affected_rental_id,
           source_rental_id,
           old_car_id,
           new_car_id,
           admin_id,
           reason
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          affected.id,
          rentalId,
          affected.car_id,
          selectedCar.id,
          admin?.id || null,
          'late return replacement'
        ]
      );
      await createUserNotification({
        user_id: affected.user_id,
        car_rental_id: affected.id,
        type: 'rental_car_replaced',
        title: 'Your rental car was changed',
        message: `${affected.old_car_name} was changed to ${selectedCar.name} because another return ran late. Your rental price stayed the same.`,
        action_url: `/bookings?tab=rentals&rental=${affected.id}`,
        action_type: 'view_rental',
        metadata: {
          rental_id: affected.id,
          source_rental_id: rentalId,
          old_car_id: affected.car_id,
          old_car_name: affected.old_car_name,
          old_plate_number: affected.old_plate_number,
          new_car_id: selectedCar.id,
          new_car_name: selectedCar.name,
          new_plate_number: selectedCar.plate_number,
          pickup_datetime: affected.pickup_datetime,
          return_datetime: affected.return_datetime,
          reason: 'late return replacement',
          price_kept: true
        }
      }, client);
    }

    const pickupChanged = new Date(existing.pickup_datetime).getTime() !== pickupDateTime.date.getTime();
    const returnChanged = new Date(existing.return_datetime).getTime() !== returnDateTime.date.getTime();
    if (existing.status !== 'cancelled' && status === 'cancelled') {
      const claim = await createRentalRefundClaim(rentalId, client);
      await createRefundClaimNotification(claim, {
        metadata: {
          reason: 'admin rental status cancelled',
          rental_id: existing.id,
          car_name: existing.car_name
        }
      }, client);
    } else if ((pickupChanged || returnChanged) && status !== 'cancelled') {
      await createUserNotification({
        user_id: existing.user_id,
        car_rental_id: existing.id,
        type: 'rental_changed',
        title: 'Your rental schedule changed',
        message: `${existing.car_name} rental pickup or return time was updated by admin.`,
        action_url: '/bookings?tab=rentals',
        action_type: 'view_rental',
        metadata: {
          rental_id: existing.id,
          old_pickup_datetime: existing.pickup_datetime,
          old_return_datetime: existing.return_datetime,
          pickup_datetime: pickupDateTime.value,
          return_datetime: returnDateTime.value
        }
      }, client);
    }

    await client.query('COMMIT');
    const updated = await fetchAdminRentalById(rentalId);
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(err.status || 400).json({
      error: err.message,
      code: err.code,
      conflict: err.conflict,
      affected_rentals: err.affected_rentals
    });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/rentals/:id', async (req, res) => {
  const rentalId = Number(req.params.id);
  if (!rentalId) return res.status(400).json({ error: 'Invalid rental id.' });

  try {
    const existing = await fetchAdminRentalById(rentalId);
    if (!existing) return res.status(404).json({ error: 'Rental not found.' });
    await createUserNotification({
      user_id: existing.user_id,
      type: 'rental_cancelled',
      title: 'Your rental was removed',
      message: `${existing.car_name} rental was removed by admin.`,
      action_url: '/bookings?tab=rentals',
      action_type: 'view_rental',
      metadata: { rental_id: existing.id, car_name: existing.car_name }
    });
    const result = await pool.query(`DELETE FROM car_rentals WHERE id = $1 RETURNING id`, [rentalId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Rental not found.' });
    res.json({ id: rentalId, message: 'Rental deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/reports', async (req, res) => {
  const monthRange = buildMonthRange(req.query.month);
  const params = [monthRange.start, monthRange.end];
  const previousRange = buildPreviousMonthRange(monthRange);
  const previousParams = [previousRange.start, previousRange.end];

  try {
    const [
      bookingRevenue,
      rentalRevenue,
      bookingDaily,
      rentalDaily,
      previousBookingRevenue,
      previousRentalRevenue,
      bookingCancellations,
      rentalCancellations,
      activeCustomers,
      newCustomers,
      topRoutes,
      topCars,
      topCompanies,
      topCustomers,
      paymentMix,
      bookingDetails,
      rentalDetails,
      customerDetails,
      paymentDetails
    ] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_price), 0) AS revenue, COUNT(*)::INT AS count FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2`, params),
      pool.query(`SELECT COALESCE(SUM(total_price), 0) AS revenue, COUNT(*)::INT AS count FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2`, params),
      pool.query(`SELECT created_at::DATE AS day, COALESCE(SUM(total_price), 0) AS revenue FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2 GROUP BY created_at::DATE ORDER BY day`, params),
      pool.query(`SELECT booked_at::DATE AS day, COALESCE(SUM(total_price), 0) AS revenue FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2 GROUP BY booked_at::DATE ORDER BY day`, params),
      pool.query(`SELECT COALESCE(SUM(total_price), 0) AS revenue, COUNT(*)::INT AS count FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2`, previousParams),
      pool.query(`SELECT COALESCE(SUM(total_price), 0) AS revenue, COUNT(*)::INT AS count FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2`, previousParams),
      pool.query(`SELECT COUNT(*)::INT AS count FROM bus_bookings WHERE status = 'cancelled' AND created_at >= $1 AND created_at < $2`, params),
      pool.query(`SELECT COUNT(*)::INT AS count FROM car_rentals WHERE status = 'cancelled' AND booked_at >= $1 AND booked_at < $2`, params),
      pool.query(
        `SELECT COUNT(DISTINCT user_id)::INT AS count
         FROM (
           SELECT user_id FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2
           UNION
           SELECT user_id FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2
         ) active_users`,
        params
      ),
      pool.query(`SELECT COUNT(*)::INT AS count FROM users WHERE created_at >= $1 AND created_at < $2`, params),
      pool.query(
        `SELECT br.origin, br.destination, COUNT(*)::INT AS count, COALESCE(SUM(bb.total_price), 0) AS revenue
         FROM bus_bookings bb
         JOIN bus_routes br ON br.id = bb.route_id
         WHERE bb.status <> 'cancelled' AND bb.created_at >= $1 AND bb.created_at < $2
         GROUP BY br.origin, br.destination
         ORDER BY count DESC, revenue DESC
         LIMIT 5`,
        params
      ),
      pool.query(
        `SELECT rc.name, COUNT(*)::INT AS count, COALESCE(SUM(cr.total_price), 0) AS revenue
         FROM car_rentals cr
         JOIN rental_cars rc ON rc.id = cr.car_id
         WHERE cr.status <> 'cancelled' AND cr.booked_at >= $1 AND cr.booked_at < $2
         GROUP BY rc.name
         ORDER BY count DESC, revenue DESC
         LIMIT 5`,
        params
      ),
      pool.query(
        `SELECT c.name, COUNT(*)::INT AS count, COALESCE(SUM(bb.total_price), 0) AS revenue, c.theme_color AS color
         FROM bus_bookings bb
         JOIN bus_routes br ON br.id = bb.route_id
         JOIN buses b ON b.id = br.bus_id
         LEFT JOIN companies c ON c.id = b.company_id
         WHERE bb.status <> 'cancelled' AND bb.created_at >= $1 AND bb.created_at < $2
         GROUP BY c.name, c.theme_color
         ORDER BY count DESC, revenue DESC
         LIMIT 5`,
        params
      ),
      pool.query(
        `SELECT user_name, COUNT(*)::INT AS count, SUM(total_spent) AS spend
         FROM (
           SELECT CONCAT(u.first_name, ' ', u.last_name) AS user_name, bb.total_price AS total_spent
           FROM bus_bookings bb
           JOIN users u ON u.id = bb.user_id
           WHERE bb.status <> 'cancelled' AND bb.created_at >= $1 AND bb.created_at < $2
           UNION ALL
           SELECT CONCAT(u.first_name, ' ', u.last_name) AS user_name, cr.total_price AS total_spent
           FROM car_rentals cr
           JOIN users u ON u.id = cr.user_id
           WHERE cr.status <> 'cancelled' AND cr.booked_at >= $1 AND cr.booked_at < $2
         ) activity
         GROUP BY user_name
         ORDER BY spend DESC, count DESC
         LIMIT 5`,
        params
      ),
      pool.query(
        `SELECT payment_method, COUNT(*)::INT AS count
         FROM (
           SELECT payment_method FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2
           UNION ALL
           SELECT payment_method::TEXT AS payment_method FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2
         ) payments
         GROUP BY payment_method
         ORDER BY count DESC`,
        params
      ),
      pool.query(
        `SELECT
           br.origin,
           br.destination,
           COALESCE(c.name, 'Unknown company') AS company_name,
           c.theme_color AS color,
           COUNT(bb.id) FILTER (WHERE bb.status <> 'cancelled')::INT AS count,
           COALESCE(SUM(bb.total_price) FILTER (WHERE bb.status <> 'cancelled'), 0) AS revenue,
           COALESCE(AVG(bb.total_price) FILTER (WHERE bb.status <> 'cancelled'), 0) AS average_fare,
           COUNT(bb.id) FILTER (WHERE bb.status = 'cancelled')::INT AS cancelled_count,
           COUNT(bb.id)::INT AS total_records
         FROM bus_bookings bb
         JOIN bus_routes br ON br.id = bb.route_id
         JOIN buses b ON b.id = br.bus_id
         LEFT JOIN companies c ON c.id = b.company_id
         WHERE bb.created_at >= $1 AND bb.created_at < $2
         GROUP BY br.origin, br.destination, COALESCE(c.name, 'Unknown company'), c.theme_color
         ORDER BY revenue DESC, count DESC, cancelled_count DESC
         LIMIT 12`,
        params
      ),
      pool.query(
        `SELECT
           rc.name,
           rc.type,
           COUNT(cr.id) FILTER (WHERE cr.status <> 'cancelled')::INT AS count,
           COALESCE(SUM(cr.total_price) FILTER (WHERE cr.status <> 'cancelled'), 0) AS revenue,
           COALESCE(AVG(cr.total_price) FILTER (WHERE cr.status <> 'cancelled'), 0) AS average_rental_value,
           COUNT(cr.id) FILTER (WHERE cr.status = 'cancelled')::INT AS cancelled_count,
           COUNT(cr.id) FILTER (WHERE cr.status = 'returned')::INT AS returned_count,
           COUNT(cr.id)::INT AS total_records
         FROM car_rentals cr
         JOIN rental_cars rc ON rc.id = cr.car_id
         WHERE cr.booked_at >= $1 AND cr.booked_at < $2
         GROUP BY rc.name, rc.type
         ORDER BY revenue DESC, count DESC, cancelled_count DESC
         LIMIT 12`,
        params
      ),
      pool.query(
        `SELECT
           user_name,
           email,
           COUNT(*)::INT AS transaction_count,
           COUNT(*) FILTER (WHERE activity_type = 'booking')::INT AS booking_count,
           COUNT(*) FILTER (WHERE activity_type = 'rental')::INT AS rental_count,
           COALESCE(SUM(total_spent), 0) AS spend,
           MAX(activity_at) AS last_activity
         FROM (
           SELECT CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email, bb.total_price AS total_spent, bb.created_at AS activity_at, 'booking' AS activity_type
           FROM bus_bookings bb
           JOIN users u ON u.id = bb.user_id
           WHERE bb.status <> 'cancelled' AND bb.created_at >= $1 AND bb.created_at < $2
           UNION ALL
           SELECT CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email, cr.total_price AS total_spent, cr.booked_at AS activity_at, 'rental' AS activity_type
           FROM car_rentals cr
           JOIN users u ON u.id = cr.user_id
           WHERE cr.status <> 'cancelled' AND cr.booked_at >= $1 AND cr.booked_at < $2
         ) activity
         GROUP BY user_name, email
         ORDER BY spend DESC, transaction_count DESC
         LIMIT 12`,
        params
      ),
      pool.query(
        `SELECT
           COALESCE(payment_method, 'unknown') AS payment_method,
           COUNT(*)::INT AS count,
           COALESCE(SUM(amount), 0) AS revenue
         FROM (
           SELECT payment_method, total_price AS amount FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2
           UNION ALL
           SELECT payment_method::TEXT AS payment_method, total_price AS amount FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2
         ) payments
         GROUP BY COALESCE(payment_method, 'unknown')
         ORDER BY revenue DESC, count DESC`,
        params
      )
    ]);

    const bookingRevenueValue = Number(bookingRevenue.rows[0].revenue || 0);
    const rentalRevenueValue = Number(rentalRevenue.rows[0].revenue || 0);
    const transactionCount = Number(bookingRevenue.rows[0].count || 0) + Number(rentalRevenue.rows[0].count || 0);
    const previousBookingRevenueValue = Number(previousBookingRevenue.rows[0].revenue || 0);
    const previousRentalRevenueValue = Number(previousRentalRevenue.rows[0].revenue || 0);
    const previousTransactionCount = Number(previousBookingRevenue.rows[0].count || 0) + Number(previousRentalRevenue.rows[0].count || 0);
    const totalRevenue = bookingRevenueValue + rentalRevenueValue;
    const previousTotalRevenue = previousBookingRevenueValue + previousRentalRevenueValue;
    const daily = buildDailySeries(monthRange, bookingDaily.rows, rentalDaily.rows);
    const bestRevenueDay = daily.reduce((best, day) => {
      const revenue = Number(day.booking_revenue || 0) + Number(day.rental_revenue || 0);
      return revenue > Number(best.revenue || 0) ? { date: day.date, label: day.label, revenue } : best;
    }, { date: null, label: 'No revenue', revenue: 0 });
    const cancellationCount = Number(bookingCancellations.rows[0].count || 0) + Number(rentalCancellations.rows[0].count || 0);
    const totalRecords = transactionCount + cancellationCount;
    const paymentRevenueTotal = paymentDetails.rows.reduce((sum, payment) => sum + Number(payment.revenue || 0), 0);
    const paymentCountTotal = paymentDetails.rows.reduce((sum, payment) => sum + Number(payment.count || 0), 0);

    const bookingDetailRows = bookingDetails.rows.map((row) => ({
      ...row,
      cancellation_rate: calculatePercent(row.cancelled_count, row.total_records)
    }));
    const rentalDetailRows = rentalDetails.rows.map((row) => ({
      ...row,
      cancellation_rate: calculatePercent(row.cancelled_count, row.total_records)
    }));
    const paymentDetailRows = paymentDetails.rows.map((row) => ({
      ...row,
      count_share: calculatePercent(row.count, paymentCountTotal),
      revenue_share: calculatePercent(row.revenue, paymentRevenueTotal)
    }));

    res.json({
      month: monthRange.key,
      metrics: {
        total_revenue: totalRevenue,
        booking_revenue: bookingRevenueValue,
        rental_revenue: rentalRevenueValue,
        transactions: transactionCount,
        average_transaction_value: transactionCount ? Number((totalRevenue / transactionCount).toFixed(2)) : 0,
        cancellation_rate: calculatePercent(cancellationCount, totalRecords)
      },
      comparison: {
        month: previousRange.key,
        total_revenue: calculateChange(totalRevenue, previousTotalRevenue),
        booking_revenue: calculateChange(bookingRevenueValue, previousBookingRevenueValue),
        rental_revenue: calculateChange(rentalRevenueValue, previousRentalRevenueValue),
        transactions: calculateChange(transactionCount, previousTransactionCount)
      },
      summary: {
        average_transaction_value: transactionCount ? Number((totalRevenue / transactionCount).toFixed(2)) : 0,
        active_customers: Number(activeCustomers.rows[0].count || 0),
        new_customers: Number(newCustomers.rows[0].count || 0),
        cancellation_count: cancellationCount,
        cancellation_rate: calculatePercent(cancellationCount, totalRecords),
        best_revenue_day: bestRevenueDay,
        revenue_source_split: {
          booking_percent: calculatePercent(bookingRevenueValue, totalRevenue),
          rental_percent: calculatePercent(rentalRevenueValue, totalRevenue)
        }
      },
      daily,
      top_routes: topRoutes.rows,
      top_cars: topCars.rows,
      top_companies: topCompanies.rows,
      top_customers: topCustomers.rows,
      payment_mix: paymentMix.rows,
      details: {
        bookings: bookingDetailRows,
        rentals: rentalDetailRows,
        customers: customerDetails.rows,
        companies: topCompanies.rows,
        payments: paymentDetailRows
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Register a User
app.post('/api/auth/register', async (req, res) => {
  const { first_name, last_name, email, phone, password, national_id } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const roleId = await fetchDefaultRoleId('user');

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, national_id, role, role_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, first_name, last_name, email, role_id, is_active`,
      [first_name, last_name, email, phone, password_hash, national_id, 'user', roleId]
    );
    const user = { ...result.rows[0], role: 'user' };
    const token = createAuthToken(user);
    await createUserSession(user.id, token);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Login User
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.role_id,
         r.name AS role,
         COALESCE(u.is_active, TRUE) AS is_active,
         u.password_hash
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'This account is inactive' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    delete user.password_hash;
    const token = createAuthToken(user);
    await createUserSession(user.id, token);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const result = await pool.query(
      `UPDATE user_sessions
       SET is_revoked = TRUE
       WHERE token_hash = $1
       RETURNING id`,
      [hashToken(token)]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my/profile', async (req, res) => {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const userResult = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.phone,
         u.national_id,
         u.created_at,
         COALESCE(u.is_active, TRUE) AS is_active,
         COALESCE(r.name, u.role, 'user') AS role,
         COALESCE(r.label, INITCAP(COALESCE(r.name, u.role, 'user'))) AS role_label
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [authUser.id]
    );

    if (!userResult.rowCount) return res.status(404).json({ error: 'Profile not found.' });

    const statsResult = await pool.query(
      `WITH trip_tickets AS (
         SELECT DISTINCT COALESCE(round_trip_reference, booking_reference, CONCAT('BT-', LPAD(id::TEXT, 6, '0'))) AS ticket_reference
         FROM bus_bookings
         WHERE user_id = $1
           AND status <> 'cancelled'
       ),
       route_counts AS (
         SELECT
           br.origin,
           br.destination,
           COUNT(*)::INT AS count
         FROM bus_bookings bb
         JOIN bus_routes br ON br.id = bb.route_id
         WHERE bb.user_id = $1
           AND bb.status <> 'cancelled'
         GROUP BY br.origin, br.destination
         ORDER BY count DESC, br.origin, br.destination
         LIMIT 1
       )
       SELECT
         (SELECT COUNT(*)::INT FROM trip_tickets) AS total_trips,
         (SELECT COUNT(*)::INT FROM car_rentals WHERE user_id = $1 AND status <> 'cancelled') AS total_rentals,
         (SELECT COUNT(*)::INT FROM bus_bookings WHERE user_id = $1 AND status = 'cancelled') AS cancelled_tickets,
         (SELECT COUNT(*)::INT FROM car_rentals WHERE user_id = $1 AND status = 'cancelled') AS cancelled_rentals,
         COALESCE((SELECT CONCAT(origin, ' -> ', destination) FROM route_counts), 'No trips yet') AS favourite_route`,
      [authUser.id]
    );

    res.json({
      user: userResult.rows[0],
      stats: statsResult.rows[0] || {
        total_trips: 0,
        total_rentals: 0,
        cancelled_tickets: 0,
        cancelled_rentals: 0,
        favourite_route: 'No trips yet'
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/my/profile', async (req, res) => {
  const firstName = normalizeText(req.body.first_name);
  const lastName = normalizeText(req.body.last_name);
  const email = normalizeText(req.body.email).toLowerCase();
  const phone = normalizeText(req.body.phone);
  const nationalId = normalizeText(req.body.national_id) || null;

  if (!firstName || !lastName || !email || !phone) {
    return res.status(400).json({ error: 'First name, last name, email, and phone are required.' });
  }

  try {
    const authUser = await getAuthUserFromRequest(req);
    const duplicate = await pool.query(
      `SELECT id, email, phone
       FROM users
       WHERE id <> $1
         AND (LOWER(email) = LOWER($2) OR phone = $3)
       LIMIT 1`,
      [authUser.id, email, phone]
    );

    if (duplicate.rowCount) {
      const row = duplicate.rows[0];
      return res.status(400).json({
        error: String(row.email || '').toLowerCase() === email ? 'Email is already used by another account.' : 'Phone is already used by another account.'
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           email = $3,
           phone = $4,
           national_id = $5
       WHERE id = $6
       RETURNING id, first_name, last_name, email, phone, national_id, role, is_active, created_at`,
      [firstName, lastName, email, phone, nationalId, authUser.id]
    );

    res.json({ user: result.rows[0], message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/my/profile/password', async (req, res) => {
  const currentPassword = String(req.body.current_password || '');
  const newPassword = String(req.body.new_password || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const authUser = await getAuthUserFromRequest(req);
    const result = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [authUser.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Profile not found.' });

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect.' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, authUser.id]);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

async function fetchUserTripForFeedback(reference, userId) {
  const result = await pool.query(
    `SELECT
       bb.id,
       bb.user_id,
       bb.route_id,
       bb.status,
       COALESCE(bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0'))) AS booking_reference,
       bb.round_trip_reference,
       COALESCE(bb.trip_leg, 'outbound') AS trip_leg,
       r.departure_time,
       r.origin,
       r.destination,
       b.id AS bus_id,
       b.name AS bus_name,
       b.type AS bus_type,
       b.plate_number,
       c.id AS company_id,
       c.name AS company_name
     FROM bus_bookings bb
     JOIN bus_routes r ON r.id = bb.route_id
     JOIN buses b ON b.id = r.bus_id
     LEFT JOIN companies c ON c.id = b.company_id
     WHERE bb.user_id = $1
       AND (
         bb.booking_reference = $2
         OR bb.round_trip_reference = $2
         OR CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0')) = $2
       )
     ORDER BY
       CASE WHEN COALESCE(bb.trip_leg, 'outbound') = 'outbound' THEN 0 ELSE 1 END,
       r.departure_time ASC,
       bb.id ASC
     LIMIT 1`,
    [userId, reference]
  );
  return result.rows[0] || null;
}

function tripFeedbackIsOpen(booking) {
  const status = String(booking?.status || '').toLowerCase();
  if (status === 'cancelled') return false;
  const departure = new Date(booking?.departure_time);
  return !Number.isNaN(departure.getTime()) && departure <= new Date();
}

async function submitBusTripFeedback(req, res, feedbackType) {
  const reference = normalizeText(req.params.reference);
  const comment = normalizeText(req.body.comment || req.body.report);
  if (!reference) return res.status(400).json({ error: 'Ticket reference is required.' });
  if (!comment) return res.status(400).json({ error: feedbackType === 'report' ? 'Report detail is required.' : 'Trip comment is required.' });

  try {
    const user = await getAuthUserFromRequest(req);
    const booking = await fetchUserTripForFeedback(reference, user.id);
    if (!booking) return res.status(404).json({ error: 'Ticket not found.' });
    if (String(booking.status || '').toLowerCase() === 'cancelled') return res.status(400).json({ error: 'Cancelled trip tickets cannot receive feedback.' });
    if (!tripFeedbackIsOpen(booking)) return res.status(400).json({ error: 'Trip feedback unlocks once the departure time has started.' });

    const result = await pool.query(
      `INSERT INTO bus_trip_feedback (
         user_id,
         bus_booking_id,
         route_id,
         company_id,
         bus_id,
         feedback_type,
         comment
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, feedback_type, comment, created_at`,
      [user.id, booking.id, booking.route_id, booking.company_id || null, booking.bus_id || null, feedbackType, comment]
    );

    res.status(201).json({
      message: feedbackType === 'report' ? 'Trip report submitted successfully.' : 'Trip comment saved successfully.',
      feedback: result.rows[0]
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

app.get('/api/my/bookings/trips', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    const result = await pool.query(
      `SELECT
         bb.id,
         COALESCE(bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0'))) AS booking_reference,
         bb.round_trip_reference,
         COALESCE(bb.trip_leg, 'outbound') AS trip_leg,
         bb.user_id,
         bb.route_id,
         bb.seat_number,
         bb.total_price,
         COALESCE(bb.original_price, bb.total_price) AS original_price,
         COALESCE(bb.discount_amount, 0) AS discount_amount,
         COALESCE(bb.package_weight_kg, 0) AS package_weight_kg,
         COALESCE(bb.overweight_charge, 0) AS overweight_charge,
         bb.payment_method,
         bb.status,
         bb.created_at,
         bb.passenger_first_name,
         bb.passenger_last_name,
         bb.passenger_phone,
         bb.passenger_email,
         bb.passenger_id_number,
         r.origin,
         r.destination,
         r.departure_time,
         r.arrival_time,
         r.price,
         r.daily_template_id,
         r.service_date,
         COALESCE(r.is_generated, FALSE) AS is_generated,
         b.name AS bus_name,
         b.type AS bus_type,
         b.plate_number,
         c.name AS company_name,
         c.theme_color AS color,
         c.theme_bg AS bg,
         COALESCE((
           SELECT JSON_AGG(
             JSON_BUILD_OBJECT(
               'id', un.id,
               'type', un.type,
               'title', un.title,
               'message', un.message,
               'action_url', un.action_url,
               'action_type', un.action_type,
               'is_read', un.is_read,
               'created_at', un.created_at,
               'metadata', COALESCE(un.metadata, '{}'::JSONB)
             )
             ORDER BY un.created_at DESC, un.id DESC
           )
           FROM user_notifications un
           WHERE un.user_id = bb.user_id
             AND (
               un.bus_booking_id = bb.id
               OR un.booking_reference = COALESCE(bb.round_trip_reference, bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0')))
               OR un.booking_reference = bb.booking_reference
             )
         ), '[]'::JSON) AS notifications,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', btf.id,
             'feedback_type', btf.feedback_type,
             'comment', btf.comment,
             'admin_reply', btf.admin_reply,
             'admin_replied_at', btf.admin_replied_at,
             'created_at', btf.created_at
           )
           FROM bus_trip_feedback btf
           WHERE btf.bus_booking_id = bb.id
             AND btf.user_id = bb.user_id
             AND btf.feedback_type = 'comment'
           ORDER BY btf.created_at DESC, btf.id DESC
           LIMIT 1
         ) AS my_trip_comment,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', btf.id,
             'feedback_type', btf.feedback_type,
             'comment', btf.comment,
             'admin_reply', btf.admin_reply,
             'admin_replied_at', btf.admin_replied_at,
             'created_at', btf.created_at
           )
           FROM bus_trip_feedback btf
           WHERE btf.bus_booking_id = bb.id
             AND btf.user_id = bb.user_id
             AND btf.feedback_type = 'report'
           ORDER BY btf.created_at DESC, btf.id DESC
           LIMIT 1
         ) AS my_trip_report,
         (
           SELECT JSON_BUILD_OBJECT(
             'id', rcx.id,
             'refund_type', rcx.refund_type,
             'booking_reference', rcx.booking_reference,
             'amount', rcx.amount,
             'status', rcx.status,
             'claim_token', rcx.claim_token,
             'created_at', rcx.created_at,
             'claimed_at', rcx.claimed_at,
             'voided_at', rcx.voided_at
           )
           FROM refund_claims rcx
           WHERE rcx.refund_type = 'bus_ticket'
             AND rcx.user_id = bb.user_id
             AND rcx.status <> 'voided'
             AND (
               rcx.booking_reference = COALESCE(bb.round_trip_reference, bb.booking_reference, CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0')))
               OR bb.id = ANY(rcx.bus_booking_ids)
             )
           ORDER BY rcx.created_at DESC, rcx.id DESC
           LIMIT 1
         ) AS refund_claim
       FROM bus_bookings bb
       JOIN bus_routes r ON r.id = bb.route_id
       JOIN buses b ON b.id = r.bus_id
       LEFT JOIN companies c ON c.id = b.company_id
       WHERE bb.user_id = $1
       ORDER BY bb.created_at DESC, bb.id DESC`,
      [user.id]
    );

    const statusRank = { confirmed: 4, pending: 3, completed: 2, cancelled: 1 };
    const tickets = new Map();

    result.rows.forEach((row) => {
      const groupKey = row.round_trip_reference || row.booking_reference || `BT-${String(row.id).padStart(6, '0')}`;
      if (!tickets.has(groupKey)) {
        tickets.set(groupKey, {
          ticket_reference: groupKey,
          round_trip_reference: row.round_trip_reference,
          is_round_trip: Boolean(row.round_trip_reference),
          first_booking_id: row.id,
          booking_reference: row.booking_reference,
          status: row.status,
          status_rank: statusRank[row.status] || 0,
          created_at: row.created_at,
          latest_created_at: row.created_at,
          passenger_first_name: row.passenger_first_name,
          passenger_last_name: row.passenger_last_name,
          passenger_phone: row.passenger_phone,
          passenger_email: row.passenger_email,
          passenger_id_number: row.passenger_id_number,
          payment_method: row.payment_method,
          subtotal_amount: 0,
          discount_amount: 0,
          total_amount: 0,
          package_weight_kg: 0,
          overweight_charge: 0,
          notifications: [],
          my_trip_comment: null,
          my_trip_report: null,
          refund_claim: null,
          legs: []
        });
      }

      const ticket = tickets.get(groupKey);
      ticket.status_rank = Math.max(ticket.status_rank, statusRank[row.status] || 0);
      ticket.status = Object.keys(statusRank).find((key) => statusRank[key] === ticket.status_rank) || ticket.status;
      if (new Date(row.created_at) > new Date(ticket.latest_created_at)) ticket.latest_created_at = row.created_at;
      ticket.subtotal_amount += Number(row.original_price || row.total_price || 0);
      ticket.discount_amount += Number(row.discount_amount || 0);
      ticket.total_amount += Number(row.total_price || 0);
      ticket.package_weight_kg += Number(row.package_weight_kg || 0);
      ticket.overweight_charge += Number(row.overweight_charge || 0);
      (Array.isArray(row.notifications) ? row.notifications : []).forEach((notification) => {
        if (!ticket.notifications.some((item) => Number(item.id) === Number(notification.id))) {
          ticket.notifications.push(notification);
        }
      });
      if (row.my_trip_comment && (!ticket.my_trip_comment || new Date(row.my_trip_comment.created_at) > new Date(ticket.my_trip_comment.created_at))) {
        ticket.my_trip_comment = row.my_trip_comment;
      }
      if (row.my_trip_report && (!ticket.my_trip_report || new Date(row.my_trip_report.created_at) > new Date(ticket.my_trip_report.created_at))) {
        ticket.my_trip_report = row.my_trip_report;
      }
      if (row.refund_claim && (!ticket.refund_claim || new Date(row.refund_claim.created_at) > new Date(ticket.refund_claim.created_at))) {
        ticket.refund_claim = row.refund_claim;
      }

      const legKey = `${row.trip_leg || 'outbound'}-${row.booking_reference || row.route_id}`;
      let leg = ticket.legs.find((item) => item.leg_key === legKey);
      if (!leg) {
        leg = {
          leg_key: legKey,
          booking_reference: row.booking_reference,
          leg_type: row.trip_leg || 'outbound',
          route_id: row.route_id,
          seats: [],
          booking_ids: [],
          total_amount: 0,
          subtotal_amount: 0,
          discount_amount: 0,
          package_weight_kg: 0,
          overweight_charge: 0,
          payment_method: row.payment_method,
          status: row.status,
          origin: row.origin,
          destination: row.destination,
          departure_time: row.departure_time,
          arrival_time: row.arrival_time,
          price: row.price,
          daily_template_id: row.daily_template_id,
          service_date: row.service_date,
          is_generated: row.is_generated,
          bus_name: row.bus_name,
          bus_type: row.bus_type,
          plate_number: row.plate_number,
          company_name: row.company_name,
          color: row.color,
          bg: row.bg
        };
        ticket.legs.push(leg);
      }

      leg.seats.push(row.seat_number);
      leg.booking_ids.push(row.id);
      leg.subtotal_amount += Number(row.original_price || row.total_price || 0);
      leg.discount_amount += Number(row.discount_amount || 0);
      leg.total_amount += Number(row.total_price || 0);
      leg.package_weight_kg += Number(row.package_weight_kg || 0);
      leg.overweight_charge += Number(row.overweight_charge || 0);
    });

    const trips = Array.from(tickets.values())
      .map((ticket) => ({
        ...ticket,
        subtotal_amount: Number(ticket.subtotal_amount.toFixed(2)),
        discount_amount: Number(ticket.discount_amount.toFixed(2)),
        total_amount: Number(ticket.total_amount.toFixed(2)),
        package_weight_kg: Number(ticket.package_weight_kg.toFixed(2)),
        overweight_charge: Number(ticket.overweight_charge.toFixed(2)),
        notifications: ticket.notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
        legs: ticket.legs
          .map((leg) => ({
            ...leg,
            subtotal_amount: Number(leg.subtotal_amount.toFixed(2)),
            discount_amount: Number(leg.discount_amount.toFixed(2)),
            total_amount: Number(leg.total_amount.toFixed(2)),
            package_weight_kg: Number(leg.package_weight_kg.toFixed(2)),
            overweight_charge: Number(leg.overweight_charge.toFixed(2))
          }))
          .sort((a, b) => (a.leg_type === 'outbound' ? -1 : 1) - (b.leg_type === 'outbound' ? -1 : 1))
      }))
      .sort((a, b) => new Date(b.latest_created_at) - new Date(a.latest_created_at));

    res.json({ trips });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/my/bookings/trips/:reference/comment', async (req, res) => {
  await submitBusTripFeedback(req, res, 'comment');
});

app.post('/api/my/bookings/trips/:reference/report', async (req, res) => {
  await submitBusTripFeedback(req, res, 'report');
});

app.post('/api/my/bookings/trips/:reference/cancel', async (req, res) => {
  const reference = normalizeText(req.params.reference);
  if (!reference) return res.status(400).json({ error: 'Ticket reference is required.' });

  const client = await pool.connect();
  try {
    const user = await getAuthUserFromRequest(req);
    await client.query('BEGIN');

    const ticketResult = await client.query(
      `SELECT
         bb.id,
         bb.status,
         bb.booking_reference,
         bb.round_trip_reference,
         r.departure_time
       FROM bus_bookings bb
       JOIN bus_routes r ON r.id = bb.route_id
       WHERE bb.user_id = $1
         AND (
           bb.booking_reference = $2
           OR bb.round_trip_reference = $2
           OR CONCAT('BT-', LPAD(bb.id::TEXT, 6, '0')) = $2
         )
       FOR UPDATE OF bb`,
      [user.id, reference]
    );

    if (!ticketResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const rows = ticketResult.rows;
    const activeRows = rows.filter((row) => ['pending', 'confirmed'].includes(String(row.status || '').toLowerCase()));
    if (activeRows.length !== rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only pending or confirmed tickets can be cancelled.' });
    }

    const earliestDeparture = rows.reduce((earliest, row) => {
      const departure = new Date(row.departure_time);
      if (Number.isNaN(departure.getTime())) return earliest;
      return !earliest || departure < earliest ? departure : earliest;
    }, null);
    const bookingIds = activeRows.map((row) => row.id);
    const movedResult = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM booking_recovery_events
         WHERE booking_id = ANY($1::INT[])
           AND reason ILIKE 'maintenance%'
       ) AS moved_due_to_maintenance`,
      [bookingIds]
    );
    const movedDueToMaintenance = Boolean(movedResult.rows[0]?.moved_due_to_maintenance);
    const cancellationCutoff = new Date(Date.now() + (movedDueToMaintenance ? 30 : 120) * 60 * 1000);

    if (!earliestDeparture || earliestDeparture <= cancellationCutoff) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: movedDueToMaintenance
          ? 'Moved maintenance tickets can only be cancelled more than 30 minutes before departure.'
          : 'Tickets can only be cancelled more than 2 hours before departure.'
      });
    }

    const cancelResult = await client.query(
      `UPDATE bus_bookings
       SET status = 'cancelled'
       WHERE user_id = $1
         AND id = ANY($2::INT[])
       RETURNING id`,
      [user.id, bookingIds]
    );

    await syncBusBookingTransactions(bookingIds, client);
    const refundClaims = await createBusRefundClaimsForBookingGroups(bookingIds, client);

    await client.query('COMMIT');
    res.json({
      message: 'Ticket cancelled successfully.',
      cancelled_count: cancelResult.rowCount,
      refund_claim: refundClaims.length === 1 ? formatRefundClaim(refundClaims[0]) : null,
      refund_claims: refundClaims.map(formatRefundClaim)
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 5. Create a Bus Booking
app.post('/api/bookings/bus', async (req, res) => {
  const rawLegs = Array.isArray(req.body.legs) && req.body.legs.length
    ? req.body.legs
    : [{
      route_id: req.body.route_id,
      seat_numbers: req.body.seat_numbers || (req.body.seat_number ? [req.body.seat_number] : []),
      leg_type: 'outbound'
    }];
  const paymentMethod = normalizeText(req.body.payment_method).toLowerCase();
  const passenger = req.body.passenger || {};
  const passengerFirstName = normalizeText(passenger.first_name || req.body.first_name);
  const passengerLastName = normalizeText(passenger.last_name || req.body.last_name);
  const passengerPhone = normalizeText(passenger.phone || req.body.phone);
  const passengerEmail = normalizeText(passenger.email || req.body.email);
  const passengerIdNumber = normalizeText(passenger.id_number || req.body.id_number);
  const legs = rawLegs.map((leg) => ({
    route_id: Number(leg.route_id),
    leg_type: normalizeText(leg.leg_type || 'outbound').toLowerCase(),
    seat_numbers: (Array.isArray(leg.seat_numbers) ? leg.seat_numbers : [])
      .map((seat) => normalizeText(seat).toUpperCase())
      .filter(Boolean)
  }));
  const isRoundTrip = legs.length === 2;

  if (!legs.length || legs.length > 2) return res.status(400).json({ error: 'One-way bookings need one leg, and round trips need two legs.' });
  if (isRoundTrip && new Set(legs.map((leg) => leg.leg_type)).size !== 2) return res.status(400).json({ error: 'Round trips require outbound and return legs.' });
  if (isRoundTrip && (!legs.some((leg) => leg.leg_type === 'outbound') || !legs.some((leg) => leg.leg_type === 'return'))) {
    return res.status(400).json({ error: 'Round trips require outbound and return legs.' });
  }
  if (legs.some((leg) => !leg.route_id)) return res.status(400).json({ error: 'Route is required.' });
  if (legs.some((leg) => !['outbound', 'return'].includes(leg.leg_type))) return res.status(400).json({ error: 'Invalid trip leg.' });
  if (legs.some((leg) => !leg.seat_numbers.length)) return res.status(400).json({ error: 'At least one seat is required for every leg.' });
  if (legs.some((leg) => new Set(leg.seat_numbers).size !== leg.seat_numbers.length)) return res.status(400).json({ error: 'Duplicate seats are not allowed.' });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method.' });
  if (!passengerFirstName || !passengerLastName || !passengerPhone || !passengerEmail || !passengerIdNumber) {
    return res.status(400).json({ error: 'Passenger name, phone, email, and ID/passport are required.' });
  }

  const client = await pool.connect();
  try {
    const user = await getAuthUserFromRequest(req);
    await releaseExpiredBusMaintenance();
    await generateDailyRoutes();
    await client.query('BEGIN');

    const fail = (status, message) => {
      const error = new Error(message);
      error.status = status;
      throw error;
    };
    const routeByLeg = {};

    for (const leg of legs) {
      const routeResult = await client.query(
        `SELECT
           r.*,
           b.total_seats,
           b.maintenance_start AS bus_maintenance_start,
           b.maintenance_end AS bus_maintenance_end,
           b.seat_map_override,
           t.layout_json AS template_layout,
           c.name AS company_name,
           c.theme_color AS color,
           c.theme_bg AS bg
         FROM bus_routes r
         JOIN buses b ON b.id = r.bus_id
         LEFT JOIN bus_seat_map_templates t ON t.id = b.seat_map_template_id
         LEFT JOIN companies c ON c.id = b.company_id
         WHERE r.id = $1
         FOR UPDATE OF r`,
        [leg.route_id]
      );
      const route = routeResult.rows[0];
      if (!route) fail(404, 'Route not found.');
      if (new Date(route.departure_time) < new Date()) fail(409, 'This trip already departed and cannot be booked.');
      if (routeIsMaintenanceBlocked(route)) fail(409, 'This trip is under maintenance and cannot be booked.');

      const seatMap = resolveSeatMap(route);
      const canonicalSeatByKey = new Map(
        (seatMap.cells || [])
          .filter((cell) => cell.type === 'seat' && normalizeText(cell.label))
          .map((cell) => [normalizeText(cell.label).toUpperCase(), normalizeText(cell.label)])
      );
      const missingSeats = leg.seat_numbers.filter((seat) => !canonicalSeatByKey.has(seat));
      if (missingSeats.length) fail(400, `These seats do not exist on this bus: ${missingSeats.join(', ')}.`);

      const booked = await client.query(
        `SELECT seat_number
         FROM bus_bookings
         WHERE route_id = $1
           AND status <> 'cancelled'
           AND UPPER(seat_number) = ANY($2::TEXT[])`,
        [leg.route_id, leg.seat_numbers]
      );
      if (booked.rowCount) fail(409, `These seats are already booked: ${booked.rows.map((row) => row.seat_number).join(', ')}.`);

      routeByLeg[leg.leg_type] = { route, canonicalSeatByKey };
    }

    if (isRoundTrip) {
      const outbound = routeByLeg.outbound?.route;
      const returning = routeByLeg.return?.route;
      if (!outbound || !returning) fail(400, 'Round trips require outbound and return legs.');
      if (
        normalizeRouteName(outbound.origin) !== normalizeRouteName(returning.destination) ||
        normalizeRouteName(outbound.destination) !== normalizeRouteName(returning.origin)
      ) {
        fail(400, 'Return trip must use the reverse destination of the outbound trip.');
      }
      if (new Date(returning.departure_time) <= new Date(outbound.departure_time)) {
        fail(400, 'Coming back trip must depart after the outbound trip.');
      }
    }

    const roundTripReference = isRoundTrip ? `RT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}` : null;
    const discountRate = isRoundTrip ? 0.05 : 0;
    const inserted = [];

    for (const leg of legs) {
      const { route, canonicalSeatByKey } = routeByLeg[leg.leg_type];
      const bookingReference = isRoundTrip
        ? `${roundTripReference}-${leg.leg_type === 'return' ? 'RET' : 'OUT'}`
        : `BT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const originalPrice = Number(route.price || 0);
      const discountAmount = Number((originalPrice * discountRate).toFixed(2));
      const discountedPrice = Number((originalPrice - discountAmount).toFixed(2));

      for (const seat of leg.seat_numbers) {
        const seatLabel = canonicalSeatByKey.get(seat);
        const insertResult = await client.query(
          `INSERT INTO bus_bookings (
             user_id,
             route_id,
             booking_reference,
             round_trip_reference,
             trip_leg,
             seat_number,
             original_price,
             discount_amount,
             total_price,
             passenger_first_name,
             passenger_last_name,
             passenger_phone,
             passenger_email,
             passenger_id_number,
             payment_method,
             status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'confirmed')
           RETURNING id, route_id, booking_reference, round_trip_reference, trip_leg, seat_number, original_price, discount_amount, total_price`,
          [
            user.id,
            leg.route_id,
            bookingReference,
            roundTripReference,
            leg.leg_type,
            seatLabel,
            originalPrice,
            discountAmount,
            discountedPrice,
            passengerFirstName,
            passengerLastName,
            passengerPhone,
            passengerEmail,
            passengerIdNumber,
            paymentMethod
          ]
        );
        const booking = insertResult.rows[0];
        inserted.push(booking);
        await client.query(
          `INSERT INTO transactions (user_id, bus_booking_id, amount, payment_method, status)
           VALUES ($1, $2, $3, ($4)::payment_method, 'success')`,
          [user.id, booking.id, discountedPrice, paymentMethod]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Booking created successfully.',
      round_trip_reference: roundTripReference,
      booking_reference: inserted[0]?.booking_reference,
      bookings: inserted,
      subtotal_price: Number(inserted.reduce((sum, booking) => sum + Number(booking.original_price || 0), 0).toFixed(2)),
      discount_amount: Number(inserted.reduce((sum, booking) => sum + Number(booking.discount_amount || 0), 0).toFixed(2)),
      total_price: Number(inserted.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0).toFixed(2))
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return res.status(409).json({ error: 'One or more selected seats were just booked. Please choose another seat.' });
    }
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
userSchemaReady.finally(() => {
  app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
  });
  setInterval(() => {
    releaseExpiredBusMaintenance().catch((err) => console.error('Bus maintenance release failed:', err.message));
  }, 60 * 1000);
});
