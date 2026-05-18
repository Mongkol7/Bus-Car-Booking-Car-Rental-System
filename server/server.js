const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'bookride-dev-secret';

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

async function createUserSession(userId, token) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await pool.query(
    `INSERT INTO user_sessions (user_id, token_hash, session_type, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashToken(token), 'access', expiresAt]
  );
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
    (COALESCE(bb.bus_bookings_count, 0) + COALESCE(cr.car_rentals_count, 0))::INT AS total_activity_count,
    COALESCE(bb.bus_total, 0) + COALESCE(cr.rental_total, 0) AS total_spent,
    GREATEST(bb.last_bus_booking_at, cr.last_car_rental_at) AS last_activity_at
  FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS bus_bookings_count,
      COALESCE(SUM(total_price), 0) AS bus_total,
      MAX(created_at) AS last_bus_booking_at
    FROM bus_bookings
    GROUP BY user_id
  ) bb ON bb.user_id = u.id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS car_rentals_count,
      COALESCE(SUM(total_price), 0) AS rental_total,
      MAX(booked_at) AS last_car_rental_at
    FROM car_rentals
    GROUP BY user_id
  ) cr ON cr.user_id = u.id
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
const RENTAL_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'returned'];
const PAYMENT_METHODS = ['aba', 'khqr', 'cash'];
const VEHICLE_STATUSES = ['available', 'rented', 'maintenance'];
const SEAT_MAP_CELL_TYPES = ['seat', 'empty', 'door', 'bathroom', 'driver', 'note'];

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
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

function formatDateKey(date) {
  if (date instanceof Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return String(date).slice(0, 10);
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
       cr.driver_name,
       cr.driver_license,
       cr.total_price,
       cr.payment_method,
       cr.status,
       cr.booked_at,
       CONCAT(u.first_name, ' ', u.last_name) AS user_name,
       u.email,
       u.phone,
       rc.name AS car_name,
       rc.type AS car_type,
       rc.plate_number
     FROM car_rentals cr
     JOIN users u ON u.id = cr.user_id
     JOIN rental_cars rc ON rc.id = cr.car_id
     WHERE cr.id = $1`,
    [rentalId]
  );
  return result.rows[0] || null;
}

function formatUserRow(row) {
  const lastActivity = row.last_activity_at ? new Date(row.last_activity_at) : null;
  const isRecent =
    lastActivity &&
    !Number.isNaN(lastActivity.getTime()) &&
    Date.now() - lastActivity.getTime() <= 1000 * 60 * 60 * 24 * 14;
  const status = !row.is_active || (lastActivity && !isRecent) ? 'Inactive' : 'Active';

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
    r.created_at,
    b.name AS bus_name,
    b.type AS bus_type,
    b.plate_number,
    b.total_seats,
    b.status AS bus_status,
    c.id AS company_id,
    c.name AS company_name,
    c.theme_color AS color,
    c.theme_bg AS bg
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

  const departureLocal = departureRaw.replace('T', ' ') + (departureRaw.length === 16 ? ':00' : '');
  const arrivalLocal = arrivalRaw.replace('T', ' ') + (arrivalRaw.length === 16 ? ':00' : '');

  return {
    value: {
      bus_id: busId,
      origin,
      destination,
      departure_time: departureLocal,
      arrival_time: arrivalLocal,
      price: price.toFixed(2)
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

async function fetchAdminRoutes() {
  const routes = await pool.query(`${ROUTE_SELECT} ORDER BY r.departure_time ASC`);
  const buses = await pool.query(BUS_SELECT);
  const destinations = await pool.query(DESTINATION_SELECT);
  return { routes: routes.rows, buses: buses.rows, destinations: destinations.rows };
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
         COUNT(cr.id)::INT AS rental_count
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
       COUNT(cr.id)::INT AS rental_count
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

  if (!companyId || !name || !type || !plateNumber || !status) {
    return { error: 'Company, name, type, plate number, seats, and status are required.' };
  }
  if (!Number.isInteger(totalSeats) || totalSeats <= 0) {
    return { error: 'Total seats must be a positive whole number.' };
  }
  if (!VEHICLE_STATUSES.includes(status)) {
    return { error: 'Invalid vehicle status.' };
  }

  return {
    value: {
      company_id: companyId,
      name,
      type,
      plate_number: plateNumber,
      total_seats: totalSeats,
      status
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

// 1. Fetch all Rental Cars
app.get('/api/cars', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM rental_cars
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Fetch all Bus Routes (For BusSearch.jsx)
app.get('/api/routes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.*,
        b.name AS vehicle,
        b.type AS vehicle_type,
        b.total_seats,
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
      GROUP BY r.id, b.id, t.id, c.id
      ORDER BY r.departure_time ASC
    `);
    res.json(result.rows.map((row) => ({
      ...row,
      seat_map: resolveSeatMap(row)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(400).json({ error: err.message });
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
    res.status(400).json({ error: err.message });
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
      `INSERT INTO buses (company_id, name, type, plate_number, total_seats, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [payload.company_id, payload.name, payload.type, payload.plate_number, payload.total_seats, payload.status]
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

    await pool.query(
      `UPDATE buses
       SET company_id = $1,
           name = $2,
           type = $3,
           plate_number = $4,
           total_seats = $5,
           status = $6
       WHERE id = $7`,
      [payload.company_id, payload.name, payload.type, payload.plate_number, payload.total_seats, payload.status, busId]
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
      `INSERT INTO bus_routes (bus_id, origin, destination, departure_time, arrival_time, price)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        payload.bus_id,
        payload.origin,
        payload.destination,
        payload.departure_time,
        payload.arrival_time,
        payload.price
      ]
    );

    const route = await fetchAdminRouteById(insertResult.rows[0].id);
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
        payload.bus_id,
        payload.origin,
        payload.destination,
        payload.departure_time,
        payload.arrival_time,
        payload.price,
        routeId
      ]
    );

    const route = await fetchAdminRouteById(routeId);
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/routes/:id', async (req, res) => {
  const routeId = Number(req.params.id);
  if (!routeId) {
    return res.status(400).json({ error: 'Invalid route id.' });
  }

  try {
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
         bb.seat_number,
         bb.total_price,
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
         c.name AS company_name,
         c.theme_color AS color
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

app.put('/api/admin/bookings/:id', async (req, res) => {
  const bookingId = Number(req.params.id);
  const seatNumber = normalizeText(req.body.seat_number);
  const totalPrice = normalizeMoney(req.body.total_price);
  const paymentMethod = normalizeText(req.body.payment_method).toLowerCase();
  const status = normalizeText(req.body.status).toLowerCase();

  if (!bookingId) return res.status(400).json({ error: 'Invalid booking id.' });
  if (!seatNumber) return res.status(400).json({ error: 'Seat number is required.' });
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) return res.status(400).json({ error: 'Total price must be greater than zero.' });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method.' });
  if (!BOOKING_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid booking status.' });

  try {
    const existing = await fetchAdminBookingById(bookingId);
    if (!existing) return res.status(404).json({ error: 'Booking not found.' });

    await pool.query(
      `UPDATE bus_bookings
       SET seat_number = $1,
           total_price = $2,
           payment_method = $3,
           status = $4
       WHERE id = $5`,
      [seatNumber, totalPrice.toFixed(2), paymentMethod, status, bookingId]
    );

    res.json(await fetchAdminBookingById(bookingId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/bookings/:id', async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!bookingId) return res.status(400).json({ error: 'Invalid booking id.' });

  try {
    const result = await pool.query(`DELETE FROM bus_bookings WHERE id = $1 RETURNING id`, [bookingId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ id: bookingId, message: 'Booking deleted successfully.' });
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
         cr.driver_name,
         cr.driver_license,
         cr.total_price,
         cr.payment_method,
         cr.status,
         cr.booked_at,
         CONCAT(u.first_name, ' ', u.last_name) AS user_name,
         u.email,
         u.phone,
         rc.name AS car_name,
         rc.type AS car_type,
         rc.plate_number
       FROM car_rentals cr
       JOIN users u ON u.id = cr.user_id
       JOIN rental_cars rc ON rc.id = cr.car_id
       ORDER BY cr.booked_at DESC, cr.id DESC`
    );
    res.json({ rentals: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/rentals/:id', async (req, res) => {
  const rentalId = Number(req.params.id);
  const pickupDate = normalizeText(req.body.pickup_date);
  const returnDate = normalizeText(req.body.return_date);
  const driverName = normalizeText(req.body.driver_name);
  const driverLicense = normalizeText(req.body.driver_license);
  const totalPrice = normalizeMoney(req.body.total_price);
  const paymentMethod = normalizeText(req.body.payment_method).toLowerCase();
  const status = normalizeText(req.body.status).toLowerCase();
  const pickup = new Date(`${pickupDate}T00:00:00`);
  const dropoff = new Date(`${returnDate}T00:00:00`);

  if (!rentalId) return res.status(400).json({ error: 'Invalid rental id.' });
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(dropoff.getTime())) return res.status(400).json({ error: 'Pickup and return dates must be valid.' });
  if (dropoff <= pickup) return res.status(400).json({ error: 'Return date must be after pickup date.' });
  if (!driverName || !driverLicense) return res.status(400).json({ error: 'Driver name and license are required.' });
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) return res.status(400).json({ error: 'Total price must be greater than zero.' });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method.' });
  if (!RENTAL_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid rental status.' });

  try {
    const existing = await fetchAdminRentalById(rentalId);
    if (!existing) return res.status(404).json({ error: 'Rental not found.' });

    await pool.query(
      `UPDATE car_rentals
       SET pickup_date = $1,
           return_date = $2,
           driver_name = $3,
           driver_license = $4,
           total_price = $5,
           payment_method = $6,
           status = $7
       WHERE id = $8`,
      [pickupDate, returnDate, driverName, driverLicense, totalPrice.toFixed(2), paymentMethod, status, rentalId]
    );

    res.json(await fetchAdminRentalById(rentalId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/rentals/:id', async (req, res) => {
  const rentalId = Number(req.params.id);
  if (!rentalId) return res.status(400).json({ error: 'Invalid rental id.' });

  try {
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

  try {
    const [
      bookingRevenue,
      rentalRevenue,
      bookingDaily,
      rentalDaily,
      topRoutes,
      topCars,
      topCompanies,
      topCustomers,
      paymentMix
    ] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_price), 0) AS revenue, COUNT(*)::INT AS count FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2`, params),
      pool.query(`SELECT COALESCE(SUM(total_price), 0) AS revenue, COUNT(*)::INT AS count FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2`, params),
      pool.query(`SELECT created_at::DATE AS day, COALESCE(SUM(total_price), 0) AS revenue FROM bus_bookings WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2 GROUP BY created_at::DATE ORDER BY day`, params),
      pool.query(`SELECT booked_at::DATE AS day, COALESCE(SUM(total_price), 0) AS revenue FROM car_rentals WHERE status <> 'cancelled' AND booked_at >= $1 AND booked_at < $2 GROUP BY booked_at::DATE ORDER BY day`, params),
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
      )
    ]);

    const bookingRevenueValue = Number(bookingRevenue.rows[0].revenue || 0);
    const rentalRevenueValue = Number(rentalRevenue.rows[0].revenue || 0);
    const transactionCount = Number(bookingRevenue.rows[0].count || 0) + Number(rentalRevenue.rows[0].count || 0);

    res.json({
      month: monthRange.key,
      metrics: {
        total_revenue: bookingRevenueValue + rentalRevenueValue,
        booking_revenue: bookingRevenueValue,
        rental_revenue: rentalRevenueValue,
        transactions: transactionCount
      },
      daily: buildDailySeries(monthRange, bookingDaily.rows, rentalDaily.rows),
      top_routes: topRoutes.rows,
      top_cars: topCars.rows,
      top_companies: topCompanies.rows,
      top_customers: topCustomers.rows,
      payment_mix: paymentMix.rows
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

// 5. Create a Bus Booking
app.post('/api/bookings/bus', async (req, res) => {
  const { user_id, route_id, seat_number, total_price, payment_method } = req.body;
  try {
    // Note: This requires inserting into bus_seats and bus_bookings
    res.status(201).json({ message: 'Booking created successfully', route_id, seat_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
userSchemaReady.finally(() => {
  app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
  });
});
