
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, icons, setupScrollReveal, getTodayISO } from '../../utils/sharedUser';
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

function formatDbRoute(route) {
  const totalSeats = Number(route.total_seats || 0);
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
    totalSeats,
    bookedCount,
    takenSeats: Array.isArray(route.booked_seats) ? route.booked_seats : [],
    avail: Math.max(0, totalSeats - bookedCount),
    price: Number(route.price || 0),
    color: route.color || '#60a5fa',
    bg: route.bg || 'rgba(96,165,250,0.16)'
  };
}

export default function BusSearch({
  role,
  setActive,
  setBookingsTab
}) {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [payMethod, setPayMethod] = useState('aba');
  const [done, setDone] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [routesError, setRoutesError] = useState('');

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
    if (step >= 2 && !selectedRoute) {
      navigate('/booking/search', { replace: true });
      return;
    }
    if (step >= 3 && !selectedSeats.length) {
      navigate('/booking/seats', { replace: true });
    }
  }, [step, selectedRoute, selectedSeats.length, navigate]);
  const cityOptions = useMemo(() => {
    const cities = new Set(FALLBACK_CITIES);
    routes.forEach(route => {
      if (route.origin) cities.add(route.origin);
      if (route.destination) cities.add(route.destination);
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [routes]);
  const filteredRoutes = useMemo(() => {
    return routes.filter(route =>
      (!fromCity || route.origin === fromCity) &&
      (!toCity || route.destination === toCity) &&
      (!travelDate || route.dateKey === travelDate)
    );
  }, [fromCity, routes, toCity, travelDate]);
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
  }, [step, routes.length, filteredRoutes.length, fromCity, toCity, travelDate]);
  const currentRoute = routes.find(r => r.id === selectedRoute);
  const takenSeats = currentRoute?.takenSeats || [];
  const goBack = () => {
    goStep(Math.max(1, step - 1));
  };
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
            ?
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
  const seatRows = ['A', 'B', 'C', 'D', 'E'];
  const seatCols = [1, 2, 3, 4];
  const toggleSeat = sid => {
    if (takenSeats.includes(sid)) return;
    setSelectedSeats(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]);
  };
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
            ?
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
        {['Search', 'Seats', 'Info', 'Pay'].map((s, i) => <div key={s} style={{
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
                setSelectedSeats([]);
              }}>
                <option value="">All origins</option>
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
                setSelectedSeats([]);
              }}>
                <option value="">All destinations</option>
                {cityOptions.map(city => <option key={`to-${city}`} value={city}>
                    {city}
                  </option>)}
              </select>
            </div>
            <div>
              <div className="label">Date</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" value={travelDate} onChange={e => {
                  setTravelDate(e.target.value);
                  setSelectedRoute(null);
                  setSelectedSeats([]);
                }} />
                {travelDate ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => {
                  setTravelDate('');
                  setSelectedRoute(null);
                  setSelectedSeats([]);
                }}>
                  All
                </button> : null}
              </div>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => {
              setFromCity('');
              setToCity('');
              setTravelDate('');
              setSelectedRoute(null);
              setSelectedSeats([]);
            }}>
              Show all
            </button>
          </div>
          {loadingRoutes ? <div className="card"><div className="page-sub">Loading bus routes...</div></div> : null}
          {routesError ? <div className="card" style={{ borderColor: 'rgba(248,113,113,0.35)' }}>
              <div className="page-sub" style={{ color: 'var(--red)' }}>{routesError}</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
                Try again
              </button>
            </div> : null}
          {!loadingRoutes && !routesError ? <div className="sec-title">{filteredRoutes.length} trips found</div> : null}
          {!loadingRoutes && !routesError && !filteredRoutes.length ? <div className="card"><div className="page-sub">No trips found for this route and date.</div></div> : null}
          {!loadingRoutes && !routesError && filteredRoutes.map((r, i) => <div key={r.id} className={`route-card ticket-card scroll-animate ${selectedRoute === r.id ? 'selected' : ''}`} style={{
        '--delay': `${i * 40}ms`
      }} onClick={() => {
        if (r.avail <= 0) return;
        if (role === 'guest') {
          setShowAuthModal(true);
        } else setSelectedRoute(r.id);
      }}>
              <div>
                <div className="route-time">{r.from}</div>
                <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 2
          }}>
                  <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: r.color,
              boxShadow: `0 0 0 3px ${r.bg}`
            }} />
                  <span style={{
              fontSize: 11,
              color: r.color
            }}>
                    {r.vehicle}
                  </span>
                </div>
                <div style={{
            fontSize: 10,
            color: 'var(--text-3)',
            marginTop: 2
          }}>
                  {r.type}
                  {r.busName ? ` - ${r.busName}` : ''}
                </div>
              </div>
              <div className="route-arrow">
                <div style={{
            fontSize: 11,
            color: 'var(--text-3)',
            marginBottom: 2
          }}>
                  {r.duration}
                </div>
                <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
                  <div style={{
              flex: 1,
              height: '0.5px',
              background: 'var(--glass-border)'
            }} />
                  <span style={{
              fontSize: 9,
              color: 'var(--text-3)'
            }}>?</span>
                </div>
              </div>
              <div>
                <div className="route-time">{r.to}</div>
                <div style={{
            fontSize: 11,
            color: r.avail <= 5 ? 'var(--amber)' : 'var(--text-3)',
            marginTop: 2
          }}>
                  {r.avail > 0 ? `${r.avail} seats left` : 'Sold out'}
                </div>
              </div>
              <div className="route-price">${r.price}</div>
              <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          border: '1.5px solid',
          borderColor: selectedRoute === r.id ? 'var(--accent)' : 'var(--glass-border)',
          background: selectedRoute === r.id ? 'var(--accent)' : 'transparent',
          flexShrink: 0
        }} />
            </div>)}
          <div style={{
        marginTop: 20,
        display: 'flex',
        justifyContent: 'flex-end'
      }}>
            <button className="btn btn-primary btn-lg" disabled={!selectedRoute} onClick={() => goStep(2)}>
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </>}

      {step === 2 && <div className="seat-map-wrap">
          <div className="seat-legend">
            <div className="seat-legend-item">
              <div className="seat-dot seat-dot-avail" />
              <span>Available</span>
            </div>
            <div className="seat-legend-item">
              <div className="seat-dot seat-dot-taken" />
              <span>Taken</span>
            </div>
            <div className="seat-legend-item">
              <div className="seat-dot seat-dot-sel" />
              <span>Selected</span>
            </div>
          </div>
          <div className="seat-layout">
            <div>
              <div className="bus-shell">
                <div className="bus-pattern" />
                <div className="bus-roof" />
                <div className="bus-front">
                  <span className="steering">??</span>
                </div>
                <div className="seat-grid">
                  {seatRows.map((row, ri) => <div key={row} style={{
                display: 'contents'
              }}>
                      {seatCols.map(col => {
                  const sid = `${row}${col}`;
                  const taken = takenSeats.includes(sid);
                  const sel = selectedSeats.includes(sid);
                  return <div key={sid} className={`seat ${taken ? 'seat-taken' : sel ? 'seat-sel' : 'seat-avail'}`} style={col === 3 ? {
                    marginLeft: 8
                  } : {}} onClick={() => toggleSeat(sid)}>
                            {sid}
                          </div>;
                })}
                      {ri < seatRows.length - 1 && <div className="seat-col-gap" />}
                    </div>)}
                </div>
              </div>
            </div>
            <div style={{
          flex: 1
        }}>
              <div className="sec-title">Booking summary</div>
              <div className="card card-sm">
                <div className="summary-row">
                  <span className="summary-key">Route</span>
                  <span className="summary-val">
                    {fromCity} ? {toCity}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Date</span>
                  <span className="summary-val">
                    {travelDate} • {currentRoute?.from}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Vehicle</span>
                  <span className="summary-val" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: currentRoute?.color || 'var(--text)'
              }}>
                    <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: currentRoute?.color || 'var(--text-3)',
                  boxShadow: `0 0 0 3px ${currentRoute?.bg || 'transparent'}`
                }} />
                    {currentRoute?.vehicle}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Bus type</span>
                  <span className="summary-val">{currentRoute?.type}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Seats</span>
                  <span className="summary-val" style={{
                color: 'var(--accent)'
              }}>
                    {selectedSeats.length ? selectedSeats.join(', ') : 'None'}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Price each</span>
                  <span className="summary-val">
                    ${currentRoute?.price ?? 0}
                  </span>
                </div>
                <div className="divider" style={{
              margin: '10px 0'
            }} />
                <div className="summary-row">
                  <span className="summary-key" style={{
                fontWeight: 600,
                color: 'var(--text)'
              }}>
                    Total
                  </span>
                  <span className="summary-val" style={{
                color: 'var(--green)',
                fontSize: 16
              }}>
                    $
                    {((currentRoute?.price ?? 0) * selectedSeats.length).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 24
      }}>
            <button className="btn btn-ghost btn-round-back" aria-label="Back" onClick={goBack}>
              <Icon d={icons.back} size={15} />
            </button>
            <button className="btn btn-primary" disabled={!selectedSeats.length} onClick={() => goStep(3)}>
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </div>}

      {step === 3 && <div className="card">
          <div className="sec-title">Passenger information</div>
          <div className="form-row">
            <div>
              <div className="label">First name</div>
              <input placeholder="Sereymongkol" />
            </div>
            <div>
              <div className="label">Last name</div>
              <input placeholder="Thoeung" />
            </div>
          </div>
          <div className="form-group">
            <div className="label">Phone number</div>
            <input placeholder="+855 17 420 051" />
          </div>
          <div className="form-group">
            <div className="label">National ID / Passport</div>
            <input placeholder="ID123456789" />
          </div>
          <div className="form-group">
            <div className="label">Email (for ticket)</div>
            <input type="email" placeholder="thoeungsereymongkol@gmail.com" />
          </div>
          <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 20
      }}>
            <button className="btn btn-ghost btn-round-back" aria-label="Back" onClick={goBack}>
              <Icon d={icons.back} size={15} />
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => goStep(4)}>
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </div>}

      {step === 4 && <div className="card">
          <div className="sec-title">Choose payment method</div>
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
                Amount: $
                {((currentRoute?.price ?? 0) * selectedSeats.length).toFixed(2)}
              </div>
            </div>}

          <div className="divider" />
          <div className="total-box">
            <span style={{
          fontSize: 13,
          color: 'var(--accent)'
        }}>
              Total to pay
            </span>
            <span style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--accent)'
        }}>
              ${((currentRoute?.price ?? 0) * selectedSeats.length).toFixed(2)}
            </span>
          </div>

          <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 24
      }}>
            <button className="btn btn-ghost btn-round-back" aria-label="Back" onClick={goBack}>
              <Icon d={icons.back} size={15} />
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => {
          setPaymentSuccess(true);
          goStep(5);
        }}>
              Confirm & Pay <Icon d={icons.check} size={15} color="#fff" />
            </button>
          </div>
        </div>}
    </div>;
}

