ALTER TABLE bus_bookings
  ADD COLUMN IF NOT EXISTS passenger_first_name VARCHAR(80);

ALTER TABLE bus_bookings
  ADD COLUMN IF NOT EXISTS passenger_last_name VARCHAR(80);

ALTER TABLE bus_bookings
  ADD COLUMN IF NOT EXISTS passenger_phone VARCHAR(30);

ALTER TABLE bus_bookings
  ADD COLUMN IF NOT EXISTS passenger_national_id VARCHAR(50);

ALTER TABLE bus_bookings
  ADD COLUMN IF NOT EXISTS passenger_email VARCHAR(255);
