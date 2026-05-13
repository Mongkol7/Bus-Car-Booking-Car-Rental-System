
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { busFleet, carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedAdmin';

export default // ── VEHICLES ──────────────────────────────────────────────────────────────────
function Vehicles() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = location.pathname === '/admin/vehicles/rental-cars' ? 'cars' : 'buses';
  const setTab = nextTab => {
    navigate(nextTab === 'cars' ? '/admin/vehicles/rental-cars' : '/admin/vehicles/buses');
  };
  const buses = busFleet;
  const cars = carModels;
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.observe-animate'));
    elements.forEach(el => {
      if (!el.dataset.revealed) {
        el.dataset.revealed = 'true';
      }
    });
  }, [tab]);
  return <div>
        <div className="page-header observe-animate" style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }}>
        <div>
          <div className="page-title">Vehicles</div>
          <div className="page-sub">Manage fleet — buses and rental cars</div>
        </div>
        <button className="btn btn-primary btn-sm">
          <Icon d={icons.plus} size={13} color="#fff" /> Add vehicle
        </button>
      </div>
        <div className="pill-nav observe-animate">
          {['buses', 'cars'].map(t => <div key={t} className={`pill-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'buses' ? 'Buses' : 'Rental cars'}
          </div>)}
      </div>
        {tab === 'buses' ? <div className="card observe-animate">
          <div className="toolbar">
            <div className="input-wrap" style={{
          width: 220
        }}>
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
                {buses.map(b => <tr key={b.id}>
                    <td style={{
                color: 'var(--accent)',
                fontSize: 12
              }}>
                      {b.id}
                    </td>
                    <td style={{
                fontWeight: 500
              }}>{b.name}</td>
                    <td className="td-muted">{b.type}</td>
                    <td className="td-muted">{b.plate}</td>
                    <td className="td-muted">{b.seats}</td>
                    <td className="td-muted">{b.driver}</td>
                    <td>
                      <span className={`badge ${b.status === 'Active' ? 'badge-green' : 'badge-amber'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <div style={{
                  display: 'flex',
                  gap: 6
                }}>
                        <button className="btn btn-ghost btn-sm">
                          <Icon d={icons.edit} size={12} />
                        </button>
                        <button className="btn btn-danger btn-sm">
                          <Icon d={icons.trash} size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div> : <div className="car-grid">
            {cars.map((c, i) => <div key={c.id} className="car-card observe-animate" style={{
        '--delay': `${i * 40}ms`
      }}>
              <div className="car-img">🚗</div>
              <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 4
        }}>
                <div className="car-name">{c.name}</div>
                <span className={`badge ${c.status === 'Available' ? 'badge-green' : c.status === 'Rented' ? 'badge-blue' : 'badge-amber'}`}>
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
                <div style={{
            display: 'flex',
            gap: 6
          }}>
                  <button className="btn btn-ghost btn-sm">
                    <Icon d={icons.edit} size={12} />
                  </button>
                  <button className="btn btn-danger btn-sm">
                    <Icon d={icons.trash} size={12} />
                  </button>
                </div>
              </div>
            </div>)}
        </div>}
    </div>;
}

// ── ROUTES ────────────────────────────────────────────────────────────────────
