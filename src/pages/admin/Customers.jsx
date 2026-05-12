
import React, { useEffect, useRef, useState } from 'react';
import { busFleet, carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedAdmin';

export default // ── CUSTOMERS ────────────────────────────────────────────────────────────────
function Customers() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const customers = [{
    id: 'C-1024',
    name: 'Sophea Chan',
    email: 'sophea.chan@mail.com',
    phone: '+855 12 345 678',
    trips: 12,
    last: 'Mar 30, 2026',
    status: 'VIP'
  }, {
    id: 'C-1023',
    name: 'Dara Meas',
    email: 'dara.meas@mail.com',
    phone: '+855 17 420 051',
    trips: 9,
    last: 'Mar 28, 2026',
    status: 'Active'
  }, {
    id: 'C-1022',
    name: 'Lina Keo',
    email: 'lina.keo@mail.com',
    phone: '+855 92 118 220',
    trips: 7,
    last: 'Mar 26, 2026',
    status: 'Active'
  }, {
    id: 'C-1021',
    name: 'Makara Phy',
    email: 'makara.phy@mail.com',
    phone: '+855 78 552 190',
    trips: 6,
    last: 'Mar 20, 2026',
    status: 'Inactive'
  }, {
    id: 'C-1020',
    name: 'Chenda Sok',
    email: 'chenda.sok@mail.com',
    phone: '+855 11 904 332',
    trips: 5,
    last: 'Mar 18, 2026',
    status: 'Active'
  }, {
    id: 'C-1019',
    name: 'Sokha Lim',
    email: 'sokha.lim@mail.com',
    phone: '+855 16 300 991',
    trips: 4,
    last: 'Mar 15, 2026',
    status: 'Inactive'
  }, {
    id: 'C-1018',
    name: 'Vanna Chea',
    email: 'vanna.chea@mail.com',
    phone: '+855 10 771 220',
    trips: 3,
    last: 'Mar 12, 2026',
    status: 'Active'
  }, {
    id: 'C-1017',
    name: 'Serey Roth',
    email: 'serey.roth@mail.com',
    phone: '+855 95 220 774',
    trips: 2,
    last: 'Mar 7, 2026',
    status: 'VIP'
  }];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = customers.filter(c => {
    const matchesQuery = !normalizedQuery || c.name.toLowerCase().includes(normalizedQuery) || c.email.toLowerCase().includes(normalizedQuery) || c.phone.toLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === 'all' || c.status.toLowerCase() === statusFilter;
    return matchesQuery && matchesStatus;
  });
  const statusBadge = status => {
    if (status === 'Active') return 'badge-green';
    if (status === 'VIP') return 'badge-purple';
    if (status === 'Inactive') return 'badge-red';
    return 'badge-amber';
  };
  return <div>
      <div className="page-header observe-animate">
        <div className="page-title">Customers</div>
        <div className="page-sub">Manage customer profiles and activity</div>
      </div>

      <div className="pill-nav observe-animate" style={{
      justifyContent: 'space-between',
      width: '100%'
    }}>
        <div style={{
        display: 'flex',
        gap: 8
      }}>
          {[{
          id: 'all',
          label: 'All'
        }, {
          id: 'active',
          label: 'Active'
        }, {
          id: 'inactive',
          label: 'Inactive'
        }, {
          id: 'vip',
          label: 'VIP'
        }].map(s => <div key={s.id} className={`pill-tab ${statusFilter === s.id ? 'active' : ''}`} onClick={() => setStatusFilter(s.id)}>
              {s.label}
            </div>)}
        </div>
        <div style={{
        minWidth: 220,
        width: '32%'
      }}>
          <input placeholder="Search name, email, phone" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="card observe-animate">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Trips</th>
                <th>Last booking</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => <tr key={c.id}>
                  <td>
                    <div style={{
                  fontWeight: 600
                }}>{c.name}</div>
                    <div className="td-muted">{c.id}</div>
                  </td>
                  <td className="td-muted">{c.email}</td>
                  <td className="td-muted">{c.phone}</td>
                  <td style={{
                fontWeight: 600
              }}>{c.trips}</td>
                  <td className="td-muted">{c.last}</td>
                  <td>
                    <span className={`badge ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm">View</button>
                  </td>
                </tr>)}
              {!filtered.length && <tr>
                  <td colSpan={7} className="td-muted" style={{
                padding: 18
              }}>
                    No customers found.
                  </td>
                </tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}

// ── APP ───────────────────────────────────────────────────────────────────────
