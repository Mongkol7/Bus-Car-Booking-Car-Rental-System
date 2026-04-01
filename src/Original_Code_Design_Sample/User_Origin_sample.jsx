import { useState } from 'react';

const css = `
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

  /* ── TOPNAV ── */
  .topnav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(10,10,20,0.82);
    backdrop-filter: var(--blur);
    border-bottom: 0.5px solid var(--glass-border);
    display: flex; align-items: center; gap: 0;
    padding: 0 32px; height: 54px;
  }
  .topnav-logo { font-size: 14px; font-weight: 600; color: var(--text); letter-spacing: -0.01em; margin-right: 32px; }
  .topnav-logo span { color: var(--accent); }
  .topnav-links { display: flex; align-items: center; gap: 2px; flex: 1; }
  .topnav-link {
    padding: 6px 14px; border-radius: var(--radius-xs);
    font-size: 13px; font-weight: 400; color: var(--text-2);
    cursor: pointer; transition: all 0.15s; border: 0.5px solid transparent;
  }
  .topnav-link:hover { background: var(--surface-hover); color: var(--text); }
  .topnav-link.active { background: var(--accent-soft); color: var(--accent); border-color: rgba(79,142,247,0.2); }
  .topnav-right { display: flex; align-items: center; gap: 10px; }
  .avatar-sm {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--accent-soft); border: 1px solid rgba(79,142,247,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 600; color: var(--accent); cursor: pointer;
  }

  /* ── LAYOUT ── */
  .page { max-width: 900px; margin: 0 auto; padding: 36px 24px; }
  .page-wide { max-width: 1100px; margin: 0 auto; padding: 36px 24px; }

  /* ── GLASS CARD ── */
  .card {
    background: var(--glass);
    backdrop-filter: var(--blur);
    border: 0.5px solid var(--glass-border);
    border-radius: var(--radius);
    padding: 24px 28px;
  }
  .card-sm { padding: 16px 20px; border-radius: var(--radius-sm); }

  /* ── TYPOGRAPHY ── */
  .page-title { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 4px; }
  .page-sub { font-size: 13px; color: var(--text-2); margin-bottom: 28px; }
  .sec-title { font-size: 14px; font-weight: 600; margin-bottom: 16px; }
  .label { font-size: 12px; font-weight: 500; color: var(--text-2); margin-bottom: 6px; }

  /* ── FORM ── */
  input, select, textarea {
    width: 100%; padding: 10px 14px;
    background: var(--glass); border: 0.5px solid var(--glass-border);
    border-radius: var(--radius-xs); color: var(--text);
    font-size: 13px; font-family: var(--font); outline: none;
    transition: border-color 0.15s;
  }
  input:focus, select:focus, textarea:focus { border-color: var(--accent); }
  input::placeholder, textarea::placeholder { color: var(--text-3); }
  select option { background: #1a1a2e; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .form-group { margin-bottom: 14px; }
  .input-icon-wrap { position: relative; }
  .input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); }

  /* ── BUTTON ── */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 10px 20px; border-radius: var(--radius-xs);
    font-size: 13px; font-weight: 500; cursor: pointer;
    border: 0.5px solid; transition: all 0.15s; font-family: var(--font);
  }
  .btn-primary { background: var(--accent); color: #fff; border-color: transparent; }
  .btn-primary:hover { opacity: 0.87; }
  .btn-ghost { background: var(--glass); color: var(--text-2); border-color: var(--glass-border); }
  .btn-ghost:hover { background: var(--surface-hover); color: var(--text); }
  .btn-green { background: var(--green-soft); color: var(--green); border-color: rgba(52,211,153,0.2); }
  .btn-red { background: var(--red-soft); color: var(--red); border-color: rgba(248,113,113,0.2); }
  .btn-full { width: 100%; }
  .btn-sm { padding: 7px 14px; font-size: 12px; }
  .btn-lg { padding: 13px 28px; font-size: 14px; }

  /* ── BADGE ── */
  .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 20px; white-space: nowrap; }
  .badge-green { background: var(--green-soft); color: var(--green); }
  .badge-amber { background: var(--amber-soft); color: var(--amber); }
  .badge-red   { background: var(--red-soft);   color: var(--red); }
  .badge-blue  { background: var(--accent-soft); color: var(--accent); }
  .badge-purple{ background: var(--purple-soft); color: var(--purple); }

  /* ── DIVIDER ── */
  .divider { height: 0.5px; background: var(--glass-border); margin: 20px 0; }

  /* ── AUTH SCREENS ── */
  .auth-wrap {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px;
    background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,142,247,0.12) 0%, transparent 70%);
  }
  .auth-card { width: 100%; max-width: 400px; }
  .auth-logo { text-align: center; margin-bottom: 28px; }
  .auth-logo-mark { font-size: 28px; font-weight: 700; letter-spacing: -0.03em; }
  .auth-logo-mark span { color: var(--accent); }
  .auth-logo-sub { font-size: 13px; color: var(--text-2); margin-top: 4px; }
  .auth-title { font-size: 20px; font-weight: 600; margin-bottom: 6px; }
  .auth-sub { font-size: 13px; color: var(--text-2); margin-bottom: 24px; }
  .auth-footer { text-align: center; margin-top: 18px; font-size: 13px; color: var(--text-2); }
  .auth-link { color: var(--accent); cursor: pointer; }
  .divider-or { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
  .divider-or::before, .divider-or::after { content: ''; flex: 1; height: 0.5px; background: var(--glass-border); }
  .divider-or span { font-size: 11px; color: var(--text-3); }

  /* ── HOME ── */
  .hero {
    text-align: center; padding: 56px 0 48px;
    background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(79,142,247,0.1) 0%, transparent 70%);
  }
  .hero-title { font-size: 36px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 14px; }
  .hero-title span { color: var(--accent); }
  .hero-sub { font-size: 15px; color: var(--text-2); max-width: 420px; margin: 0 auto 36px; line-height: 1.6; }
  .service-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 620px; margin: 0 auto; }
  .service-card {
    background: var(--glass); border: 0.5px solid var(--glass-border);
    border-radius: var(--radius); padding: 28px 24px; cursor: pointer;
    transition: all 0.18s; text-align: left;
  }
  .service-card:hover { background: var(--glass-strong); border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
  .service-icon { font-size: 28px; margin-bottom: 14px; }
  .service-name { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  .service-desc { font-size: 12px; color: var(--text-2); line-height: 1.5; }

  /* ── SEARCH FORM ── */
  .search-bar {
    background: var(--glass); border: 0.5px solid var(--glass-border);
    border-radius: var(--radius); padding: 18px 22px;
    display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end;
    margin-bottom: 28px;
  }
  .route-card {
    background: var(--glass); border: 0.5px solid var(--glass-border);
    border-radius: var(--radius-sm); padding: 18px 20px; cursor: pointer;
    transition: all 0.15s; margin-bottom: 10px; display: flex; align-items: center; gap: 16px;
  }
  .route-card:hover { background: var(--glass-strong); border-color: rgba(255,255,255,0.18); }
  .route-card.selected { border-color: var(--accent); background: var(--accent-soft); }
  .route-time { font-size: 18px; font-weight: 600; color: var(--text); }
  .route-arrow { color: var(--text-3); font-size: 13px; flex: 1; text-align: center; }
  .route-seats { font-size: 12px; color: var(--text-2); }
  .route-price { font-size: 17px; font-weight: 600; color: var(--accent); margin-left: auto; }

  /* ── SEAT MAP ── */
  .seat-map-wrap { background: var(--glass); border: 0.5px solid var(--glass-border); border-radius: var(--radius); padding: 28px; }
  .seat-legend { display: flex; gap: 20px; margin-bottom: 24px; }
  .seat-legend-item { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-2); }
  .seat-dot { width: 14px; height: 14px; border-radius: 3px; }
  .seat-dot-avail { background: var(--glass-strong); border: 0.5px solid var(--glass-border); }
  .seat-dot-taken { background: rgba(248,113,113,0.15); border: 0.5px solid rgba(248,113,113,0.3); }
  .seat-dot-sel { background: var(--accent); border: 0.5px solid var(--accent); }
  .bus-front { text-align: center; margin-bottom: 18px; }
  .steering { display: inline-block; font-size: 20px; background: var(--glass-strong); border: 0.5px solid var(--glass-border); border-radius: 50%; width: 40px; height: 40px; line-height: 40px; }
  .seat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; max-width: 220px; }
  .seat-col-gap { grid-column: span 4; height: 8px; }
  .seat {
    width: 44px; height: 40px; border-radius: 6px 6px 4px 4px;
    border: 0.5px solid; cursor: pointer; transition: all 0.12s;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 500;
  }
  .seat-avail { background: var(--glass-strong); border-color: var(--glass-border); color: var(--text-3); }
  .seat-avail:hover { border-color: var(--accent); color: var(--accent); }
  .seat-taken { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.25); color: rgba(248,113,113,0.4); cursor: not-allowed; }
  .seat-sel { background: var(--accent); border-color: var(--accent); color: #fff; }

  /* ── BOOKING SUMMARY ── */
  .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 0.5px solid rgba(255,255,255,0.05); }
  .summary-row:last-child { border-bottom: none; }
  .summary-key { font-size: 13px; color: var(--text-2); }
  .summary-val { font-size: 13px; font-weight: 500; }

  /* ── PAYMENT ── */
  .pay-method {
    border: 0.5px solid var(--glass-border); border-radius: var(--radius-sm);
    padding: 14px 18px; cursor: pointer; transition: all 0.15s; margin-bottom: 10px;
    display: flex; align-items: center; gap: 14px;
  }
  .pay-method:hover { background: var(--glass-strong); }
  .pay-method.selected { border-color: var(--accent); background: var(--accent-soft); }
  .pay-method-icon { font-size: 22px; width: 40px; text-align: center; }
  .pay-method-name { font-size: 13px; font-weight: 500; }
  .pay-method-sub { font-size: 11px; color: var(--text-2); margin-top: 2px; }
  .pay-radio { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--glass-border); margin-left: auto; display: flex; align-items: center; justify-content: center; }
  .pay-radio.checked { border-color: var(--accent); }
  .pay-radio.checked::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); display: block; }
  .qr-box { background: white; border-radius: var(--radius-sm); padding: 16px; width: 130px; height: 130px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
  .qr-pattern { display: grid; grid-template-columns: repeat(10,1fr); gap: 1.5px; width: 98px; height: 98px; }
  .qr-cell { border-radius: 1px; }

  /* ── CONFIRM ── */
  .confirm-icon { width: 60px; height: 60px; border-radius: 50%; background: var(--green-soft); border: 1px solid rgba(52,211,153,0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; font-size: 24px; }

  /* ── MY BOOKINGS ── */
  .booking-item {
    background: var(--glass); border: 0.5px solid var(--glass-border);
    border-radius: var(--radius-sm); padding: 18px 20px; margin-bottom: 12px;
  }
  .booking-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .booking-route { font-size: 15px; font-weight: 600; }
  .booking-meta { display: flex; gap: 18px; margin-bottom: 14px; }
  .booking-meta-item { font-size: 12px; color: var(--text-2); }
  .booking-meta-item span { display: block; font-size: 13px; font-weight: 500; color: var(--text); }
  .qr-reveal {
    border-top: 0.5px solid var(--glass-border); margin-top: 14px; padding-top: 14px;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .qr-mini { background: white; border-radius: 8px; padding: 10px; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; }
  .qr-mini-grid { display: grid; grid-template-columns: repeat(8,1fr); gap: 1px; width: 78px; height: 78px; }

  /* ── CAR GRID ── */
  .car-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
  .car-card {
    background: var(--glass); border: 0.5px solid var(--glass-border);
    border-radius: var(--radius); overflow: hidden; cursor: pointer; transition: all 0.15s;
  }
  .car-card:hover { background: var(--glass-strong); border-color: rgba(255,255,255,0.18); transform: translateY(-2px); }
  .car-img-wrap { height: 100px; background: var(--surface); display: flex; align-items: center; justify-content: center; font-size: 40px; border-bottom: 0.5px solid var(--glass-border); }
  .car-body { padding: 16px; }
  .car-name { font-size: 14px; font-weight: 600; margin-bottom: 3px; }
  .car-type { font-size: 11px; color: var(--text-2); margin-bottom: 12px; }
  .car-specs { display: flex; gap: 10px; margin-bottom: 12px; }
  .car-spec { font-size: 11px; color: var(--text-2); background: var(--surface); padding: 3px 8px; border-radius: 5px; }
  .car-footer { display: flex; justify-content: space-between; align-items: center; }
  .car-price { font-size: 15px; font-weight: 600; color: var(--accent); }
  .car-price span { font-size: 11px; font-weight: 400; color: var(--text-2); }

  /* ── RENTAL FORM ── */
  .date-range { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .total-box { background: var(--accent-soft); border: 0.5px solid rgba(79,142,247,0.25); border-radius: var(--radius-xs); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }

  /* ── STEP INDICATOR ── */
  .steps { display: flex; align-items: center; gap: 0; margin-bottom: 32px; }
  .step { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; }
  .step-num { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; border: 1px solid; }
  .step.done .step-num { background: var(--green); border-color: var(--green); color: #fff; }
  .step.active .step-num { background: var(--accent); border-color: var(--accent); color: #fff; }
  .step.idle .step-num { background: var(--glass); border-color: var(--glass-border); color: var(--text-3); }
  .step.done .step-label, .step.active .step-label { color: var(--text); }
  .step.idle .step-label { color: var(--text-3); }
  .step-line { flex: 1; height: 0.5px; background: var(--glass-border); margin: 0 8px; min-width: 20px; }

  /* ── PROFILE ── */
  .profile-avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--accent-soft); border: 1.5px solid rgba(79,142,247,0.3); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 600; color: var(--accent); margin: 0 auto 12px; }
`;

const Icon = ({ d, size = 16, color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const icons = {
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M9 22V12h6v10',
  bus: 'M8 6v6M16 6v6M2 12h20M4 18h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2zM6 18v2M18 18v2',
  car: 'M5 17H3a2 2 0 01-2-2V9l2-5h14l2 5v6a2 2 0 01-2 2h-2M7 17h10M7 17a2 2 0 11-4 0M17 17a2 2 0 104 0',
  ticket:
    'M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  search: 'M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  check: 'M20 6L9 17l-5-5',
  qr: 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM19 19h2v2h-2z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  x: 'M18 6L6 18M6 6l12 12',
  calendar:
    'M3 9h18M7 3v3M17 3v3M4 5h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z',
  map: 'M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0zM12 10m-3 0a3 3 0 106 0 3 3 0 00-6 0',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
};

// ── NAV ────────────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'search', label: 'Bus booking', icon: 'bus' },
  { id: 'cars', label: 'Car rental', icon: 'car' },
  { id: 'bookings', label: 'My bookings', icon: 'ticket' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

function TopNav({ active, setActive }) {
  return (
    <nav className="topnav">
      <div className="topnav-logo">
        Book<span>.</span>Ride
      </div>
      <div className="topnav-links">
        {NAV.map((n) => (
          <div
            key={n.id}
            className={`topnav-link ${active === n.id ? 'active' : ''}`}
            onClick={() => setActive(n.id)}
          >
            {n.label}
          </div>
        ))}
      </div>
      <div className="topnav-right">
        <div className="avatar-sm">SC</div>
      </div>
    </nav>
  );
}

// ── HOME ───────────────────────────────────────────────────────────────────────
function Home({ setActive }) {
  return (
    <div>
      <div className="hero">
        <div className="page">
          <div className="page-title hero-title">
            Travel smarter
            <br />
            across <span>Cambodia</span>
          </div>
          <div className="hero-sub">
            Book bus seats or rent a car — fast, simple, and on the go.
          </div>
          <div className="service-grid">
            <div className="service-card" onClick={() => setActive('search')}>
              <div className="service-icon">🚌</div>
              <div className="service-name">Bus seat booking</div>
              <div className="service-desc">
                Search routes, pick your seat and pay — all in one flow.
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary btn-sm">Book now</button>
              </div>
            </div>
            <div className="service-card" onClick={() => setActive('cars')}>
              <div className="service-icon">🚗</div>
              <div className="service-name">Car rental</div>
              <div className="service-desc">
                Browse sedans and SUVs. Pick up, drive, return — easy.
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-ghost btn-sm">Browse cars</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="page">
        <div className="sec-title">Recent activity</div>
        {[
          {
            route: 'Phnom Penh → Siem Reap',
            date: 'Apr 5, 06:00',
            seat: 'A12',
            status: 'Confirmed',
          },
          {
            route: 'Toyota Camry rental',
            date: 'Mar 28 – Apr 3',
            seat: '3 days',
            status: 'Returned',
          },
        ].map((b, i) => (
          <div key={i} className="booking-item" style={{ cursor: 'default' }}>
            <div className="booking-header">
              <div className="booking-route">{b.route}</div>
              <span
                className={`badge ${b.status === 'Confirmed' ? 'badge-green' : b.status === 'Returned' ? 'badge-purple' : 'badge-amber'}`}
              >
                {b.status}
              </span>
            </div>
            <div className="booking-meta">
              <div className="booking-meta-item">
                Date<span>{b.date}</span>
              </div>
              <div className="booking-meta-item">
                Seat / Duration<span>{b.seat}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
function Register({ setView }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">
            Book<span>.</span>Ride
          </div>
          <div className="auth-logo-sub">Bus & Car Booking + Car Rental</div>
        </div>
        <div className="card">
          <div className="auth-title">Create account</div>
          <div className="auth-sub">Start booking seats and renting cars</div>
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="label">First name</div>
              <input placeholder="Sophea" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="label">Last name</div>
              <input placeholder="Chan" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <div className="label">Email</div>
            <input type="email" placeholder="sophea@gmail.com" />
          </div>
          <div className="form-group">
            <div className="label">Phone</div>
            <input placeholder="+855 12 345 678" />
          </div>
          <div className="form-group">
            <div className="label">Password</div>
            <input type="password" placeholder="••••••••" />
          </div>
          <button
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: 6 }}
          >
            Create account
          </button>
          <div className="auth-footer">
            Already have an account?{' '}
            <span className="auth-link" onClick={() => setView('login')}>
              Sign in
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ setView }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">
            Book<span>.</span>Ride
          </div>
          <div className="auth-logo-sub">Bus & Car Booking + Car Rental</div>
        </div>
        <div className="card">
          <div className="auth-title">Welcome back</div>
          <div className="auth-sub">Sign in to your account</div>
          <div className="form-group">
            <div className="label">Email</div>
            <input type="email" placeholder="sophea@gmail.com" />
          </div>
          <div className="form-group">
            <div className="label">Password</div>
            <input type="password" placeholder="••••••••" />
          </div>
          <button
            className="btn btn-primary btn-full btn-lg"
            style={{ marginTop: 6 }}
          >
            Sign in
          </button>
          <div className="divider-or">
            <span>or</span>
          </div>
          <button className="btn btn-ghost btn-full">Continue as guest</button>
          <div className="auth-footer">
            No account?{' '}
            <span className="auth-link" onClick={() => setView('register')}>
              Register
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BUS SEARCH & SEAT ─────────────────────────────────────────────────────────
function BusSearch() {
  const [step, setStep] = useState(1);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [payMethod, setPayMethod] = useState('aba');
  const [done, setDone] = useState(false);

  const routes = [
    {
      id: 1,
      from: '06:00',
      to: '11:00',
      vehicle: 'Mekong Express',
      avail: 8,
      price: '$12',
    },
    {
      id: 2,
      from: '09:00',
      to: '14:00',
      vehicle: 'Sorya Bus',
      avail: 14,
      price: '$12',
    },
    {
      id: 3,
      from: '13:00',
      to: '18:00',
      vehicle: 'Giant Ibis',
      avail: 3,
      price: '$15',
    },
  ];

  const takenSeats = ['A1', 'A3', 'B2', 'B4', 'C1', 'D3', 'D4'];
  const seatRows = ['A', 'B', 'C', 'D', 'E'];
  const seatCols = [1, 2, 3, 4];

  const toggleSeat = (sid) => {
    if (takenSeats.includes(sid)) return;
    setSelectedSeats((prev) =>
      prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid],
    );
  };

  const stepState = (n) => (n < step ? 'done' : n === step ? 'active' : 'idle');

  if (done)
    return (
      <div className="page" style={{ maxWidth: 480 }}>
        <div
          className="card"
          style={{ textAlign: 'center', padding: '40px 32px' }}
        >
          <div className="confirm-icon">✓</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            Booking confirmed!
          </div>
          <div
            style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24 }}
          >
            Your seat is reserved. Show your QR at boarding.
          </div>
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 16,
              width: 110,
              height: 110,
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(9,1fr)',
                gap: '1.5px',
                width: 82,
                height: 82,
              }}
            >
              {Array.from({ length: 81 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 1,
                    background: Math.random() > 0.5 ? '#111' : 'transparent',
                    border: '0.5px solid #ddd',
                  }}
                />
              ))}
            </div>
          </div>
          <div
            style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 24 }}
          >
            Booking ID: #B-4822
          </div>
          <div className="summary-row">
            <span className="summary-key">Route</span>
            <span className="summary-val">Phnom Penh → Siem Reap</span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Departure</span>
            <span className="summary-val">Apr 5, 06:00</span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Seats</span>
            <span className="summary-val">
              {selectedSeats.join(', ') || 'A2'}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Paid</span>
            <span className="summary-val" style={{ color: 'var(--green)' }}>
              $12
            </span>
          </div>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 20 }}
            onClick={() => {
              setDone(false);
              setStep(1);
              setSelectedSeats([]);
              setSelectedRoute(null);
            }}
          >
            Book another
          </button>
        </div>
      </div>
    );

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-title">Bus booking</div>
      <div className="page-sub">Search, pick a seat and pay</div>

      <div className="steps">
        {['Search', 'Select seat', 'Passenger info', 'Payment'].map((s, i) => (
          <>
            <div key={s} className={`step ${stepState(i + 1)}`}>
              <div className="step-num">
                {stepState(i + 1) === 'done' ? '✓' : i + 1}
              </div>
              <div className="step-label">{s}</div>
            </div>
            {i < 3 && <div className="step-line" />}
          </>
        ))}
      </div>

      {step === 1 && (
        <>
          <div className="search-bar">
            <div>
              <div className="label">From</div>
              <select>
                <option>Phnom Penh</option>
                <option>Siem Reap</option>
                <option>Kampot</option>
              </select>
            </div>
            <div>
              <div className="label">To</div>
              <select>
                <option>Siem Reap</option>
                <option>Phnom Penh</option>
                <option>Kampot</option>
              </select>
            </div>
            <div>
              <div className="label">Date</div>
              <input type="date" defaultValue="2026-04-05" />
            </div>
            <button className="btn btn-primary">Search</button>
          </div>
          <div className="sec-title">{routes.length} trips found</div>
          {routes.map((r) => (
            <div
              key={r.id}
              className={`route-card ${selectedRoute === r.id ? 'selected' : ''}`}
              onClick={() => setSelectedRoute(r.id)}
            >
              <div>
                <div className="route-time">{r.from}</div>
                <div
                  style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}
                >
                  {r.vehicle}
                </div>
              </div>
              <div className="route-arrow">
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-3)',
                    marginBottom: 2,
                  }}
                >
                  5h 00m
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      flex: 1,
                      height: '0.5px',
                      background: 'var(--glass-border)',
                    }}
                  />
                  <span style={{ fontSize: 9, color: 'var(--text-3)' }}>→</span>
                </div>
              </div>
              <div>
                <div className="route-time">{r.to}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: r.avail <= 5 ? 'var(--amber)' : 'var(--text-2)',
                    marginTop: 2,
                  }}
                >
                  {r.avail} seats left
                </div>
              </div>
              <div className="route-price">{r.price}</div>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  border: '1.5px solid',
                  borderColor:
                    selectedRoute === r.id
                      ? 'var(--accent)'
                      : 'var(--glass-border)',
                  background:
                    selectedRoute === r.id ? 'var(--accent)' : 'transparent',
                  flexShrink: 0,
                }}
              />
            </div>
          ))}
          <div
            style={{
              marginTop: 20,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              className="btn btn-primary btn-lg"
              disabled={!selectedRoute}
              style={{ opacity: selectedRoute ? 1 : 0.4 }}
              onClick={() => setStep(2)}
            >
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="seat-map-wrap">
            <div className="seat-legend">
              <div className="seat-legend-item">
                <div className="seat-dot seat-dot-avail" />
                <span>Available</span>
              </div>
              <div className="seat-legend-item">
                <div className="seat-dot seat-dot-taken" />
                <span>Taken</span>
              </div>
              <div className="seat-legend-item">
                <div className="seat-dot seat-dot-sel" />
                <span>Selected</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
              <div>
                <div className="bus-front">
                  <span className="steering">🚌</span>
                </div>
                <div className="seat-grid">
                  {seatRows.map((row, ri) => (
                    <>
                      {seatCols.map((col) => {
                        const sid = `${row}${col}`;
                        const taken = takenSeats.includes(sid);
                        const sel = selectedSeats.includes(sid);
                        return (
                          <div
                            key={sid}
                            className={`seat ${taken ? 'seat-taken' : sel ? 'seat-sel' : 'seat-avail'}`}
                            style={col === 3 ? { marginLeft: 8 } : {}}
                            onClick={() => toggleSeat(sid)}
                          >
                            {sid}
                          </div>
                        );
                      })}
                      {ri < seatRows.length - 1 && (
                        <div className="seat-col-gap" />
                      )}
                    </>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="sec-title">Booking summary</div>
                <div
                  style={{
                    background: 'var(--glass)',
                    border: '0.5px solid var(--glass-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 18px',
                  }}
                >
                  <div className="summary-row">
                    <span className="summary-key">Route</span>
                    <span className="summary-val">Phnom Penh → Siem Reap</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-key">Date</span>
                    <span className="summary-val">Apr 5, 06:00</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-key">Vehicle</span>
                    <span className="summary-val">Mekong Express</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-key">Seats</span>
                    <span
                      className="summary-val"
                      style={{ color: 'var(--accent)' }}
                    >
                      {selectedSeats.length ? selectedSeats.join(', ') : 'None'}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-key">Price each</span>
                    <span className="summary-val">$12</span>
                  </div>
                  <div className="divider" />
                  <div className="summary-row">
                    <span
                      className="summary-key"
                      style={{ fontWeight: 600, color: 'var(--text)' }}
                    >
                      Total
                    </span>
                    <span
                      className="summary-val"
                      style={{ color: 'var(--green)', fontSize: 16 }}
                    >
                      ${selectedSeats.length * 12}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 20,
            }}
          >
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={!selectedSeats.length}
              style={{ opacity: selectedSeats.length ? 1 : 0.4 }}
              onClick={() => setStep(3)}
            >
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="card">
            <div className="sec-title">Passenger information</div>
            <div className="form-row">
              <div>
                <div className="label">First name</div>
                <input placeholder="Sophea" />
              </div>
              <div>
                <div className="label">Last name</div>
                <input placeholder="Chan" />
              </div>
            </div>
            <div className="form-group">
              <div className="label">Phone number</div>
              <input placeholder="+855 12 345 678" />
            </div>
            <div className="form-group">
              <div className="label">National ID / Passport</div>
              <input placeholder="ID123456789" />
            </div>
            <div className="form-group">
              <div className="label">Email (for ticket)</div>
              <input type="email" placeholder="sophea@gmail.com" />
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 20,
            }}
          >
            <button className="btn btn-ghost" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setStep(4)}
            >
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="card">
            <div className="sec-title">Choose payment method</div>
            {[
              {
                id: 'aba',
                icon: '🏦',
                name: 'ABA Bank',
                sub: 'Scan QR or transfer',
              },
              {
                id: 'khqr',
                icon: '🇰🇭',
                name: 'KHQR',
                sub: 'Cambodia QR payment standard',
              },
              {
                id: 'cash',
                icon: '💵',
                name: 'Cash on boarding',
                sub: 'Pay when you board the bus',
              },
            ].map((m) => (
              <div
                key={m.id}
                className={`pay-method ${payMethod === m.id ? 'selected' : ''}`}
                onClick={() => setPayMethod(m.id)}
              >
                <div className="pay-method-icon">{m.icon}</div>
                <div>
                  <div className="pay-method-name">{m.name}</div>
                  <div className="pay-method-sub">{m.sub}</div>
                </div>
                <div
                  className={`pay-radio ${payMethod === m.id ? 'checked' : ''}`}
                />
              </div>
            ))}
            {payMethod !== 'cash' && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-2)',
                    marginBottom: 12,
                  }}
                >
                  Scan with your banking app
                </div>
                <div className="qr-box">
                  <div className="qr-pattern">
                    {Array.from({ length: 100 }, (_, i) => (
                      <div
                        key={i}
                        className="qr-cell"
                        style={{
                          background:
                            Math.random() > 0.45 ? '#111' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-3)',
                    marginTop: 10,
                  }}
                >
                  Amount: $12.00
                </div>
              </div>
            )}
            <div className="divider" />
            <div className="total-box">
              <span style={{ fontSize: 13, color: 'var(--accent)' }}>
                Total to pay
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--accent)',
                }}
              >
                $12.00
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 20,
            }}
          >
            <button className="btn btn-ghost" onClick={() => setStep(3)}>
              Back
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setDone(true)}
            >
              Confirm & pay <Icon d={icons.check} size={15} color="#fff" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── CAR RENTAL ────────────────────────────────────────────────────────────────
function CarRental() {
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(1);

  const cars = [
    {
      id: 1,
      name: 'Toyota Camry',
      type: 'Sedan',
      seats: 5,
      trans: 'Auto',
      price: 45,
      emoji: '🚗',
      status: 'Available',
    },
    {
      id: 2,
      name: 'Honda CRV',
      type: 'SUV',
      seats: 7,
      trans: 'Auto',
      price: 65,
      emoji: '🚙',
      status: 'Rented',
    },
    {
      id: 3,
      name: 'Lexus RX 350',
      type: 'SUV',
      seats: 5,
      trans: 'Auto',
      price: 95,
      emoji: '🚘',
      status: 'Available',
    },
    {
      id: 4,
      name: 'Toyota Vios',
      type: 'Sedan',
      seats: 5,
      trans: 'Auto',
      price: 38,
      emoji: '🚗',
      status: 'Available',
    },
    {
      id: 5,
      name: 'Kia Sportage',
      type: 'SUV',
      seats: 5,
      trans: 'Auto',
      price: 58,
      emoji: '🚙',
      status: 'Available',
    },
    {
      id: 6,
      name: 'Honda City',
      type: 'Sedan',
      seats: 5,
      trans: 'Auto',
      price: 35,
      emoji: '🚗',
      status: 'Available',
    },
  ];

  const car = cars.find((c) => c.id === selected);

  if (step === 2 && car)
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <div className="page-title">Rental details</div>
        <div className="page-sub">Fill in your trip info</div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 32 }}>{car.emoji}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{car.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {car.type} · {car.seats} seats · {car.trans}
              </div>
            </div>
            <div
              style={{
                marginLeft: 'auto',
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              ${car.price}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--text-2)',
                }}
              >
                /day
              </span>
            </div>
          </div>
          <div className="divider" />
          <div className="date-range">
            <div>
              <div className="label">Pickup date</div>
              <input type="date" defaultValue="2026-04-05" />
            </div>
            <div>
              <div className="label">Return date</div>
              <input type="date" defaultValue="2026-04-08" />
            </div>
          </div>
          <div className="form-group">
            <div className="label">Driver full name</div>
            <input placeholder="Sophea Chan" />
          </div>
          <div className="form-group">
            <div className="label">Driver license number</div>
            <input placeholder="DL-12345678" />
          </div>
          <div className="form-group">
            <div className="label">Phone number</div>
            <input placeholder="+855 12 345 678" />
          </div>
          <div className="total-box">
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent)' }}>
                Total (3 days × ${car.price})
              </div>
            </div>
            <div
              style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}
            >
              ${car.price * 3}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" onClick={() => setStep(1)}>
            Back
          </button>
          <button className="btn btn-primary btn-lg">
            Submit rental request{' '}
            <Icon d={icons.check} size={15} color="#fff" />
          </button>
        </div>
      </div>
    );

  return (
    <div className="page-wide">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <div className="page-title">Car rental</div>
          <div className="page-sub">Choose a car for your trip</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ width: 130, fontSize: 12 }}>
            <option>All types</option>
            <option>Sedan</option>
            <option>SUV</option>
          </select>
          <select style={{ width: 130, fontSize: 12 }}>
            <option>Any price</option>
            <option>Under $50</option>
            <option>$50–$80</option>
            <option>$80+</option>
          </select>
          <button className="btn btn-ghost btn-sm">
            <Icon d={icons.filter} size={13} /> Filter
          </button>
        </div>
      </div>
      <div className="car-grid">
        {cars.map((c) => (
          <div
            key={c.id}
            className="car-card"
            onClick={() => {
              if (c.status === 'Available') {
                setSelected(c.id);
                setStep(2);
              }
            }}
          >
            <div className="car-img-wrap">{c.emoji}</div>
            <div className="car-body">
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
                  className={`badge ${c.status === 'Available' ? 'badge-green' : 'badge-red'}`}
                >
                  {c.status}
                </span>
              </div>
              <div className="car-type">{c.type}</div>
              <div className="car-specs">
                <span className="car-spec">{c.seats} seats</span>
                <span className="car-spec">{c.trans}</span>
              </div>
              <div className="car-footer">
                <div className="car-price">
                  ${c.price}
                  <span>/day</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={c.status !== 'Available'}
                  style={{ opacity: c.status === 'Available' ? 1 : 0.3 }}
                >
                  Rent
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MY BOOKINGS ───────────────────────────────────────────────────────────────
function MyBookings() {
  const [tab, setTab] = useState('upcoming');
  const [qrOpen, setQrOpen] = useState(null);

  const bookings = {
    upcoming: [
      {
        id: '#B-4822',
        route: 'Phnom Penh → Siem Reap',
        date: 'Apr 5, 2026',
        depart: '06:00',
        seat: 'A2',
        status: 'Confirmed',
        price: '$12',
      },
      {
        id: '#B-4821',
        route: 'Phnom Penh → Kampot',
        date: 'Apr 9, 2026',
        depart: '08:30',
        seat: 'C4',
        status: 'Confirmed',
        price: '$9',
      },
    ],
    past: [
      {
        id: '#B-4803',
        route: 'Siem Reap → Phnom Penh',
        date: 'Mar 20, 2026',
        depart: '07:00',
        seat: 'B3',
        status: 'Completed',
        price: '$12',
      },
      {
        id: '#B-4795',
        route: 'Phnom Penh → Kampong Cham',
        date: 'Mar 12, 2026',
        depart: '09:00',
        seat: 'A5',
        status: 'Completed',
        price: '$8',
      },
    ],
    rentals: [
      {
        id: '#R-205',
        route: 'Toyota Camry',
        date: 'Mar 28 – Apr 3, 2026',
        depart: '3 days',
        seat: 'PP-1122',
        status: 'Returned',
        price: '$135',
      },
      {
        id: '#R-202',
        route: 'Honda CRV',
        date: 'Apr 5 – Apr 7, 2026',
        depart: '2 days',
        seat: 'PP-3344',
        status: 'Pending',
        price: '$130',
      },
    ],
  };

  const tabs = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past trips' },
    { id: 'rentals', label: 'Car rentals' },
  ];

  return (
    <div className="page" style={{ maxWidth: 620 }}>
      <div className="page-title">My bookings</div>
      <div className="page-sub">All your trips and rentals in one place</div>
      <div className="pill-nav" style={{ marginBottom: 20 }}>
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`pill-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </div>
        ))}
      </div>
      {bookings[tab].map((b) => (
        <div key={b.id} className="booking-item">
          <div className="booking-header">
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-3)',
                  marginBottom: 3,
                }}
              >
                {b.id}
              </div>
              <div className="booking-route">{b.route}</div>
            </div>
            <span
              className={`badge ${b.status === 'Confirmed' ? 'badge-green' : b.status === 'Completed' ? 'badge-purple' : b.status === 'Pending' ? 'badge-amber' : 'badge-blue'}`}
            >
              {b.status}
            </span>
          </div>
          <div className="booking-meta">
            <div className="booking-meta-item">
              Date<span>{b.date}</span>
            </div>
            <div className="booking-meta-item">
              {tab === 'rentals' ? 'Duration' : 'Departure'}
              <span>{b.depart}</span>
            </div>
            <div className="booking-meta-item">
              {tab === 'rentals' ? 'Plate' : 'Seat'}
              <span>{b.seat}</span>
            </div>
            <div className="booking-meta-item">
              Paid<span style={{ color: 'var(--green)' }}>{b.price}</span>
            </div>
          </div>
          {(b.status === 'Confirmed' || b.status === 'Completed') &&
            tab !== 'rentals' && (
              <div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQrOpen(qrOpen === b.id ? null : b.id)}
                >
                  <Icon d={icons.qr} size={13} />{' '}
                  {qrOpen === b.id ? 'Hide ticket' : 'Show ticket'}
                </button>
                {qrOpen === b.id && (
                  <div className="qr-reveal">
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      Scan at boarding gate
                    </div>
                    <div className="qr-mini">
                      <div className="qr-mini-grid">
                        {Array.from({ length: 64 }, (_, i) => (
                          <div
                            key={i}
                            style={{
                              borderRadius: 1,
                              background:
                                Math.random() > 0.5 ? '#111' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {b.id} · {b.route}
                    </div>
                  </div>
                )}
              </div>
            )}
          {b.status === 'Confirmed' && (
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-red btn-sm">
                <Icon d={icons.x} size={12} /> Cancel booking
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
function Profile() {
  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="page-title">My profile</div>
      <div className="page-sub">Manage your account details</div>
      <div
        className="card"
        style={{ textAlign: 'center', marginBottom: 16, padding: '28px' }}
      >
        <div className="profile-avatar">SC</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          Sophea Chan
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
          sophea@gmail.com
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <span className="badge badge-green">Verified</span>
          <span className="badge badge-blue">Member since 2025</span>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Personal information</div>
        <div className="form-row">
          <div>
            <div className="label">First name</div>
            <input defaultValue="Sophea" />
          </div>
          <div>
            <div className="label">Last name</div>
            <input defaultValue="Chan" />
          </div>
        </div>
        <div className="form-group">
          <div className="label">Email</div>
          <input defaultValue="sophea@gmail.com" />
        </div>
        <div className="form-group">
          <div className="label">Phone</div>
          <input defaultValue="+855 12 345 678" />
        </div>
        <div className="form-group">
          <div className="label">National ID</div>
          <input defaultValue="ID123456789" />
        </div>
        <button className="btn btn-primary btn-sm">
          <Icon d={icons.edit} size={13} color="#fff" /> Save changes
        </button>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Change password</div>
        <div className="form-group">
          <div className="label">Current password</div>
          <input type="password" placeholder="••••••••" />
        </div>
        <div className="form-group">
          <div className="label">New password</div>
          <input type="password" placeholder="••••••••" />
        </div>
        <div className="form-group">
          <div className="label">Confirm new password</div>
          <input type="password" placeholder="••••••••" />
        </div>
        <button className="btn btn-ghost btn-sm">Update password</button>
      </div>
      <div className="card">
        <div className="sec-title" style={{ marginBottom: 8 }}>
          Trip stats
        </div>
        {[
          { k: 'Total trips', v: '12' },
          { k: 'Total rentals', v: '3' },
          { k: 'Favourite route', v: 'PP → SR' },
        ].map((s) => (
          <div
            key={s.k}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '9px 0',
              borderBottom: '0.5px solid rgba(255,255,255,0.05)',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{s.k}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{s.v}</span>
          </div>
        ))}
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-red btn-sm">
            <Icon d={icons.logout} size={12} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PILL NAV ── (reused inline)
function PillNav({ tabs, active, setActive }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        background: 'var(--glass)',
        border: '0.5px solid var(--glass-border)',
        borderRadius: 10,
        padding: 4,
        marginBottom: 20,
        width: 'fit-content',
      }}
    >
      {tabs.map((t) => (
        <div
          key={t.id || t}
          className={`pill-tab ${active === (t.id || t) ? 'active' : ''}`}
          onClick={() => setActive(t.id || t)}
        >
          {t.label || t}
        </div>
      ))}
    </div>
  );
}

// ── APP ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('home');
  const [authView, setAuthView] = useState('login');

  if (page === 'auth') {
    return (
      <>
        <style>{css}</style>
        {authView === 'login' ? (
          <Login
            setView={(v) => {
              if (v === 'register') setAuthView('register');
              else setPage('home');
            }}
          />
        ) : (
          <Register
            setView={(v) => {
              if (v === 'login') setAuthView('login');
            }}
          />
        )}
      </>
    );
  }

  const PAGES = {
    home: Home,
    search: BusSearch,
    cars: CarRental,
    bookings: MyBookings,
    profile: Profile,
  };
  const Page = PAGES[page] || Home;

  return (
    <>
      <style>{css}</style>
      <div
        style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      >
        <TopNav active={page} setActive={setPage} />
        <div style={{ flex: 1 }}>
          <Page setActive={setPage} />
        </div>
        <div
          style={{
            textAlign: 'center',
            padding: '12px 0',
            borderTop: '0.5px solid var(--glass-border)',
          }}
        >
          <span
            style={{ fontSize: 11, color: 'var(--text-3)', cursor: 'pointer' }}
            onClick={() => setPage('auth')}
          >
            Switch to Login / Register view
          </span>
        </div>
      </div>
    </>
  );
}
