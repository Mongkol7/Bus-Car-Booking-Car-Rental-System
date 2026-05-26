
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, icons, setupScrollReveal, getTodayISO } from '../../utils/sharedUser';
import { useAuth } from '../../context/AuthContext';
import AuthModal from './AuthModal';

const FALLBACK_CITIES = ['Phnom Penh', 'Siem Reap', 'Battambang', 'Sihanoukville', 'Kampot', 'Kep', 'Kratie', 'Kampong Cham', 'Pursat', 'Banteay Meanchey'];

function getLocalDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Direct';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours ? `${hours}h` : ''}${hours && mins ? ' ' : ''}${mins ? `${mins}m` : ''}`;
}

function rowLabel(index) {
  let label = '';
  let value = index + 1;
  while (value > 0) {
    const mod = (value - 1) % 26;
    label = String.fromCharCode(65 + mod) + label;
    value = Math.floor((value - mod) / 26);
  }
  return label;
}

function fallbackSeatMap(totalSeats = 0) {
  const seatTotal = Math.max(0, Number(totalSeats || 0));
  const columns = 4;
  const rows = Math.max(1, Math.ceil(seatTotal / columns));
  const cells = [];
  let seatIndex = 0;

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      seatIndex += 1;
      cells.push({
        row,
        column,
        type: seatIndex <= seatTotal ? 'seat' : 'empty',
        label: seatIndex <= seatTotal ? `${rowLabel(row - 1)}${column}` : '',
        color: '',
        note: ''
      });
    }
  }

  return { rows, columns, cells };
}

function normalizeSeatMap(layout, totalSeats) {
  if (layout?.rows && layout?.columns && Array.isArray(layout?.cells)) return layout;
  return fallbackSeatMap(totalSeats);
}

function countBookableSeats(layout) {
  return (layout?.cells || []).filter((cell) => cell.type === 'seat').length;
}

function seatCellText(cell) {
  if (cell.type === 'seat') return cell.label;
  if (cell.type === 'bathroom') return 'WC';
  if (cell.type === 'driver') return 'DR';
  if (cell.type === 'door') return 'DO';
  if (cell.type === 'note') return cell.label || 'Note';
  return '';
}

function formatDbRoute(route) {
  const seatMap = normalizeSeatMap(route.seat_map, Number(route.total_seats || 0));
  const totalSeats = countBookableSeats(seatMap);
  const bookedCount = Number(route.booked_count || 0);
  const companyName = route.company_name || route.vehicle || 'Unknown company';

  return {
    id: route.id,
    origin: route.origin,
    destination: route.destination,
    dateKey: getLocalDateKey(route.departure_time),
    from: formatTime(route.departure_time),
    to: formatTime(route.arrival_time),
    duration: formatDuration(route.departure_time, route.arrival_time),
    vehicle: companyName,
    busName: route.vehicle,
    type: route.vehicle_type || 'Bus',
    layout: String(route.vehicle_type || '').toLowerCase().includes('sleeper') ? 'sleeper' : 'standard',
    seatMap,
    totalSeats,
    bookedCount,
    takenSeats: Array.isArray(route.booked_seats) ? route.booked_seats : [],
    avail: Math.max(0, totalSeats - bookedCount),
    price: Number(route.price || 0),
    color: route.color || '#60a5fa',
    bg: route.bg || 'rgba(96,165,250,0.16)',
    isMaintenanceBlocked: Boolean(route.is_maintenance_blocked),
    unavailableReason: route.unavailable_reason || ''
  };
}

export default function BusSearch({
  role,
  setActive,
  setBookingsTab
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const stepByPath = {
    '/booking/search': 1,
    '/booking/seats': 2,
    '/booking/passenger': 3,
    '/booking/payment': 4,
    '/booking/success': 5
  };
  const pathByStep = {
    1: '/booking/search',
    2: '/booking/seats',
    3: '/booking/passenger',
    4: '/booking/payment',
    5: '/booking/success'
  };
  const step = stepByPath[location.pathname] || 1;
  const goStep = nextStep => navigate(pathByStep[nextStep] || pathByStep[1]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [selectedReturnRoute, setSelectedReturnRoute] = useState(null);
  const [returnSeats, setReturnSeats] = useState([]);
  const [activeSeatLeg, setActiveSeatLeg] = useState('outbound');
  const [payMethod, setPayMethod] = useState('aba');
  const [done, setDone] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [passenger, setPassenger] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    phone: user?.phone || '',
    idNumber: '',
    email: user?.email || ''
  });
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [travelDate, setTravelDate] = useState(getTodayISO());
  const [returnDate, setReturnDate] = useState('');
  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [routesError, setRoutesError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [savingBooking, setSavingBooking] = useState(false);

  function goSeatsStep() {
    setActiveSeatLeg('outbound');
    goStep(2);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadRoutes() {
      setLoadingRoutes(true);
      setRoutesError('');
      try {
        const response = await fetch('/api/routes', { signal: controller.signal });
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(data.error || 'Unable to load bus routes.');
        }
        setRoutes(Array.isArray(data) ? data.map(formatDbRoute) : []);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setRoutesError(error.message || 'Unable to load bus routes.');
          setRoutes([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingRoutes(false);
        }
      }
    }

    loadRoutes();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (step >= 2 && (!selectedRoute || (returnDate && !selectedReturnRoute))) {
      navigate('/booking/search', { replace: true });
      return;
    }
    if (step >= 3 && (!selectedSeats.length || (returnDate && !returnSeats.length))) {
      navigate('/booking/seats', { replace: true });
    }
  }, [step, selectedRoute, selectedReturnRoute, selectedSeats.length, returnDate, returnSeats.length, navigate]);
  useEffect(() => {
    setPassenger((current) => ({
      ...current,
      firstName: current.firstName || user?.first_name || '',
      lastName: current.lastName || user?.last_name || '',
      phone: current.phone || user?.phone || '',
      email: current.email || user?.email || ''
    }));
  }, [user]);
  const cityOptions = useMemo(() => {
    const cities = new Set(FALLBACK_CITIES);
    routes.forEach(route => {
      if (route.origin) cities.add(route.origin);
      if (route.destination) cities.add(route.destination);
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [routes]);
  const outboundRoutes = useMemo(() => {
    return routes.filter(route =>
      (!fromCity || route.origin === fromCity) &&
      (!toCity || route.destination === toCity) &&
      (!travelDate || route.dateKey === travelDate)
    );
  }, [fromCity, routes, toCity, travelDate]);
  const returnRoutes = useMemo(() => {
    if (!returnDate || !fromCity || !toCity) return [];
    return routes.filter(route =>
      route.origin === toCity &&
      route.destination === fromCity &&
      route.dateKey === returnDate
    );
  }, [fromCity, returnDate, routes, toCity]);
  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    document.querySelectorAll('.route-card.scroll-animate').forEach(el => {
      delete el.dataset.revealed;
    });
    const cleanup = setupScrollReveal();
    const timer = setTimeout(() => {
      document.querySelectorAll('.route-card.scroll-animate').forEach(el => {
        el.dataset.revealed = 'true';
      });
    }, 120);
    return () => {
      cleanup();
      clearTimeout(timer);
    };
  }, [step, routes.length, outboundRoutes.length, returnRoutes.length, fromCity, toCity, travelDate, returnDate]);
  const currentRoute = routes.find(r => r.id === selectedRoute);
  const currentReturnRoute = routes.find(r => r.id === selectedReturnRoute);
  const takenSeats = currentRoute?.takenSeats || [];
  const takenSeatSet = useMemo(() => new Set(takenSeats.map((seat) => String(seat || '').toUpperCase())), [takenSeats]);
  const currentSeatMap = currentRoute?.seatMap || fallbackSeatMap(currentRoute?.totalSeats || 0);
  const returnTakenSeats = currentReturnRoute?.takenSeats || [];
  const returnTakenSeatSet = useMemo(() => new Set(returnTakenSeats.map((seat) => String(seat || '').toUpperCase())), [returnTakenSeats]);
  const currentReturnSeatMap = currentReturnRoute?.seatMap || fallbackSeatMap(currentReturnRoute?.totalSeats || 0);
  const isRoundTrip = Boolean(returnDate);
  const subtotal = ((currentRoute?.price ?? 0) * selectedSeats.length) + ((currentReturnRoute?.price ?? 0) * returnSeats.length);
  const discount = isRoundTrip ? subtotal * 0.05 : 0;
  const finalTotal = Math.max(0, subtotal - discount);
  const activeRoute = activeSeatLeg === 'return' && isRoundTrip ? currentReturnRoute : currentRoute;
  const activeSeatMap = activeSeatLeg === 'return' && isRoundTrip ? currentReturnSeatMap : currentSeatMap;
  const activeTakenSeatSet = activeSeatLeg === 'return' && isRoundTrip ? returnTakenSeatSet : takenSeatSet;
  const activeSelectedSeats = activeSeatLeg === 'return' && isRoundTrip ? returnSeats : selectedSeats;
  const goBack = () => {
    goStep(Math.max(1, step - 1));
  };
  function updatePassenger(field, value) {
    setPassenger((current) => ({ ...current, [field]: value }));
  }

  function validatePassenger() {
    if (!passenger.firstName.trim() || !passenger.lastName.trim() || !passenger.phone.trim() || !passenger.email.trim() || !passenger.idNumber.trim()) {
      setBookingError('Passenger name, phone, email, and ID/passport are required.');
      return false;
    }
    setBookingError('');
    return true;
  }

  async function confirmBusBooking() {
    if (!token || role === 'guest') {
      setShowAuthModal(true);
      return;
    }
    if (!currentRoute || !selectedSeats.length || (isRoundTrip && (!currentReturnRoute || !returnSeats.length))) {
      setBookingError(isRoundTrip ? 'Please select departure and coming back routes and seats.' : 'Please select a route and seat first.');
      return;
    }
    if (!validatePassenger()) return;

    setSavingBooking(true);
    setBookingError('');
    try {
      const response = await fetch('/api/bookings/bus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          legs: isRoundTrip
            ? [
              { route_id: currentRoute.id, seat_numbers: selectedSeats, leg_type: 'outbound' },
              { route_id: currentReturnRoute.id, seat_numbers: returnSeats, leg_type: 'return' }
            ]
            : [{ route_id: currentRoute.id, seat_numbers: selectedSeats, leg_type: 'outbound' }],
          payment_method: payMethod,
          passenger: {
            first_name: passenger.firstName,
            last_name: passenger.lastName,
            phone: passenger.phone,
            email: passenger.email,
            id_number: passenger.idNumber
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to create booking.');
      setPaymentSuccess(true);
      goStep(5);
    } catch (error) {
      setBookingError(error.message || 'Unable to create booking.');
    } finally {
      setSavingBooking(false);
    }
  }
  if (paymentSuccess || step === 5) return <div className="page" style={{
    maxWidth: 480
  }}>
        <div className="card" style={{
      textAlign: 'center',
      padding: '40px'
    }}>
          <div className="confirm-icon" style={{
        background: 'var(--green-soft)',
        color: 'var(--green)',
        width: 60,
        height: 60,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
        fontSize: 24
      }}>
            <Icon d={icons.check} size={24} />
          </div>
          <div className="page-title">Payment successful!</div>
          <div className="page-sub">Choose where to go next</div>
          <div className="success-actions">
            <button className="btn btn-primary btn-full" onClick={() => {
          if (setBookingsTab) setBookingsTab('trips');
          setPaymentSuccess(false);
          setActive('bookings');
        }}>
              My Bookings
            </button>
            <button className="btn btn-ghost btn-full" onClick={() => {
          setPaymentSuccess(false);
          setActive('home');
        }}>
              Back to Home
            </button>
          </div>
        </div>
      </div>;
  const toggleSeat = sid => {
    if (takenSeatSet.has(String(sid || '').toUpperCase())) return;
    setSelectedSeats(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]);
  };
  const toggleReturnSeat = sid => {
    if (returnTakenSeatSet.has(String(sid || '').toUpperCase())) return;
    setReturnSeats(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]);
  };
  function routeCanBeSelected(route) {
    return route && route.avail > 0 && !route.isMaintenanceBlocked;
  }

  function selectOutboundRoute(route, advanceToSeats = false) {
    if (!routeCanBeSelected(route)) return;
    if (role === 'guest') {
      setShowAuthModal(true);
      return;
    }
    setSelectedRoute(route.id);
    setSelectedSeats([]);
    setActiveSeatLeg('outbound');
    if (advanceToSeats && (!isRoundTrip || selectedReturnRoute)) {
      goSeatsStep();
    }
  }

  function selectReturnRoute(route, advanceToSeats = false) {
    if (!routeCanBeSelected(route)) return;
    if (role === 'guest') {
      setShowAuthModal(true);
      return;
    }
    setSelectedReturnRoute(route.id);
    setReturnSeats([]);
    if (advanceToSeats && selectedRoute) {
      goSeatsStep();
    } else {
      setActiveSeatLeg('return');
    }
  }
  if (done) return <div className="page" style={{
    maxWidth: 480
  }}>
        <div className="card" style={{
      textAlign: 'center',
      padding: '40px'
    }}>
          <div className="confirm-icon" style={{
        background: 'var(--green-soft)',
        color: 'var(--green)',
        width: 60,
        height: 60,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
        fontSize: 24
      }}>
            <Icon d={icons.check} size={24} />
          </div>
          <div className="page-title">Booking confirmed!</div>
          <div className="page-sub">Seat preserved. Show QR at boarding.</div>
          <div style={{
        background: 'white',
        borderRadius: 12,
        padding: 16,
        width: 110,
        height: 110,
        margin: '0 auto 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
            <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(9,1fr)',
          gap: '1.5px',
          width: 82,
          height: 82
        }}>
              {Array.from({
            length: 81
          }, (_, i) => <div key={i} style={{
            borderRadius: 1,
            background: Math.random() > 0.5 ? '#111' : 'transparent',
            border: '0.5px solid #ddd'
          }} />)}
            </div>
          </div>
          <button className="btn btn-primary btn-full" onClick={() => setActive('bookings')}>
            Go to My Bookings
          </button>
          <button className="btn btn-ghost btn-full" style={{
        marginTop: 8
      }} onClick={() => {
        setDone(false);
        goStep(1);
        setSelectedSeats([]);
        setSelectedRoute(null);
        setReturnSeats([]);
        setSelectedReturnRoute(null);
      }}>
            Book another
          </button>
        </div>
      </div>;
  return <div className="page" style={{
    maxWidth: 720
  }}>
      {showAuthModal && <AuthModal onConfirm={() => navigate('/login')} onClose={() => setShowAuthModal(false)} />}

      <div className="page-title">Bus booking</div>
      <div className="page-sub">Search across Cambodia's top routes</div>
      <div className="company-row">
        {currentRoute ? <span className="company-chip" style={{
        color: currentRoute.color,
        borderColor: currentRoute.color,
        background: currentRoute.bg
      }}>
            {currentRoute.vehicle}
          </span> : <span className="company-chip" style={{
        color: 'var(--text-2)',
        borderColor: 'var(--glass-border)',
        background: 'rgba(255,255,255,0.04)'
      }}>
            Select a route to see bus company
          </span>}
      </div>
      <div className="steps">
        {['Select destination', 'Seats', 'Info', 'Pay'].map((s, i) => <div key={s} style={{
        display: 'flex',
        alignItems: 'center',
        flex: i === 3 ? 'initial' : 1
      }}>
            <div className={`step ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : 'idle'}`}>
              <div className="step-num">{i + 1 < step ? '?' : i + 1}</div>
              <div className="step-label" style={{
            marginLeft: 6,
            fontSize: 11
          }}>
                {s}
              </div>
            </div>
            {i < 3 && <div className="step-line" />}
          </div>)}
      </div>

      {step === 1 && <>
          <div className="search-bar">
            <div>
              <div className="label">From</div>
              <select value={fromCity} onChange={e => {
                setFromCity(e.target.value);
                setSelectedRoute(null);
                setSelectedReturnRoute(null);
                setSelectedSeats([]);
                setReturnSeats([]);
              }}>
                <option value="">Select origin</option>
                {cityOptions.map(city => <option key={`from-${city}`} value={city}>
                    {city}
                  </option>)}
              </select>
            </div>
            <div>
              <div className="label">To</div>
              <select value={toCity} onChange={e => {
                setToCity(e.target.value);
                setSelectedRoute(null);
                setSelectedReturnRoute(null);
                setSelectedSeats([]);
                setReturnSeats([]);
              }}>
                <option value="">Select destination</option>
                {cityOptions.map(city => <option key={`to-${city}`} value={city}>
                    {city}
                  </option>)}
              </select>
            </div>
            <div>
              <div className="label">Departure date</div>
              <input type="date" value={travelDate} min={getTodayISO()} onChange={e => {
                const nextDate = e.target.value || getTodayISO();
                setTravelDate(nextDate);
                if (returnDate && returnDate < nextDate) {
                  setReturnDate('');
                  setSelectedReturnRoute(null);
                  setReturnSeats([]);
                }
                setSelectedRoute(null);
                setSelectedSeats([]);
              }} />
            </div>
            <div>
              <div className="label">Coming back date</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" value={returnDate} min={travelDate || getTodayISO()} onChange={e => {
                  setReturnDate(e.target.value);
                  setSelectedReturnRoute(null);
                  setReturnSeats([]);
                  setActiveSeatLeg('outbound');
                }} />
                {returnDate ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => {
                  setReturnDate('');
                  setSelectedReturnRoute(null);
                  setReturnSeats([]);
                  setActiveSeatLeg('outbound');
                }}>
                  One way
                </button> : null}
              </div>
            </div>
          </div>
          {isRoundTrip ? <div className="card card-sm" style={{ marginTop: -8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>Two-way discount active</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>Choose seats for departure and coming back to receive 5% off both legs.</div>
          </div> : null}
          {loadingRoutes ? <div className="card"><div className="page-sub">Loading bus routes...</div></div> : null}
          {routesError ? <div className="card" style={{ borderColor: 'rgba(248,113,113,0.35)' }}>
              <div className="page-sub" style={{ color: 'var(--red)' }}>{routesError}</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
                Try again
              </button>
            </div> : null}
          {!loadingRoutes && !routesError ? <>
            <div className="sec-title">Departure schedules ({outboundRoutes.length})</div>
            {!outboundRoutes.length ? <div className="card"><div className="page-sub">No departure trips found for this route and date.</div></div> : null}
            {outboundRoutes.map((r, i) => <div key={r.id} className={`route-card ticket-card scroll-animate ${selectedRoute === r.id ? 'selected' : ''}`} style={{
          '--delay': `${i * 40}ms`,
          opacity: r.isMaintenanceBlocked ? 0.62 : 1,
          cursor: r.isMaintenanceBlocked ? 'not-allowed' : 'pointer'
                }} onClick={() => selectOutboundRoute(r)} onDoubleClick={() => selectOutboundRoute(r, true)}>
                <div>
                  <div className="route-time">{r.from}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, boxShadow: `0 0 0 3px ${r.bg}` }} />
                    <span style={{ fontSize: 11, color: r.color }}>{r.vehicle}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{r.origin} to {r.destination}</div>
                </div>
                <div className="route-arrow">
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{r.duration}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ flex: 1, height: '0.5px', background: 'var(--glass-border)' }} /><span style={{ fontSize: 9, color: 'var(--text-3)' }}>?</span></div>
                </div>
                <div>
                  <div className="route-time">{r.to}</div>
                  <div style={{ fontSize: 11, color: r.avail <= 5 ? 'var(--amber)' : 'var(--text-3)', marginTop: 2 }}>
                    {r.isMaintenanceBlocked ? 'Maintenance' : r.avail > 0 ? `${r.avail} seats left` : 'Sold out'}
                  </div>
                  {r.isMaintenanceBlocked ? <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>{r.unavailableReason}</div> : null}
                </div>
                <div className="route-price">${r.price}</div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid', borderColor: selectedRoute === r.id ? 'var(--accent)' : 'var(--glass-border)', background: selectedRoute === r.id ? 'var(--accent)' : 'transparent', flexShrink: 0 }} />
              </div>)}

            {isRoundTrip ? <>
              <div className="sec-title" style={{ marginTop: 22 }}>Coming back schedules ({returnRoutes.length})</div>
              {!returnRoutes.length ? <div className="card"><div className="page-sub">No coming back trips found for the reverse route and date.</div></div> : null}
              {returnRoutes.map((r, i) => <div key={r.id} className={`route-card ticket-card scroll-animate ${selectedReturnRoute === r.id ? 'selected' : ''}`} style={{
            '--delay': `${(outboundRoutes.length + i) * 40}ms`,
            opacity: r.isMaintenanceBlocked ? 0.62 : 1,
            cursor: r.isMaintenanceBlocked ? 'not-allowed' : 'pointer'
                  }} onClick={() => selectReturnRoute(r)} onDoubleClick={() => selectReturnRoute(r, true)}>
                  <div>
                    <div className="route-time">{r.from}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, boxShadow: `0 0 0 3px ${r.bg}` }} />
                      <span style={{ fontSize: 11, color: r.color }}>{r.vehicle}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{r.origin} to {r.destination}</div>
                  </div>
                  <div className="route-arrow">
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{r.duration}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ flex: 1, height: '0.5px', background: 'var(--glass-border)' }} /><span style={{ fontSize: 9, color: 'var(--text-3)' }}>?</span></div>
                  </div>
                  <div>
                    <div className="route-time">{r.to}</div>
                    <div style={{ fontSize: 11, color: r.avail <= 5 ? 'var(--amber)' : 'var(--text-3)', marginTop: 2 }}>
                      {r.isMaintenanceBlocked ? 'Maintenance' : r.avail > 0 ? `${r.avail} seats left` : 'Sold out'}
                    </div>
                    {r.isMaintenanceBlocked ? <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>{r.unavailableReason}</div> : null}
                  </div>
                  <div className="route-price">${r.price}</div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid', borderColor: selectedReturnRoute === r.id ? 'var(--accent)' : 'var(--glass-border)', background: selectedReturnRoute === r.id ? 'var(--accent)' : 'transparent', flexShrink: 0 }} />
                </div>)}
            </> : null}
          </> : null}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-lg" disabled={!selectedRoute || (isRoundTrip && !selectedReturnRoute)} onClick={goSeatsStep}>
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </>}

      {step === 2 && <div className="seat-map-wrap">
          {isRoundTrip ? <div className="pill-nav" style={{ marginBottom: 16 }}>
            <div className={`pill-tab ${activeSeatLeg === 'outbound' ? 'active' : ''}`} onClick={() => setActiveSeatLeg('outbound')}>Departure seats</div>
            <div className={`pill-tab ${activeSeatLeg === 'return' ? 'active' : ''}`} onClick={() => setActiveSeatLeg('return')}>Coming back seats</div>
          </div> : null}
          <div className="seat-legend">
            <div className="seat-legend-item"><div className="seat-dot seat-dot-avail" /><span>Available</span></div>
            <div className="seat-legend-item"><div className="seat-dot seat-dot-taken" /><span>Taken</span></div>
            <div className="seat-legend-item"><div className="seat-dot seat-dot-sel" /><span>Selected</span></div>
            <div className="seat-legend-item"><div className="seat-dot" style={{ background: 'rgba(255,255,255,0.07)', border: '0.5px dashed var(--glass-border)' }} /><span>Facility</span></div>
          </div>
          <div className="seat-layout">
            <div>
              <div className="bus-shell">
                <div className="bus-pattern" />
                <div className="bus-roof" />
                <div className="bus-front"><span className="steering">??</span></div>
                <div className="seat-grid" style={{ gridTemplateColumns: `repeat(${activeSeatMap.columns || 4}, 44px)`, maxWidth: 'none' }}>
                  {(activeSeatMap.cells || []).map(cell => {
                    const sid = cell.label;
                    const isSeat = cell.type === 'seat';
                    const taken = isSeat && activeTakenSeatSet.has(String(sid || '').toUpperCase());
                    const sel = isSeat && activeSelectedSeats.includes(sid);
                    const className = isSeat ? `seat ${taken ? 'seat-taken' : sel ? 'seat-sel' : 'seat-avail'}` : 'seat';
                    const facilityStyle = !isSeat ? {
                      background: cell.type === 'empty' ? 'transparent' : 'rgba(255,255,255,0.07)',
                      borderStyle: cell.type === 'empty' ? 'dashed' : 'solid',
                      color: 'var(--text-3)',
                      cursor: 'default'
                    } : cell.color && !taken && !sel ? {
                      background: cell.color,
                      color: '#fff',
                      borderColor: cell.color
                    } : {};
                    return <div key={`${cell.row}-${cell.column}`} className={className} style={facilityStyle} title={cell.note || cell.label || cell.type} onClick={() => isSeat && (activeSeatLeg === 'return' ? toggleReturnSeat(sid) : toggleSeat(sid))}>
                      {seatCellText(cell)}
                    </div>;
                  })}
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="sec-title">{activeSeatLeg === 'return' ? 'Coming back' : 'Departure'} summary</div>
              <div className="card card-sm">
                <div className="summary-row"><span className="summary-key">Route</span><span className="summary-val">{activeRoute ? `${activeRoute.origin} -> ${activeRoute.destination}` : 'Select route'}</span></div>
                <div className="summary-row"><span className="summary-key">Date</span><span className="summary-val">{activeRoute ? `${activeRoute.dateKey} | ${activeRoute.from} - ${activeRoute.to}` : 'Select date'}</span></div>
                <div className="summary-row">
                  <span className="summary-key">Vehicle</span>
                  <span className="summary-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: activeRoute?.color || 'var(--text)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeRoute?.color || 'var(--text-3)', boxShadow: `0 0 0 3px ${activeRoute?.bg || 'transparent'}` }} />
                    {activeRoute?.vehicle}
                  </span>
                </div>
                <div className="summary-row"><span className="summary-key">Departure seats</span><span className="summary-val" style={{ color: 'var(--accent)' }}>{selectedSeats.length ? selectedSeats.join(', ') : 'None'}</span></div>
                {isRoundTrip ? <div className="summary-row"><span className="summary-key">Coming back seats</span><span className="summary-val" style={{ color: 'var(--accent)' }}>{returnSeats.length ? returnSeats.join(', ') : 'None'}</span></div> : null}
                <div className="summary-row"><span className="summary-key">Subtotal</span><span className="summary-val">${subtotal.toFixed(2)}</span></div>
                {isRoundTrip ? <div className="summary-row"><span className="summary-key">Two-way discount</span><span className="summary-val" style={{ color: 'var(--green)' }}>-${discount.toFixed(2)}</span></div> : null}
                <div className="divider" style={{ margin: '10px 0' }} />
                <div className="summary-row">
                  <span className="summary-key" style={{ fontWeight: 600, color: 'var(--text)' }}>Total</span>
                  <span className="summary-val" style={{ color: 'var(--green)', fontSize: 16 }}>${finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button className="btn btn-ghost btn-round-back" aria-label="Back" onClick={goBack}><Icon d={icons.back} size={15} /></button>
            <button className="btn btn-primary" disabled={!selectedSeats.length || (isRoundTrip && !returnSeats.length)} onClick={() => goStep(3)}>
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </div>}

      {step === 3 && <div className="card">
          <div className="sec-title">Passenger information</div>
          {bookingError ? <div style={{ marginBottom: 12, color: 'var(--red)', fontSize: 12 }}>{bookingError}</div> : null}
          <div className="form-row">
            <div>
              <div className="label">First name</div>
              <input placeholder="Sereymongkol" value={passenger.firstName} onChange={(event) => updatePassenger('firstName', event.target.value)} />
            </div>
            <div>
              <div className="label">Last name</div>
              <input placeholder="Thoeung" value={passenger.lastName} onChange={(event) => updatePassenger('lastName', event.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <div className="label">Phone number</div>
            <input placeholder="+855 17 420 051" value={passenger.phone} onChange={(event) => updatePassenger('phone', event.target.value)} />
          </div>
          <div className="form-group">
            <div className="label">National ID / Passport</div>
            <input placeholder="ID123456789" value={passenger.idNumber} onChange={(event) => updatePassenger('idNumber', event.target.value)} />
          </div>
          <div className="form-group">
            <div className="label">Email (for ticket)</div>
            <input type="email" placeholder="thoeungsereymongkol@gmail.com" value={passenger.email} onChange={(event) => updatePassenger('email', event.target.value)} />
          </div>
          <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 20
      }}>
            <button className="btn btn-ghost btn-round-back" aria-label="Back" onClick={goBack}>
              <Icon d={icons.back} size={15} />
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => { if (validatePassenger()) goStep(4); }}>
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </div>}

      {step === 4 && <div className="card">
          <div className="sec-title">Choose payment method</div>
          {bookingError ? <div style={{ marginBottom: 12, color: 'var(--red)', fontSize: 12 }}>{bookingError}</div> : null}
          {[{
        id: 'aba',
        icon: '??',
        name: 'ABA Bank',
        sub: 'Scan QR or transfer'
      }, {
        id: 'khqr',
        icon: '????',
        name: 'KHQR',
        sub: 'Cambodia QR payment standard'
      }, {
        id: 'cash',
        icon: '??',
        name: 'Cash on boarding',
        sub: 'Pay when you board'
      }].map(m => <div key={m.id} className={`pay-method ${payMethod === m.id ? 'selected' : ''}`} onClick={() => setPayMethod(m.id)}>
              <div className="pay-method-icon">{m.icon}</div>
              <div>
                <div className="pay-method-name">{m.name}</div>
                <div className="pay-method-sub">{m.sub}</div>
              </div>
              <div className={`pay-radio ${payMethod === m.id ? 'checked' : ''}`} />
            </div>)}

          {payMethod !== 'cash' && <div style={{
        textAlign: 'center',
        marginTop: 20
      }}>
              <div style={{
          fontSize: 12,
          color: 'var(--text-2)',
          marginBottom: 12
        }}>
                Scan with your banking app
              </div>
              <div className="qr-box">
                <div className="qr-pattern">
                  {Array.from({
              length: 100
            }, (_, i) => <div key={i} className="qr-cell" style={{
              background: Math.random() > 0.45 ? '#111' : 'transparent'
            }} />)}
                </div>
              </div>
              <div style={{
          fontSize: 11,
          color: 'var(--text-3)',
          marginTop: 10
        }}>
                Amount: ${finalTotal.toFixed(2)}
              </div>
            </div>}

          <div className="divider" />
          <div className="total-box">
            <span style={{ fontSize: 13, color: 'var(--accent)' }}>
              Total to pay
              {isRoundTrip ? <span style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
                Subtotal ${subtotal.toFixed(2)} - 5% two-way discount ${discount.toFixed(2)}
              </span> : null}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>${finalTotal.toFixed(2)}</span>
          </div>

          <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 24
      }}>
            <button className="btn btn-ghost btn-round-back" aria-label="Back" onClick={goBack}>
              <Icon d={icons.back} size={15} />
            </button>
            <button className="btn btn-primary btn-lg" disabled={savingBooking} onClick={confirmBusBooking}>
              {savingBooking ? 'Saving...' : 'Confirm & Pay'} <Icon d={icons.check} size={15} color="#fff" />
            </button>
          </div>
        </div>}
    </div>;
}

