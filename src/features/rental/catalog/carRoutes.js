import { Router } from "express";
const router = Router();
 import { query as _query } from "../../../../server/db"; // Adjusted path to reach the actual server db


// GET all cars, with optional type filtering
router.get("/", async (req, res) => {
  try {
    const { type } = req.query; // Get type from query parameters
    let query = "SELECT * FROM rental_cars"; // Use rental_cars table as per database_schema.sql
    let queryParams = [];

    if (type && type !== "All") {
      // If a specific type is requested, filter by it
      query += " WHERE type = $1";
      queryParams = [type];
    }

    const result = await _query(query, queryParams);

    // Format the data to match frontend expectations, including mock photos
    const formattedCars = result.rows.map((car) => ({
      id: car.id, // Assuming 'id' is the primary key in 'rental_cars'
      name: car.name, // 'name' column directly from rental_cars
      type: car.type,
      seats: car.total_seats,
      trans: car.transmission || "Auto",
      price: parseFloat(car.daily_rate),
      status: car.status,
      photos: car.photos || [],
      emoji: car.type === "SUV" ? "ðŸš™" : "ðŸš—",
    }));
    res.json(formattedCars);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
