-- ==========================================
-- BUS & CAR BOOKING SYSTEM: POSTGRESQL SCHEMA
-- Drop existing tables to allow clean recreation
-- ==========================================
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS car_rentals CASCADE;
DROP TABLE IF EXISTS bus_bookings CASCADE;
DROP TABLE IF EXISTS bus_seats CASCADE;
DROP TABLE IF EXISTS bus_routes CASCADE;
DROP TABLE IF EXISTS rental_cars CASCADE;
DROP TABLE IF EXISTS buses CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS vehicle_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;

-- 1. ENUMS FOR STATUSES & ROLES
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE vehicle_status AS ENUM ('available', 'rented', 'maintenance');
CREATE TYPE payment_method AS ENUM ('aba', 'khqr', 'cash');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'returned');

-- 2. USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    national_id VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. COMPANIES TABLE (Mekong Express, Giant Ibis, etc.)
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    theme_color VARCHAR(20),
    theme_bg VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. BUSES TABLE (For Bus Fleet)
CREATE TABLE buses (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'VIP Sleeper', 'Express Coach'
    plate_number VARCHAR(20) UNIQUE,
    total_seats INT NOT NULL,
    status vehicle_status DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. RENTAL CARS TABLE (For Car Rentals)
CREATE TABLE rental_cars (
    id SERIAL PRIMARY KEY,
    owner_id INT REFERENCES users(id) ON DELETE SET NULL, -- Allow peer-to-peer rental
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'SUV', 'Sedan'
    plate_number VARCHAR(20) UNIQUE,
    total_seats INT NOT NULL,
    transmission VARCHAR(20), -- 'Auto', 'Manual'
    daily_rate DECIMAL(10,2) NOT NULL,
    status vehicle_status DEFAULT 'available',
    photos TEXT[], -- Array of image URLs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. BUS ROUTES
CREATE TABLE bus_routes (
    id SERIAL PRIMARY KEY,
    bus_id INT REFERENCES buses(id) ON DELETE CASCADE,
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    departure_time TIMESTAMP NOT NULL,
    arrival_time TIMESTAMP NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. BUS SEATS (Optional: Pre-generate seats for a route)
CREATE TABLE bus_seats (
    id SERIAL PRIMARY KEY,
    route_id INT REFERENCES bus_routes(id) ON DELETE CASCADE,
    seat_number VARCHAR(10) NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE,
    UNIQUE(route_id, seat_number)
);

-- 8. BUS BOOKINGS
CREATE TABLE bus_bookings (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    route_id INT REFERENCES bus_routes(id) ON DELETE CASCADE,
    seat_number VARCHAR(10) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    status booking_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id, seat_number) REFERENCES bus_seats (route_id, seat_number) ON DELETE CASCADE
);

-- 9. CAR RENTALS (Transactions)
CREATE TABLE car_rentals (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    car_id INT REFERENCES rental_cars(id) ON DELETE CASCADE,
    pickup_date DATE NOT NULL,
    return_date DATE NOT NULL,
    driver_name VARCHAR(150) NOT NULL,
    driver_license VARCHAR(50) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    payment_method payment_method NOT NULL,
    status booking_status DEFAULT 'pending',
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. TRANSACTIONS / PAYMENTS (Optional but good for tracking)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    bus_booking_id INT REFERENCES bus_bookings(id) ON DELETE CASCADE,
    car_rental_id INT REFERENCES car_rentals(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method payment_method NOT NULL,
    status VARCHAR(20) DEFAULT 'success',
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Ensure a transaction belongs to exactly one type of booking
    CHECK (
        (bus_booking_id IS NOT NULL AND car_rental_id IS NULL) OR 
        (bus_booking_id IS NULL AND car_rental_id IS NOT NULL)
    )
);

-- 10. INDEXES FOR PERFORMANCE
CREATE INDEX idx_bus_routes_search ON bus_routes(origin, destination, departure_time);
CREATE INDEX idx_car_rental_dates ON car_rentals(pickup_date, return_date);
CREATE INDEX idx_user_bookings ON bus_bookings(user_id);
