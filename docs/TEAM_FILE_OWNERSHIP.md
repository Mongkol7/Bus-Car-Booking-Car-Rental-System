# Team File Ownership Guide

Use this guide before starting a ticket. The goal is to keep each member inside a clear folder so future merges are cleaner and fewer people edit the same file.

## Current App Structure

```text
src/
  App.jsx                  Global route entry. Keep changes small and coordinated.
  Admin.jsx                Admin shell. Coordinates admin pages and sidebar state.
  User.jsx                 User shell. Coordinates user pages and top navigation state.
  Login.jsx                Login/register screen.
  context/
    AuthContext.jsx        Auth role state and logout redirect state.
  pages/
    admin/                 Current admin pages.
    user/                  Current user/customer pages.
  features/                New task-owned feature folders for team work.
  components/              Shared layout/components used by more than one feature.
  data/                    Mock/shared transport data.
  utils/                   Shared helpers and icons.
```

## Merge Rules

1. Work mainly inside your assigned `src/features/...` folder.
2. Only edit `src/App.jsx`, `src/Admin.jsx`, `src/User.jsx`, `src/index.css`, `src/data/transportData.js`, or shared utils after telling the team, because those files affect everyone.
3. If a feature needs shared data, add it to `src/data/` only when two or more features need it. Otherwise keep mock data inside the feature folder.
4. Name feature files by responsibility: `SeatMap.jsx`, `bookingSearch.mock.js`, `PaymentMethodSelector.jsx`, not generic names like `Card.jsx`.
5. Keep each ticket in its own branch, for example `bcrs-9-seat-map`.

## Shared Integration Files

| File | Owner | Purpose | Edit Rule |
| --- | --- | --- | --- |
| `src/App.jsx` | Mongkol | Global React routes and route guards. | Coordinate before editing. |
| `src/Admin.jsx` | Mongkol | Admin app layout and admin page switching. | Admin tickets only. |
| `src/User.jsx` | Heng | User app layout and user page switching. | Coordinate if Sak needs checkout/rental navigation. |
| `src/context/AuthContext.jsx` | Mongkol | Role/session state. | Auth ticket only unless agreed. |
| `src/pages/user/TopNav.jsx` | Heng | Top navigation login/logout display and page links. | Heng owns. |
| `src/index.css` | Shared | Global styling. | Prefer feature CSS classes in feature files; coordinate global edits. |
| `src/data/transportData.js` | Shared | Current shared mock transport data. | Add stable shared mock data only. |
| `src/components/Footer.jsx` | Shared | Site footer. | Avoid unless footer task is assigned. |

## Mongkol Ownership

### BCRS-2 Auth

Primary files:

- `src/features/auth/`
- `src/context/AuthContext.jsx`
- `src/App.jsx`

Responsibilities:

- Protected route guards in React.
- Prevent guests from reaching admin/profile pages.
- Redirect users by role after login.

Avoid editing:

- User page feature logic owned by Heng/Sak.

### BCRS-3 Admin1

Primary files:

- `src/features/admin/dashboard/`
- `src/Admin.jsx`
- `src/pages/admin/Sidebar.jsx`
- `src/pages/admin/Dashboard.jsx`

Responsibilities:

- Admin dashboard layout and DB-backed metrics.
- Sidebar navigation.
- Role-based admin redirect.

### BCRS-4 Admin2

Primary files:

- `src/features/admin/vehicles/`
- `src/pages/admin/Vehicles.jsx`

Responsibilities:

- DB-backed Vehicle Management page.
- Buses/Rental Cars tabs.
- Bus, rental car, and company CRUD with safe delete rules.

### BCRS-5 Admin3

Primary files:

- `src/features/admin/routes/`
- `src/pages/admin/Routes.jsx`

Responsibilities:

- Route and schedule management.
- Assign vehicles, departure times, pricing logic.

### BCRS-6 Admin4

Primary files:

- `src/features/admin/users/`
- `src/pages/admin/Users.jsx`

Responsibilities:

- User stats.
- Searchable user list.
- User create, edit, role assignment, password reset, delete actions, and role CRUD.

### BCRS-18 Admin5

Primary files:

- `src/features/admin/reports/`
- `src/pages/admin/Reports.jsx`
- `src/pages/admin/Bookings.jsx`
- `src/pages/admin/Rentals.jsx`

Responsibilities:

- DB-backed admin reports, revenue charts, and metrics.
- Booking/rental management tables with search, filters, edit, delete, and CSV export.

## Heng Ownership

### BCRS-7 Home

Primary files:

- `src/features/home/`
- `src/pages/user/Home.jsx`
- `src/pages/user/TopNav.jsx`

Responsibilities:

- Topnav login/logout state.
- Service card navigation.

### BCRS-8 Booking1

Primary files:

- `src/features/booking/search/`
- `src/pages/user/BusSearch.jsx`

Responsibilities:

- Search form logic.
- Filter mock data by origin, destination, and date.
- Result display.

### BCRS-9 Booking2

Primary files:

- `src/features/booking/seats/`
- `src/pages/user/BusSearch.jsx`

Responsibilities:

- Interactive seat map.
- Available, taken, selected, and locked seat states.

Recommended split:

- Put reusable seat logic/components in `src/features/booking/seats/`.
- Keep only page wiring in `src/pages/user/BusSearch.jsx`.

### BCRS-10 Booking3

Primary files:

- `src/features/booking/my-bookings/`
- `src/pages/user/MyBookings.jsx`

Responsibilities:

- My Bookings tabs.
- Ticket styling.
- QR code generation.

### BCRS-11 Booking4

Primary files:

- `src/features/profile/`
- `src/pages/user/Profile.jsx`

Responsibilities:

- Update profile info.
- Change password UI/logic.
- Trip stats summary.

## Sak Ownership

### BCRS-13 Rental1

Primary files:

- `src/features/rental/catalog/`
- `src/pages/user/CarRental.jsx`
- `public/cars/`

Responsibilities:

- Car rental grid.
- Filter by car type.
- Details panel and photo gallery.

### BCRS-14 Rental2

Primary files:

- `src/features/rental/booking-form/`
- `src/pages/user/CarRental.jsx`

Responsibilities:

- Rental booking form.
- Pickup/return dates.
- Driver info validation.

### BCRS-15 Passenger

Primary files:

- `src/features/checkout/passenger/`
- `src/pages/user/BusSearch.jsx`

Responsibilities:

- Passenger info form.
- Validation.
- Booking summary data passing.

### BCRS-16 Payment

Primary files:

- `src/features/checkout/payment/`

Responsibilities:

- Payment selection logic.
- ABA, KHQR, and Cash options.
- Mock QR scanning box.

### BCRS-17 Checkout

Primary files:

- `src/features/checkout/confirmation/`

Responsibilities:

- Payment confirmation.
- Success state handling.

## Recommended Future Folder Shape

```text
src/features/
  auth/
  admin/
    dashboard/
    vehicles/
    routes/
    users/
    reports/
  home/
  booking/
    search/
    seats/
    my-bookings/
  profile/
  rental/
    catalog/
    booking-form/
  checkout/
    passenger/
    payment/
    confirmation/
```

## How To Connect Feature Work Later

- Build components and logic inside the feature folder first.
- Export the main component from that folder with an `index.js` when ready.
- Import the feature into the current page file only at the end of the ticket.
- Keep the final page file edit small so merge conflicts are easy to resolve.
