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
  return { routes: routes.rows, buses: buses.rows };
}

async function fetchAdminRouteById(routeId) {
  const result = await pool.query(`${ROUTE_SELECT} WHERE r.id = $1`, [routeId]);
  return result.rows[0] || null;
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
      SELECT r.*, b.name as vehicle, b.type as vehicle_type, 
             c.name as company_name, c.theme_color as color, c.theme_bg as bg
      FROM bus_routes r
      JOIN buses b ON r.bus_id = b.id
      LEFT JOIN companies c ON b.company_id = c.id
    `);
    res.json(result.rows);
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
