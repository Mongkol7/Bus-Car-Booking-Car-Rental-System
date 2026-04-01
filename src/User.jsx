import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carModels } from './data/transportData';

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

  body { background: var(--bg); color: var(--text); font-family: var(--font); min-height: 100vh; overflow-x: hidden; }

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
  .topnav-right { display: flex; align-items: center; gap: 16px; }
  .avatar-sm {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--accent-soft); border: 1px solid rgba(79,142,247,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 600; color: var(--accent); cursor: pointer;
    transition: all 0.2s;
  }
  .avatar-sm:hover { background: var(--accent); color: #fff; }
  .login-btn {
    padding: 6px 14px; border-radius: 8px; background: var(--accent); color: #fff;
    font-size: 13px; font-weight: 600; cursor: pointer; border: none;
    transition: all 0.2s;
  }
  .login-btn:hover { opacity: 0.85; transform: translateY(-1px); }

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
  .hero-title { font-size: 32px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 14px; }
  .hero-title span { color: var(--accent); }
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

  /* ── BUTTON ── */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 10px 20px; border-radius: var(--radius-xs);
    font-size: 13px; font-weight: 500; cursor: pointer;
    border: 0.5px solid; transition: all 0.15s; font-family: var(--font);
  }
  .btn-primary { background: var(--accent); color: #fff; border-color: transparent; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
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

  /* ── HOME ── */
  .hero { text-align: center; padding: 56px 0; background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(79,142,247,0.1) 0%, transparent 70%); }
  .hero-sub { font-size: 15px; color: var(--text-2); max-width: 420px; margin: 0 auto 36px; line-height: 1.6; }
  .service-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 620px; margin: 0 auto; }
  .service-card { background: var(--glass); border: 0.5px solid var(--glass-border); border-radius: var(--radius); padding: 28px 24px; cursor: pointer; text-align: left; }
  .service-card:hover { transform: translateY(-2px); background: var(--glass-strong); }

  /* ── SHAKE ANIMATION ── */
  @keyframes shake {
    0% { transform: translateX(0); }
    20% { transform: translateX(-4px); }
    40% { transform: translateX(4px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
    100% { transform: translateX(0); }
  }
  .shake-anim { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }

  /* ── BUS SEARCH & SEAT ── */
  .search-bar { background: var(--glass); border: 0.5px solid var(--glass-border); border-radius: var(--radius); padding: 20px 24px; display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; margin-bottom: 28px; }
  .route-card { background: var(--glass); border: 0.5px solid var(--glass-border); border-radius: var(--radius-sm); padding: 18px 20px; margin-bottom: 10px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.15s; }
  .route-card:hover { background: var(--glass-strong); }
  .route-card.selected { border-color: var(--accent); background: var(--accent-soft); }
  .route-time { font-size: 18px; font-weight: 600; }
  .route-arrow { color: var(--text-3); font-size: 13px; flex: 1; text-align: center; }
  .route-price { font-size: 17px; font-weight: 600; color: var(--accent); margin-left: auto; }
  
  .seat-map-wrap { background: var(--glass); border: 0.5px solid var(--glass-border); border-radius: var(--radius); padding: 28px; }
  .seat-legend { display: flex; gap: 20px; margin-bottom: 24px; }
  .seat-legend-item { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-2); }
  .seat-dot { width: 14px; height: 14px; border-radius: 3px; }
  .seat-dot-avail { background: var(--glass-strong); border: 0.5px solid var(--glass-border); }
  .seat-dot-taken { background: rgba(248,113,113,0.15); border: 0.5px solid rgba(248,113,113,0.3); }
  .seat-dot-sel { background: var(--accent); border: 0.5px solid var(--accent); }
  
  .bus-front { text-align: center; margin-bottom: 18px; }
  .steering { display: inline-block; font-size: 20px; background: var(--glass-strong); border: 0.5px solid var(--glass-border); border-radius: 50%; width: 40px; height: 40px; line-height: 40px; }
  
  .seat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-width: 220px; }
  .seat-col-gap { grid-column: span 4; height: 8px; }
  .seat { width: 44px; height: 40px; border-radius: 6px 6px 4px 4px; border: 0.5px solid; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 500; transition: all 0.12s; }
  .seat-avail { background: var(--glass-strong); border-color: var(--glass-border); color: var(--text-3); }
  .seat-avail:hover { border-color: var(--accent); color: var(--accent); }
  .seat-taken { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.25); color: rgba(248,113,113,0.3); cursor: not-allowed; }
  .seat-sel { background: var(--accent); border-color: var(--accent); color: #fff; }

  /* ── MODAL ── */
  .modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
    z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeIn 0.2s ease-out;
  }
  .modal-card {
    background: rgba(15,15,25,0.8);
    backdrop-filter: var(--blur);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius);
    max-width: 400px; width: 100%;
    padding: 32px; text-align: center;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

  .modal-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px; border: 1px solid rgba(79,142,247,0.3); }
  .modal-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #fff; }
  .modal-text { font-size: 14px; color: var(--text-2); margin-bottom: 28px; line-height: 1.5; }
  .modal-btns { display: flex; gap: 12px; }
  .modal-btns .btn { flex: 1; }

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
  .pay-method-icon { font-size: 22px; width: 32px; text-align: center; }
  .pay-method-name { font-size: 13px; font-weight: 500; }
  .pay-method-sub { font-size: 11px; color: var(--text-2); margin-top: 2px; }
  .pay-radio { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--glass-border); margin-left: auto; display: flex; align-items: center; justify-content: center; }
  .pay-radio.checked { border-color: var(--accent); }
  .pay-radio.checked::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); display: block; }
  .qr-box { background: white; border-radius: var(--radius-sm); padding: 16px; width: 130px; height: 130px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
  .qr-pattern { display: grid; grid-template-columns: repeat(10,1fr); gap: 1.5px; width: 98px; height: 98px; }
  .qr-cell { border-radius: 1px; }

  /* ── STEPS ── */
  .steps { display: flex; align-items: center; gap: 0; margin-bottom: 32px; }
  .step { display: flex; align-items: center; gap: 8px; }
  .step-num { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; border: 1px solid; }
  .step.done .step-num { background: var(--green); border-color: var(--green); color: #fff; }
  .step.active .step-num { background: var(--accent); border-color: var(--accent); color: #fff; }
  .step.idle .step-num { background: var(--glass); border-color: var(--glass-border); color: var(--text-3); }
  .step-line { flex: 1; height: 1px; background: var(--glass-border); margin: 0 8px; }

  /* ── CAR RENTAL ── */
  .car-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .car-card { background: var(--glass); border: 0.5px solid var(--glass-border); border-radius: var(--radius); overflow: hidden; cursor: pointer; transition: all 0.15s; }
  .car-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.2); }
  .car-img-wrap { height: 100px; background: var(--surface); display: flex; align-items: center; justify-content: center; font-size: 40px; }
  .car-body { padding: 16px; }
  .car-name { font-size: 14px; font-weight: 600; }
  .car-price { font-size: 15px; font-weight: 600; color: var(--accent); margin-top: 8px; }
  .car-price span { font-size: 11px; color: var(--text-2); font-weight: 400; }
  .date-range { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .total-box { background: var(--accent-soft); border: 0.5px solid rgba(79,142,247,0.25); border-radius: var(--radius-xs); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }

  /* ── PILL NAV ── */
  .pill-nav { display: flex; gap: 8px; margin-bottom: 20px; }
  .pill-tab { padding: 8px 20px; border-radius: 40px; background: var(--glass); border: 0.5px solid var(--glass-border); font-size: 12px; color: var(--text-2); cursor: pointer; transition: all 0.2s; }
  .pill-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }

  /* ── BOOKINGS ── */
  .booking-item { background: var(--glass); border: 0.5px solid var(--glass-border); border-radius: 12px; padding: 18px 20px; margin-bottom: 12px; }
  .booking-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .booking-route { font-size: 15px; font-weight: 600; }
  .booking-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 12px; }
  .booking-meta-item { font-size: 11px; color: var(--text-2); }
  .booking-meta-item span { display: block; font-size: 13px; font-weight: 500; color: var(--text); margin-top: 4px; }
  .qr-reveal {
    border-top: 0.5px solid var(--glass-border); margin-top: 14px; padding-top: 14px;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .qr-mini { background: white; border-radius: 8px; padding: 10px; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; }
  .qr-mini-grid { display: grid; grid-template-columns: repeat(8,1fr); gap: 1px; width: 78px; height: 78px; }

  .profile-avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--accent-soft); border: 1.5px solid rgba(79,142,247,0.3); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 600; color: var(--accent); margin: 0 auto 12px; }
`;

const Icon = ({ d, size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const icons = {
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M9 22V12h6v10',
  bus: 'M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zM6 18h12M6 6h12',
  car: 'M5 17h14M5 17a2 2 0 11-4 0M5 17V9l2-5h10l2 5v8a2 2 0 01-2 2h-2M17 17a2 2 0 104 0',
  ticket: 'M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  check: 'M20 6L9 17l-5-5',
  qr: 'M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h2v2h-2zm4 0h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2z',
  x: 'M18 6L6 18M6 6l12 12',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z'
};

const NAV = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'search', label: 'Bus booking', icon: 'bus' },
  { id: 'cars', label: 'Car rental', icon: 'car' },
  { id: 'bookings', label: 'My bookings', icon: 'ticket' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

function TopNav({ active, setActive, role, onLogout }) {
  const navigate = useNavigate();
  return (
    <nav className="topnav">
      <div
        className="topnav-logo"
        style={{ cursor: 'pointer' }}
        onClick={() => {
          setActive('home');
          navigate('/');
        }}
      >
        Book<span>.</span>Ride
      </div>
      <div className="topnav-links">
        {NAV.map((n) => (
          <div key={n.id} className={`topnav-link ${active === n.id ? 'active' : ''}`} onClick={() => setActive(n.id)}>{n.label}</div>
        ))}
      </div>
      <div className="topnav-right">
        {role === 'guest' ? (
          <button className="login-btn" onClick={() => navigate('/login')}>Login</button>
        ) : (
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px', height: 28 }} onClick={onLogout}>Logout</button>
        )}
        <div className="avatar-sm">{role === 'guest' ? '?' : 'ST'}</div>
      </div>
    </nav>
  );
}

function Home({ role, setActive }) {
  return (
    <div>
      <div className="hero">
        <div className="page">
          <div className="hero-title">Travel smarter<br />across <span>Cambodia</span></div>
          <div className="hero-sub">Book bus seats or rent a car — fast, simple, and on the go.</div>
          <div className="service-grid">
            <div className="service-card" onClick={() => setActive('search')}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🚌</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Bus seat booking</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Search routes, pick seats and pay.</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>Book now</button>
            </div>
            <div className="service-card" onClick={() => setActive('cars')}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🚗</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Car rental</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Browse sedans and SUVs for rent.</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>Browse cars</button>
            </div>
          </div>
        </div>
      </div>
      <div className="page">
        <div className="sec-title">Recent activity</div>
        {role === 'guest' ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>No recent activity. Sign in to track your trips.</p>
          </div>
        ) : (
          [{ type: 'ticket', route: 'Phnom Penh → Siem Reap', date: 'Apr 5, 06:00', seat: 'A12', status: 'Confirmed' },
           { type: 'rental', route: 'Toyota Camry rental', date: 'Mar 28 – Apr 3', seat: '3 days', status: 'Returned' }
          ].map((b, i) => (
            <div key={i} className="booking-item">
              <div className="booking-header">
                <div>
                  <span className={`badge ${b.type === 'ticket' ? 'badge-blue' : 'badge-purple'}`} style={{ marginBottom: 6, fontSize: 9 }}>
                    {b.type === 'ticket' ? 'BUS TICKET' : 'CAR RENTAL'}
                  </span>
                  <div className="booking-route">{b.route}</div>
                </div>
                <span className={`badge ${b.status === 'Confirmed' ? 'badge-green' : 'badge-purple'}`}>{b.status}</span>
              </div>
              <div className="booking-meta">
                <div className="booking-meta-item">Date<span>{b.date}</span></div>
                <div className="booking-meta-item">{b.type === 'ticket' ? 'Seat' : 'Duration'}<span>{b.seat}</span></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AuthModal({ onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-icon">🔐</div>
        <div className="modal-title">Sign in required</div>
        <div className="modal-text">To continue with your booking or rental, please sign in to your account. It's fast and secure.</div>
        <div className="modal-btns">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Sign in now</button>
        </div>
      </div>
    </div>
  );
}

function BusSearch({ role, setActive }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [payMethod, setPayMethod] = useState("aba");
  const [done, setDone] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [fromCity, setFromCity] = useState("Phnom Penh");
  const [toCity, setToCity] = useState("Siem Reap");
  const [travelDate, setTravelDate] = useState("2026-04-05");

  const destinations = [
    "Phnom Penh",
    "Siem Reap",
    "Battambang",
    "Sihanoukville",
    "Kampot",
    "Kep",
    "Kratie",
    "Kampong Cham",
    "Pursat",
    "Banteay Meanchey",
  ];

  const routes = [
    { id: 1, from: "06:00", to: "11:00", vehicle: "Mekong Express", type: "VIP Sleeper", avail: 8, price: 12, color: "#22c55e", bg: "rgba(34,197,94,0.16)" },
    { id: 2, from: "09:00", to: "14:00", vehicle: "Sorya Bus", type: "Express Coach", avail: 14, price: 12, color: "#f59e0b", bg: "rgba(245,158,11,0.16)" },
    { id: 3, from: "13:00", to: "18:00", vehicle: "Giant Ibis", type: "Luxury Coach", avail: 3, price: 15, color: "#a855f7", bg: "rgba(168,85,247,0.16)" },
    { id: 4, from: "15:30", to: "20:30", vehicle: "Larryta Express", type: "Mini Bus", avail: 10, price: 13, color: "#38bdf8", bg: "rgba(56,189,248,0.16)" },
    { id: 5, from: "22:00", to: "04:00", vehicle: "VET Air Bus", type: "Night Sleeper", avail: 5, price: 16, color: "#f87171", bg: "rgba(248,113,113,0.16)" },
    { id: 6, from: "07:30", to: "12:30", vehicle: "Capitol Tours", type: "Standard Coach", avail: 18, price: 11, color: "#60a5fa", bg: "rgba(96,165,250,0.16)" },
    { id: 7, from: "17:00", to: "22:30", vehicle: "Sorya Bus", type: "Premium Coach", avail: 6, price: 14, color: "#f59e0b", bg: "rgba(245,158,11,0.16)" },
  ];

  const currentRoute = routes.find(r => r.id === selectedRoute);
  const takenSeats = ["A1", "A3", "B2", "B4", "C1", "D3", "D4"];
  const seatRows = ["A", "B", "C", "D", "E"];
  const seatCols = [1, 2, 3, 4];

  const toggleSeat = (sid) => {
    if (takenSeats.includes(sid)) return;
    setSelectedSeats(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]);
  };

  if (done) return (
    <div className="page" style={{ maxWidth: 480 }}>
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="confirm-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>✓</div>
        <div className="page-title">Booking confirmed!</div>
        <div className="page-sub">Seat preserved. Show QR at boarding.</div>
        <div style={{ background: "white", borderRadius: 12, padding: 16, width: 110, height: 110, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: "1.5px", width: 82, height: 82 }}>
            {Array.from({ length: 81 }, (_, i) => (
              <div key={i} style={{ borderRadius: 1, background: Math.random() > 0.5 ? "#111" : "transparent", border: "0.5px solid #ddd" }} />
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={() => setActive('bookings')}>Go to My Bookings</button>
        <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }} onClick={() => { setDone(false); setStep(1); setSelectedSeats([]); setSelectedRoute(null); }}>Book another</button>
      </div>
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      {showAuthModal && (
        <AuthModal
          onConfirm={() => navigate('/login')}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      <div className="page-title">Bus booking</div>
      <div className="page-sub">Search across Cambodia's top routes</div>
      <div className="steps">
        {['Search', 'Seats', 'Info', 'Pay'].map((s, i) => (
          <div
            key={s}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: i === 3 ? 'initial' : 1,
            }}
          >
            <div
              className={`step ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : 'idle'}`}
            >
              <div className="step-num">{i + 1 < step ? '✓' : i + 1}</div>
              <div
                className="step-label"
                style={{ marginLeft: 6, fontSize: 11 }}
              >
                {s}
              </div>
            </div>
            {i < 3 && <div className="step-line" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          <div className="search-bar">
            <div>
              <div className="label">From</div>
              <select value={fromCity} onChange={(e) => setFromCity(e.target.value)}>
                {destinations.map((city) => (
                  <option key={`from-${city}`} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label">To</div>
              <select value={toCity} onChange={(e) => setToCity(e.target.value)}>
                {destinations.map((city) => (
                  <option key={`to-${city}`} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label">Date</div>
              <input
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
              />
            </div>
            <button className="btn btn-primary">Search</button>
          </div>
          <div className="sec-title">{routes.length} trips found</div>
          {routes.map((r) => (
            <div
              key={r.id}
              className={`route-card ${selectedRoute === r.id ? 'selected' : ''}`}
              onClick={() => {
                if (role === 'guest') {
                  setShowAuthModal(true);
                } else setSelectedRoute(r.id);
              }}
            >
              <div>
                <div className="route-time">{r.from}</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 2,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: r.color,
                      boxShadow: `0 0 0 3px ${r.bg}`,
                    }}
                  />
                  <span style={{ fontSize: 11, color: r.color }}>
                    {r.vehicle}
                  </span>
                </div>
                <div
                  style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}
                >
                  {r.type}
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
                    color: r.avail <= 5 ? 'var(--amber)' : 'var(--text-3)',
                    marginTop: 2,
                  }}
                >
                  {r.avail} seats left
                </div>
              </div>
              <div className="route-price">${r.price}</div>
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
              onClick={() => setStep(2)}
            >
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
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
                  <div key={row} style={{ display: 'contents' }}>
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
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="sec-title">Booking summary</div>
              <div className="card card-sm">
                <div className="summary-row">
                  <span className="summary-key">Route</span>
                  <span className="summary-val">{fromCity} → {toCity}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Date</span>
                  <span className="summary-val">{travelDate} • {currentRoute?.from}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Vehicle</span>
                  <span
                    className="summary-val"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: currentRoute?.color || 'var(--text)',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: currentRoute?.color || 'var(--text-3)',
                        boxShadow: `0 0 0 3px ${currentRoute?.bg || 'transparent'}`,
                      }}
                    />
                    {currentRoute?.vehicle}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Bus type</span>
                  <span className="summary-val">{currentRoute?.type}</span>
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
                  <span className="summary-val">${currentRoute?.price ?? 0}</span>
                </div>
                <div className="divider" style={{ margin: '10px 0' }} />
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
                    ${((currentRoute?.price ?? 0) * selectedSeats.length).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 24,
            }}
          >
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              disabled={!selectedSeats.length}
              onClick={() => setStep(3)}
            >
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="sec-title">Passenger information</div>
          <div className="form-row">
            <div>
              <div className="label">First name</div>
              <input placeholder="Sereymongkol" />
            </div>
            <div>
              <div className="label">Last name</div>
              <input placeholder="Thoeung" />
            </div>
          </div>
          <div className="form-group">
            <div className="label">Phone number</div>
            <input placeholder="+855 17 420 051" />
          </div>
          <div className="form-group">
            <div className="label">National ID / Passport</div>
            <input placeholder="ID123456789" />
          </div>
          <div className="form-group">
            <div className="label">Email (for ticket)</div>
            <input type="email" placeholder="thoeungsereymongkol@gmail.com" />
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
        </div>
      )}

      {step === 4 && (
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
              sub: 'Pay when you board',
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
                style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}
              >
                Amount: ${((currentRoute?.price ?? 0) * selectedSeats.length).toFixed(2)}
              </div>
            </div>
          )}

          <div className="divider" />
          <div className="total-box">
            <span style={{ fontSize: 13, color: 'var(--accent)' }}>
              Total to pay
            </span>
            <span
              style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}
            >
              ${((currentRoute?.price ?? 0) * selectedSeats.length).toFixed(2)}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 24,
            }}
          >
            <button className="btn btn-ghost" onClick={() => setStep(3)}>
              Back
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setDone(true)}
            >
              Confirm & Pay <Icon d={icons.check} size={15} color="#fff" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CarRental({ role, setActive }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);
  const [payMethod, setPayMethod] = useState("aba");
  const [done, setDone] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [shaking, setShaking] = useState(null);

  const cars = carModels.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    seats: c.seats,
    trans: c.trans,
    price: c.dailyRate,
    emoji: c.emoji,
    status: c.status,
  }));

  const car = cars.find(c => c.id === selected);
  const days = 3; // Mocked duration

  if (done) return (
    <div className="page" style={{ maxWidth: 480 }}>
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="confirm-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>✓</div>
        <div className="page-title">Rental Request Sent!</div>
        <div className="page-sub">Your rental is being processed.</div>
        <button className="btn btn-primary btn-full" onClick={() => setActive('bookings')}>Go to My Bookings</button>
      </div>
    </div>
  );

  return (
    <div className="page-wide">
      {showAuthModal && <AuthModal onConfirm={() => navigate('/login')} onClose={() => setShowAuthModal(false)} />}
      
      <div className="page-title">Car rental</div>
      <div className="page-sub">Premium vehicles for your personal use</div>
      
      {step > 1 && (
        <div className="steps" style={{ maxWidth: 640, margin: "0 auto 32px" }}>
          {['Details', 'Payment'].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === 1 ? 'initial' : 1 }}>
              <div className={`step ${i + 2 === step ? 'active' : i + 2 < step ? 'done' : 'idle'}`}>
                <div className="step-num">{i + 2 < step ? '✓' : i + 1}</div>
                <div className="step-label" style={{ marginLeft: 6, fontSize: 11 }}>{s}</div>
              </div>
              {i < 1 && <div className="step-line" />}
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="car-grid">
          {cars.map(c => (
            <div key={c.id} className={`car-card ${shaking === c.id ? 'shake-anim' : ''}`} onClick={() => {
               if (c.status === 'Rented') {
                 setShaking(c.id);
                 if (window.navigator.vibrate) window.navigator.vibrate(50); // Haptic feedback
                 setTimeout(() => setShaking(null), 400);
               } else if (role === 'guest') { 
                 setShowAuthModal(true); 
               } else { 
                 setSelected(c.id); setStep(2); 
               }
            }}>
              <div className="car-img-wrap">{c.emoji}</div>
              <div className="car-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div className="car-name">{c.name}</div>
                  <span className={`badge ${c.status === 'Available' ? 'badge-green' : 'badge-red'}`}>{c.status}</span>
                </div>
                <div className="car-price">${c.price}<span>/day</span></div>
                <button className={`btn btn-full btn-sm ${c.status === 'Rented' ? 'btn-ghost' : 'btn-primary'}`} style={{ marginTop: 12 }}>
                  {c.status === 'Rented' ? 'Not Available' : role === 'guest' ? 'Sign in to rent' : 'Rent now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && car && (
        <div className="page" style={{ maxWidth: 560, padding: 0 }}>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 32 }}>{car.emoji}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{car.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>{car.type} · {car.seats} seats · {car.trans}</div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 17, fontWeight: 600, color: "var(--accent)" }}>${car.price}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-2)" }}>/day</span></div>
            </div>
            <div className="divider" />
            <div className="date-range">
              <div><div className="label">Pickup date</div><input type="date" defaultValue="2026-04-05" /></div>
              <div><div className="label">Return date</div><input type="date" defaultValue="2026-04-08" /></div>
            </div>
            <div className="form-group"><div className="label">Driver full name</div><input placeholder="Sereymongkol Thoeung" /></div>
            <div className="form-group"><div className="label">Driver license number</div><input placeholder="DL-12345678" /></div>
            <div className="form-group"><div className="label">Phone number</div><input placeholder="+855 17 420 0051" /></div>
            <div className="total-box">
              <div><div style={{ fontSize: 12, color: "var(--accent)" }}>Total ({days} days × ${car.price})</div></div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>${car.price * days}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(3)}>Continue to Payment <Icon d={icons.arrow} size={15} color="#fff" /></button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && car && (
        <div className="page" style={{ maxWidth: 560, padding: 0 }}>
          <div className="card">
            <div className="sec-title">Choose payment method</div>
            {[
              { id: "aba", icon: "🏦", name: "ABA Bank", sub: "Scan QR or transfer" },
              { id: "khqr", icon: "🇰🇭", name: "KHQR", sub: "Cambodia QR payment standard" },
            ].map(m => (
              <div key={m.id} className={`pay-method ${payMethod === m.id ? "selected" : ""}`} onClick={() => setPayMethod(m.id)}>
                <div className="pay-method-icon">{m.icon}</div>
                <div><div className="pay-method-name">{m.name}</div><div className="pay-method-sub">{m.sub}</div></div>
                <div className={`pay-radio ${payMethod === m.id ? "checked" : ""}`} />
              </div>
            ))}

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12 }}>Scan to pay deposit</div>
              <div className="qr-box">
                <div className="qr-pattern">
                  {Array.from({ length: 100 }, (_, i) => (
                    <div key={i} className="qr-cell" style={{ background: Math.random() > 0.45 ? "#111" : "transparent" }} />
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10 }}>Deposit: ${(car.price * days * 0.2).toFixed(2)}</div>
            </div>

            <div className="divider" />
            <div className="total-box">
              <span style={{ fontSize: 13, color: "var(--accent)" }}>Remaining to pay on pickup</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>${(car.price * days * 0.8).toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
              <button className="btn btn-primary btn-lg" onClick={() => setDone(true)}>Confirm Rental <Icon d={icons.check} size={15} color="#fff" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyBookings({ role }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("upcoming");
  const [qrOpen, setQrOpen] = useState(null);
  const [rentalFilter, setRentalFilter] = useState("all");

  if (role === 'guest') return (
    <div className="page" style={{ textAlign: 'center' }}>
      <div className="confirm-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>🎫</div>
      <div className="page-title">Sign in to see bookings</div>
      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/login')}>Sign in now</button>
    </div>
  );

  const bookings = {
    upcoming: [
      { id: '#B-4811', type: 'ticket', route: 'Phnom Penh → Siem Reap', price: '$12.00', status: 'Confirmed', date: 'Apr 5, 2026', time: "06:00", seat: "A2" },
    ],
    past: [
      { id: '#B-4795', type: 'ticket', route: 'Phnom Penh → Kampot', price: '$8.00', status: 'Completed', date: 'Mar 12, 2026', time: "09:00", seat: "A5" },
    ],
    rentals: [
      { id: '#R-205', type: 'rental', route: 'Toyota Camry', price: '$135.00', status: 'Returned', date: 'Mar 28 – Apr 3', time: "3 days", seat: "PP-1122" },
      { id: '#R-202', type: 'rental', route: 'Honda CRV', price: '$130.00', status: 'Pending', date: 'Apr 5 – Apr 7', time: "2 days", seat: "PP-3344" },
    ],
  };

  const filteredRentals = (bookings.rentals || []).filter((b) => {
    if (rentalFilter === "all") return true;
    return b.status.toLowerCase() === rentalFilter;
  });

  const currentBookings = tab === "rentals" ? filteredRentals : (bookings[tab] || []);

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-title">My bookings</div>
      <div className="page-sub">Track all your travel activity</div>
      
      <div className="pill-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ id: "upcoming", label: "Upcoming" }, { id: "past", label: "Past trips" }, { id: "rentals", label: "Rentals" }].map(t => (
            <div key={t.id} className={`pill-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</div>
          ))}
        </div>
      </div>
      {tab === 'rentals' && (
        <div className="pill-nav" style={{ marginTop: -6, marginBottom: 20 }}>
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "returned", label: "Returned" },
          ].map((f) => (
            <div
              key={f.id}
              className={`pill-tab ${rentalFilter === f.id ? "active" : ""}`}
              onClick={() => setRentalFilter(f.id)}
            >
              {f.label}
            </div>
          ))}
        </div>
      )}

      {currentBookings.map(b => (
        <div key={b.id} className="booking-item">
          <div className="booking-header">
            <div>
              <span className={`badge ${b.type === 'ticket' ? 'badge-blue' : 'badge-purple'}`} style={{ marginBottom: 6, fontSize: 9 }}>{b.type === 'ticket' ? 'BUS TICKET' : 'CAR RENTAL'}</span>
              <div className="booking-route">{b.route}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{b.id} · {b.date}</div>
            </div>
            <span className={`badge ${b.status === 'Confirmed' ? 'badge-green' : b.status === 'Completed' || b.status === 'Returned' ? 'badge-purple' : 'badge-amber'}`}>{b.status}</span>
          </div>
          <div className="booking-meta">
            <div className="booking-meta-item">{b.type === 'ticket' ? 'Departure' : 'Duration'}<span>{b.time}</span></div>
            <div className="booking-meta-item">{b.type === 'ticket' ? 'Seat' : 'Plate'}<span>{b.seat}</span></div>
            <div className="booking-meta-item">Paid<span>{b.price}</span></div>
          </div>

          {(b.status === 'Confirmed' || b.status === 'Completed') && b.type === 'ticket' && (
            <div style={{ marginTop: 12, borderTop: "0.5px solid var(--glass-border)", paddingTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setQrOpen(qrOpen === b.id ? null : b.id)}>
                <Icon d={icons.qr} size={13} /> {qrOpen === b.id ? "Hide Ticket" : "Show Ticket"}
              </button>
              
              {qrOpen === b.id && (
                <div className="qr-reveal">
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>Scan at boarding gate</div>
                  <div className="qr-mini">
                    <div className="qr-mini-grid">
                      {Array.from({ length: 64 }, (_, i) => (
                        <div key={i} style={{ borderRadius: 1, background: Math.random() > 0.5 ? "#111" : "transparent" }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{b.id} · {b.route}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Profile({ role, onLogout }) {
  const navigate = useNavigate();
  if (role === 'guest') return (
    <div className="page" style={{ textAlign: 'center' }}>
      <div className="profile-avatar" style={{ opacity: 0.3 }}>?</div>
      <div className="page-title">Private Profile</div>
      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/login')}>Sign in now</button>
    </div>
  );

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
          Sereymongkol Thoeung
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
          thoeungsereymongkol@gmail.com
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
            <input defaultValue="Sereymongkol" />
          </div>
          <div>
            <div className="label">Last name</div>
            <input defaultValue="Thoeung" />
          </div>
        </div>
        <div className="form-group">
          <div className="label">Email</div>
          <input defaultValue="thoeungsereymongkol@gmail.com" />
        </div>
        <div className="form-group">
          <div className="label">Phone</div>
          <input defaultValue="+855 17 420 051" />
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
          <button className="btn btn-red btn-sm" onClick={onLogout}>
            <Icon d={icons.logout} size={12} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

const PAGES = { home: Home, search: BusSearch, cars: CarRental, bookings: MyBookings, profile: Profile };

export default function App({ role, onLogout }) {
  const [page, setPage] = useState('home');
  const PageComp = PAGES[page] || Home;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <style>{css}</style>
      <TopNav active={page} setActive={setPage} role={role} onLogout={onLogout} />
      <div style={{ flex: 1 }}>
        <PageComp role={role} setActive={setPage} onLogout={onLogout} />
      </div>
      <div style={{ textAlign: "center", padding: "12px 0", borderTop: "0.5px solid var(--glass-border)" }}>
        <span style={{ fontSize: 11, color: "var(--text-3)", cursor: "pointer" }} onClick={() => window.location.href = '/login'}>
          Sign in to another account
        </span>
      </div>
    </div>
  );
}
