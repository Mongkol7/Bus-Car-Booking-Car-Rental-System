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
    // Trigger to set is_booked = FALSE when deleting a bus_booking
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_bus_seats_on_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE bus_seats
        SET is_booked = FALSE
        WHERE route_id = OLD.route_id AND seat_number = OLD.seat_number;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      CREATE TRIGGER trigger_bus_seats_cleanup
      AFTER DELETE ON bus_bookings
      FOR EACH ROW EXECUTE FUNCTION update_bus_seats_on_delete();
    `);

    console.log("Added trigger to update bus_seats when deleting bus_bookings");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
})();
