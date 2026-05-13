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
  const departure = new Date(body.departure_time);
  const arrival = new Date(body.arrival_time);
  const price = Number(body.price);

  if (!busId || !origin || !destination || !body.departure_time || !body.arrival_time || Number.isNaN(price)) {
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

  return {
    value: {
      bus_id: busId,
      origin,
      destination,
      departure_time: departure.toISOString(),
      arrival_time: arrival.toISOString(),
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

    const overlaps = await hasOverlappingSchedule(
      payload.bus_id,
      payload.departure_time,
      payload.arrival_time,
      routeId
    );
    if (overlaps) {
      return res.status(409).json({ error: 'This bus already has a trip during that time.' });
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

// 3. Register a User
app.post('/api/auth/register', async (req, res) => {
  const { first_name, last_name, email, phone, password, national_id } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, national_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, first_name, last_name, email, role`,
      [first_name, last_name, email, phone, password_hash, national_id]
    );
    const user = result.rows[0];
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
      `SELECT id, first_name, last_name, email, role, password_hash FROM users WHERE email = $1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
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
app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
});
