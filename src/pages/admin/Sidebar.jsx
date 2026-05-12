
import React, { useEffect, useRef, useState } from 'react';
import { busFleet, carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedAdmin';

export default // ── SIDEBAR ────────────────────────────────────────────────────────────────────
function Sidebar({
  active,
  setActive,
  onLogout
}) {
  return <div className="sidebar">
      <div className="sidebar-logo" style={{
      cursor: 'pointer'
    }} onClick={() => setActive('dashboard')}>
        Book<span className="logo-dot">.</span><span className="logo-ride">Ride</span>
      </div>
      <div className="nav-section">
        <div className="nav-label">Overview</div>
        {NAV.slice(0, 1).map(n => <div key={n.id} className={`nav-item ${active === n.id ? 'active' : ''}`} onClick={() => setActive(n.id)}>
            <Icon d={icons[n.icon]} size={15} color="currentColor" />
            {n.label}
          </div>)}
      </div>
      <div className="nav-section">
        <div className="nav-label">Manage</div>
        {NAV.slice(1).map(n => <div key={n.id} className={`nav-item ${active === n.id ? 'active' : ''}`} onClick={() => setActive(n.id)}>
            <Icon d={icons[n.icon]} size={15} color="currentColor" />
            {n.label}
          </div>)}
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
    </div>;
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
