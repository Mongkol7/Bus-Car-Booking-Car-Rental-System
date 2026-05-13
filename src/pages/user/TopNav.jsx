
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, setupScrollReveal, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedUser';

export default function TopNav({
  active,
  setActive,
  role,
  onLogout
}) {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuOpen]);
  const handleNavChange = id => {
    if (role === 'guest' && id === 'profile') {
      navigate('/login');
      return;
    }
    setActive(id);
  };

  return <>
      <nav className="topnav">
        <div className="topnav-logo" style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center'
      }} onClick={() => {
        setActive('home');
        navigate('/');
      }}>
          Book<span className="logo-dot">.</span>
          <span className="logo-ride">Ride</span>
        </div>
        <div className="topnav-links">
          {NAV.map(n => <div key={n.id} className={`topnav-link ${active === n.id ? 'active' : ''}`} onClick={() => handleNavChange(n.id)}>
              <span className="topnav-icon">
                <Icon d={icons[n.icon]} size={14} />
              </span>
              {n.label}
            </div>)}
        </div>
        <div className="topnav-right" style={{
        position: 'relative'
      }} ref={menuRef}>
          {role === 'guest' ? <button className="login-btn" onClick={() => navigate('/login')}>
              Login
            </button> : <div style={{
          fontSize: 12,
          color: 'var(--text-2)'
        }}>Welcome</div>}
          <div className="avatar-sm" onClick={() => {
          if (role !== 'guest') setMenuOpen(prev => !prev);
        }}>
            {role === 'guest' ? '?' : 'ST'}
          </div>
          {role !== 'guest' && <div className={`user-menu ${menuOpen ? 'open' : ''}`}>
              <div className="user-menu-item" onClick={onLogout}>
                <Icon d={icons.logout} size={12} /> Logout
              </div>
            </div>}
        </div>
      </nav>
      <div className="bottomnav">
        {NAV.map(n => {
        const mobileLabel = {
          home: 'Home',
          search: 'Bus booking',
          cars: 'Car rental',
          bookings: 'My booking',
          profile: 'Profile'
        }[n.id] || n.label;
        return <div key={`bottom-${n.id}`} className={`bottomnav-link ${active === n.id ? 'active' : ''}`} onClick={() => handleNavChange(n.id)}>
              <span className="bottomnav-icon">
                <Icon d={icons[n.icon]} size={12} />
              </span>
              {mobileLabel}
            </div>;
      })}
      </div>
    </>;
}
