import React from 'react';

export // ── SVG Icons ──────────────────────────────────────────────────────────────────
const Icon = ({
  d,
  size = 16,
  color = 'currentColor',
  stroke = true
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke ? 'none' : color} stroke={stroke ? color : 'none'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>;

export const icons = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  route: 'M3 12s0-7 9-7 9 7 9 7-9 7-9 7-9-7-9-7zM12 12m-3 0a3 3 0 106 0 3 3 0 00-6 0',
  clock: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
  dollar: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  ticket: 'M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z',
  car: 'M5 17H3a2 2 0 01-2-2V9l2-5h14l2 5v6a2 2 0 01-2 2h-2M7 17h10M7 17a2 2 0 11-4 0M17 17a2 2 0 104 0',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  search: 'M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z'
};

// ── NAV CONFIG ─────────────────────────────────────────────────────────────────

export // ── NAV CONFIG ─────────────────────────────────────────────────────────────────
const NAV = [{
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'grid'
}, {
  id: 'vehicles',
  label: 'Vehicles',
  icon: 'truck'
}, {
  id: 'routes',
  label: 'Routes & Schedules',
  icon: 'route'
}, {
  id: 'bookings',
  label: 'Bookings',
  icon: 'ticket'
}, {
  id: 'rentals',
  label: 'Rentals',
  icon: 'car'
}, {
  id: 'customers',
  label: 'Customers',
  icon: 'users'
}, {
  id: 'reports',
  label: 'Reports',
  icon: 'chart'
}];

export const companyMeta = {
  'Mekong Express': {
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.16)'
  },
  'Sorya Bus': {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.16)'
  },
  'Giant Ibis': {
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.16)'
  },
  'Larryta Express': {
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.16)'
  },
  'VET Air Bus': {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.16)'
  },
  'Capitol Tours': {
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.16)'
  }
};

export const getCompanyMeta = name => companyMeta[name] || {
  color: 'var(--text-2)',
  bg: 'rgba(255,255,255,0.06)'
};

// ── SIDEBAR ────────────────────────────────────────────────────────────────────

