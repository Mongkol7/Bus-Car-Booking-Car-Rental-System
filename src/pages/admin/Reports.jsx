
import React, { useEffect, useRef, useState } from 'react';
import { busFleet, carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedAdmin';

export default // ── REPORTS ───────────────────────────────────────────────────────────────────
function Reports() {
  const days = ['Apr 1', 'Apr 2', 'Apr 3', 'Apr 4', 'Apr 5', 'Apr 6', 'Apr 7', 'Apr 8', 'Apr 9', 'Apr 10', 'Apr 11', 'Apr 12'];
  const bookingDaily = [420, 510, 460, 620, 580, 740, 520, 810, 590, 690, 730, 860];
  const rentalDaily = [180, 240, 210, 310, 280, 390, 260, 430, 300, 360, 410, 470];
  const maxBooking = Math.max(...bookingDaily);
  const maxRental = Math.max(...rentalDaily);
  return <div>
      <div className="page-header observe-animate" style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }}>
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Revenue and usage analytics</div>
        </div>
        <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }}>
          <select style={{
          width: 130,
          fontSize: 12
        }}>
            <option>April 2026</option>
            <option>March 2026</option>
          </select>
          <button className="btn btn-ghost btn-sm">
            <Icon d={icons.download} size={13} /> Export CSV
          </button>
        </div>
      </div>
      <div className="metrics observe-animate">
        {[{
        label: 'Total revenue',
        val: '$9,420',
        sub: 'Apr 2026',
        color: 'var(--accent)'
      }, {
        label: 'Booking revenue',
        val: '$5,184',
        sub: 'from bus seats',
        color: 'var(--green)'
      }, {
        label: 'Rental revenue',
        val: '$4,236',
        sub: 'from car rentals',
        color: 'var(--purple)'
      }, {
        label: 'Transactions',
        val: '847',
        sub: 'completed payments',
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
          <div className="sec-title">Booking revenue — daily</div>
          <div className="chart-row chart-animate observe-animate" style={{
          height: 60
        }}>
            {bookingDaily.map((val, i) => <div key={i} className={`bar ${i === bookingDaily.length - 1 ? 'lit' : ''}`} style={{
            '--bar-h': `${Math.round(val / maxBooking * 100)}%`
          }} title={`${days[i]} • $${val}`} />)}
          </div>
          <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8
        }}>
            <span style={{
            fontSize: 11,
            color: 'var(--text-3)'
          }}>Apr 1</span>
            <span style={{
            fontSize: 11,
            color: 'var(--text-3)'
          }}>Apr 12</span>
          </div>
        </div>
        <div className="card observe-animate">
          <div className="sec-title">Rental revenue — daily</div>
          <div className="chart-row chart-animate observe-animate" style={{
          height: 60
        }}>
            {rentalDaily.map((val, i) => <div key={i} className={`bar ${i === rentalDaily.length - 1 ? 'lit' : ''}`} style={{
            '--bar-h': `${Math.round(val / maxRental * 100)}%`,
            background: 'var(--purple-soft)',
            borderColor: 'rgba(167,139,250,0.35)'
          }} title={`${days[i]} • $${val}`} />)}
          </div>
          <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8
        }}>
            <span style={{
            fontSize: 11,
            color: 'var(--text-3)'
          }}>Apr 1</span>
            <span style={{
            fontSize: 11,
            color: 'var(--text-3)'
          }}>Apr 12</span>
          </div>
        </div>
      </div>
      <div className="grid2" style={{
      marginTop: 16
    }}>
        <div className="card observe-animate">
          <div className="sec-title">Top routes by bookings</div>
          {[{
          route: 'Phnom Penh → Siem Reap',
          count: 342,
          pct: 100
        }, {
          route: 'Phnom Penh → Kampot',
          count: 214,
          pct: 63
        }, {
          route: 'Phnom Penh → Kampong Cham',
          count: 178,
          pct: 52
        }, {
          route: 'Siem Reap → Kampong Thom',
          count: 113,
          pct: 33
        }].map(r => <div key={r.route} style={{
          marginBottom: 12
        }}>
              <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4
          }}>
                <span style={{
              fontSize: 12,
              color: 'var(--text-2)'
            }}>
                  {r.route}
                </span>
                <span style={{
              fontSize: 12,
              fontWeight: 500
            }}>{r.count}</span>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{
              width: `${r.pct}%`
            }} />
              </div>
            </div>)}
        </div>
        <div className="card observe-animate">
          <div className="sec-title">Top rental cars by bookings</div>
          {[{
          car: 'Toyota Camry',
          count: 28,
          pct: 100,
          color: 'var(--green)'
        }, {
          car: 'Honda CRV',
          count: 22,
          pct: 79,
          color: 'var(--green)'
        }, {
          car: 'Lexus RX',
          count: 18,
          pct: 64,
          color: 'var(--green)'
        }, {
          car: 'Kia Sportage',
          count: 14,
          pct: 50,
          color: 'var(--green)'
        }].map(r => <div key={r.car} style={{
          marginBottom: 12
        }}>
              <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4
          }}>
                <span style={{
              fontSize: 12,
              color: 'var(--text-2)'
            }}>
                  {r.car}
                </span>
                <span style={{
              fontSize: 12,
              fontWeight: 500
            }}>
                  {r.count} rentals
                </span>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{
              width: `${r.pct}%`,
              background: r.color
            }} />
              </div>
            </div>)}
        </div>
        <div className="card observe-animate">
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
      
        <div className="card observe-animate">
          <div className="sec-title">Top customers by spend</div>
          {[{
          name: 'Sophea Chan',
          spend: '$420',
          trips: 12
        }, {
          name: 'Dara Meas',
          spend: '$310',
          trips: 9
        }, {
          name: 'Lina Keo',
          spend: '$255',
          trips: 7
        }, {
          name: 'Makara Phy',
          spend: '$210',
          trips: 6
        }].map(u => <div key={u.name} className="stat-row">
              <div>
                <div style={{
              fontSize: 13,
              fontWeight: 500
            }}>{u.name}</div>
                <div style={{
              fontSize: 11,
              color: 'var(--text-3)'
            }}>
                  {u.trips} trips
                </div>
              </div>
              <span className="stat-val">{u.spend}</span>
            </div>)}
        </div>
        <div className="card observe-animate">
          <div className="sec-title">Payment mix</div>
          {[{
          label: 'ABA',
          pct: 48,
          color: 'var(--accent)'
        }, {
          label: 'KHQR',
          pct: 34,
          color: 'var(--green)'
        }, {
          label: 'Cash',
          pct: 18,
          color: 'var(--amber)'
        }].map(p => <div key={p.label} style={{
          marginBottom: 12
        }}>
              <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4
          }}>
                <span style={{
              fontSize: 12,
              color: 'var(--text-2)'
            }}>
                  {p.label}
                </span>
                <span style={{
              fontSize: 12,
              fontWeight: 500
            }}>{p.pct}%</span>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{
              width: `${p.pct}%`,
              background: p.color
            }} />
              </div>
            </div>)}
        </div>
      </div>
    </div>;
}

// ── CUSTOMERS ────────────────────────────────────────────────────────────────
