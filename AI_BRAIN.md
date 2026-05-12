# 🧠 Antigravity AI Project Memory

**Project Name:** Bus & Car Booking + Car Rental System
**Tech Stack:** React (Vite), Node.js (Express), PostgreSQL (PERN Stack)
**Database Name:** `bookride_db`

---

## 🏛️ Architecture & Database Design
We have officially migrated from static Dummy Data to a fully relational PostgreSQL database.

**Core Tables:**
- `users`: Handles both `admin` and `user` roles. Uses `bcryptjs` for password hashing.
- `companies`: Bus companies like Mekong Express and Giant Ibis (stores their UI colors).
- `buses`: Belongs to a company. Used strictly for bus routes.
- `rental_cars`: Separate from buses! Stores peer-to-peer or company rentals, including a `photos TEXT[]` array for unlimited image storage.
- `bus_routes`: Links a `bus_id` to an origin, destination, and schedule.
- *(Transaction Tables)*: `bus_bookings`, `car_rentals`, `transactions`.

## 🔌 Current API Endpoints (Express)
- `POST /api/auth/register`: Creates a user, hashes password via bcrypt.
- `POST /api/auth/login`: Authenticates user, returns `{ role: 'admin' | 'user' }`.
- `GET /api/cars`: Returns all `rental_cars` to populate `CarRental.jsx`.
- `GET /api/routes`: Returns all `bus_routes` combined with their `buses` and `companies` to populate `BusSearch.jsx`.

## ✅ Completed Tasks
1. **Full PERN Stack Setup**: Node backend built and connected to Postgres.
2. **Database Splitting**: Separated the single `vehicles` table into `buses` and `rental_cars` for correct database normalization.
3. **Vite Proxy Configured**: Fixed CORS issues by routing `/api` to port 5000.
4. **Security Added**: Implemented `bcryptjs` for secure password hashing.
5. **Authentication Wired**: `Login.jsx` connected to real backend, handles state via `AuthContext`.
6. **Dynamic UI Mapping**: `CarRental.jsx` now correctly maps real array data (`car.photos.map`).

## 🚀 Next Steps / Team Delegation
**1. Thoeung Sereymongkol (Auth & Admin)**
- Refine the Admin Dashboard (`Admin.jsx`) to perform CRUD operations (POST/PUT/DELETE) on the Postgres tables (like adding a new Bus Route).
- Branch: `feature/auth-and-admin`

**2. Lim Bunheng (Bus Booking Flow)**
- Integrate the "Select Seats" and "Pay" buttons in `BusSearch.jsx` to send a POST request to `/api/bookings/bus`.
- Branch: `feature/bus-booking`

**3. Sok Rithysak (Car Rentals Flow)**
- Integrate the "Rent Now" and date-picker logic in `CarRental.jsx` to send a POST request to the `car_rentals` transaction table.
- Branch: `feature/car-rentals`

---
*Note: This file serves as the memory for the AI. If the chat context is lost, the AI can read this file to instantly understand the entire history and architecture of the project.*
