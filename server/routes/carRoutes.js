import { Router } from "express";
import pool from "../db.js";

const router = Router();
const DRIVER_FEE_PER_DAY = 25;
const VALID_PAYMENT_METHODS = new Set(["aba", "khqr", "cash"]);
const VALID_RENTAL_MODES = new Set(["self_drive", "with_driver"]);

function isValidDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeOnly(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function getRentalDays(pickupDate, returnDate) {
  const start = new Date(`${pickupDate}T00:00:00Z`);
  const end = new Date(`${returnDate}T00:00:00Z`);
  const diffDays = Math.floor((end - start) / 86400000);
  return Number.isFinite(diffDays) ? Math.max(1, diffDays) : 0;
}

function normalizeTime(value) {
  return value ? `${value}`.slice(0, 5) : "";
}

function getRentalDateLabel(rental, dateValue, timeValue) {
  if (rental.rental_mode === "with_driver") return dateValue;
  const time = normalizeTime(timeValue);
  return time ? `${dateValue} ${time}` : dateValue;
}

function mapRental(row) {
  const pickupDate = row.pickup_date instanceof Date
    ? row.pickup_date.toISOString().slice(0, 10)
    : row.pickup_date;
  const returnDate = row.return_date instanceof Date
    ? row.return_date.toISOString().slice(0, 10)
    : row.return_date;

  return {
    id: row.id,
    user_id: row.user_id,
    car_id: row.car_id,
    pickup_date: pickupDate,
    return_date: returnDate,
    pickup_time: normalizeTime(row.pickup_time),
    return_time: normalizeTime(row.return_time),
    driver_name: row.driver_name,
    driver_license: row.driver_license,
    rental_mode: row.rental_mode,
    phone_number: row.phone_number,
    driver_fee_per_day: Number(row.driver_fee_per_day || 0),
    total_price: Number(row.total_price || 0),
    payment_method: row.payment_method,
    status: row.status,
    booked_at: row.booked_at,
    car: {
      id: row.car_id,
      name: row.car_name,
      type: row.car_type,
      location: row.car_location,
      plate_number: row.plate_number,
      daily_rate: Number(row.daily_rate || 0),
      status: row.car_status,
      photos: row.photos || [],
    },
  };
}

function buildRentalConfirmation(rental) {
  const usesQr = rental.payment_method === "aba" || rental.payment_method === "khqr";
  const total = Number(rental.total_price || 0);

  return {
    type: "rental",
    id: rental.id,
    status: rental.status,
    paymentMethod: rental.payment_method,
    total,
    summary: {
      Car: rental.car?.name || "Rental car",
      Plate: rental.car?.plate_number || "N/A",
      Pickup: getRentalDateLabel(rental, rental.pickup_date, rental.pickup_time),
      Return: getRentalDateLabel(rental, rental.return_date, rental.return_time),
      "Rental days": getRentalDays(rental.pickup_date, rental.return_date),
      Mode: rental.rental_mode === "with_driver" ? "With driver" : "Self-drive",
      [usesQr ? "Deposit paid" : "Payment method"]: usesQr ? total * 0.2 : "Cash",
      [usesQr ? "Remaining on pickup" : "Pay on pickup"]: usesQr ? total * 0.8 : total,
    },
  };
}

router.get("/locations", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT location
      FROM rental_cars
      WHERE location IS NOT NULL AND TRIM(location) <> ''
      ORDER BY location
    `);

    res.json(result.rows.map((row) => row.location));
  } catch (err) {
    console.error("Error fetching car locations:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { type, location, pickupDate, returnDate, status, name } = req.query;
    const conditions = [];
    const params = [];
    let displayStatusSql = "rental_cars.status";

    if (pickupDate && returnDate) {
      params.push(pickupDate, returnDate);
      const pickupDateParam = params.length - 1;
      const returnDateParam = params.length;

      displayStatusSql = `
        CASE
          WHEN rental_cars.status = 'available'
            AND EXISTS (
              SELECT 1
              FROM car_rentals cr
              WHERE cr.car_id = rental_cars.id
                AND cr.status NOT IN ('cancelled', 'returned')
                AND cr.pickup_date <= $${returnDateParam}
                AND cr.return_date >= $${pickupDateParam}
            )
          THEN 'rented'::vehicle_status
          ELSE rental_cars.status
        END
      `;
    }

    if (type && type !== "All") {
      params.push(type);
      conditions.push(`rental_cars.type = $${params.length}`);
    }

    if (location && location !== "All") {
      params.push(location);
      conditions.push(`rental_cars.location = $${params.length}`);
    }

    if (`${status}`.toLowerCase() === "available") {
      params.push("available");
      conditions.push(`(${displayStatusSql})::text = $${params.length}`);
    }

    if (name && name !== "All") {
      params.push(name);
      conditions.push(`rental_cars.name = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `
      SELECT
        id,
        owner_id,
        name,
        type,
        location,
        plate_number,
        total_seats,
        transmission,
        daily_rate,
        ${displayStatusSql} AS status,
        photos,
        created_at
      FROM rental_cars
      ${whereClause}
      ORDER BY id
      `,
      params,
    );

    res.json(
      result.rows.map((car) => ({
        id: car.id,
        owner_id: car.owner_id,
        name: car.name,
        type: car.type,
        location: car.location,
        plate_number: car.plate_number,
        total_seats: car.total_seats,
        transmission: car.transmission || "Auto",
        daily_rate: Number(car.daily_rate),
        status: car.status,
        photos: car.photos || [],
        created_at: car.created_at,
      })),
    );
  } catch (err) {
    console.error("Error fetching cars:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const { userId } = req.query;
    const params = [];
    const conditions = [];

    if (userId && userId !== "null") {
      params.push(userId);
      conditions.push(`cr.user_id = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `
      SELECT
        cr.*,
        rc.name AS car_name,
        rc.type AS car_type,
        rc.location AS car_location,
        rc.plate_number,
        rc.daily_rate,
        rc.status AS car_status,
        rc.photos
      FROM car_rentals cr
      JOIN rental_cars rc ON rc.id = cr.car_id
      ${whereClause}
      ORDER BY cr.booked_at DESC, cr.id DESC
      `,
      params,
    );

    res.json(result.rows.map(mapRental));
  } catch (err) {
    console.error("Error fetching rental bookings:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

router.patch("/bookings/:id/cancel", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User is required to cancel a rental" });
    }

    await client.query("BEGIN");

    const rentalResult = await client.query(
      `
      SELECT id, user_id, car_id, status
      FROM car_rentals
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (!rentalResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Rental booking not found" });
    }

    const rental = rentalResult.rows[0];

    if (`${rental.user_id}` !== `${userId}`) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "You can only cancel your own rental bookings" });
    }

    if (rental.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Only pending rentals can be cancelled" });
    }

    await client.query(
      `
      UPDATE car_rentals
      SET status = 'cancelled'
      WHERE id = $1
      `,
      [id],
    );

    await client.query(
      `
      UPDATE rental_cars
      SET status = 'available'
      WHERE id = $1
      `,
      [rental.car_id],
    );

    const updatedResult = await client.query(
      `
      SELECT
        cr.*,
        rc.name AS car_name,
        rc.type AS car_type,
        rc.location AS car_location,
        rc.plate_number,
        rc.daily_rate,
        rc.status AS car_status,
        rc.photos
      FROM car_rentals cr
      JOIN rental_cars rc ON rc.id = cr.car_id
      WHERE cr.id = $1
      `,
      [id],
    );

    await client.query("COMMIT");

    res.json(mapRental(updatedResult.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error cancelling rental booking:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

router.post("/bookings", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      carId,
      pickupDate,
      pickupTime,
      returnDate,
      returnTime,
      fullName,
      licenseNumber,
      rentalMode = "self_drive",
      paymentMethod = "aba",
      userId,
      phoneNumber,
    } = req.body;

    if (!carId || !pickupDate || !returnDate || !fullName || !phoneNumber || !paymentMethod) {
      return res.status(400).json({ error: "All required fields must be provided" });
    }

    if (!VALID_RENTAL_MODES.has(rentalMode)) {
      return res.status(400).json({ error: "Invalid rental mode" });
    }

    if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    if (!isValidDateOnly(pickupDate) || !isValidDateOnly(returnDate)) {
      return res.status(400).json({ error: "Pickup and return dates must use YYYY-MM-DD format" });
    }

    const normalizedPickupTime = rentalMode === "self_drive"
      ? normalizeTime(pickupTime)
      : normalizeTime(pickupTime) || "09:00";
    const normalizedReturnTime = rentalMode === "self_drive"
      ? normalizeTime(returnTime)
      : normalizeTime(returnTime) || "18:00";

    if (!isValidTimeOnly(normalizedPickupTime) || !isValidTimeOnly(normalizedReturnTime)) {
      return res.status(400).json({ error: "Pickup and return times must use HH:MM format" });
    }

    if (returnDate < pickupDate) {
      return res.status(400).json({ error: "Return date must be on or after pickup date" });
    }

    if (
      rentalMode === "self_drive" &&
      returnDate === pickupDate &&
      normalizedReturnTime <= normalizedPickupTime
    ) {
      return res.status(400).json({ error: "Return time must be after pickup time for same-day rentals" });
    }

    const normalizedName = `${fullName}`.trim();
    const normalizedPhone = `${phoneNumber}`.trim();
    const normalizedLicense = `${licenseNumber || ""}`.trim();

    if (normalizedName.length < 3 || !/^[a-zA-Z\s]+$/.test(normalizedName)) {
      return res.status(400).json({ error: "Enter a valid full name" });
    }

    if (!/^\+?[0-9\s-]{8,20}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: "Enter a valid phone number" });
    }

    if (rentalMode === "self_drive" && !normalizedLicense) {
      return res.status(400).json({ error: "Driver license is required for self-drive rentals" });
    }

    if (
      rentalMode === "self_drive" &&
      (!/^[A-Za-z0-9-]+$/.test(normalizedLicense) || normalizedLicense.length < 5)
    ) {
      return res.status(400).json({ error: "Enter a valid driver license number" });
    }

    await client.query("BEGIN");

    const carResult = await client.query(
      `
      SELECT id, name, type, location, plate_number, daily_rate, status, photos
      FROM rental_cars
      WHERE id = $1
      FOR UPDATE
      `,
      [carId],
    );

    if (!carResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Car not found" });
    }

    if (carResult.rows[0].status !== "available") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Car is not available" });
    }

    const overlapResult = await client.query(
      `
      SELECT 1
      FROM car_rentals
      WHERE car_id = $1
        AND status NOT IN ('cancelled', 'returned')
        AND pickup_date <= $3
        AND return_date >= $2
      LIMIT 1
      `,
      [carId, pickupDate, returnDate],
    );

    if (overlapResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Car is already booked for these dates" });
    }

    const days = getRentalDays(pickupDate, returnDate);
    const dailyRate = Number(carResult.rows[0].daily_rate);
    const driverFeePerDay = rentalMode === "with_driver" ? DRIVER_FEE_PER_DAY : 0;
    const totalPrice = (dailyRate + driverFeePerDay) * days;

    const result = await client.query(
      `INSERT INTO car_rentals (
        user_id,
        car_id,
        pickup_date,
        return_date,
        pickup_time,
        return_time,
        driver_name,
        driver_license,
        rental_mode,
        phone_number,
        driver_fee_per_day,
        total_price,
        payment_method,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        userId || null,
        carId,
        pickupDate,
        returnDate,
        normalizedPickupTime,
        normalizedReturnTime,
        normalizedName,
        rentalMode === "self_drive" ? normalizedLicense : "BOOKRIDE-DRIVER",
        rentalMode,
        normalizedPhone,
        driverFeePerDay,
        totalPrice,
        paymentMethod,
        "pending",
      ],
    );

    await client.query(
      `
      UPDATE rental_cars
      SET status = 'rented'
      WHERE id = $1
      `,
      [carId],
    );

    await client.query("COMMIT");

    const rentalResponse = {
      ...result.rows[0],
      pickup_time: normalizeTime(result.rows[0].pickup_time),
      return_time: normalizeTime(result.rows[0].return_time),
      total_price: Number(result.rows[0].total_price),
      driver_fee_per_day: Number(result.rows[0].driver_fee_per_day || 0),
      car: {
        id: carResult.rows[0].id,
        name: carResult.rows[0].name,
        type: carResult.rows[0].type,
        location: carResult.rows[0].location,
        plate_number: carResult.rows[0].plate_number,
        daily_rate: Number(carResult.rows[0].daily_rate || 0),
        status: "rented",
        photos: carResult.rows[0].photos || [],
      },
    };

    res.status(201).json({
      ...rentalResponse,
      confirmation: buildRentalConfirmation(rentalResponse),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error creating booking:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

export default router;
