-- ==========================================
-- BUS & CAR BOOKING SYSTEM: SEED DATA
-- Run this AFTER executing database_schema.sql
-- ==========================================

-- 1. SEED ROLES
INSERT INTO roles (name, label, description, is_system) VALUES
('user', 'User', 'Default customer account role', TRUE),
('admin', 'Admin', 'System administrator role', TRUE)
ON CONFLICT (name) DO UPDATE SET
label = EXCLUDED.label,
description = EXCLUDED.description,
is_system = EXCLUDED.is_system;

-- 2. SEED COMPANIES
INSERT INTO companies (name, theme_color, theme_bg) VALUES
('Mekong Express', '#22c55e', 'rgba(34,197,94,0.16)'),
('Sorya Bus', '#f59e0b', 'rgba(245,158,11,0.16)'),
('Capitol Tours', '#60a5fa', 'rgba(96,165,250,0.16)'),
('Giant Ibis', '#a855f7', 'rgba(168,85,247,0.16)'),
('Larryta Express', '#38bdf8', 'rgba(56,189,248,0.16)'),
('VET Air Bus', '#f87171', 'rgba(248,113,113,0.16)')
ON CONFLICT (name) DO NOTHING;

-- 3. SEED BUS FLEET
INSERT INTO buses (company_id, name, type, plate_number, total_seats, status) VALUES
((SELECT id FROM companies WHERE name = 'Mekong Express'), 'Mekong Express Bus', 'VIP Sleeper', '2A-1234', 40, 'available'),
((SELECT id FROM companies WHERE name = 'Sorya Bus'), 'Sorya Express Coach', 'Express Coach', '2B-5678', 35, 'available'),
((SELECT id FROM companies WHERE name = 'Giant Ibis'), 'Giant Ibis Luxury', 'Luxury Coach', '4D-3456', 38, 'available'),
((SELECT id FROM companies WHERE name = 'Larryta Express'), 'Larryta Mini', 'Mini Bus', '5E-7788', 25, 'available'),
((SELECT id FROM companies WHERE name = 'VET Air Bus'), 'VET Night Bus', 'Night Sleeper', '6F-4455', 32, 'available')
ON CONFLICT (plate_number) DO NOTHING;

-- 4. SEED CAR RENTALS
INSERT INTO rental_cars (name, type, plate_number, total_seats, transmission, daily_rate, status, photos) VALUES
('Toyota Camry', 'Sedan', 'PP-1122', 5, 'Auto', 45.00, 'available', ARRAY['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fd?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1550130983-4a11ccf2bbbb?auto=format&fit=crop&w=800&q=80']),
('Honda CRV', 'SUV', 'PP-3344', 7, 'Auto', 65.00, 'rented', ARRAY['https://images.unsplash.com/photo-1568844293986-8d0400ba4715?auto=format&fit=crop&w=800&q=80']),
('Ford Ranger', 'Pickup', 'PP-5566', 5, 'Manual', 55.00, 'available', ARRAY['https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=800&q=80']),
('Lexus RX330', 'Luxury SUV', 'PP-7788', 5, 'Auto', 85.00, 'maintenance', ARRAY['https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80']),
('Toyota Prius', 'Hybrid Sedan', 'PP-9900', 5, 'Auto', 40.00, 'available', ARRAY['https://images.unsplash.com/photo-1550130983-4a11ccf2bbbb?auto=format&fit=crop&w=800&q=80'])
ON CONFLICT (plate_number) DO NOTHING;

-- 5. SEED BUS ROUTES
-- Note: Dates are generated dynamically but for seeding we use fixed dates
INSERT INTO destinations (name) VALUES
('Phnom Penh'),
('Siem Reap'),
('Battambang'),
('Sihanoukville'),
('Kampot'),
('Kep')
ON CONFLICT (name) DO NOTHING;

INSERT INTO bus_routes (bus_id, origin, destination, departure_time, arrival_time, price) VALUES
((SELECT id FROM buses WHERE plate_number = '2A-1234'), 'Phnom Penh', 'Siem Reap', CURRENT_DATE + TIME '06:00:00', CURRENT_DATE + TIME '11:00:00', 12.00),
((SELECT id FROM buses WHERE plate_number = '2B-5678'), 'Phnom Penh', 'Battambang', CURRENT_DATE + TIME '09:00:00', CURRENT_DATE + TIME '14:00:00', 12.00),
((SELECT id FROM buses WHERE plate_number = '4D-3456'), 'Phnom Penh', 'Sihanoukville', CURRENT_DATE + TIME '13:00:00', CURRENT_DATE + TIME '18:00:00', 15.00),
((SELECT id FROM buses WHERE plate_number = '5E-7788'), 'Phnom Penh', 'Kampot', CURRENT_DATE + TIME '15:30:00', CURRENT_DATE + TIME '20:30:00', 13.00),
((SELECT id FROM buses WHERE plate_number = '6F-4455'), 'Siem Reap', 'Phnom Penh', CURRENT_DATE + TIME '22:00:00', CURRENT_DATE + INTERVAL '1 day' + TIME '04:00:00', 16.00);

-- 6. SEED ADMIN USER
-- Password hash is '123' hashed with bcrypt
INSERT INTO users (first_name, last_name, email, phone, password_hash, role, role_id) VALUES
('System', 'Admin', 'admin@bookride.com', '+85512345678', '$2b$10$QIQ9x2djZ2D9TaOsRoJn5.n/CZAhzjA2f0VhdMkmdzzcLSoWw3vQG', 'admin', (SELECT id FROM roles WHERE name = 'admin'))
ON CONFLICT (email) DO NOTHING;

UPDATE users
SET password_hash = '$2b$10$QIQ9x2djZ2D9TaOsRoJn5.n/CZAhzjA2f0VhdMkmdzzcLSoWw3vQG',
    role = 'admin',
    role_id = (SELECT id FROM roles WHERE name = 'admin')
WHERE email = 'admin@bookride.com';


INSERT INTO bus_bookings (user_id, route_id, seat_number, total_price, payment_method, status)
VALUES (1, 1, 'A1', 12.50, 'aba', 'confirmed');


INSERT INTO car_rentals (
  user_id, car_id, pickup_date, return_date,
  driver_name, driver_license, total_price, payment_method, status
)
VALUES (
  1, 1, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days',
  'Test Driver', 'DL-12345', 90.00, 'khqr', 'confirmed'
);

INSERT INTO bus_routes (bus_id, origin, destination, departure_time, arrival_time, price) VALUES
((SELECT id FROM buses WHERE plate_number = '2A-1234'), 'Phnom Penh', 'Siem Reap', CURRENT_DATE + TIME '06:00:00', CURRENT_DATE + TIME '11:00:00', 12.00),
((SELECT id FROM buses WHERE plate_number = '2A-1234'), 'Siem Reap', 'Phnom Penh', CURRENT_DATE + TIME '13:00:00', CURRENT_DATE + TIME '18:00:00', 12.00),

((SELECT id FROM buses WHERE plate_number = '2B-5678'), 'Phnom Penh', 'Battambang', CURRENT_DATE + TIME '08:30:00', CURRENT_DATE + TIME '14:00:00', 13.50),
((SELECT id FROM buses WHERE plate_number = '2B-5678'), 'Battambang', 'Phnom Penh', CURRENT_DATE + TIME '15:30:00', CURRENT_DATE + TIME '21:00:00', 13.50),

((SELECT id FROM buses WHERE plate_number = '4D-3456'), 'Phnom Penh', 'Kampot', CURRENT_DATE + TIME '07:00:00', CURRENT_DATE + TIME '10:30:00', 9.00),
((SELECT id FROM buses WHERE plate_number = '4D-3456'), 'Kampot', 'Phnom Penh', CURRENT_DATE + TIME '12:00:00', CURRENT_DATE + TIME '15:30:00', 9.00),

((SELECT id FROM buses WHERE plate_number = '5E-7788'), 'Phnom Penh', 'Sihanoukville', CURRENT_DATE + TIME '09:00:00', CURRENT_DATE + TIME '14:00:00', 14.00),
((SELECT id FROM buses WHERE plate_number = '5E-7788'), 'Sihanoukville', 'Phnom Penh', CURRENT_DATE + TIME '16:00:00', CURRENT_DATE + TIME '21:00:00', 14.00),

((SELECT id FROM buses WHERE plate_number = '6F-4455'), 'Phnom Penh', 'Kep', CURRENT_DATE + TIME '06:30:00', CURRENT_DATE + TIME '10:00:00', 8.50),
((SELECT id FROM buses WHERE plate_number = '6F-4455'), 'Kep', 'Phnom Penh', CURRENT_DATE + TIME '13:00:00', CURRENT_DATE + TIME '16:30:00', 8.50),

((SELECT id FROM buses WHERE plate_number = '2A-1234'), 'Phnom Penh', 'Siem Reap', CURRENT_DATE + INTERVAL '1 day' + TIME '06:00:00', CURRENT_DATE + INTERVAL '1 day' + TIME '11:00:00', 12.00),
((SELECT id FROM buses WHERE plate_number = '2B-5678'), 'Phnom Penh', 'Battambang', CURRENT_DATE + INTERVAL '1 day' + TIME '08:30:00', CURRENT_DATE + INTERVAL '1 day' + TIME '14:00:00', 13.50),
((SELECT id FROM buses WHERE plate_number = '4D-3456'), 'Phnom Penh', 'Kampot', CURRENT_DATE + INTERVAL '1 day' + TIME '07:00:00', CURRENT_DATE + INTERVAL '1 day' + TIME '10:30:00', 9.00),
((SELECT id FROM buses WHERE plate_number = '5E-7788'), 'Phnom Penh', 'Sihanoukville', CURRENT_DATE + INTERVAL '1 day' + TIME '09:00:00', CURRENT_DATE + INTERVAL '1 day' + TIME '14:00:00', 14.00);



WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY bus_id, origin, destination, departure_time, arrival_time
      ORDER BY id
    ) AS rn
  FROM bus_routes
)
DELETE FROM bus_routes
WHERE id IN (
  SELECT id
  FROM duplicates
  WHERE rn > 1
);




-- =========================
-- SAMPLE BUS BOOKINGS
-- =========================
INSERT INTO bus_bookings (
  user_id,
  route_id,
  seat_number,
  total_price,
  payment_method,
  status,
  created_at
)
VALUES
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM bus_routes WHERE origin = 'Phnom Penh' AND destination = 'Siem Reap' ORDER BY departure_time ASC LIMIT 1),
  'A1',
  12.00,
  'aba',
  'confirmed',
  NOW() - INTERVAL '1 day'
),
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM bus_routes WHERE origin = 'Phnom Penh' AND destination = 'Battambang' ORDER BY departure_time ASC LIMIT 1),
  'A2',
  13.50,
  'cash',
  'cancelled',
  NOW() - INTERVAL '2 days'
),
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM bus_routes WHERE origin = 'Phnom Penh' AND destination = 'Kampot' ORDER BY departure_time ASC LIMIT 1),
  'B1',
  9.00,
  'khqr',
  'confirmed',
  NOW() - INTERVAL '3 days'
),
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM bus_routes WHERE origin = 'Phnom Penh' AND destination = 'Sihanoukville' ORDER BY departure_time ASC LIMIT 1),
  'B2',
  14.00,
  'aba',
  'cancelled',
  NOW() - INTERVAL '4 days'
),
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM bus_routes WHERE origin = 'Siem Reap' AND destination = 'Phnom Penh' ORDER BY departure_time ASC LIMIT 1),
  'C1',
  12.00,
  'cash',
  'confirmed',
  NOW() - INTERVAL '5 days'
);

-- =========================
-- SAMPLE CAR RENTALS
-- =========================
INSERT INTO car_rentals (
  user_id,
  car_id,
  pickup_date,
  return_date,
  driver_name,
  driver_license,
  total_price,
  payment_method,
  status,
  booked_at
)
VALUES
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM rental_cars ORDER BY id ASC LIMIT 1),
  CURRENT_DATE + INTERVAL '1 day',
  CURRENT_DATE + INTERVAL '4 days',
  'Serey Mongkol',
  'DL-10001',
  90.00,
  'aba',
  'confirmed',
  NOW() - INTERVAL '1 day'
),
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM rental_cars ORDER BY id ASC OFFSET 1 LIMIT 1),
  CURRENT_DATE + INTERVAL '2 days',
  CURRENT_DATE + INTERVAL '5 days',
  'Dara Sok',
  'DL-10002',
  120.00,
  'cash',
  'cancelled',
  NOW() - INTERVAL '2 days'
),
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM rental_cars ORDER BY id ASC OFFSET 2 LIMIT 1),
  CURRENT_DATE + INTERVAL '3 days',
  CURRENT_DATE + INTERVAL '6 days',
  'Vannak Lim',
  'DL-10003',
  150.00,
  'khqr',
  'confirmed',
  NOW() - INTERVAL '3 days'
),
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM rental_cars ORDER BY id ASC OFFSET 3 LIMIT 1),
  CURRENT_DATE + INTERVAL '4 days',
  CURRENT_DATE + INTERVAL '7 days',
  'Nita Chhay',
  'DL-10004',
  110.00,
  'aba',
  'cancelled',
  NOW() - INTERVAL '4 days'
),
(
  (SELECT id FROM users WHERE email = 'admin@bookride.com' LIMIT 1),
  (SELECT id FROM rental_cars ORDER BY id ASC OFFSET 4 LIMIT 1),
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '2 days',
  'Piseth Heng',
  'DL-10005',
  70.00,
  'cash',
  'confirmed',
  NOW() - INTERVAL '5 days'
);

SELECT id, seat_number, total_price, payment_method, status, created_at
FROM bus_bookings
ORDER BY id DESC;