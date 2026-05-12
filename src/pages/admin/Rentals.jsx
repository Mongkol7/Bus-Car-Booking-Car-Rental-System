
import React, { useEffect, useRef, useState } from 'react';
import { busFleet, carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedAdmin';

export default // ── RENTALS ───────────────────────────────────────────────────────────────────
function Rentals() {
  const [tab, setTab] = useState('Pending');
  const all = [{
    id: '#R-201',
    user: 'Makara Phy',
    car: 'Honda CRV',
    from: 'Apr 3',
    to: 'Apr 6',
    days: 3,
    total: '$195',
    phone: '+855 12 440 909',
    license: 'DL-384920',
    status: 'Active'
  }, {
    id: '#R-202',
    user: 'Sreymom Yim',
    car: 'Toyota Vios',
    from: 'Apr 5',
    to: 'Apr 7',
    days: 2,
    total: '$76',
    phone: '+855 77 203 118',
    license: 'DL-552184',
    status: 'Pending'
  }, {
    id: '#R-203',
    user: 'Piseth Hang',
    car: 'Lexus RX',
    from: 'Apr 4',
    to: 'Apr 9',
    days: 5,
    total: '$475',
    phone: '+855 97 110 441',
    license: 'DL-901332',
    status: 'Active'
  }, {
    id: '#R-204',
    user: 'Channary Oum',
    car: 'Kia Sportage',
    from: 'Apr 6',
    to: 'Apr 8',
    days: 2,
    total: '$116',
    phone: '+855 31 228 994',
    license: 'DL-441909',
    status: 'Pending'
  }, {
    id: '#R-205',
    user: 'Vibol Chhim',
    car: 'Toyota Camry',
    from: 'Mar 28',
    to: 'Apr 3',
    days: 6,
    total: '$270',
    phone: '+855 15 800 772',
    license: 'DL-330128',
    status: 'Returned'
  }];
  const tabs = ['Pending', 'Active', 'Returned'];
  const shown = all.filter(r => r.status === tab);
  return <div>
      <div className="page-header observe-animate">
        <div className="page-title">Rentals</div>
        <div className="page-sub">Approve requests and track car returns</div>
      </div>
      <div className="metrics observe-animate" style={{
      gridTemplateColumns: 'repeat(3,1fr)'
    }}>
        {[{
        label: 'Pending approval',
        val: all.filter(r => r.status === 'Pending').length,
        color: 'var(--amber)'
      }, {
        label: 'Currently active',
        val: all.filter(r => r.status === 'Active').length,
        color: 'var(--green)'
      }, {
        label: 'Returned this week',
        val: all.filter(r => r.status === 'Returned').length,
        color: 'var(--text-2)'
      }].map(m => <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className="metric-val" style={{
          color: m.color,
          fontSize: 28
        }}>
              {m.val}
            </div>
          </div>)}
      </div>
      <div className="pill-nav observe-animate">
        {tabs.map(t => <div key={t} className={`pill-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </div>)}
      </div>
      <div className="card observe-animate">
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
              {shown.map(r => <tr key={r.id}>
                  <td style={{
                color: 'var(--accent)',
                fontSize: 12
              }}>
                    {r.id}
                  </td>
                  <td style={{
                fontWeight: 500
              }}>{r.user}</td>
                  <td>
                    <div style={{
                  fontSize: 12
                }}>{r.phone}</div>
                    <div style={{
                  fontSize: 11,
                  color: 'var(--text-3)'
                }}>Driver</div>
                  </td>
                  <td className="td-muted">{r.car}</td>
                  <td className="td-muted">
                    {r.from} to {r.to}
                    <div style={{
                  fontSize: 11,
                  color: 'var(--text-3)'
                }}>{r.days} days</div>
                  </td>
                  <td className="td-muted">{r.license}</td>
                  <td style={{
                color: 'var(--green)',
                fontWeight: 500
              }}>
                    {r.total}
                  </td>
                  <td>
                    <div style={{
                  display: 'flex',
                  gap: 5
                }}>
                      {r.status === 'Pending' && <button className="btn btn-ghost btn-sm" style={{
                    color: 'var(--green)',
                    borderColor: 'rgba(52,211,153,0.2)'
                  }}>
                          <Icon d={icons.check} size={12} color="var(--green)" />{' '}
                          Approve
                        </button>}
                      {r.status === 'Active' && <button className="btn btn-ghost btn-sm" style={{
                    color: 'var(--purple)',
                    borderColor: 'rgba(167,139,250,0.2)'
                  }}>
                          <Icon d={icons.check} size={12} color="var(--purple)" />{' '}
                          Returned
                        </button>}
                      {r.status === 'Returned' && <span className="badge badge-purple">Closed</span>}
                    </div>
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
