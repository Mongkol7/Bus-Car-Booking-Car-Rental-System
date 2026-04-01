import { useState } from 'react';
import { busFleet, carModels } from './data/transportData';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --surface: rgba(255,255,255,0.05);
    --surface-hover: rgba(255,255,255,0.09);
    --glass: rgba(255,255,255,0.07);
    --glass-border: rgba(255,255,255,0.12);
    --glass-strong: rgba(255,255,255,0.11);
    --text: #f0f0f5;
    --text-2: rgba(240,240,245,0.55);
    --text-3: rgba(240,240,245,0.3);
    --accent: #4f8ef7;
    --accent-soft: rgba(79,142,247,0.15);
    --accent-glow: rgba(79,142,247,0.35);
    --green: #34d399;
    --green-soft: rgba(52,211,153,0.12);
    --amber: #fbbf24;
    --amber-soft: rgba(251,191,36,0.12);
    --red: #f87171;
    --red-soft: rgba(248,113,113,0.12);
    --purple: #a78bfa;
    --purple-soft: rgba(167,139,250,0.12);
    --radius: 16px;
    --radius-sm: 10px;
    --radius-xs: 7px;
    --blur: blur(24px) saturate(180%);
    --font: 'DM Sans', sans-serif;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font); min-height: 100vh; }

  .app { display: flex; min-height: 100vh; }

  /* SIDEBAR */
  .sidebar {
    width: 220px; flex-shrink: 0;
    background: rgba(10,10,20,0.85);
    backdrop-filter: var(--blur);
    border-right: 0.5px solid var(--glass-border);
    display: flex; flex-direction: column;
    padding: 28px 0; position: sticky; top: 0; height: 100vh;
  }
  .sidebar-logo {
    padding: 0 20px 28px;
    font-size: 13px; font-weight: 600; letter-spacing: 0.06em;
    color: var(--text-2); text-transform: uppercase;
    border-bottom: 0.5px solid var(--glass-border);
    margin-bottom: 16px;
  }
  .sidebar-logo span { color: var(--accent); }
  .nav-section { padding: 0 12px; margin-bottom: 4px; }
  .nav-label {
    font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
    color: var(--text-3); text-transform: uppercase;
    padding: 0 8px; margin-bottom: 6px; margin-top: 16px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: var(--radius-xs);
    cursor: pointer; font-size: 13px; font-weight: 400;
    color: var(--text-2); transition: all 0.15s ease;
    border: 0.5px solid transparent;
    margin-bottom: 2px;
  }
  .nav-item:hover { background: var(--surface-hover); color: var(--text); }
  .nav-item.active {
    background: var(--accent-soft);
    color: var(--accent);
    border-color: rgba(79,142,247,0.2);
  }
  .nav-icon { width: 16px; height: 16px; opacity: 0.8; flex-shrink: 0; }
  .sidebar-bottom { margin-top: auto; padding: 0 12px; }

  /* MAIN */
  .main { flex: 1; overflow-y: auto; padding: 32px 36px; min-width: 0; }

  /* PAGE HEADER */
  .page-header { margin-bottom: 28px; }
  .page-title { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: var(--text); }
  .page-sub { font-size: 13px; color: var(--text-2); margin-top: 4px; }

  /* GLASS CARD */
  .card {
    background: var(--glass);
    backdrop-filter: var(--blur);
    border: 0.5px solid var(--glass-border);
    border-radius: var(--radius);
    padding: 20px 24px;
  }
  .card-sm { padding: 14px 18px; border-radius: var(--radius-sm); }

  /* METRIC CARDS */
  .metrics { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 24px; }
  .metric-card {
    background: var(--glass); border: 0.5px solid var(--glass-border);
    border-radius: var(--radius-sm); padding: 18px 20px;
  }
  .metric-label { font-size: 11px; font-weight: 500; color: var(--text-2); letter-spacing: 0.04em; margin-bottom: 8px; }
  .metric-val { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; }
  .metric-sub { font-size: 11px; color: var(--text-3); margin-top: 4px; }
  .metric-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 5px; }

  /* GRID 2 */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

  /* TABLE */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    text-align: left; padding: 10px 14px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
    color: var(--text-3); text-transform: uppercase;
    border-bottom: 0.5px solid var(--glass-border);
  }
  tbody tr { border-bottom: 0.5px solid rgba(255,255,255,0.04); transition: background 0.1s; }
  tbody tr:hover { background: var(--surface-hover); }
  tbody tr:last-child { border-bottom: none; }
  td { padding: 12px 14px; color: var(--text); vertical-align: middle; }
  .td-muted { color: var(--text-2); }

  /* BADGES */
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 500; padding: 3px 9px;
    border-radius: 20px; white-space: nowrap;
  }
  .badge-green { background: var(--green-soft); color: var(--green); }
  .badge-amber { background: var(--amber-soft); color: var(--amber); }
  .badge-red   { background: var(--red-soft);   color: var(--red); }
  .badge-blue  { background: var(--accent-soft); color: var(--accent); }
  .badge-purple{ background: var(--purple-soft); color: var(--purple); }

  /* BUTTONS */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: var(--radius-xs);
    font-size: 13px; font-weight: 500; cursor: pointer;
    border: 0.5px solid; transition: all 0.15s ease;
    font-family: var(--font);
  }
  .btn-primary { background: var(--accent); color: #fff; border-color: transparent; }
  .btn-primary:hover { opacity: 0.88; }
  .btn-ghost { background: var(--glass); color: var(--text-2); border-color: var(--glass-border); }
  .btn-ghost:hover { background: var(--surface-hover); color: var(--text); }
  .btn-danger { background: var(--red-soft); color: var(--red); border-color: rgba(248,113,113,0.2); }
  .btn-sm { padding: 5px 11px; font-size: 12px; }

  /* INPUT */
  .input-wrap { position: relative; }
  input, select {
    width: 100%; padding: 9px 14px;
    background: var(--glass); border: 0.5px solid var(--glass-border);
    border-radius: var(--radius-xs); color: var(--text);
    font-size: 13px; font-family: var(--font); outline: none;
    transition: border-color 0.15s;
  }
  input:focus, select:focus { border-color: var(--accent); }
  input::placeholder { color: var(--text-3); }
  select option { background: #1a1a2e; }
  .search-input { padding-left: 36px; }
  .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text-3); font-size: 14px; }

  /* TOOLBAR */
  .toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
  .toolbar-right { margin-left: auto; display: flex; gap: 8px; }

  /* SECTION TITLE */
  .sec-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 14px; }
  .sec-sub { font-size: 12px; color: var(--text-2); }

  /* AVATAR */
  .avatar {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600; flex-shrink: 0;
  }

  /* CAR CARD */
  .car-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
  .car-card {
    background: var(--glass); border: 0.5px solid var(--glass-border);
    border-radius: var(--radius); padding: 18px; cursor: pointer;
    transition: all 0.15s ease;
  }
  .car-card:hover { background: var(--glass-strong); border-color: rgba(255,255,255,0.18); transform: translateY(-1px); }
  .car-img {
    width: 100%; height: 80px; border-radius: var(--radius-xs);
    background: var(--surface); display: flex; align-items: center;
    justify-content: center; font-size: 32px; margin-bottom: 14px;
    border: 0.5px solid var(--glass-border);
  }
  .car-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
  .car-type { font-size: 11px; color: var(--text-2); margin-bottom: 12px; }
  .car-meta { display: flex; justify-content: space-between; align-items: center; }
  .car-price { font-size: 15px; font-weight: 600; color: var(--accent); }
  .car-price span { font-size: 11px; font-weight: 400; color: var(--text-2); }

  /* MINI CHART BARS */
  .chart-row { display: flex; align-items: flex-end; gap: 4px; height: 44px; }
  .bar { flex: 1; border-radius: 3px 3px 0 0; background: var(--accent-soft); border: 0.5px solid var(--accent-glow); transition: height 0.3s ease; }
  .bar.lit { background: var(--accent); }

  /* DIVIDER */
  .divider { height: 0.5px; background: var(--glass-border); margin: 16px 0; }

  /* PILL NAV (for page tabs) */
  .pill-nav { display: flex; gap: 6px; background: var(--glass); border: 0.5px solid var(--glass-border); border-radius: 10px; padding: 4px; margin-bottom: 20px; width: fit-content; }
  .pill-tab { padding: 6px 14px; border-radius: 7px; font-size: 12px; font-weight: 500; color: var(--text-2); cursor: pointer; transition: all 0.15s; }
  .pill-tab.active { background: var(--accent); color: #fff; }

  /* STAT ROW */
  .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 0.5px solid rgba(255,255,255,0.04); }
  .stat-row:last-child { border-bottom: none; }
  .stat-key { font-size: 12px; color: var(--text-2); }
  .stat-val { font-size: 13px; font-weight: 500; }

  /* PROGRESS */
  .prog-track { height: 4px; background: rgba(255,255,255,0.07); border-radius: 2px; margin-top: 6px; }
  .prog-fill { height: 100%; border-radius: 2px; background: var(--accent); }

  /* ICON SVG helpers */
  svg.icon { width: 16px; height: 16px; display: inline-block; vertical-align: middle; }
`;

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, color = 'currentColor', stroke = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={stroke ? 'none' : color}
    stroke={stroke ? color : 'none'}
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const icons = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  truck:
    'M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  route:
    'M3 12s0-7 9-7 9 7 9 7-9 7-9 7-9-7-9-7zM12 12m-3 0a3 3 0 106 0 3 3 0 00-6 0',
  clock: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
  dollar: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  ticket:
    'M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z',
  car: 'M5 17H3a2 2 0 01-2-2V9l2-5h14l2 5v6a2 2 0 01-2 2h-2M7 17h10M7 17a2 2 0 11-4 0M17 17a2 2 0 104 0',
  users:
    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
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
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
};

// ── NAV CONFIG ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'vehicles', label: 'Vehicles', icon: 'truck' },
  { id: 'routes', label: 'Routes & Schedules', icon: 'route' },
  { id: 'bookings', label: 'Bookings', icon: 'ticket' },
  { id: 'rentals', label: 'Rentals', icon: 'car' },
  { id: 'reports', label: 'Reports', icon: 'chart' },
];

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, onLogout }) {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        Admin<span>.</span>Panel
      </div>
      <div className="nav-section">
        <div className="nav-label">Overview</div>
        {NAV.slice(0, 1).map((n) => (
          <div
            key={n.id}
            className={`nav-item ${active === n.id ? 'active' : ''}`}
            onClick={() => setActive(n.id)}
          >
            <Icon d={icons[n.icon]} size={15} color="currentColor" />
            {n.label}
          </div>
        ))}
      </div>
      <div className="nav-section">
        <div className="nav-label">Manage</div>
        {NAV.slice(1).map((n) => (
          <div
            key={n.id}
            className={`nav-item ${active === n.id ? 'active' : ''}`}
            onClick={() => setActive(n.id)}
          >
            <Icon d={icons[n.icon]} size={15} color="currentColor" />
            {n.label}
          </div>
        ))}
      </div>
      <div className="sidebar-bottom">
        <div className="nav-item">
          <Icon d={icons.settings} size={15} color="currentColor" />
          Settings
        </div>
        <div className="nav-item" onClick={onLogout}>
          <Icon d={icons.logout} size={15} color="currentColor" />
          Logout
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const bars = [30, 55, 40, 70, 60, 85, 50, 90, 65, 75, 80, 95];
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Bus & Car Booking + Car Rental System</div>
      </div>
      <div className="metrics">
        {[
          {
            label: 'Total bookings',
            val: '1,284',
            sub: '+12% this week',
            color: 'var(--accent)',
          },
          {
            label: 'Active rentals',
            val: '38',
            sub: '6 returning today',
            color: 'var(--green)',
          },
          {
            label: 'Revenue (Apr)',
            val: '$9,420',
            sub: '↑ vs last month',
            color: 'var(--purple)',
          },
          {
            label: 'Users',
            val: '3,107',
            sub: '210 new this month',
            color: 'var(--amber)',
          },
        ].map((m) => (
          <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className="metric-val" style={{ color: m.color }}>
              {m.val}
            </div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid2">
        <div className="card">
          <div className="sec-title">Booking activity — last 12 days</div>
          <div className="chart-row">
            {bars.map((h, i) => (
              <div
                key={i}
                className={`bar ${i === bars.length - 1 ? 'lit' : ''}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Mar 23</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Apr 5</span>
          </div>
        </div>
        <div className="card">
          <div className="sec-title">Recent bookings</div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Route</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['#B-4821', 'PP → SR', 'Confirmed', '$12'],
                ['#B-4820', 'SR → KP', 'Pending', '$9'],
                ['#B-4819', 'PP → KP', 'Confirmed', '$15'],
                ['#B-4818', 'KP → PP', 'Cancelled', '$12'],
              ].map(([id, route, status, amt]) => (
                <tr key={id}>
                  <td style={{ color: 'var(--accent)', fontSize: 12 }}>{id}</td>
                  <td className="td-muted">{route}</td>
                  <td>
                    <span
                      className={`badge ${status === 'Confirmed' ? 'badge-green' : status === 'Pending' ? 'badge-amber' : 'badge-red'}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{amt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid3">
        {[
          {
            label: 'Buses available',
            val: '14/18',
            pct: 78,
            color: 'var(--accent)',
          },
          {
            label: 'Rental cars available',
            val: '9/12',
            pct: 75,
            color: 'var(--green)',
          },
          {
            label: 'Active routes',
            val: '7',
            pct: 100,
            color: 'var(--purple)',
          },
        ].map((s) => (
          <div key={s.label} className="card card-sm">
            <div className="sec-title" style={{ marginBottom: 4 }}>
              {s.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: s.color,
                marginBottom: 4,
              }}
            >
              {s.val}
            </div>
            <div className="prog-track">
              <div
                className="prog-fill"
                style={{ width: `${s.pct}%`, background: s.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="sec-title">Top customers</div>
          {[
            { name: 'Sophea Chan', email: 'sophea@gmail.com', trips: 12 },
            { name: 'Dara Meas', email: 'dara.meas@gmail.com', trips: 9 },
            { name: 'Lina Keo', email: 'lina.keo@gmail.com', trips: 7 },
            { name: 'Bopha Ros', email: 'bopha.ros@gmail.com', trips: 6 },
          ].map((u) => (
            <div key={u.email} className="stat-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {u.email}
                </div>
              </div>
              <span className="stat-val">{u.trips} trips</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="sec-title">New user signups</div>
          {[
            { name: 'Vuthy Sok', date: 'Apr 5', route: 'PP → SR' },
            { name: 'Channary Oum', date: 'Apr 5', route: 'PP → KP' },
            { name: 'Rathana Em', date: 'Apr 4', route: 'SR → KT' },
            { name: 'Makara Phy', date: 'Apr 4', route: 'PP → KP' },
          ].map((u) => (
            <div key={u.name} className="stat-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Joined {u.date}
                </div>
              </div>
              <span className="stat-val">{u.route}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── VEHICLES ──────────────────────────────────────────────────────────────────
function Vehicles() {
  const [tab, setTab] = useState('buses');
  const buses = busFleet;
  const cars = carModels;
  return (
    <div>
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div className="page-title">Vehicles</div>
          <div className="page-sub">Manage fleet — buses and rental cars</div>
        </div>
        <button className="btn btn-primary btn-sm">
          <Icon d={icons.plus} size={13} color="#fff" /> Add vehicle
        </button>
      </div>
      <div className="pill-nav">
        {['buses', 'cars'].map((t) => (
          <div
            key={t}
            className={`pill-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'buses' ? 'Buses' : 'Rental cars'}
          </div>
        ))}
      </div>
      {tab === 'buses' ? (
        <div className="card">
          <div className="toolbar">
            <div className="input-wrap" style={{ width: 220 }}>
              <span className="search-icon">
                <Icon d={icons.search} size={13} />
              </span>
              <input className="search-input" placeholder="Search vehicles…" />
            </div>
            <div className="toolbar-right">
              <button className="btn btn-ghost btn-sm">
                <Icon d={icons.filter} size={13} /> Filter
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Plate</th>
                  <th>Seats</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--accent)', fontSize: 12 }}>
                      {b.id}
                    </td>
                    <td style={{ fontWeight: 500 }}>{b.name}</td>
                    <td className="td-muted">{b.type}</td>
                    <td className="td-muted">{b.plate}</td>
                    <td className="td-muted">{b.seats}</td>
                    <td className="td-muted">{b.driver}</td>
                    <td>
                      <span
                        className={`badge ${b.status === 'Active' ? 'badge-green' : 'badge-amber'}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm">
                          <Icon d={icons.edit} size={12} />
                        </button>
                        <button className="btn btn-danger btn-sm">
                          <Icon d={icons.trash} size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="car-grid">
          {cars.map((c) => (
            <div key={c.id} className="car-card">
              <div className="car-img">🚗</div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 4,
                }}
              >
                <div className="car-name">{c.name}</div>
                <span
                  className={`badge ${c.status === 'Available' ? 'badge-green' : c.status === 'Rented' ? 'badge-blue' : 'badge-amber'}`}
                >
                  {c.status}
                </span>
              </div>
              <div className="car-type">
                {c.type} · {c.plate} · {c.seats} seats · {c.trans}
              </div>
              <div className="car-meta">
                <div className="car-price">
                  ${c.dailyRate}
                  <span>/day</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm">
                    <Icon d={icons.edit} size={12} />
                  </button>
                  <button className="btn btn-danger btn-sm">
                    <Icon d={icons.trash} size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ROUTES ────────────────────────────────────────────────────────────────────
function Routes() {
  const routes = [
    {
      id: 'R-01',
      from: 'Phnom Penh',
      to: 'Siem Reap',
      stops: 2,
      dist: '314 km',
      duration: '5h',
      price: '$12',
    },
    {
      id: 'R-02',
      from: 'Phnom Penh',
      to: 'Kampot',
      stops: 1,
      dist: '148 km',
      duration: '2.5h',
      price: '$9',
    },
    {
      id: 'R-03',
      from: 'Siem Reap',
      to: 'Kampong Thom',
      stops: 0,
      dist: '147 km',
      duration: '2h',
      price: '$7',
    },
    {
      id: 'R-04',
      from: 'Phnom Penh',
      to: 'Kampong Cham',
      stops: 1,
      dist: '120 km',
      duration: '2h',
      price: '$8',
    },
    {
      id: 'R-05',
      from: 'Phnom Penh',
      to: 'Kep',
      stops: 2,
      dist: '172 km',
      duration: '3h',
      price: '$10',
    },
    {
      id: 'R-06',
      from: 'Phnom Penh',
      to: 'Battambang',
      stops: 1,
      dist: '291 km',
      duration: '5h',
      price: '$11',
    },
    {
      id: 'R-07',
      from: 'Phnom Penh',
      to: 'Sihanoukville',
      stops: 1,
      dist: '230 km',
      duration: '4h',
      price: '$12',
    },
    {
      id: 'R-08',
      from: 'Phnom Penh',
      to: 'Kratie',
      stops: 2,
      dist: '315 km',
      duration: '6h',
      price: '$14',
    },
  ];
  const scheds = [
    {
      id: 'S-01',
      route: 'PP → SR',
      vehicle: 'Mekong Express',
      type: 'VIP Sleeper',
      depart: '06:00',
      seats: '40/40',
      price: '$12',
      date: 'Apr 5',
    },
    {
      id: 'S-02',
      route: 'PP → SR',
      vehicle: 'Sorya Bus',
      type: 'Express Coach',
      depart: '09:00',
      seats: '35/35',
      price: '$12',
      date: 'Apr 5',
    },
    {
      id: 'S-03',
      route: 'PP → KP',
      vehicle: 'Giant Ibis',
      type: 'Luxury Coach',
      depart: '07:30',
      seats: '38/38',
      price: '$15',
      date: 'Apr 5',
    },
    {
      id: 'S-04',
      route: 'SR → KT',
      vehicle: 'Capitol Bus',
      type: 'Standard Coach',
      depart: '08:00',
      seats: '45/45',
      price: '$11',
      date: 'Apr 6',
    },
    {
      id: 'S-05',
      route: 'PP → SHV',
      vehicle: 'Larryta Express',
      type: 'Mini Bus',
      depart: '15:30',
      seats: '20/25',
      price: '$12',
      date: 'Apr 6',
    },
  ];
  return (
    <div>
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div className="page-title">Routes & Schedules</div>
          <div className="page-sub">
            Manage travel routes and departure schedules
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm">
            <Icon d={icons.plus} size={13} /> Add route
          </button>
          <button className="btn btn-primary btn-sm">
            <Icon d={icons.plus} size={13} /> Add schedule
          </button>
        </div>
      </div>
      <div className="grid2">
        <div className="card">
          <div className="sec-title">Routes</div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>From → To</th>
                <th>Stops</th>
                <th>Distance</th>
                <th>Duration</th>
                <th>Fare</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--accent)', fontSize: 12 }}>
                    {r.id}
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>
                    {r.from} → {r.to}
                  </td>
                  <td className="td-muted">{r.stops}</td>
                  <td className="td-muted">{r.dist}</td>
                  <td className="td-muted">{r.duration}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 500 }}>
                    {r.price}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm">
                      <Icon d={icons.edit} size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="sec-title">Upcoming schedules</div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Route</th>
                <th>Vehicle</th>
                <th>Type</th>
                <th>Depart</th>
                <th>Seats</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {scheds.map((s) => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--accent)', fontSize: 12 }}>
                    {s.id}
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{s.route}</td>
                  <td className="td-muted" style={{ fontSize: 12 }}>
                    {s.vehicle}
                  </td>
                  <td>
                    <span className="badge badge-blue">{s.depart}</span>
                  </td>
                  <td className="td-muted">{s.seats}</td>
                  <td className="td-muted">{s.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
function Bookings() {
  const [filter, setFilter] = useState('All');
  const all = [
    {
      id: '#B-4821',
      user: 'Sophea Chan',
      route: 'PP → SR',
      seat: 'A12',
      date: 'Apr 5',
      paid: '$12',
      payment: 'ABA',
      email: 'sophea@gmail.com',
      phone: '+855 12 345 678',
      vehicle: 'Mekong Express',
      status: 'Confirmed',
    },
    {
      id: '#B-4820',
      user: 'Dara Meas',
      route: 'SR → KP',
      seat: 'B7',
      date: 'Apr 5',
      paid: '$9',
      payment: 'KHQR',
      email: 'dara.meas@gmail.com',
      phone: '+855 92 301 774',
      vehicle: 'Sorya Bus',
      status: 'Pending',
    },
    {
      id: '#B-4819',
      user: 'Lina Keo',
      route: 'PP → KP',
      seat: 'C3',
      date: 'Apr 6',
      paid: '$15',
      payment: 'Cash',
      email: 'lina.keo@gmail.com',
      phone: '+855 98 112 990',
      vehicle: 'Giant Ibis',
      status: 'Confirmed',
    },
    {
      id: '#B-4818',
      user: 'Vuthy Sok',
      route: 'KP → PP',
      seat: 'A1',
      date: 'Apr 4',
      paid: '$12',
      payment: 'ABA',
      email: 'vuthy.sok@gmail.com',
      phone: '+855 10 553 221',
      vehicle: 'Larryta Express',
      status: 'Cancelled',
    },
    {
      id: '#B-4817',
      user: 'Bopha Ros',
      route: 'PP → KC',
      seat: 'D9',
      date: 'Apr 5',
      paid: '$8',
      payment: 'KHQR',
      email: 'bopha.ros@gmail.com',
      phone: '+855 15 774 991',
      vehicle: 'Capitol Bus',
      status: 'Confirmed',
    },
    {
      id: '#B-4816',
      user: 'Rathana Em',
      route: 'PP → SR',
      seat: 'B5',
      date: 'Apr 6',
      paid: '$12',
      payment: 'ABA',
      email: 'rathana.em@gmail.com',
      phone: '+855 11 223 998',
      vehicle: 'Sorya Bus',
      status: 'Pending',
    },
  ];
  const tabs = ['All', 'Confirmed', 'Pending', 'Cancelled'];
  const shown = filter === 'All' ? all : all.filter((b) => b.status === filter);
  return (
    <div>
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div className="page-title">Bookings</div>
          <div className="page-sub">View and manage all seat bookings</div>
        </div>
        <button className="btn btn-ghost btn-sm">
          <Icon d={icons.download} size={13} /> Export
        </button>
      </div>
      <div className="pill-nav">
        {tabs.map((t) => (
          <div
            key={t}
            className={`pill-tab ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </div>
        ))}
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="input-wrap" style={{ width: 240 }}>
            <span className="search-icon">
              <Icon d={icons.search} size={13} />
            </span>
            <input
              className="search-input"
              placeholder="Search by user or booking ID…"
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Contact</th>
                <th>Route</th>
                <th>Seat</th>
                <th>Date</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id}>
                  <td style={{ color: 'var(--accent)', fontSize: 12 }}>
                    {b.id}
                  </td>
                  <td style={{ fontWeight: 500 }}>{b.user}</td>
                  <td>
                    <div style={{ fontSize: 12 }}>{b.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {b.phone}
                    </div>
                  </td>
                  <td>
                    <div className="td-muted">{b.route}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{b.vehicle}</div>
                  </td>
                  <td className="td-muted">{b.seat}</td>
                  <td className="td-muted">{b.date}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 500 }}>
                    {b.paid}
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{b.payment}</div>
                  </td>
                  <td>
                    <span
                      className={`badge ${b.status === 'Confirmed' ? 'badge-green' : b.status === 'Pending' ? 'badge-amber' : 'badge-red'}`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {b.status === 'Pending' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            color: 'var(--green)',
                            borderColor: 'rgba(52,211,153,0.2)',
                          }}
                        >
                          <Icon
                            d={icons.check}
                            size={12}
                            color="var(--green)"
                          />
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm">
                        <Icon d={icons.x} size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── RENTALS ───────────────────────────────────────────────────────────────────
function Rentals() {
  const [tab, setTab] = useState('Pending');
  const all = [
    {
      id: '#R-201',
      user: 'Makara Phy',
      car: 'Honda CRV',
      from: 'Apr 3',
      to: 'Apr 6',
      days: 3,
      total: '$195',
      phone: '+855 12 440 909',
      license: 'DL-384920',
      status: 'Active',
    },
    {
      id: '#R-202',
      user: 'Sreymom Yim',
      car: 'Toyota Vios',
      from: 'Apr 5',
      to: 'Apr 7',
      days: 2,
      total: '$76',
      phone: '+855 77 203 118',
      license: 'DL-552184',
      status: 'Pending',
    },
    {
      id: '#R-203',
      user: 'Piseth Hang',
      car: 'Lexus RX',
      from: 'Apr 4',
      to: 'Apr 9',
      days: 5,
      total: '$475',
      phone: '+855 97 110 441',
      license: 'DL-901332',
      status: 'Active',
    },
    {
      id: '#R-204',
      user: 'Channary Oum',
      car: 'Kia Sportage',
      from: 'Apr 6',
      to: 'Apr 8',
      days: 2,
      total: '$116',
      phone: '+855 31 228 994',
      license: 'DL-441909',
      status: 'Pending',
    },
    {
      id: '#R-205',
      user: 'Vibol Chhim',
      car: 'Toyota Camry',
      from: 'Mar 28',
      to: 'Apr 3',
      days: 6,
      total: '$270',
      phone: '+855 15 800 772',
      license: 'DL-330128',
      status: 'Returned',
    },
  ];
  const tabs = ['Pending', 'Active', 'Returned'];
  const shown = all.filter((r) => r.status === tab);
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Rentals</div>
        <div className="page-sub">Approve requests and track car returns</div>
      </div>
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {[
          {
            label: 'Pending approval',
            val: all.filter((r) => r.status === 'Pending').length,
            color: 'var(--amber)',
          },
          {
            label: 'Currently active',
            val: all.filter((r) => r.status === 'Active').length,
            color: 'var(--green)',
          },
          {
            label: 'Returned this week',
            val: all.filter((r) => r.status === 'Returned').length,
            color: 'var(--text-2)',
          },
        ].map((m) => (
          <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div
              className="metric-val"
              style={{ color: m.color, fontSize: 28 }}
            >
              {m.val}
            </div>
          </div>
        ))}
      </div>
      <div className="pill-nav">
        {tabs.map((t) => (
          <div
            key={t}
            className={`pill-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </div>
        ))}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Contact</th>
                <th>Car</th>
                <th>Period</th>
                <th>License</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--accent)', fontSize: 12 }}>
                    {r.id}
                  </td>
                  <td style={{ fontWeight: 500 }}>{r.user}</td>
                  <td>
                    <div style={{ fontSize: 12 }}>{r.phone}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Driver</div>
                  </td>
                  <td className="td-muted">{r.car}</td>
                  <td className="td-muted">
                    {r.from} to {r.to}
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.days} days</div>
                  </td>
                  <td className="td-muted">{r.license}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 500 }}>
                    {r.total}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {r.status === 'Pending' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            color: 'var(--green)',
                            borderColor: 'rgba(52,211,153,0.2)',
                          }}
                        >
                          <Icon
                            d={icons.check}
                            size={12}
                            color="var(--green)"
                          />{' '}
                          Approve
                        </button>
                      )}
                      {r.status === 'Active' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            color: 'var(--purple)',
                            borderColor: 'rgba(167,139,250,0.2)',
                          }}
                        >
                          <Icon
                            d={icons.check}
                            size={12}
                            color="var(--purple)"
                          />{' '}
                          Returned
                        </button>
                      )}
                      {r.status === 'Returned' && (
                        <span className="badge badge-purple">Closed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
function Reports() {
  const bars = [42, 65, 55, 80, 70, 90, 58, 95, 72, 85, 88, 100];
  const rentalBars = [20, 35, 28, 50, 42, 60, 38, 65, 48, 55, 62, 70];
  return (
    <div>
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Revenue and usage analytics</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ width: 130, fontSize: 12 }}>
            <option>April 2026</option>
            <option>March 2026</option>
          </select>
          <button className="btn btn-ghost btn-sm">
            <Icon d={icons.download} size={13} /> Export CSV
          </button>
        </div>
      </div>
      <div className="metrics">
        {[
          {
            label: 'Total revenue',
            val: '$9,420',
            sub: 'Apr 2026',
            color: 'var(--accent)',
          },
          {
            label: 'Booking revenue',
            val: '$5,184',
            sub: 'from bus seats',
            color: 'var(--green)',
          },
          {
            label: 'Rental revenue',
            val: '$4,236',
            sub: 'from car rentals',
            color: 'var(--purple)',
          },
          {
            label: 'Transactions',
            val: '847',
            sub: 'completed payments',
            color: 'var(--amber)',
          },
        ].map((m) => (
          <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className="metric-val" style={{ color: m.color }}>
              {m.val}
            </div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid2">
        <div className="card">
          <div className="sec-title">Booking revenue — daily</div>
          <div className="chart-row" style={{ height: 60 }}>
            {bars.map((h, i) => (
              <div
                key={i}
                className={`bar ${i === bars.length - 1 ? 'lit' : ''}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Apr 1</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Apr 12</span>
          </div>
        </div>
        <div className="card">
          <div className="sec-title">Rental revenue — daily</div>
          <div className="chart-row" style={{ height: 60 }}>
            {rentalBars.map((h, i) => (
              <div
                key={i}
                className={`bar ${i === rentalBars.length - 1 ? 'lit' : ''}`}
                style={{
                  height: `${h}%`,
                  background: 'var(--purple-soft)',
                  borderColor: 'rgba(167,139,250,0.35)',
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Apr 1</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Apr 12</span>
          </div>
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="sec-title">Top routes by bookings</div>
          {[
            { route: 'Phnom Penh → Siem Reap', count: 342, pct: 100 },
            { route: 'Phnom Penh → Kampot', count: 214, pct: 63 },
            { route: 'Phnom Penh → Kampong Cham', count: 178, pct: 52 },
            { route: 'Siem Reap → Kampong Thom', count: 113, pct: 33 },
          ].map((r) => (
            <div key={r.route} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {r.route}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{r.count}</span>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="sec-title">Top rental cars by bookings</div>
          {[
            { car: 'Toyota Camry', count: 28, pct: 100, color: 'var(--green)' },
            { car: 'Honda CRV', count: 22, pct: 79, color: 'var(--green)' },
            { car: 'Lexus RX', count: 18, pct: 64, color: 'var(--green)' },
            { car: 'Kia Sportage', count: 14, pct: 50, color: 'var(--green)' },
          ].map((r) => (
            <div key={r.car} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {r.car}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {r.count} rentals
                </span>
              </div>
              <div className="prog-track">
                <div
                  className="prog-fill"
                  style={{ width: `${r.pct}%`, background: r.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="sec-title">Top customers by spend</div>
          {[
            { name: 'Sophea Chan', spend: '$420', trips: 12 },
            { name: 'Dara Meas', spend: '$310', trips: 9 },
            { name: 'Lina Keo', spend: '$255', trips: 7 },
            { name: 'Makara Phy', spend: '$210', trips: 6 },
          ].map((u) => (
            <div key={u.name} className="stat-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {u.trips} trips
                </div>
              </div>
              <span className="stat-val">{u.spend}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="sec-title">Payment mix</div>
          {[
            { label: 'ABA', pct: 48, color: 'var(--accent)' },
            { label: 'KHQR', pct: 34, color: 'var(--green)' },
            { label: 'Cash', pct: 18, color: 'var(--amber)' },
          ].map((p) => (
            <div key={p.label} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {p.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{p.pct}%</span>
              </div>
              <div className="prog-track">
                <div
                  className="prog-fill"
                  style={{ width: `${p.pct}%`, background: p.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
const PAGES = {
  dashboard: Dashboard,
  vehicles: Vehicles,
  routes: Routes,
  bookings: Bookings,
  rentals: Rentals,
  reports: Reports,
};

export default function App({ onLogout }) {
  const [active, setActive] = useState('dashboard');
  const Page = PAGES[active];
  const handleLogout = onLogout || (() => {
    window.location.href = '/login';
  });
  return (
    <>
      <style>{css}</style>
      <div className="app">
        <Sidebar active={active} setActive={setActive} onLogout={handleLogout} />
        <div className="main">
          <Page />
        </div>
      </div>
    </>
  );
}
