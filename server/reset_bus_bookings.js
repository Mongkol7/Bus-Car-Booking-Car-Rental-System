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
    // Delete transactions first (due to foreign keys)
    await pool.query("DELETE FROM transactions");
    console.log("Cleared transactions");

    // Delete bus bookings
    await pool.query("DELETE FROM bus_bookings");
    console.log("Cleared bus_bookings");

    // Delete bus seats (to reset availability)
    await pool.query("DELETE FROM bus_seats");
    console.log("Cleared bus_seats");

    // Optionally clear car rentals if testing bus only, but user said "bus seat booking"
    // await pool.query('DELETE FROM car_rentals');
    // console.log('Cleared car_rentals');

    console.log(
      "Bus seat booking data reset. Users, buses, and routes are intact.",
    );
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
})();
