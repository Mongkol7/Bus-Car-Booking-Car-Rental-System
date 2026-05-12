
import React, { useEffect, useRef, useState } from 'react';
import { busFleet, carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedAdmin';

export default // ── BOOKINGS ──────────────────────────────────────────────────────────────────
function Bookings() {
  const [filter, setFilter] = useState('All');
  const all = [{
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
    status: 'Confirmed'
  }, {
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
    status: 'Pending'
  }, {
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
    status: 'Confirmed'
  }, {
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
    status: 'Cancelled'
  }, {
    id: '#B-4817',
    user: 'Bopha Ros',
    route: 'PP → KC',
    seat: 'D9',
    date: 'Apr 5',
    paid: '$8',
    payment: 'KHQR',
    email: 'bopha.ros@gmail.com',
    phone: '+855 15 774 991',
    vehicle: 'Capitol Tours',
    status: 'Confirmed'
  }, {
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
    status: 'Pending'
  }];
  const tabs = ['All', 'Confirmed', 'Pending', 'Cancelled'];
  const shown = filter === 'All' ? all : all.filter(b => b.status === filter);
  return <div>
      <div className="page-header observe-animate" style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }}>
        <div>
          <div className="page-title">Bookings</div>
          <div className="page-sub">View and manage all seat bookings</div>
        </div>
        <button className="btn btn-ghost btn-sm">
          <Icon d={icons.download} size={13} /> Export
        </button>
      </div>
      <div className="pill-nav observe-animate">
        {tabs.map(t => <div key={t} className={`pill-tab ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
            {t}
          </div>)}
      </div>
      <div className="card observe-animate">
        <div className="toolbar">
          <div className="input-wrap" style={{
          width: 240
        }}>
            <span className="search-icon">
              <Icon d={icons.search} size={13} />
            </span>
            <input className="search-input" placeholder="Search by user or booking ID…" />
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
              {shown.map(b => <tr key={b.id}>
                  <td style={{
                color: 'var(--accent)',
                fontSize: 12
              }}>
                    {b.id}
                  </td>
                  <td style={{
                fontWeight: 500
              }}>{b.user}</td>
                  <td>
                    <div style={{
                  fontSize: 12
                }}>{b.email}</div>
                    <div style={{
                  fontSize: 11,
                  color: 'var(--text-3)'
                }}>
                      {b.phone}
                    </div>
                  </td>
                  <td>
                    <div className="td-muted">{b.route}</div>
                    <div style={{
                  fontSize: 11,
                  color: 'var(--text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                      <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: getCompanyMeta(b.vehicle).color
                  }} />
                      <span style={{
                    color: getCompanyMeta(b.vehicle).color
                  }}>
                        {b.vehicle}
                      </span>
                    </div>
                  </td>
                  <td className="td-muted">{b.seat}</td>
                  <td className="td-muted">{b.date}</td>
                  <td style={{
                color: 'var(--green)',
                fontWeight: 500
              }}>
                    {b.paid}
                    <div style={{
                  fontSize: 11,
                  color: 'var(--text-3)'
                }}>{b.payment}</div>
                  </td>
                  <td>
                    <span className={`badge ${b.status === 'Confirmed' ? 'badge-green' : b.status === 'Pending' ? 'badge-amber' : 'badge-red'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <div style={{
                  display: 'flex',
                  gap: 5
                }}>
                      {b.status === 'Pending' && <button className="btn btn-ghost btn-sm" style={{
                    color: 'var(--green)',
                    borderColor: 'rgba(52,211,153,0.2)'
                  }}>
                          <Icon d={icons.check} size={12} color="var(--green)" />
                        </button>}
                      <button className="btn btn-danger btn-sm">
                        <Icon d={icons.x} size={12} />
                      </button>
                    </div>
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}

// ── RENTALS ───────────────────────────────────────────────────────────────────
