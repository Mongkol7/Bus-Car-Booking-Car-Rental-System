import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon, icons, setupScrollReveal, getCompanyMeta } from '../../utils/sharedUser';

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

function getStatusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'confirmed' || normalized === 'upcoming' || normalized === 'active' || normalized === 'returned') return 'badge-green';
  if (normalized === 'overdue') return 'badge-red';
  if (normalized === 'returned' || normalized === 'completed') return 'badge-purple';
  if (normalized === 'cancelled') return 'badge-red';
  return 'badge-amber';
}

function rentalStage(booking, now = new Date()) {
  const status = String(booking?.statusKey || 'pending').toLowerCase();
  if (status !== 'confirmed') return status;
  const start = new Date(booking.pickupDatetime);
  const end = new Date(booking.returnDatetime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'active';
  if (now < start) return 'upcoming';
  if (now > end) return 'overdue';
  return 'active';
}

function displayFilterLabel(status) {
  if (status === 'all') return 'All';
  return formatStatus(status);
}

function canCancelTicket(booking) {
  if (booking.type !== 'ticket') return false;
  if (!['pending', 'confirmed'].includes(String(booking.statusKey || '').toLowerCase())) return false;
  const departureTimes = booking.isRoundTrip && Array.isArray(booking.legs)
    ? booking.legs.map((leg) => leg.departure_time).filter(Boolean)
    : [booking.departureTime].filter(Boolean);
  if (!departureTimes.length) return false;
  const earliestDeparture = departureTimes
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b)[0];
  if (!earliestDeparture) return false;
  return earliestDeparture.getTime() > Date.now() + 2 * 60 * 60 * 1000;
}

function canCancelRental(booking) {
  if (booking.type !== 'rental') return false;
  if (!['pending', 'confirmed'].includes(String(booking.statusKey || '').toLowerCase())) return false;
  const pickup = new Date(booking.pickupDatetime);
  if (Number.isNaN(pickup.getTime())) return false;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const pickupDayStart = new Date(pickup.getFullYear(), pickup.getMonth(), pickup.getDate());
  return todayStart < pickupDayStart;
}

function getTripDepartureTime(booking) {
  const departureValues = booking?.isRoundTrip && Array.isArray(booking.legs)
    ? booking.legs.map((leg) => leg.departure_time).filter(Boolean)
    : [booking?.departureTime].filter(Boolean);
  const departureTimes = departureValues
    .map((value) => new Date(value).getTime())
    .filter((time) => !Number.isNaN(time));
  return departureTimes.length ? Math.min(...departureTimes) : Number.POSITIVE_INFINITY;
}

function getBookingStartTime(booking) {
  if (booking?.type === 'rental') {
    const pickupTime = new Date(booking.pickupDatetime).getTime();
    return Number.isNaN(pickupTime) ? Number.POSITIVE_INFINITY : pickupTime;
  }
  return getTripDepartureTime(booking);
}

function buildRentalTicket(row) {
  return {
    id: `#R-${row.id}`,
    rawId: row.id,
    type: 'rental',
    route: row.car_name || 'Rental car',
    price: formatMoney(row.total_price),
    status: formatStatus(row.status),
    statusKey: String(row.status || '').toLowerCase(),
    date: `${formatDateTime(row.pickup_datetime)} to ${formatDateTime(row.return_datetime)}`,
    time: `${Number(row.rental_hours || 0)} hour${Number(row.rental_hours || 0) === 1 ? '' : 's'}`,
    seat: row.plate_number || 'No plate',
    pickupDatetime: row.pickup_datetime,
    returnDatetime: row.return_datetime,
    paymentMethod: row.payment_method,
    dailyRate: row.daily_rate,
    hourlyRate: row.hourly_rate,
    basePrice: row.rental_base_price || row.hourly_charge,
    driverFee: row.driver_fee,
    returnedAt: row.returned_at,
    driverName: row.hired_driver_name,
    driverRating: row.hired_driver_rating,
    driverReviewCount: row.hired_driver_review_count,
    driverHourlyRate: row.hired_driver_hourly_rate,
    driverPhone: row.hired_driver_phone,
    myDriverReview: row.my_driver_review,
    myDriverReport: row.my_driver_report,
    notifications: Array.isArray(row.notifications) ? row.notifications : [],
    unreadNotifications: Array.isArray(row.notifications) ? row.notifications.filter((item) => !item.is_read).length : 0
  };
}

function buildTripTicket(row) {
  const legs = Array.isArray(row.legs) && row.legs.length ? row.legs : [row];
  const outbound = legs.find((leg) => leg.leg_type === 'outbound') || legs[0] || {};
  const returning = legs.find((leg) => leg.leg_type === 'return');
  const departure = outbound.departure_time || row.departure_time;
  const arrival = returning?.arrival_time || outbound.arrival_time || row.arrival_time;
  const seats = Array.isArray(outbound.seats) ? outbound.seats.filter(Boolean) : Array.isArray(row.seats) ? row.seats.filter(Boolean) : [];
  const returnSeats = Array.isArray(returning?.seats) ? returning.seats.filter(Boolean) : [];
  const isRoundTrip = Boolean(row.is_round_trip || returning);

  return {
    id: `#${row.ticket_reference || row.booking_reference || `B-${row.first_booking_id}`}`,
    rawId: row.ticket_reference || row.booking_reference || row.first_booking_id,
    type: 'ticket',
    route: isRoundTrip
      ? `${outbound.origin || 'Origin'} -> ${outbound.destination || 'Destination'} round trip`
      : `${outbound.origin || row.origin || 'Origin'} -> ${outbound.destination || row.destination || 'Destination'}`,
    company: outbound.company_name || row.company_name || 'Unknown company',
    color: outbound.color || row.color,
    bg: outbound.bg || row.bg,
    busName: outbound.bus_name || row.bus_name,
    busType: outbound.bus_type || row.bus_type,
    price: formatMoney(row.total_amount),
    subtotal: row.subtotal_amount,
    discount: row.discount_amount,
    priceEach: outbound.price || row.price_each,
    status: formatStatus(row.status),
    statusKey: String(row.status || '').toLowerCase(),
    date: formatDateTime(departure),
    departureTime: departure,
    arrivalTime: arrival,
    time: isRoundTrip ? 'Two-way trip' : `${formatDateTime(departure)} to ${formatDateTime(arrival)}`,
    seat: isRoundTrip ? `Out: ${seats.join(', ') || 'None'} | Back: ${returnSeats.join(', ') || 'None'}` : seats.join(', ') || 'No seats',
    seats,
    returnSeats,
    paymentMethod: row.payment_method || outbound.payment_method,
    passengerName: [row.passenger_first_name, row.passenger_last_name].filter(Boolean).join(' '),
    passengerPhone: row.passenger_phone,
    passengerEmail: row.passenger_email,
    isRoundTrip,
    legs
  };
}

export default function MyBookings({
  role,
  bookingsTab,
  setBookingsTab
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const [tab, setTab] = useState(bookingsTab || 'trips');
  const [qrOpen, setQrOpen] = useState(null);
  const [expandedRentalId, setExpandedRentalId] = useState(null);
  const [expandedTripId, setExpandedTripId] = useState(null);
  const [rentalFilter, setRentalFilter] = useState('all');
  const [tripFilter, setTripFilter] = useState('all');
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsError, setTripsError] = useState('');
  const [rentals, setRentals] = useState([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);
  const [rentalsError, setRentalsError] = useState('');
  const [feedbackForms, setFeedbackForms] = useState({});
  const [feedbackStatus, setFeedbackStatus] = useState({});
  const [ticketMenuOpen, setTicketMenuOpen] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [cancellingTicket, setCancellingTicket] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState(null);

  useEffect(() => {
    const cleanup = setupScrollReveal({
      threshold: 0.05,
      rootMargin: '0px 0px 24% 0px'
    });
    return cleanup;
  }, [tab, rentalFilter, tripFilter, rentals, trips]);

  useEffect(() => {
    if (bookingsTab && bookingsTab !== tab) {
      setTab(bookingsTab);
    }
  }, [bookingsTab, tab]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryTab = searchParams.get('tab');
    if (!['trips', 'rentals'].includes(queryTab)) return;
    setTab(queryTab);
    if (setBookingsTab) setBookingsTab(queryTab);
  }, [location.search, setBookingsTab]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryTab = searchParams.get('tab');
    const ticketTarget = searchParams.get('ticket');
    const rentalTarget = searchParams.get('rental');
    const targetType = queryTab === 'rentals' || rentalTarget ? 'rental' : 'ticket';
    const rawId = targetType === 'rental' ? rentalTarget : ticketTarget;
    if (!rawId) return;

    const targetId = String(rawId);
    setHighlightTarget({ type: targetType, id: targetId, token: searchParams.get('notice') || `${targetType}-${targetId}-${Date.now()}` });
    if (targetType === 'rental') {
      setExpandedRentalId(Number(targetId));
      setRentalFilter('all');
    } else {
      setExpandedTripId(targetId);
      setTripFilter('all');
    }
  }, [location.search]);

  async function loadRentals({ silent = false } = {}) {
    if (!token || role === 'guest') {
      setRentals([]);
      return;
    }

    if (!silent) setRentalsLoading(true);
    setRentalsError('');
    try {
      const response = await fetch('/api/my/rentals', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load rental tickets.');
      setRentals((Array.isArray(data.rentals) ? data.rentals : []).map(buildRentalTicket));
    } catch (error) {
      setRentals([]);
      setRentalsError(error.message || 'Unable to load rental tickets.');
    } finally {
      if (!silent) setRentalsLoading(false);
    }
  }

  async function loadTrips({ silent = false } = {}) {
    if (!token || role === 'guest') {
      setTrips([]);
      return;
    }

    if (!silent) setTripsLoading(true);
    setTripsError('');
    try {
      const response = await fetch('/api/my/bookings/trips', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load bus tickets.');
      setTrips((Array.isArray(data.trips) ? data.trips : []).map(buildTripTicket));
    } catch (error) {
      setTrips([]);
      setTripsError(error.message || 'Unable to load bus tickets.');
    } finally {
      if (!silent) setTripsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'rentals') {
      loadRentals();
    } else if (tab === 'trips') {
      loadTrips();
    }
  }, [tab, token, role]);

  useEffect(() => {
    if (tab !== 'rentals' || !token || role === 'guest') return;
    const refresh = () => loadRentals({ silent: true });
    const intervalId = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [tab, token, role]);

  useEffect(() => {
    if (tab !== 'trips' || !token || role === 'guest') return;
    const refresh = () => loadTrips({ silent: true });
    const intervalId = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [tab, token, role]);

  const filteredRentals = rentals.filter((booking) => {
    if (rentalFilter === 'all') return true;
    return rentalStage(booking) === rentalFilter;
  });
  const filteredTrips = trips.filter((booking) => {
    if (tripFilter === 'all') return true;
    const statusKey = String(booking.statusKey || '').toLowerCase();
    if (tripFilter === 'cancelled') return statusKey === 'cancelled';
    if (statusKey === 'cancelled') return false;
    const arrival = new Date(booking.arrivalTime || booking.departureTime);
    const isPast = statusKey === 'completed' || (!Number.isNaN(arrival.getTime()) && arrival < new Date());
    return tripFilter === 'past' ? isPast : !isPast;
  });
  const currentBookings = [...(tab === 'rentals' ? filteredRentals : filteredTrips)]
    .sort((a, b) => getBookingStartTime(a) - getBookingStartTime(b));

  useEffect(() => {
    if (!highlightTarget) return undefined;
    const resolvedId = highlightTarget.type === 'ticket'
      ? String(currentBookings.find((booking) => (
        booking.type === 'ticket' && (
          String(booking.rawId) === highlightTarget.id ||
          (booking.legs || []).some((leg) => (
            String(leg.booking_reference || '') === highlightTarget.id ||
            (leg.booking_ids || []).some((id) => String(id) === highlightTarget.id)
          ))
        )
      ))?.rawId || highlightTarget.id)
      : highlightTarget.id;
    if (highlightTarget.type === 'ticket' && resolvedId !== highlightTarget.id) {
      setExpandedTripId(resolvedId);
    }
    const escapedId = window.CSS?.escape ? window.CSS.escape(resolvedId) : resolvedId.replace(/"/g, '\\"');
    const targetSelector = `[data-ticket-type="${highlightTarget.type}"][data-ticket-id="${escapedId}"]`;
    const scrollTimer = window.setTimeout(() => {
      const element = document.querySelector(targetSelector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.setAttribute('data-highlighted-ticket', 'true');
      }
    }, 180);
    const clearTimer = window.setTimeout(() => {
      const element = document.querySelector(targetSelector);
      if (element) element.removeAttribute('data-highlighted-ticket');
      setHighlightTarget((current) => current?.token === highlightTarget.token ? null : current);
    }, 3600);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightTarget, currentBookings]);

  if (role === 'guest') return <div className="page scroll-animate" style={{ textAlign: 'center' }}>
    <div className="confirm-icon" style={{
      background: 'var(--accent-soft)',
      color: 'var(--accent)',
      width: 60,
      height: 60,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 20px'
    }}>
      <Icon d={icons.ticket} size={24} />
    </div>
    <div className="page-title">Sign in to see bookings</div>
    <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/login')}>
      Sign in now
    </button>
  </div>;

  function updateFeedback(rentalId, patch) {
    setFeedbackForms((current) => ({
      ...current,
      [rentalId]: {
        rating: 5,
        comment: '',
        report: '',
        ...(current[rentalId] || {}),
        ...patch
      }
    }));
  }

  async function submitDriverFeedback(rentalId, type) {
    const form = feedbackForms[rentalId] || {};
    const isReport = type === 'report';
    const body = isReport
      ? { comment: form.report || '' }
      : { rating: Number(form.rating || 5), comment: form.comment || '' };

    if (!String(body.comment || '').trim()) {
      setFeedbackStatus((current) => ({
        ...current,
        [rentalId]: isReport ? 'Report detail is required.' : 'Review comment is required.'
      }));
      return;
    }

    setFeedbackStatus((current) => ({ ...current, [rentalId]: 'Saving...' }));
    try {
      const response = await fetch(`/api/my/rentals/${rentalId}/${isReport ? 'driver-report' : 'driver-review'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save feedback.');

      setFeedbackStatus((current) => ({
        ...current,
        [rentalId]: isReport ? 'Report submitted.' : 'Review saved.'
      }));
      updateFeedback(rentalId, isReport ? { report: '' } : { comment: '' });
      await loadRentals();
    } catch (error) {
      setFeedbackStatus((current) => ({
        ...current,
        [rentalId]: error.message || 'Unable to save feedback.'
      }));
    }
  }

  async function markRentalNotificationsRead(rentalId) {
    const rental = rentals.find((item) => item.rawId === rentalId);
    if (!token || !rental || !rental.unreadNotifications) return;

    setRentals((current) => current.map((item) => item.rawId === rentalId
      ? {
          ...item,
          unreadNotifications: 0,
          notifications: item.notifications.map((notification) => ({ ...notification, is_read: true }))
        }
      : item));

    try {
      await fetch(`/api/my/rentals/${rentalId}/notifications/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Unable to mark rental notification as read:', error);
    }
  }

  async function cancelBusTicket() {
    if (!cancelTarget) return;
    setCancellingTicket(true);
    setCancelError('');
    try {
      const response = await fetch(`/api/my/bookings/trips/${encodeURIComponent(cancelTarget.rawId)}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to cancel ticket.');
      setCancelTarget(null);
      setTicketMenuOpen(null);
      setQrOpen(null);
      await loadTrips();
    } catch (error) {
      setCancelError(error.message || 'Unable to cancel ticket.');
    } finally {
      setCancellingTicket(false);
    }
  }

  async function cancelRentalTicket() {
    if (!cancelTarget) return;
    setCancellingTicket(true);
    setCancelError('');
    try {
      const response = await fetch(`/api/my/rentals/${cancelTarget.rawId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to cancel rental.');
      setCancelTarget(null);
      setTicketMenuOpen(null);
      await loadRentals();
    } catch (error) {
      setCancelError(error.message || 'Unable to cancel rental.');
    } finally {
      setCancellingTicket(false);
    }
  }

  function renderRentalPanel(booking) {
    const expanded = expandedRentalId === booking.rawId;
    const canReviewDriver = booking.statusKey === 'returned' && booking.driverName;
    const form = feedbackForms[booking.rawId] || { rating: 5, comment: '', report: '' };

    return <div
      className={`rental-ticket-panel ${expanded ? 'open' : ''}`}
      aria-hidden={!expanded}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="ticket-divider" />
      <div className="rental-detail-grid">
        <div className="booking-meta-item">Pickup<span className="ticket-date-highlight">{formatDateTime(booking.pickupDatetime)}</span></div>
        <div className="booking-meta-item">Return<span>{formatDateTime(booking.returnDatetime)}</span></div>
        <div className="booking-meta-item">Payment<span>{String(booking.paymentMethod || 'Not set').toUpperCase()}</span></div>
        <div className="booking-meta-item">Hourly rate<span>{formatMoney(booking.hourlyRate)} / hr</span></div>
        <div className="booking-meta-item">Base rental<span>{formatMoney(booking.basePrice)}</span></div>
        <div className="booking-meta-item">Driver fee<span>{formatMoney(booking.driverFee)}</span></div>
      </div>

      {booking.notifications?.length ? <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {booking.notifications.map((notification) => (
          <div key={notification.id} style={{
            padding: 10,
            borderRadius: 10,
            border: notification.is_read ? '1px solid var(--glass-border)' : '1px solid rgba(245,158,11,0.35)',
            background: notification.is_read ? 'rgba(255,255,255,0.04)' : 'rgba(245,158,11,0.10)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{notification.title}</div>
              {!notification.is_read ? <span className="badge badge-amber">New</span> : null}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, marginTop: 4 }}>{notification.message}</div>
          </div>
        ))}
      </div> : null}

      {booking.driverName ? <div className="rental-driver-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="label">Hired driver</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{booking.driverName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>
              Rating {Number(booking.driverRating || 0).toFixed(1)} | {Number(booking.driverReviewCount || 0)} reviews
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatMoney(booking.driverHourlyRate)} / hr</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{booking.driverPhone || 'No phone'}</div>
          </div>
        </div>
      </div> : <div className="rental-driver-box">
        <div className="page-sub" style={{ margin: 0 }}>This rental was self-drive, so there is no driver to review.</div>
      </div>}

      {booking.driverName && !canReviewDriver ? <div className="page-sub" style={{ marginTop: 12 }}>
        Driver review and report actions unlock after this rental is returned.
      </div> : null}

      {canReviewDriver ? <div className="rental-feedback-grid">
        <div className="rental-feedback-box">
          <div className="label">Review this driver</div>
          {booking.myDriverReview ? <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
            Last review: {booking.myDriverReview.comment}
            {booking.myDriverReview.admin_reply ? <div style={{ color: 'var(--green)', marginTop: 4 }}>
              Admin reply: {booking.myDriverReview.admin_reply}
            </div> : null}
          </div> : null}
          <div className="form-row" style={{ marginTop: 8 }}>
            <select value={form.rating || 5} onChange={(event) => updateFeedback(booking.rawId, { rating: event.target.value })}>
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} rating</option>)}
            </select>
            <input placeholder="Comment after the rental" value={form.comment || ''} onChange={(event) => updateFeedback(booking.rawId, { comment: event.target.value })} />
          </div>
          <button className="btn btn-ghost btn-sm" type="button" style={{ marginTop: 8 }} onClick={(event) => {
            event.stopPropagation();
            submitDriverFeedback(booking.rawId, 'review');
          }}>
            Save review
          </button>
        </div>

        <div className="rental-feedback-box danger">
          <div className="label">Report a problem</div>
          {booking.myDriverReport ? <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
            Last report: {booking.myDriverReport.comment}
            {booking.myDriverReport.admin_reply ? <div style={{ color: 'var(--green)', marginTop: 4 }}>
              Admin reply: {booking.myDriverReport.admin_reply}
            </div> : null}
          </div> : null}
          <input style={{ marginTop: 8 }} placeholder="Complaint detail" value={form.report || ''} onChange={(event) => updateFeedback(booking.rawId, { report: event.target.value })} />
          <button className="btn btn-ghost btn-sm" type="button" style={{ marginTop: 8 }} onClick={(event) => {
            event.stopPropagation();
            submitDriverFeedback(booking.rawId, 'report');
          }}>
            Report
          </button>
        </div>
      </div> : null}

      {feedbackStatus[booking.rawId] ? <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent)' }}>
        {feedbackStatus[booking.rawId]}
      </div> : null}

      {booking.returnedAt ? <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
        Returned at {formatDateTime(booking.returnedAt)}
      </div> : null}
    </div>;
  }

  function renderTripPanel(booking) {
    const expanded = expandedTripId === booking.rawId;
    if (!booking.isRoundTrip) return null;

    return <div className={`rental-ticket-panel ${expanded ? 'open' : ''}`} aria-hidden={!expanded} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <div className="ticket-divider" />
      <div className="rental-detail-grid">
        {booking.legs.map((leg) => (
          <div key={`${booking.rawId}-${leg.leg_type}`} className="rental-driver-box" style={{ marginTop: 0 }}>
            <div className="label">{leg.leg_type === 'return' ? 'Coming back' : 'Departure'}</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{leg.origin} {'->'} {leg.destination}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              <span className="ticket-date-highlight">{formatDateTime(leg.departure_time)}</span> to {formatDateTime(leg.arrival_time)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{leg.company_name || 'Unknown company'}{leg.bus_name ? ` | ${leg.bus_name}` : ''}</div>
            <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8 }}>Seats {(leg.seats || []).join(', ') || 'None'}</div>
          </div>
        ))}
      </div>
      <div className="rental-detail-grid" style={{ marginTop: 12 }}>
        <div className="booking-meta-item">Subtotal<span>{formatMoney(booking.subtotal)}</span></div>
        <div className="booking-meta-item">Two-way discount<span style={{ color: 'var(--green)' }}>-{formatMoney(booking.discount)}</span></div>
        <div className="booking-meta-item">Payment<span>{String(booking.paymentMethod || 'Not set').toUpperCase()}</span></div>
        <div className="booking-meta-item">Paid<span>{booking.price}</span></div>
      </div>
    </div>;
  }

  return <div className="page" style={{ maxWidth: 640 }}>
    <div className="page-title">My bookings</div>
    <div className="page-sub">Track all your travel activity</div>

    <div className="pill-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ id: 'trips', label: 'Trips' }, { id: 'rentals', label: 'Rentals' }].map((item) => <div key={item.id} className={`pill-tab ${tab === item.id ? 'active' : ''}`} onClick={() => {
          setTab(item.id);
          if (setBookingsTab) setBookingsTab(item.id);
        }}>
          {item.label}
        </div>)}
      </div>
    </div>

    {tab === 'rentals' && <div className="pill-nav" style={{ marginTop: -6, marginBottom: 20 }}>
      {[
        { id: 'all', label: 'All' },
        { id: 'pending', label: 'Pending' },
        { id: 'upcoming', label: 'Upcoming' },
        { id: 'active', label: 'Active' },
        { id: 'overdue', label: 'Overdue' },
        { id: 'cancelled', label: 'Cancelled' },
        { id: 'returned', label: 'Returned' }
      ].map((item) => <div key={item.id} className={`pill-tab ${rentalFilter === item.id ? 'active' : ''}`} onClick={() => setRentalFilter(item.id)}>
        {item.label || displayFilterLabel(item.id)}
      </div>)}
    </div>}

    {tab === 'trips' && <div className="pill-nav" style={{ marginTop: -6, marginBottom: 20 }}>
      {[
        { id: 'all', label: 'All' },
        { id: 'upcoming', label: 'Upcoming' },
        { id: 'cancelled', label: 'Cancelled' },
        { id: 'past', label: 'Past' }
      ].map((item) => <div key={item.id} className={`pill-tab ${tripFilter === item.id ? 'active' : ''}`} onClick={() => setTripFilter(item.id)}>
        {item.label}
      </div>)}
    </div>}

    {tab === 'rentals' && rentalsLoading ? <div className="card"><div className="page-sub">Loading rental tickets...</div></div> : null}
    {tab === 'rentals' && rentalsError ? <div className="card" style={{ borderColor: 'rgba(248,113,113,0.35)' }}>
      <div className="page-sub" style={{ color: 'var(--red)' }}>{rentalsError}</div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={loadRentals}>Try again</button>
    </div> : null}
    {tab === 'rentals' && !rentalsLoading && !rentalsError && !currentBookings.length ? <div className="card">
      <div className="page-sub">No rental tickets found.</div>
    </div> : null}
    {tab === 'trips' && tripsLoading ? <div className="card"><div className="page-sub">Loading bus tickets...</div></div> : null}
    {tab === 'trips' && tripsError ? <div className="card" style={{ borderColor: 'rgba(248,113,113,0.35)' }}>
      <div className="page-sub" style={{ color: 'var(--red)' }}>{tripsError}</div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={loadTrips}>Try again</button>
    </div> : null}
    {tab === 'trips' && !tripsLoading && !tripsError && !currentBookings.length ? <div className="card">
      <div className="page-sub">No bus tickets found.</div>
    </div> : null}

    {(!rentalsLoading || tab !== 'rentals') && (!tripsLoading || tab !== 'trips') && !rentalsError && !tripsError && currentBookings.map((booking, index) => <div
      key={booking.id}
      className={`booking-item ticket-card scroll-animate quick-scroll-animate ${booking.type === 'rental' || booking.isRoundTrip ? 'rental-ticket-clickable' : ''}`}
      data-ticket-type={booking.type === 'rental' ? 'rental' : 'ticket'}
      data-ticket-id={String(booking.rawId)}
      style={{ '--delay': `${index * 15}ms` }}
      onClick={() => {
        if (booking.type === 'rental') {
          const willOpen = expandedRentalId !== booking.rawId;
          setExpandedRentalId(willOpen ? booking.rawId : null);
          if (willOpen) markRentalNotificationsRead(booking.rawId);
        } else if (booking.isRoundTrip) {
          setExpandedTripId((current) => current === booking.rawId ? null : booking.rawId);
        }
      }}
      role={booking.type === 'rental' || booking.isRoundTrip ? 'button' : undefined}
      tabIndex={booking.type === 'rental' || booking.isRoundTrip ? 0 : undefined}
      onKeyDown={(event) => {
        if (booking.type === 'rental' && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          const willOpen = expandedRentalId !== booking.rawId;
          setExpandedRentalId(willOpen ? booking.rawId : null);
          if (willOpen) markRentalNotificationsRead(booking.rawId);
        } else if (booking.isRoundTrip && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          setExpandedTripId((current) => current === booking.rawId ? null : booking.rawId);
        }
      }}
    >
      {(() => {
        const visibleStatusKey = booking.type === 'rental' ? rentalStage(booking) : booking.statusKey;
        const visibleStatus = booking.type === 'rental' ? formatStatus(visibleStatusKey) : booking.status;
        return <>
      <div className="booking-header">
        <div>
          <span className={`badge ${booking.type === 'ticket' ? 'badge-blue' : 'badge-purple'}`} style={{ marginBottom: 6, fontSize: 9 }}>
            {booking.type === 'ticket' ? 'BUS TICKET' : 'CAR RENTAL'}
          </span>
          <div className="booking-route">{booking.route}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {booking.id} | <span className="ticket-date-highlight">{booking.type === 'rental' ? formatDateTime(booking.pickupDatetime) : booking.date}</span>
          </div>
          {booking.type === 'ticket' ? <div style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: booking.color || getCompanyMeta(booking.company).color }} />
            <span style={{ color: booking.color || getCompanyMeta(booking.company).color }}>{booking.company}</span>
            {booking.busName ? <span>| {booking.busName}</span> : null}
          </div> : null}
          {booking.type === 'rental' && booking.driverName ? <div style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Icon d={icons.user} size={12} color="var(--accent)" />
            <span>{booking.driverName} | {Number(booking.driverRating || 0).toFixed(1)} rating</span>
          </div> : null}
          {booking.type === 'rental' && booking.unreadNotifications ? <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 5 }}>
            {booking.unreadNotifications} new rental notice{booking.unreadNotifications === 1 ? '' : 's'}
          </div> : null}
        </div>
        <span className={`badge ${getStatusBadge(visibleStatusKey || visibleStatus)}`}>
          {visibleStatus}
        </span>
      </div>

      <div className="booking-meta">
        <div className="booking-meta-item">
          {booking.type === 'ticket' ? 'Departure' : 'Duration'}
          <span className={booking.type === 'ticket' ? 'ticket-date-highlight' : undefined}>{booking.time}</span>
        </div>
        <div className="booking-meta-item">
          {booking.type === 'ticket' ? 'Seat' : 'Plate'}
          <span>{booking.seat}</span>
        </div>
        {booking.type === 'ticket' ? <div className="booking-meta-item">
          Bus
          <span style={{ color: booking.color || getCompanyMeta(booking.company).color }}>{booking.busName || booking.company}</span>
        </div> : <div className="booking-meta-item">
          Driver
          <span>{booking.driverName ? 'Included' : 'Self-drive'}</span>
        </div>}
        <div className="booking-meta-item">
          Paid<span>{booking.price}</span>
        </div>
      </div>

      {booking.type === 'rental' ? renderRentalPanel(booking) : null}
      {booking.type === 'ticket' ? renderTripPanel(booking) : null}

      {booking.type === 'rental' && canCancelRental(booking) ? <div style={{
        marginTop: 12,
        borderTop: '0.5px solid var(--glass-border)',
        paddingTop: 12,
        display: 'flex',
        justifyContent: 'flex-end'
      }}>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" aria-label="Rental actions" onClick={(event) => {
            event.stopPropagation();
            setTicketMenuOpen((current) => current === booking.rawId ? null : booking.rawId);
          }}>
            ...
          </button>
          {ticketMenuOpen === booking.rawId ? <div className="card card-sm" style={{
            position: 'absolute',
            right: 0,
            bottom: 36,
            zIndex: 8,
            minWidth: 230,
            padding: 10,
            borderColor: 'rgba(248,113,113,0.35)'
          }} onClick={(event) => event.stopPropagation()}>
            <button className="btn btn-ghost btn-sm btn-full" style={{ justifyContent: 'center', color: 'var(--red)' }} onClick={(event) => {
              event.stopPropagation();
              setCancelTarget(booking);
              setCancelError('');
            }}>
              Cancel Rental
            </button>
            <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45, textAlign: 'left' }}>
              Rule: rentals can only be cancelled before the pickup date.
            </div>
          </div> : null}
        </div>
      </div> : null}

      {booking.type === 'ticket' && (booking.status === 'Confirmed' || booking.status === 'Completed' || canCancelTicket(booking)) ? <div style={{
        marginTop: 12,
        borderTop: '0.5px solid var(--glass-border)',
        paddingTop: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            {(booking.status === 'Confirmed' || booking.status === 'Completed') ? <button className="btn btn-ghost btn-sm" onClick={(event) => {
              event.stopPropagation();
              setQrOpen(qrOpen === booking.id ? null : booking.id);
            }}>
              <Icon d={icons.qr} size={13} /> {qrOpen === booking.id ? 'Hide Ticket' : 'Show Ticket'}
            </button> : null}
          </div>

          {canCancelTicket(booking) ? <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" aria-label="Ticket actions" onClick={(event) => {
              event.stopPropagation();
              setTicketMenuOpen((current) => current === booking.rawId ? null : booking.rawId);
            }}>
              ...
            </button>
            {ticketMenuOpen === booking.rawId ? <div className="card card-sm" style={{
              position: 'absolute',
              right: 0,
              bottom: 36,
              zIndex: 8,
              minWidth: 220,
              padding: 10,
              borderColor: 'rgba(248,113,113,0.35)'
            }} onClick={(event) => event.stopPropagation()}>
              <button className="btn btn-ghost btn-sm btn-full" style={{ justifyContent: 'center', color: 'var(--red)' }} onClick={(event) => {
                event.stopPropagation();
                setCancelTarget(booking);
                setCancelError('');
              }}>
                Cancel Ticket
              </button>
              <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45, textAlign: 'left' }}>
                Rule: tickets can only be cancelled more than 2 hours before departure.
              </div>
            </div> : null}
          </div> : null}
        </div>

        {qrOpen === booking.id ? <div className="qr-reveal">
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Scan at boarding gate</div>
          <div className="qr-mini">
            <div className="qr-mini-grid">
              {Array.from({ length: 64 }, (_, qrIndex) => <div key={qrIndex} style={{
                borderRadius: 1,
                background: Math.random() > 0.5 ? '#111' : 'transparent'
              }} />)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{booking.id} | {booking.route} | Seats {booking.seat}</div>
        </div> : null}
      </div> : null}
        </>;
      })()}
    </div>)}

    {cancelTarget ? <div className="modal-overlay" onClick={() => !cancellingTicket && setCancelTarget(null)}>
      <div className="modal-card" style={{ maxWidth: 420 }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">{cancelTarget.type === 'rental' ? 'Cancel rental?' : 'Cancel ticket?'}</div>
        <div className="page-sub" style={{ marginTop: 8 }}>
          {cancelTarget.type === 'rental'
            ? `Are you sure you want to cancel ${cancelTarget.id}? This will cancel the selected rental request.`
            : `Are you sure you want to cancel ${cancelTarget.id}? This will cancel the selected ticket and release its booked seat${cancelTarget.isRoundTrip || (cancelTarget.seats || []).length > 1 ? 's' : ''}.`}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
          {cancelTarget.type === 'rental'
            ? 'Cancellation rule: rentals can only be cancelled before the pickup date.'
            : 'Cancellation rule: tickets can only be cancelled more than 2 hours before departure.'}
        </div>
        {cancelError ? <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 12 }}>{cancelError}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" disabled={cancellingTicket} onClick={() => setCancelTarget(null)}>
            Keep ticket
          </button>
          <button className="btn btn-primary" disabled={cancellingTicket} onClick={cancelTarget.type === 'rental' ? cancelRentalTicket : cancelBusTicket}>
            {cancellingTicket ? 'Cancelling...' : 'Confirm cancel'}
          </button>
        </div>
      </div>
    </div> : null}
  </div>;
}
