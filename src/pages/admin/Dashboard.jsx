
import React, { useEffect, useRef, useState } from 'react';
import { busFleet, carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedAdmin';

export default // ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const bars = [30, 55, 40, 70, 60, 85, 50, 90, 65, 75, 80, 95];
  return <div>
        <div className="page-header observe-animate">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Bus & Car Booking + Car Rental System</div>
      </div>
        <div className="metrics observe-animate">
        {[{
        label: 'Total bookings',
        val: '1,284',
        sub: '+12% this week',
        color: 'var(--accent)'
      }, {
        label: 'Active rentals',
        val: '38',
        sub: '6 returning today',
        color: 'var(--green)'
      }, {
        label: 'Revenue (Apr)',
        val: '$9,420',
        sub: '↑ vs last month',
        color: 'var(--purple)'
      }, {
        label: 'Users',
        val: '3,107',
        sub: '210 new this month',
        color: 'var(--amber)'
      }].map(m => <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className="metric-val" style={{
          color: m.color
        }}>
              {m.val}
            </div>
            <div className="metric-sub">{m.sub}</div>
          </div>)}
      </div>
      <div className="grid2">
          <div className="card observe-animate">
            <div className="sec-title">Booking activity — last 12 days</div>
            <div className="chart-scroll">
              <div className="chart-row chart-animate observe-animate">
                {bars.map((h, i) => <div key={i} className={`bar ${i === bars.length - 1 ? 'lit' : ''}`} style={{
              '--bar-h': `${h}%`
            }} />)}
              </div>
            </div>
          <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8
        }}>
            <span style={{
            fontSize: 11,
            color: 'var(--text-3)'
          }}>Mar 23</span>
            <span style={{
            fontSize: 11,
            color: 'var(--text-3)'
          }}>Apr 5</span>
          </div>
        </div>
          <div className="card observe-animate">
          <div className="sec-title">Recent bookings</div>
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Route</th>
                <th>Company</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[{
                id: '#B-4821',
                route: 'PP → SR',
                company: 'Mekong Express',
                status: 'Confirmed',
                amt: '$12'
              }, {
                id: '#B-4820',
                route: 'SR → KP',
                company: 'Sorya Bus',
                status: 'Pending',
                amt: '$9'
              }, {
                id: '#B-4819',
                route: 'PP → KP',
                company: 'Giant Ibis',
                status: 'Confirmed',
                amt: '$15'
              }, {
                id: '#B-4818',
                route: 'KP → PP',
                company: 'VET Air Bus',
                status: 'Cancelled',
                amt: '$12'
              }].map(b => <tr key={b.id}>
                  <td style={{
                  color: 'var(--accent)',
                  fontSize: 12
                }}>{b.id}</td>
                  <td className="td-muted">{b.route}</td>
                  <td>
                    <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                      <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: getCompanyMeta(b.company).color
                    }} />
                      <span style={{
                      color: getCompanyMeta(b.company).color
                    }}>
                        {b.company}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${b.status === 'Confirmed' ? 'badge-green' : b.status === 'Pending' ? 'badge-amber' : 'badge-red'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td style={{
                  fontWeight: 500
                }}>{b.amt}</td>
                </tr>)}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      <div className="grid3">
        {[{
        label: 'Buses available',
        val: '14/18',
        pct: 78,
        color: 'var(--accent)'
      }, {
        label: 'Rental cars available',
        val: '9/12',
        pct: 75,
        color: 'var(--green)'
      }, {
        label: 'Active routes',
        val: '7',
        pct: 100,
        color: 'var(--purple)'
      }].map(s => <div key={s.label} className="card card-sm observe-animate">
            <div className="sec-title" style={{
          marginBottom: 4
        }}>
              {s.label}
            </div>
            <div style={{
          fontSize: 22,
          fontWeight: 600,
          color: s.color,
          marginBottom: 4
        }}>
              {s.val}
            </div>
            <div className="prog-track">
              <div className="prog-fill" style={{
            width: `${s.pct}%`,
            background: s.color
          }} />
            </div>
          </div>)}
      </div>
      <div className="grid3" style={{
      marginTop: 16
    }}>
        <div className="card">
          <div className="sec-title">Top customers</div>
          {[{
          name: 'Sophea Chan',
          email: 'sophea@gmail.com',
          trips: 12
        }, {
          name: 'Dara Meas',
          email: 'dara.meas@gmail.com',
          trips: 9
        }, {
          name: 'Lina Keo',
          email: 'lina.keo@gmail.com',
          trips: 7
        }, {
          name: 'Bopha Ros',
          email: 'bopha.ros@gmail.com',
          trips: 6
        }].map(u => <div key={u.email} className="stat-row">
              <div>
                <div style={{
              fontSize: 13,
              fontWeight: 500
            }}>{u.name}</div>
                <div style={{
              fontSize: 11,
              color: 'var(--text-3)'
            }}>
                  {u.email}
                </div>
              </div>
              <span className="stat-val">{u.trips} trips</span>
            </div>)}
        </div>
        <div className="card">
          <div className="sec-title">Top booking bus companies</div>
          {[{
          name: 'Mekong Express',
          count: 420,
          pct: 100
        }, {
          name: 'Sorya Bus',
          count: 310,
          pct: 74
        }, {
          name: 'Giant Ibis',
          count: 240,
          pct: 57
        }, {
          name: 'Larryta Express',
          count: 180,
          pct: 43
        }].map(c => <div key={c.name} style={{
          marginBottom: 12
        }}>
              <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4
          }}>
                <span style={{
              fontSize: 12,
              color: getCompanyMeta(c.name).color,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
                  <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: getCompanyMeta(c.name).color
              }} />
                  {c.name}
                </span>
                <span style={{
              fontSize: 12,
              fontWeight: 500
            }}>
                  {c.count}
                </span>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{
              width: `${c.pct}%`,
              background: getCompanyMeta(c.name).color
            }} />
              </div>
            </div>)}
        </div>
      </div>
    </div>;
}

// ── VEHICLES ──────────────────────────────────────────────────────────────────
