
import React, { useState, useEffect, useRef } from 'react';
import { Icon, icons, NAV } from './utils/sharedAdmin';
import Sidebar from './pages/admin/Sidebar';
import Dashboard from './pages/admin/Dashboard';
import Vehicles from './pages/admin/Vehicles';
import Routes from './pages/admin/Routes';
import Bookings from './pages/admin/Bookings';
import Rentals from './pages/admin/Rentals';
import Customers from './pages/admin/Customers';
import Reports from './pages/admin/Reports';
import Footer from './components/Footer';
import { busFleet, carModels } from './data/transportData';
// ── SVG Icons ──────────────────────────────────────────────────────────────────

// ── NAV CONFIG ─────────────────────────────────────────────────────────────────

// ── SIDEBAR ────────────────────────────────────────────────────────────────────

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

// ── VEHICLES ──────────────────────────────────────────────────────────────────

// ── ROUTES ────────────────────────────────────────────────────────────────────

// ── BOOKINGS ──────────────────────────────────────────────────────────────────

// ── RENTALS ───────────────────────────────────────────────────────────────────

// ── REPORTS ───────────────────────────────────────────────────────────────────

// ── CUSTOMERS ────────────────────────────────────────────────────────────────

// ── APP ───────────────────────────────────────────────────────────────────────
const PAGES = {
  dashboard: Dashboard,
  vehicles: Vehicles,
  routes: Routes,
  bookings: Bookings,
  rentals: Rentals,
  customers: Customers,
  reports: Reports
};
export default function App({
  onLogout
}) {
  const [active, setActive] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const edgeStartX = useRef(0);
  const edgeStartY = useRef(0);
  const edgeFromLeft = useRef(false);
  const menuTouchStartX = useRef(0);
  const menuTouchStartY = useRef(0);
  const Page = PAGES[active];
  const handleLogout = onLogout || (() => {
    window.location.href = '/login';
  });
  const primaryNav = ['dashboard', 'routes', 'vehicles', 'bookings', 'rentals'];
  const extraNav = NAV.filter(n => !primaryNav.includes(n.id) && n.id !== 'reports' && n.id !== 'customers');
  useEffect(() => {
    const handleTouchStart = e => {
      const touch = e.touches[0];
      edgeStartX.current = touch.clientX;
      edgeStartY.current = touch.clientY;
      edgeFromLeft.current = touch.clientX <= 24;
    };
    const handleTouchEnd = e => {
      if (mobileMenuOpen || !edgeFromLeft.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - edgeStartX.current;
      const dy = touch.clientY - edgeStartY.current;
      if (dx > 60 && Math.abs(dy) < 40) {
        setMobileMenuOpen(true);
      }
    };
    window.addEventListener('touchstart', handleTouchStart, {
      passive: true
    });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mobileMenuOpen]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const elements = Array.from(document.querySelectorAll('.observe-animate'));
    if (!('IntersectionObserver' in window)) {
      elements.forEach(el => {
        el.dataset.revealed = 'true';
      });
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.dataset.revealed = 'true';
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.2,
      rootMargin: '0px 0px -10% 0px'
    });
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [active]);
  const handleMenuTouchStart = e => {
    const touch = e.touches[0];
    menuTouchStartX.current = touch.clientX;
    menuTouchStartY.current = touch.clientY;
  };
  const handleMenuTouchEnd = e => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - menuTouchStartX.current;
    const dy = touch.clientY - menuTouchStartY.current;
    if (dx < -60 && Math.abs(dy) < 40) {
      setMobileMenuOpen(false);
    }
  };
  return <>
      
      <div className="admin-mobilebar">
        <div className="admin-mobile-actions">
          <button className="admin-menu-btn" onClick={() => setMobileMenuOpen(true)}>
            <span className="mac-dots">
              <span className="mac-dot red" />
              <span className="mac-dot yellow" />
              <span className="mac-dot green" />
            </span>
          </button>
          <button className="admin-report-btn" onClick={() => setActive('customers')}>
            <Icon d={icons.users} size={12} color="currentColor" />
            Customers
          </button>
          <button className="admin-report-btn" onClick={() => setActive('reports')}>
            <Icon d={icons.chart} size={12} color="currentColor" />
            Reports
          </button>
        </div>
        <div className="admin-mobilebar-logo" onClick={() => setActive('dashboard')} style={{
        cursor: 'pointer'
      }}>
          <div>Book<span className="logo-dot">.</span><span className="logo-ride">Ride</span></div>
          <div className="admin-mobilebar-sub">AdminPanel</div>
        </div>
      </div>
      <div className="app">
        <Sidebar active={active} setActive={setActive} onLogout={handleLogout} />
        <div className="main">
          <Page />
          <div style={{
          marginTop: 'auto'
        }}>
            <Footer />
          </div>
        </div>
      </div>
      {mobileMenuOpen && <div className="admin-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="admin-menu-panel" onClick={e => e.stopPropagation()} onTouchStart={handleMenuTouchStart} onTouchEnd={handleMenuTouchEnd}>
            <div className="admin-menu-title">More</div>
            {extraNav.map(n => <div key={`menu-${n.id}`} className="admin-menu-item" onClick={() => {
          setActive(n.id);
          setMobileMenuOpen(false);
        }}>
                <Icon d={icons[n.icon]} size={14} color="currentColor" />
                {n.label}
              </div>)}
            <div className="admin-menu-title" style={{
          marginTop: 16
        }}>Account</div>
            <div className="admin-menu-item" onClick={handleLogout}>
              <Icon d={icons.logout} size={14} color="currentColor" />
              Logout
            </div>
          </div>
        </div>}
      <div className="admin-bottomnav">
        {NAV.filter(n => primaryNav.includes(n.id)).map(n => {
        const mobileLabel = {
          dashboard: 'Dashboard',
          routes: 'Routes',
          vehicles: 'Vehicles',
          bookings: 'Bookings',
          rentals: 'Rentals'
        }[n.id] || n.label;
        return <div key={`admin-bottom-${n.id}`} className={`admin-bottomnav-link ${active === n.id ? 'active' : ''}`} onClick={() => setActive(n.id)}>
            <Icon d={icons[n.icon]} size={16} color="currentColor" />
            {mobileLabel}
          </div>;
      })}
      </div>
    </>;
}
