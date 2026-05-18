import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { config } from "dotenv";
import pool from "./db.js"; // Import the shared PostgreSQL pool
import carRoutes from "./routes/carRoutes.js";

config();

const app = express();
const TOKEN_SECRET = process.env.TOKEN_SECRET || "bookride-dev-secret";

// Middleware
app.use(cors()); // Allow frontend to fetch data
app.use(express.json()); // Allow parsing JSON requests

// Mount car routes
app.use("/api/cars", carRoutes);

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

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createAuthToken(user) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    }),
  );
  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${header}.${payload}.${signature}`;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createUserSession(userId, token) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await pool.query(
    `INSERT INTO user_sessions (user_id, token_hash, session_type, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashToken(token), "access", expiresAt],
  );
}

// 1. Fetch all Bus Routes (For BusSearch.jsx)
app.get("/api/routes", async (req, res) => {
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
    const user = result.rows[0];
    const token = createAuthToken(user);
    await createUserSession(user.id, token);
    res.status(201).json({ token, user });
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
    const token = createAuthToken(user);
    await createUserSession(user.id, token);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(400).json({ error: "Missing token" });
  }

  try {
    const result = await pool.query(
      `UPDATE user_sessions
       SET is_revoked = TRUE
       WHERE token_hash = $1
       RETURNING id`,
      [hashToken(token)],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function validatePassengerInfo(passengerInfo) {
  const firstName = `${passengerInfo?.firstName || ""}`.trim();
  const lastName = `${passengerInfo?.lastName || ""}`.trim();
  const phone = `${passengerInfo?.phone || ""}`.trim();
  const nationalId = `${passengerInfo?.nationalId || ""}`.trim();
  const email = `${passengerInfo?.email || ""}`.trim();

  if (!/^[A-Za-z\s]{2,40}$/.test(firstName)) {
    return { error: "Enter a valid passenger first name" };
  }
  if (!/^[A-Za-z\s]{2,40}$/.test(lastName)) {
    return { error: "Enter a valid passenger last name" };
  }
  if (!/^\+?[0-9\s-]{8,20}$/.test(phone)) {
    return { error: "Enter a valid passenger phone number" };
  }
  if (!/^[A-Za-z0-9-]{5,30}$/.test(nationalId)) {
    return { error: "Enter a valid passenger national ID or passport" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid passenger email" };
  }

  return {
    passenger: {
      firstName,
      lastName,
      phone,
      nationalId,
      email,
    },
  };
}

// 5. Create a Bus Booking
app.post("/api/bookings/bus", async (req, res) => {
  const {
    route_id,
    seat_number,
    user_id,
    total_price,
    payment_method,
    passengerInfo,
    confirmationSummary = {},
  } = req.body;

  try {
    if (!route_id || !seat_number || !total_price || !payment_method) {
      return res.status(400).json({ error: "Route, seats, total, and payment method are required" });
    }

    if (!["aba", "khqr", "cash"].includes(payment_method)) {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    const validation = validatePassengerInfo(passengerInfo);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await pool.query(
      `INSERT INTO bus_bookings (
        user_id,
        route_id,
        seat_number,
        passenger_first_name,
        passenger_last_name,
        passenger_phone,
        passenger_national_id,
        passenger_email,
        total_price,
        payment_method,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        user_id || null,
        route_id,
        Array.isArray(seat_number) ? seat_number.join(", ") : `${seat_number}`,
        validation.passenger.firstName,
        validation.passenger.lastName,
        validation.passenger.phone,
        validation.passenger.nationalId,
        validation.passenger.email,
        total_price,
        payment_method,
        "confirmed",
      ],
    );

    res.status(201).json({
      message: "Booking created successfully",
      booking: result.rows[0],
      confirmation: {
        type: "bus",
        id: result.rows[0].id,
        status: result.rows[0].status,
        paymentMethod: result.rows[0].payment_method,
        total: Number(result.rows[0].total_price || 0),
        summary: {
          Passenger: `${validation.passenger.firstName} ${validation.passenger.lastName}`,
          Contact: validation.passenger.phone,
          Email: validation.passenger.email,
          Route: confirmationSummary.route || `Route #${route_id}`,
          Date: confirmationSummary.date || "Not set",
          Vehicle: confirmationSummary.vehicle || "Bus",
          Seats: result.rows[0].seat_number,
        },
      },
    });
  } catch (err) {
    console.error("Error creating bus booking:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
});
