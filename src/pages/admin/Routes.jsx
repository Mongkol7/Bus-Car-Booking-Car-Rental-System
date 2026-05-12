
import React, { useEffect, useRef, useState } from 'react';
import { busFleet, carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedAdmin';

export default // ── ROUTES ────────────────────────────────────────────────────────────────────
function Routes() {
  const routes = [{
    id: 'R-01',
    from: 'Phnom Penh',
    to: 'Siem Reap',
    company: 'Mekong Express',
    stops: 2,
    dist: '314 km',
    duration: '5h',
    price: '$12'
  }, {
    id: 'R-02',
    from: 'Phnom Penh',
    to: 'Kampot',
    company: 'Sorya Bus',
    stops: 1,
    dist: '148 km',
    duration: '2.5h',
    price: '$9'
  }, {
    id: 'R-03',
    from: 'Siem Reap',
    to: 'Kampong Thom',
    company: 'Giant Ibis',
    stops: 0,
    dist: '147 km',
    duration: '2h',
    price: '$7'
  }, {
    id: 'R-04',
    from: 'Phnom Penh',
    to: 'Kampong Cham',
    company: 'Capitol Tours',
    stops: 1,
    dist: '120 km',
    duration: '2h',
    price: '$8'
  }, {
    id: 'R-05',
    from: 'Phnom Penh',
    to: 'Kep',
    company: 'VET Air Bus',
    stops: 2,
    dist: '172 km',
    duration: '3h',
    price: '$10'
  }, {
    id: 'R-06',
    from: 'Phnom Penh',
    to: 'Battambang',
    company: 'Larryta Express',
    stops: 1,
    dist: '291 km',
    duration: '5h',
    price: '$11'
  }, {
    id: 'R-07',
    from: 'Phnom Penh',
    to: 'Sihanoukville',
    company: 'Sorya Bus',
    stops: 1,
    dist: '230 km',
    duration: '4h',
    price: '$12'
  }, {
    id: 'R-08',
    from: 'Phnom Penh',
    to: 'Kratie',
    company: 'Mekong Express',
    stops: 2,
    dist: '315 km',
    duration: '6h',
    price: '$14'
  }];
  const scheds = [{
    id: 'S-01',
    route: 'PP → SR',
    vehicle: 'Mekong Express',
    type: 'VIP Sleeper',
    depart: '06:00',
    seats: '40/40',
    price: '$12',
    date: 'Apr 5'
  }, {
    id: 'S-02',
    route: 'PP → SR',
    vehicle: 'Sorya Bus',
    type: 'Express Coach',
    depart: '09:00',
    seats: '35/35',
    price: '$12',
    date: 'Apr 5'
  }, {
    id: 'S-03',
    route: 'PP → KP',
    vehicle: 'Giant Ibis',
    type: 'Luxury Coach',
    depart: '07:30',
    seats: '38/38',
    price: '$15',
    date: 'Apr 5'
  }, {
    id: 'S-04',
    route: 'SR → KT',
    vehicle: 'Capitol Tours',
    type: 'Standard Coach',
    depart: '08:00',
    seats: '45/45',
    price: '$11',
    date: 'Apr 6'
  }, {
    id: 'S-05',
    route: 'PP → SHV',
    vehicle: 'Larryta Express',
    type: 'Mini Bus',
    depart: '15:30',
    seats: '20/25',
    price: '$12',
    date: 'Apr 6'
  }];
  return <div>
      <div className="page-header observe-animate" style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }}>
        <div>
          <div className="page-title">Routes & Schedules</div>
          <div className="page-sub">
            Manage travel routes and departure schedules
          </div>
        </div>
        <div style={{
        display: 'flex',
        gap: 8
      }}>
          <button className="btn btn-ghost btn-sm">
            <Icon d={icons.plus} size={13} /> Add route
          </button>
          <button className="btn btn-primary btn-sm">
            <Icon d={icons.plus} size={13} /> Add schedule
          </button>
        </div>
      </div>
      <div className="grid2">
        <div className="card observe-animate">
          <div className="sec-title">Routes</div>
          <div className="table-wrap">
            <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>From → To</th>
                <th>Company</th>
                <th>Stops</th>
                <th>Distance</th>
                <th>Duration</th>
                <th>Fare</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => <tr key={r.id}>
                  <td style={{
                  color: 'var(--accent)',
                  fontSize: 12
                }}>
                    {r.id}
                  </td>
                  <td style={{
                  fontWeight: 500,
                  fontSize: 13
                }}>
                    {r.from} → {r.to}
                  </td>
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
                      background: getCompanyMeta(r.company).color
                    }} />
                      <span style={{
                      color: getCompanyMeta(r.company).color
                    }}>
                        {r.company}
                      </span>
                    </div>
                  </td>
                  <td className="td-muted">{r.stops}</td>
                  <td className="td-muted">{r.dist}</td>
                  <td className="td-muted">{r.duration}</td>
                  <td style={{
                  color: 'var(--green)',
                  fontWeight: 500
                }}>
                    {r.price}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm">
                      <Icon d={icons.edit} size={12} />
                    </button>
                  </td>
                </tr>)}
            </tbody>
            </table>
          </div>
        </div>
        <div className="card observe-animate">
          <div className="sec-title">Upcoming schedules</div>
          <div className="table-wrap">
            <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Route</th>
                <th>Vehicle</th>
                <th>Type</th>
                <th>Depart</th>
                <th>Seats</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {scheds.map(s => <tr key={s.id}>
                  <td style={{
                  color: 'var(--accent)',
                  fontSize: 12
                }}>
                    {s.id}
                  </td>
                  <td style={{
                  fontWeight: 500,
                  fontSize: 13
                }}>{s.route}</td>
                  <td>
                    <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12
                  }}>
                      <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: getCompanyMeta(s.vehicle).color
                    }} />
                      <span style={{
                      color: getCompanyMeta(s.vehicle).color
                    }}>
                        {s.vehicle}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-blue">{s.depart}</span>
                  </td>
                  <td className="td-muted">{s.seats}</td>
                  <td className="td-muted">{s.date}</td>
                </tr>)}
            </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>;
}

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
