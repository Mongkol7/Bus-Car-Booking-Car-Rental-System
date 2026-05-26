import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { setupScrollReveal, getCompanyMeta } from '../../utils/sharedUser';

function formatDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatStatus(status) {
  return String(status || 'pending')
    .split('_')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join(' ');
}

function statusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'confirmed') return 'badge-green';
  if (normalized === 'returned' || normalized === 'completed') return 'badge-purple';
  if (normalized === 'cancelled') return 'badge-red';
  return 'badge-amber';
}

function buildTripActivity(row) {
  const legs = Array.isArray(row.legs) && row.legs.length ? row.legs : [row];
  const outbound = legs.find((leg) => leg.leg_type === 'outbound') || legs[0] || {};
  const returning = legs.find((leg) => leg.leg_type === 'return');
  const seats = legs.flatMap((leg) => Array.isArray(leg.seats) ? leg.seats : []).filter(Boolean);
  const company = outbound.company_name || row.company_name || 'Unknown company';
  const companyColor = outbound.color || row.color || getCompanyMeta(company).color;

  return {
    id: `trip-${row.ticket_reference || row.booking_reference || row.first_booking_id}`,
    type: 'ticket',
    route: returning
      ? `${outbound.origin || 'Origin'} -> ${outbound.destination || 'Destination'} round trip`
      : `${outbound.origin || row.origin || 'Origin'} -> ${outbound.destination || row.destination || 'Destination'}`,
    company,
    color: companyColor,
    date: formatDateTime(outbound.departure_time || row.departure_time),
    seatLabel: seats.length ? seats.join(', ') : 'No seats',
    status: formatStatus(row.status),
    statusKey: row.status,
    createdAt: row.latest_created_at || row.created_at || outbound.departure_time || row.departure_time,
    targetTab: 'trips'
  };
}

function buildRentalActivity(row) {
  return {
    id: `rental-${row.id}`,
    type: 'rental',
    route: row.car_name || 'Rental car',
    date: `${formatDateTime(row.pickup_datetime)} to ${formatDateTime(row.return_datetime)}`,
    seatLabel: `${Number(row.rental_hours || 0)} hour${Number(row.rental_hours || 0) === 1 ? '' : 's'}`,
    status: formatStatus(row.status),
    statusKey: row.status,
    createdAt: row.booked_at || row.pickup_datetime,
    targetTab: 'rentals'
  };
}

export default function Home({
  role,
  setActive,
  setBookingsTab
}) {
  const { token, user } = useAuth();
  const [recentTrips, setRecentTrips] = useState([]);
  const [recentRentals, setRecentRentals] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    if (role === 'guest' || !token) {
      setRecentTrips([]);
      setRecentRentals([]);
      setActivityError('');
      setActivityLoading(false);
      return;
    }

    const controller = new AbortController();
    async function loadRecentActivity() {
      setActivityLoading(true);
      setActivityError('');
      try {
        const [tripsResponse, rentalsResponse] = await Promise.all([
          fetch('/api/my/bookings/trips', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          }),
          fetch('/api/my/rentals', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          })
        ]);

        const tripsData = await tripsResponse.json().catch(() => ({}));
        const rentalsData = await rentalsResponse.json().catch(() => ({}));
        if (!tripsResponse.ok) throw new Error(tripsData.error || 'Unable to load recent trips.');
        if (!rentalsResponse.ok) throw new Error(rentalsData.error || 'Unable to load recent rentals.');

        setRecentTrips((Array.isArray(tripsData.trips) ? tripsData.trips : []).map(buildTripActivity));
        setRecentRentals((Array.isArray(rentalsData.rentals) ? rentalsData.rentals : []).map(buildRentalActivity));
      } catch (error) {
        if (error.name !== 'AbortError') {
          setRecentTrips([]);
          setRecentRentals([]);
          setActivityError(error.message || 'Unable to load recent activity.');
        }
      } finally {
        if (!controller.signal.aborted) setActivityLoading(false);
      }
    }

    loadRecentActivity();
    return () => controller.abort();
  }, [role, token]);

  const recentActivity = useMemo(() => {
    return [...recentTrips, ...recentRentals]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 4);
  }, [recentTrips, recentRentals]);

  useEffect(() => {
    const cleanup = setupScrollReveal({
      threshold: 0.05,
      rootMargin: '0px 0px 18% 0px'
    });
    return cleanup;
  }, [recentActivity, activityLoading, activityError]);

  function openActivity(item) {
    if (setBookingsTab) setBookingsTab(item.targetTab);
    setActive('bookings');
  }

  return <div>
      <div className="hero">
        <div className="page hero-content">
          <div className="hero-title">
            Travel smarter
            <br />
            across <span>Cambodia</span>
          </div>
          <div className="hero-sub">
            Book bus seats or rent a car — fast, simple, and on the go.
          </div>

          {/* ── EARTH SURFACE + CAR ── */}
          <div className="earth-wrap" style={{ marginTop: 36 }}>
            {/* Earth curve + glow */}
            <svg viewBox="0 0 1440 140" preserveAspectRatio="none" style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="earthGlow" cx="50%" cy="0%" r="70%">
                  <stop offset="0%" stopColor="rgba(79,142,247,0.22)" />
                  <stop offset="55%" stopColor="rgba(79,142,247,0.08)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <filter id="lineGlow" x="-20%" y="-100%" width="140%" height="300%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Earth fill */}
              <path d="M0,140 Q720,-60 1440,140 Z" fill="url(#earthGlow)" />
              {/* Soft glow line */}
              <path d="M0,140 Q720,-60 1440,140" fill="none" stroke="rgba(79,142,247,0.3)" strokeWidth="2" filter="url(#lineGlow)" />
              {/* Sharp line */}
              <path d="M0,140 Q720,-60 1440,140" fill="none" stroke="rgba(79,142,247,0.65)" strokeWidth="1" />
            </svg>

            {/* Car on the arc */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}>
              <svg viewBox="0 0 1440 140" preserveAspectRatio="none" style={{
                width: '100%',
                height: '100%'
              }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <path id="carPath" d="M0,140 Q720,-60 1440,140" />
                </defs>
                {/* Headlight glow is now inside the car <g> below — removed standalone element */}
                {/* Car */}
                <g>
                  <animateMotion dur="10s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#carPath" />
                  </animateMotion>
                  {/* Headlight glow — offset forward (cx=18) so it stays in front of the car */}
                  <ellipse cx="18" cy="-3" rx="28" ry="7" fill="rgba(255,230,100,0.13)" />
                  <ellipse cx="0" cy="10" rx="18" ry="3" fill="rgba(0,0,0,0.25)" />
                  <rect x="-14" y="-8" width="28" height="10" rx="3" fill="#1e3a5f" stroke="rgba(79,142,247,0.6)" strokeWidth="0.8" />
                  <rect x="-8" y="-15" width="16" height="8" rx="2" fill="#152d4a" stroke="rgba(79,142,247,0.4)" strokeWidth="0.6" />
                  <rect x="-6" y="-14" width="6" height="6" rx="1" fill="rgba(120,180,255,0.5)" />
                  <rect x="2" y="-14" width="5" height="6" rx="1" fill="rgba(120,180,255,0.3)" />
                  <rect x="13" y="-5" width="3" height="2" rx="0.5" fill="rgba(255,230,100,0.95)" />
                  <rect x="-16" y="-5" width="3" height="2" rx="0.5" fill="rgba(255,80,80,0.8)" />
                  <circle cx="-8" cy="3" r="4" fill="#0a0a0f" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
                  <circle cx="-8" cy="3" r="2" fill="#1a1a2e" />
                  <circle cx="8" cy="3" r="4" fill="#0a0a0f" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
                  <circle cx="8" cy="3" r="2" fill="#1a1a2e" />
                  <rect x="-14" y="-3" width="28" height="1" rx="0.5" fill="rgba(79,142,247,0.5)" />
                </g>
              </svg>
            </div>
          </div>

          <div className="service-grid">
            <div className="service-card" onClick={() => setActive('search')}>
              <div className="hero-emoji">🚌</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Bus seat booking
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Search routes, pick seats and pay.
              </div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                Book now
              </button>
            </div>
            <div className="service-card" onClick={() => setActive('cars')}>
              <div className="hero-emoji">🚗</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Car rental</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Browse sedans and SUVs for rent.
              </div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                Browse cars
              </button>
            </div>
          </div>
        </div>
      </div>

    <div className="page">
      <div className="sec-title">Recent activity{user?.first_name ? ` for ${user.first_name}` : ''}</div>

      {role === 'guest' ? <div className="card scroll-animate" style={{ textAlign: 'center', padding: '32px' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
          No recent activity. Sign in to track your trips.
        </p>
      </div> : null}

      {role !== 'guest' && activityLoading ? <div className="card scroll-animate">
        <div className="page-sub">Loading your latest trips and rentals...</div>
      </div> : null}

      {role !== 'guest' && activityError ? <div className="card scroll-animate" style={{ borderColor: 'rgba(248,113,113,0.35)' }}>
        <div className="page-sub" style={{ color: 'var(--red)' }}>{activityError}</div>
      </div> : null}

      {role !== 'guest' && !activityLoading && !activityError && !recentActivity.length ? <div className="card scroll-animate" style={{ textAlign: 'center', padding: '32px' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
          No recent activity yet. Book a trip or rent a car to see it here.
        </p>
      </div> : null}

      {role !== 'guest' && !activityLoading && !activityError && recentActivity.map((item, index) => <div
        key={item.id}
        className="booking-item ticket-card scroll-animate quick-scroll-animate"
        style={{ '--delay': `${index * 15}ms`, cursor: 'pointer' }}
        onClick={() => openActivity(item)}
      >
        <div className="booking-header">
          <div>
            <span className={`badge ${item.type === 'ticket' ? 'badge-blue' : 'badge-purple'}`} style={{ marginBottom: 6, fontSize: 9 }}>
              {item.type === 'ticket' ? 'BUS TICKET' : 'CAR RENTAL'}
            </span>
            <div className="booking-route">{item.route}</div>
            {item.type === 'ticket' ? <div style={{
              fontSize: 11,
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 2
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color }} />
              <span style={{ color: item.color }}>{item.company}</span>
            </div> : null}
          </div>
          <span className={`badge ${statusBadge(item.statusKey)}`}>
            {item.status}
          </span>
        </div>

        <div className="booking-meta">
          <div className="booking-meta-item">
            Date<span>{item.date}</span>
          </div>
          <div className="booking-meta-item">
            {item.type === 'ticket' ? 'Seat' : 'Duration'}
            <span>{item.seatLabel}</span>
          </div>
          {item.type === 'ticket' ? <div className="booking-meta-item">
            Company<span style={{ color: item.color }}>{item.company}</span>
          </div> : <div className="booking-meta-item">
            Type<span>Rental</span>
          </div>}
        </div>
      </div>)}
    </div>
  </div>;
}
