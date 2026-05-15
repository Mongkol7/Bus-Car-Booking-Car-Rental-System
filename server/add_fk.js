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
    await pool.query(`
      ALTER TABLE bus_bookings
      ADD CONSTRAINT fk_bus_bookings_seat
      FOREIGN KEY (route_id, seat_number) REFERENCES bus_seats (route_id, seat_number) ON DELETE CASCADE
    `);
    console.log("Added foreign key linking bus_bookings to bus_seats");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
})();
