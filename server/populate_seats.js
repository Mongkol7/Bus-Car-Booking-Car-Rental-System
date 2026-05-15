const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

(async () => {
  try {
    const result = await pool.query(`
      INSERT INTO bus_seats (route_id, seat_number, is_booked)
      SELECT route_id, seat_number, TRUE
      FROM bus_bookings
      ON CONFLICT (route_id, seat_number) DO UPDATE SET is_booked = TRUE
    `);
    console.log(
      "Populated bus_seats with",
      result.rowCount,
      "rows from existing bus_bookings",
    );
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
})();
