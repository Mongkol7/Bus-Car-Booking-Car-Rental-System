-- ==========================================
-- BUS & CAR BOOKING SYSTEM: POSTGRESQL SCHEMA
-- Drop existing tables to allow clean recreation
-- ==========================================
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_notifications CASCADE;
DROP TABLE IF EXISTS car_rentals CASCADE;
DROP TABLE IF EXISTS rental_driver_reviews CASCADE;
DROP TABLE IF EXISTS rental_drivers CASCADE;
DROP TABLE IF EXISTS bus_bookings CASCADE;
DROP TABLE IF EXISTS bus_seats CASCADE;
DROP TABLE IF EXISTS bus_routes CASCADE;
DROP TABLE IF EXISTS destinations CASCADE;
DROP TABLE IF EXISTS rental_cars CASCADE;
DROP TABLE IF EXISTS buses CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS vehicle_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;

-- 1. ENUMS FOR STATUSES & ROLES
CREATE TYPE vehicle_status AS ENUM ('available', 'rented', 'maintenance');
CREATE TYPE payment_method AS ENUM ('aba', 'khqr', 'cash');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'returned');

-- 2. ROLES TABLE
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, label, description, is_system) VALUES
('user', 'User', 'Default customer account role', TRUE),
('admin', 'Admin', 'System administrator role', TRUE);

-- 3. USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    national_id VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    role_id INT REFERENCES roles(id) ON DELETE RESTRICT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. COMPANIES TABLE (Mekong Express, Giant Ibis, etc.)
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
    maintenance_start TIMESTAMP,
    maintenance_end TIMESTAMP,
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

-- 5.1 RENTAL DRIVERS
CREATE TABLE rental_drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(30),
    rating NUMERIC(3,2) DEFAULT 5.00,
    review_count INT DEFAULT 0,
    hourly_rate DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'inactive')),
    profile_photo TEXT,
    background TEXT,
    experience_years INT DEFAULT 0,
    languages TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rental_driver_reviews (
    id SERIAL PRIMARY KEY,
    driver_id INT REFERENCES rental_drivers(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    car_rental_id INT,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    review_type VARCHAR(20) DEFAULT 'review' CHECK (review_type IN ('review', 'report')),
    admin_reply TEXT,
    admin_replied_at TIMESTAMP,
    admin_replied_by INT REFERENCES users(id) ON DELETE SET NULL,
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
    daily_template_id INT,
    service_date DATE,
    is_generated BOOLEAN DEFAULT FALSE,
    availability_status VARCHAR(20) DEFAULT 'available',
    maintenance_start TIMESTAMP,
    maintenance_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6.1 DAILY ROUTE TEMPLATES
CREATE TABLE daily_route_templates (
    id SERIAL PRIMARY KEY,
    bus_id INT REFERENCES buses(id) ON DELETE CASCADE,
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6.2 DESTINATIONS
CREATE TABLE destinations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
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
    booking_reference VARCHAR(40),
    round_trip_reference VARCHAR(40),
    trip_leg VARCHAR(20) DEFAULT 'outbound',
    seat_number VARCHAR(10) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    passenger_first_name VARCHAR(100),
    passenger_last_name VARCHAR(100),
    passenger_phone VARCHAR(30),
    passenger_email VARCHAR(150),
    passenger_id_number VARCHAR(80),
    package_weight_kg DECIMAL(8,2) DEFAULT 0,
    overweight_charge DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50),
    status booking_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. CAR RENTALS (Transactions)
CREATE TABLE car_rentals (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    car_id INT REFERENCES rental_cars(id) ON DELETE CASCADE,
    pickup_date DATE NOT NULL,
    return_date DATE NOT NULL,
    pickup_datetime TIMESTAMP,
    return_datetime TIMESTAMP,
    rental_hours NUMERIC(8,2),
    hourly_charge DECIMAL(10,2),
    returned_at TIMESTAMP,
    customer_phone VARCHAR(30),
    hired_driver_id INT REFERENCES rental_drivers(id) ON DELETE SET NULL,
    rental_base_price DECIMAL(10,2) DEFAULT 0,
    driver_fee DECIMAL(10,2) DEFAULT 0,
    driver_name VARCHAR(150) NOT NULL,
    driver_license VARCHAR(50) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    payment_method payment_method NOT NULL,
    status booking_status DEFAULT 'pending' CHECK (status::TEXT IN ('pending', 'confirmed', 'cancelled', 'returned')),
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    car_rental_id INT REFERENCES car_rentals(id) ON DELETE CASCADE,
    bus_booking_id INT REFERENCES bus_bookings(id) ON DELETE CASCADE,
    booking_reference VARCHAR(80),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    action_type VARCHAR(50),
    metadata JSONB DEFAULT '{}'::JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. USER SESSIONS
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    session_type VARCHAR(20) DEFAULT 'access',
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. TRANSACTIONS / PAYMENTS (Optional but good for tracking)
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

-- 11.1 BOOKING RECOVERY EVENTS
CREATE TABLE booking_recovery_events (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bus_bookings(id) ON DELETE SET NULL,
    old_route_id INT REFERENCES bus_routes(id) ON DELETE SET NULL,
    new_route_id INT REFERENCES bus_routes(id) ON DELETE SET NULL,
    old_seat_number VARCHAR(10),
    new_seat_number VARCHAR(10),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. INDEXES FOR PERFORMANCE
CREATE INDEX idx_bus_routes_search ON bus_routes(origin, destination, departure_time);
CREATE UNIQUE INDEX idx_bus_routes_daily_template_date ON bus_routes(daily_template_id, service_date) WHERE daily_template_id IS NOT NULL;
CREATE INDEX idx_car_rental_dates ON car_rentals(pickup_date, return_date);
CREATE INDEX idx_user_bookings ON bus_bookings(user_id);
CREATE UNIQUE INDEX idx_bus_bookings_active_route_seat_unique ON bus_bookings(route_id, UPPER(seat_number)) WHERE status <> 'cancelled';
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
