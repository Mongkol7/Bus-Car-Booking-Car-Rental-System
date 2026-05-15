const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();

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
pool
  .connect()
  .then(() =>
    console.log("✅ Connected to PostgreSQL Database:", process.env.DB_NAME),
  )
  .catch((err) => console.error("❌ Connection Error:", err.message));

// ==========================================
// API ROUTES
// ==========================================

// 1. Fetch all Rental Cars
app.get("/api/cars", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM rental_cars
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Fetch Bus Routes (For BusSearch.jsx)
// No query params → all routes. With origin, destination, date (YYYY-MM-DD) → filtered in DB.
app.get("/api/routes", async (req, res) => {
  try {
    const { origin, destination, date } = req.query;
    const hasFilter = origin && destination && date;
    let sql = `
      SELECT r.*, b.name as vehicle, b.type as vehicle_type, 
             c.name as company_name, c.theme_color as color, c.theme_bg as bg
      FROM bus_routes r
      JOIN buses b ON r.bus_id = b.id
      LEFT JOIN companies c ON b.company_id = c.id
    `;
    const params = [];
    if (hasFilter) {
      sql += ` WHERE r.origin = $1 AND r.destination = $2 AND (r.departure_time::date) = ($3::date)`;
      params.push(origin, destination, date);
    }
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Register a User
app.post("/api/auth/register", async (req, res) => {
  const { first_name, last_name, email, phone, password, national_id } =
    req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, national_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, first_name, last_name, email, role`,
      [first_name, last_name, email, phone, password_hash, national_id],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Login User
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, role, password_hash FROM users WHERE email = $1`,
      [email],
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    delete user.password_hash;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Create a Bus Booking
app.post("/api/bookings/bus", async (req, res) => {
  const { user_id, route_id, seat_numbers, total_price, payment_method } =
    req.body;
  if (
    !user_id ||
    !route_id ||
    !Array.isArray(seat_numbers) ||
    seat_numbers.length === 0
  ) {
    return res.status(400).json({ error: "Missing required booking details" });
  }

  try {
    const existing = await pool.query(
      `SELECT seat_number FROM bus_bookings WHERE route_id = $1 AND seat_number = ANY($2)`,
      [route_id, seat_numbers],
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "Some seats are already booked",
        taken: existing.rows.map((row) => row.seat_number),
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // First, upsert bus_seats to mark as booked
      const seatValues = seat_numbers
        .map((seat, idx) => {
          const base = idx * 3;
          return `($${base + 1}, $${base + 2}, $${base + 3})`;
        })
        .join(", ");
      const seatParams = seat_numbers.flatMap((seat) => [route_id, seat, true]);

      await client.query(
        `INSERT INTO bus_seats (route_id, seat_number, is_booked)
         VALUES ${seatValues}
         ON CONFLICT (route_id, seat_number) DO UPDATE SET is_booked = TRUE`,
        seatParams,
      );

      // Then, insert bus_bookings
      const values = [];
      const placeholders = seat_numbers
        .map((seat, idx) => {
          const base = idx * 6;
          values.push(
            user_id,
            route_id,
            seat,
            total_price || 0,
            payment_method || "cash",
            "confirmed",
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
        })
        .join(", ");

      const result = await client.query(
        `INSERT INTO bus_bookings (user_id, route_id, seat_number, total_price, payment_method, status)
         VALUES ${placeholders}
         RETURNING *`,
        values,
      );

      // Insert transactions
      const transactionValues = result.rows
        .map((booking, idx) => {
          const base = idx * 5;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
        })
        .join(", ");
      const transactionParams = result.rows.flatMap((booking) => [
        booking.user_id,
        booking.id,
        booking.total_price,
        booking.payment_method,
        "success",
      ]);

      if (transactionParams.length > 0) {
        await client.query(
          `INSERT INTO transactions (user_id, bus_booking_id, amount, payment_method, status)
           VALUES ${transactionValues}`,
          transactionParams,
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ bookings: result.rows });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Fetch booked seats for a route
app.get("/api/routes/:routeId/booked-seats", async (req, res) => {
  const { routeId } = req.params;
  try {
    const result = await pool.query(
      `SELECT seat_number FROM bus_bookings WHERE route_id = $1`,
      [routeId],
    );
    res.json({ seat_numbers: result.rows.map((row) => row.seat_number) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Fetch user bookings and rentals
app.get("/api/bookings/user", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id" });
  }

  try {
    const busResult = await pool.query(
      `SELECT b.id, b.seat_number, b.total_price, b.payment_method, b.status, b.created_at,
              br.origin, br.destination, br.departure_time, br.arrival_time,
              bu.name AS bus_name, bu.type AS bus_type, c.name AS company_name
       FROM bus_bookings b
       JOIN bus_routes br ON b.route_id = br.id
       JOIN buses bu ON br.bus_id = bu.id
       LEFT JOIN companies c ON bu.company_id = c.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [user_id],
    );

    const rentalResult = await pool.query(
      `SELECT cr.id, cr.pickup_date, cr.return_date, cr.total_price, cr.status, cr.booked_at,
              rc.name AS car_name, rc.type AS car_type, rc.plate_number
       FROM car_rentals cr
       JOIN rental_cars rc ON cr.car_id = rc.id
       WHERE cr.user_id = $1
       ORDER BY cr.booked_at DESC`,
      [user_id],
    );

    res.json({
      trips: busResult.rows,
      rentals: rentalResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
});
