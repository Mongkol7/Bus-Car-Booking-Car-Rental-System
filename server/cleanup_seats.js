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
      UPDATE bus_seats
      SET is_booked = FALSE
      WHERE (route_id, seat_number) NOT IN (
        SELECT route_id, seat_number FROM bus_bookings
      )
    `);
    console.log("Cleaned up bus_seats, updated", result.rowCount, "rows");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
})();
