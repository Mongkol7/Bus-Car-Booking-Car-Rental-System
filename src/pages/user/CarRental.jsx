import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, icons, setupScrollReveal, getTodayISO } from '../../utils/sharedUser';
import { useAuth } from '../../context/AuthContext';
import AuthModal from './AuthModal';

function addDaysISO(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatStatus(status) {
  return String(status || 'available')
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join(' ');
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function combineDateTime(date, time) {
  if (!date || !time) return '';
  return `${date}T${time}`;
}

function getLocalTimeKey(date = new Date()) {
  const value = new Date(date);
  if (value.getSeconds() || value.getMilliseconds()) {
    value.setMinutes(value.getMinutes() + 1);
  }
  value.setSeconds(0, 0);
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function formatDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'now';
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && !days) parts.push(`${minutes}m`);
  return parts.join(' ') || 'now';
}

function getCarAvailability(car, now = new Date()) {
  const rawStatus = String(car?.rawStatus || car?.status || 'available').toLowerCase();
  if (rawStatus === 'maintenance') {
    return { status: 'Maintenance', statusKey: 'maintenance', badgeClass: 'badge-amber', note: 'Temporarily unavailable', noteColor: 'var(--amber)', bookable: false };
  }

  const rentals = (Array.isArray(car?.rentalWindows) ? car.rentalWindows : [])
    .map((rental) => ({
      ...rental,
      pickupDate: new Date(rental.pickup_datetime),
      returnDate: new Date(rental.return_datetime)
    }))
    .filter((rental) => !Number.isNaN(rental.pickupDate.getTime()) && !Number.isNaN(rental.returnDate.getTime()))
    .sort((a, b) => a.pickupDate - b.pickupDate);

  const currentRental = rentals.find((rental) => rental.pickupDate <= now && rental.returnDate > now);
  if (currentRental || rawStatus === 'rented') {
    const returnDate = currentRental?.returnDate;
    return {
      status: 'Rented',
      statusKey: 'rented',
      badgeClass: 'badge-red',
      note: returnDate ? `Free in ${formatDuration(returnDate - now)}` : 'Currently unavailable',
      noteColor: 'var(--red)',
      bookable: false,
      rental: currentRental
    };
  }

  const nextRental = rentals.find((rental) => rental.pickupDate > now);
  if (nextRental) {
    return {
      status: 'Available',
      statusKey: 'available',
      badgeClass: 'badge-green',
      note: `Available for ${formatDuration(nextRental.pickupDate - now)}`,
      noteColor: 'var(--amber)',
      bookable: true,
      rental: nextRental
    };
  }

  return { status: 'Available', statusKey: 'available', badgeClass: 'badge-green', note: 'No booking scheduled', noteColor: 'var(--green)', bookable: true };
}

function getDriverAvailability(driver, now = new Date()) {
  const currentRentalEnd = new Date(driver?.current_rental_end);
  if (!Number.isNaN(currentRentalEnd.getTime()) && currentRentalEnd > now) {
    return {
      note: `Free in ${formatDuration(currentRentalEnd - now)}`,
      color: 'var(--red)'
    };
  }

  const nextRentalStart = new Date(driver?.next_rental_start);
  if (!Number.isNaN(nextRentalStart.getTime()) && nextRentalStart > now) {
    return {
      note: `Available for ${formatDuration(nextRentalStart - now)}`,
      color: 'var(--amber)'
    };
  }

  return {
    note: 'No upcoming rental',
    color: 'var(--green)'
  };
}

function calculateRentalSummary(car, pickupDate, pickupTime, returnDate, returnTime, driver) {
  const pickup = combineDateTime(pickupDate, pickupTime);
  const dropoff = combineDateTime(returnDate, returnTime);
  const pickupValue = new Date(pickup);
  const returnValue = new Date(dropoff);
  const dailyRate = Number(car?.price || 0);
  const hourlyRate = dailyRate / 24;

  if (!pickup || !dropoff || Number.isNaN(pickupValue.getTime()) || Number.isNaN(returnValue.getTime()) || returnValue <= pickupValue) {
    return {
      valid: false,
      pickup,
      dropoff,
      hours: 0,
      hourlyRate,
      basePrice: 0,
      driverFee: 0,
      total: 0
    };
  }

  const hours = Math.max(1, Math.ceil((returnValue - pickupValue) / 3600000));
  const basePrice = Number((hours * hourlyRate).toFixed(2));
  const driverFee = driver ? Number((hours * Number(driver.hourly_rate || 0)).toFixed(2)) : 0;
  return {
    valid: true,
    pickup,
    dropoff,
    hours,
    hourlyRate,
    basePrice,
    driverFee,
    total: Number((basePrice + driverFee).toFixed(2))
  };
}

function formatDbCar(vehicle) {
  const type = vehicle.type || 'Rental car';
  const transmission = vehicle.transmission || 'Auto';
  const seats = Number(vehicle.total_seats || 0);
  const photos = Array.isArray(vehicle.photos) ? vehicle.photos.filter(Boolean) : [];

  return {
    id: vehicle.id,
    name: vehicle.name,
    type,
    plate: vehicle.plate_number || '',
    seats,
    trans: transmission,
    price: Number(vehicle.daily_rate || 0),
    rawStatus: vehicle.status || 'available',
    status: formatStatus(vehicle.status),
    rentalWindows: Array.isArray(vehicle.rental_windows) ? vehicle.rental_windows : [],
    specDetails: [
      { label: 'Type', value: type },
      { label: 'Transmission', value: transmission },
      { label: 'Seats', value: seats || 'Not set' },
      { label: 'Plate', value: vehicle.plate_number || 'Not set' },
      { label: 'Fuel', value: type.toLowerCase().includes('hybrid') ? 'Hybrid' : 'Petrol' },
      { label: 'Luggage', value: type.toLowerCase().includes('suv') ? '4 large bags' : '2 large bags' }
    ],
    photos
  };
}

function DriverCard({
  driver,
  selected,
  open,
  commentsOpen,
  onSelect,
  onToggle,
  onCommentsToggle
}) {
  const reviews = Array.isArray(driver.reviews) ? driver.reviews : [];
  const availability = getDriverAvailability(driver);

  return (
    <div
      style={{
        border: selected ? '1px solid rgba(96,165,250,0.75)' : '1px solid rgba(255,255,255,0.08)',
        background: selected ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        padding: 12,
        display: 'grid',
        gap: 10
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          style={driver.profile_photo ? {
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundImage: `url(${driver.profile_photo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            flex: '0 0 auto'
          } : {
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto'
          }}
        >
          {!driver.profile_photo ? <Icon d={icons.user} size={20} color="var(--text-2)" /> : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>{driver.name}</div>
            <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatMoney(driver.hourly_rate)}<span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 400 }}> /hr</span></div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            Rating {Number(driver.rating || 0).toFixed(1)} | {Number(driver.review_count || 0)} reviews
          </div>
          <div style={{ fontSize: 11, color: availability.color, marginTop: 3, fontWeight: 700 }}>
            {availability.note}
          </div>
          {driver.latest_comment ? <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Latest: {driver.latest_comment}</div> : null}
        </div>
      </div>

      <div className="toggle-row">
        <button className={`toggle-btn ${open ? 'active' : ''}`} type="button" onClick={onToggle} aria-expanded={open}>
          Driver background <Icon d={icons.chevron} size={12} className="toggle-icon" />
        </button>
        <button className={`toggle-btn ${commentsOpen ? 'active' : ''}`} type="button" onClick={onCommentsToggle} aria-expanded={commentsOpen}>
          Comments <Icon d={icons.chevron} size={12} className="toggle-icon" />
        </button>
        <button className={`toggle-btn ${selected ? 'active' : ''}`} type="button" onClick={onSelect}>
          {selected ? 'Selected' : 'Choose driver'}
        </button>
      </div>

      <div className={`dropdown-panel ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="spec-row"><span className="spec-key">Experience</span><span>{driver.experience_years || 0} years</span></div>
        <div className="spec-row"><span className="spec-key">Languages</span><span>{(driver.languages || []).join(', ') || 'Not set'}</span></div>
        <div className="spec-row"><span className="spec-key">License</span><span>{driver.license_number}</span></div>
        <div className="spec-row"><span className="spec-key">Phone</span><span>{driver.phone || 'Not set'}</span></div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>{driver.background || 'No background available.'}</div>
      </div>

      <div className={`dropdown-panel ${commentsOpen ? 'open' : ''}`} aria-hidden={!commentsOpen}>
        {reviews.map((review) => (
          <div key={review.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--text-3)' }}>
              <span>{review.user_name || 'User'}</span>
              <span>{Number(review.rating || 0).toFixed(0)} rating</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>
              {formatDateTime(review.created_at)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{review.comment}</div>
          </div>
        ))}
        {!reviews.length ? <div className="spec-row"><span className="spec-key">No comments yet</span></div> : null}
      </div>
    </div>
  );
}

export default function CarRental({
  role,
  setActive,
  setBookingsTab
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const stepByPath = {
    '/cars': 1,
    '/cars/details': 2,
    '/cars/payment': 3,
    '/cars/success': 4
  };
  const pathByStep = {
    1: '/cars',
    2: '/cars/details',
    3: '/cars/payment',
    4: '/cars/success'
  };
  const step = stepByPath[location.pathname] || 1;
  const goStep = nextStep => navigate(pathByStep[nextStep] || pathByStep[1]);
  const todayKey = getTodayISO();

  const [selected, setSelected] = useState(null);
  const [payMethod, setPayMethod] = useState('aba');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [createdRentalId, setCreatedRentalId] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [shaking, setShaking] = useState(null);
  const [pickupDate, setPickupDate] = useState(todayKey);
  const [pickupTime, setPickupTime] = useState(() => getLocalTimeKey());
  const [returnDate, setReturnDate] = useState(addDaysISO(todayKey, 3));
  const [returnTime, setReturnTime] = useState('09:00');
  const [returnTimeTouched, setReturnTimeTouched] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [needDriver, setNeedDriver] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [openDriverId, setOpenDriverId] = useState(null);
  const [openDriverCommentsId, setOpenDriverCommentsId] = useState(null);
  const [savingRental, setSavingRental] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [showSpecs, setShowSpecs] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [cars, setCars] = useState([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [carsError, setCarsError] = useState('');

  const car = cars.find(c => c.id === selected);
  const selectedDriver = drivers.find((driver) => Number(driver.id) === Number(selectedDriverId));
  const rentalSummary = useMemo(
    () => calculateRentalSummary(car, pickupDate, pickupTime, returnDate, returnTime, needDriver ? selectedDriver : null),
    [car, pickupDate, pickupTime, returnDate, returnTime, needDriver, selectedDriver]
  );

  const goBack = () => {
    const next = Math.max(1, step - 1);
    if (next === 1) setSelected(null);
    goStep(next);
  };

  useEffect(() => {
    if (step === 1) {
      document.querySelectorAll('.car-grid .scroll-animate').forEach(el => {
        delete el.dataset.revealed;
      });
      const cleanup = setupScrollReveal();
      const timer = setTimeout(() => {
        document.querySelectorAll('.car-grid .scroll-animate').forEach(el => {
          el.dataset.revealed = 'true';
        });
      }, 160);
      return () => {
        cleanup();
        clearTimeout(timer);
      };
    }
  }, [step, cars]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCars() {
      setLoadingCars(true);
      setCarsError('');
      try {
        const response = await fetch('/api/cars', { signal: controller.signal });
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(data.error || 'Unable to load rental cars.');
        }
        setCars(Array.isArray(data) ? data.map(formatDbCar) : []);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setCarsError(error.message || 'Unable to load rental cars.');
          setCars([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCars(false);
        }
      }
    }

    loadCars();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setShowSpecs(false);
    setShowPhotos(false);
  }, [selected, step]);

  useEffect(() => {
    if (step >= 2 && !selected) {
      navigate('/cars', { replace: true });
    }
  }, [step, selected, navigate]);

  useEffect(() => {
    if (selected && cars.length && !cars.some(c => c.id === selected)) {
      setSelected(null);
      navigate('/cars', { replace: true });
    }
  }, [cars, selected, navigate]);

  useEffect(() => {
    if (!needDriver) {
      setDrivers([]);
      setSelectedDriverId('');
      return;
    }
    if (!rentalSummary.valid) {
      setDrivers([]);
      setDriversError('Set a valid pickup and return date-time to see available drivers.');
      return;
    }

    const controller = new AbortController();
    async function loadDrivers() {
      setDriversLoading(true);
      setDriversError('');
      try {
        const params = new URLSearchParams({
          pickup_datetime: rentalSummary.pickup,
          return_datetime: rentalSummary.dropoff
        });
        const response = await fetch(`/api/rental-drivers?${params.toString()}`, { signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Unable to load drivers.');
        const rows = Array.isArray(data.drivers) ? data.drivers : [];
        setDrivers(rows);
        setSelectedDriverId((current) => rows.some((driver) => Number(driver.id) === Number(current)) ? current : '');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setDrivers([]);
          setDriversError(error.message || 'Unable to load drivers.');
        }
      } finally {
        if (!controller.signal.aborted) setDriversLoading(false);
      }
    }

    loadDrivers();
    return () => controller.abort();
  }, [needDriver, rentalSummary.valid, rentalSummary.pickup, rentalSummary.dropoff]);

  function handlePickupTimeChange(value) {
    const safeTime = pickupDate === todayKey && value < getLocalTimeKey() ? getLocalTimeKey() : value;
    setPickupTime(safeTime);
    if (!returnTimeTouched) setReturnTime(safeTime);
  }

  function handlePickupDateChange(value) {
    const safeDate = value && value < todayKey ? todayKey : value;
    const safeTime = safeDate === todayKey && pickupTime < getLocalTimeKey() ? getLocalTimeKey() : pickupTime;
    setPickupDate(safeDate);
    setPickupTime(safeTime);
    if (returnDate < safeDate) setReturnDate(safeDate);
    if (!returnTimeTouched && returnDate <= safeDate) setReturnTime(safeTime);
  }

  function handleReturnDateChange(value) {
    setReturnDate(value && value < pickupDate ? pickupDate : value);
  }

  function validateDetails() {
    if (role === 'guest' || !token) {
      setShowAuthModal(true);
      return false;
    }
    const now = new Date();
    const pickupValue = new Date(rentalSummary.pickup);
    const returnValue = new Date(rentalSummary.dropoff);
    if (!pickupDate || pickupDate < todayKey || Number.isNaN(pickupValue.getTime()) || pickupValue < now) {
      setDetailError('Pickup date-time cannot be in the past.');
      return false;
    }
    if (!returnDate || returnDate < pickupDate || Number.isNaN(returnValue.getTime()) || returnValue <= pickupValue) {
      setDetailError('Return date-time must be after pickup date-time.');
      return false;
    }
    if (!rentalSummary.valid) {
      setDetailError('Return date-time must be after pickup date-time.');
      return false;
    }
    if (needDriver && !selectedDriver) {
      setDetailError('Please choose a driver or turn off Need a driver.');
      return false;
    }
    if (!needDriver && (!driverName.trim() || !driverLicense.trim() || !customerPhone.trim())) {
      setDetailError('Driver name, license number, and phone number are required for self-drive rentals.');
      return false;
    }
    setDetailError('');
    return true;
  }

  async function confirmRental() {
    if (!validateDetails()) return;
    setSavingRental(true);
    setPaymentError('');
    try {
      const response = await fetch('/api/rentals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          car_id: car.id,
          pickup_datetime: rentalSummary.pickup,
          return_datetime: rentalSummary.dropoff,
          payment_method: payMethod,
          customer_phone: customerPhone,
          need_driver: needDriver,
          hired_driver_id: needDriver ? selectedDriverId : null,
          driver_name: needDriver ? '' : driverName,
          driver_license: needDriver ? '' : driverLicense
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save rental request.');
      setCreatedRentalId(data.rental?.id || '');
      setPaymentSuccess(true);
      goStep(4);
    } catch (error) {
      setPaymentError(error.message || 'Unable to save rental request.');
    } finally {
      setSavingRental(false);
    }
  }

  if (paymentSuccess || step === 4) return <div className="page" style={{ maxWidth: 480 }}>
    <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
      <div className="confirm-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>
        <Icon d={icons.check} size={24} />
      </div>
      <div className="page-title">Payment successful!</div>
      <div className="page-sub">Your rental request was saved and is waiting for admin approval.</div>
      <div className="success-actions">
        <button className="btn btn-primary btn-full" onClick={() => {
          if (setBookingsTab) setBookingsTab('rentals');
          setPaymentSuccess(false);
          setActive('bookings');
          const params = new URLSearchParams({ tab: 'rentals' });
          if (createdRentalId) params.set('rental', createdRentalId);
          navigate(`/bookings?${params.toString()}`);
        }}>
          View rental ticket
        </button>
        <button className="btn btn-ghost btn-full" onClick={() => {
          setPaymentSuccess(false);
          setCreatedRentalId('');
          setActive('home');
        }}>
          Back to Home
        </button>
      </div>
    </div>
  </div>;

  const currentTimeKey = getLocalTimeKey();

  return <div className="page-wide">
    {showAuthModal && <AuthModal onConfirm={() => navigate('/login')} onClose={() => setShowAuthModal(false)} />}

    <div className="page-title">Car rental</div>
    <div className="page-sub">Premium vehicles for your personal use</div>

    {step > 1 && <div className="steps" style={{ maxWidth: 640, margin: '0 auto 32px' }}>
      {['Details', 'Payment'].map((s, i) => <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === 1 ? 'initial' : 1 }}>
        <div className={`step ${i + 2 === step ? 'active' : i + 2 < step ? 'done' : 'idle'}`}>
          <div className="step-num">{i + 2 < step ? <Icon d={icons.check} size={12} /> : i + 1}</div>
          <div className="step-label" style={{ marginLeft: 6, fontSize: 11 }}>{s}</div>
        </div>
        {i < 1 && <div className="step-line" />}
      </div>)}
    </div>}

    {step === 1 && loadingCars && <div className="card"><div className="page-sub">Loading rental cars...</div></div>}

    {step === 1 && carsError && <div className="card" style={{ borderColor: 'rgba(248,113,113,0.35)' }}>
      <div className="page-sub" style={{ color: 'var(--red)' }}>{carsError}</div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Try again</button>
    </div>}

    {step === 1 && !loadingCars && !carsError && !cars.length && <div className="card"><div className="page-sub">No rental cars are available yet.</div></div>}

    {step === 1 && !loadingCars && !carsError && cars.length > 0 && <div className="car-grid">
      {cars.map((c, i) => {
        const availability = getCarAvailability(c);
        return <div key={c.id} className={`car-card ticket-card scroll-animate ${shaking === c.id ? 'shake-anim' : ''}`} style={{ '--delay': `${i * 40}ms` }} onClick={() => {
        if (!availability.bookable) {
          setShaking(c.id);
          if (window.navigator.vibrate) window.navigator.vibrate(50);
          setTimeout(() => setShaking(null), 400);
        } else if (role === 'guest') {
          setShowAuthModal(true);
        } else {
          setSelected(c.id);
          goStep(2);
        }
      }}>
        <div className="car-img-wrap" style={c.photos[0] ? { backgroundImage: `url(${c.photos[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          {!c.photos[0] ? <Icon d={icons.car} size={38} color="var(--text-2)" /> : null}
        </div>
        <div className="car-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div className="car-name">{c.name}</div>
            <div style={{ textAlign: 'right' }}>
              <span className={`badge ${availability.badgeClass}`}>{availability.status}</span>
              <div style={{ marginTop: 4, fontSize: 10.5, color: availability.noteColor, fontWeight: 700 }}>{availability.note}</div>
            </div>
          </div>
          <div className="car-price">{formatMoney(c.price)}<span>/day</span></div>
          <button className={`btn btn-full btn-sm ${availability.bookable ? 'btn-primary' : 'btn-ghost'}`} style={{ marginTop: 12 }}>
            {!availability.bookable ? 'Not Available' : role === 'guest' ? 'Sign in to rent' : 'Rent now'}
          </button>
        </div>
      </div>;
      })}
    </div>}

    {step === 2 && car && <div className="page" style={{ maxWidth: 720, padding: 0 }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={car.photos[0] ? { width: 54, height: 42, borderRadius: 10, backgroundImage: `url(${car.photos[0]})`, backgroundSize: 'cover', backgroundPosition: 'center', flex: '0 0 auto' } : { width: 54, height: 42, borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
            {!car.photos[0] ? <Icon d={icons.car} size={24} color="var(--text-2)" /> : null}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{car.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{car.type} | {car.seats} seats | {car.trans}</div>
            <div className="toggle-row">
              <button className={`toggle-btn ${showSpecs ? 'active' : ''}`} type="button" onClick={() => setShowSpecs(prev => !prev)} aria-expanded={showSpecs}>Specs <Icon d={icons.chevron} size={12} className="toggle-icon" /></button>
              <button className={`toggle-btn ${showPhotos ? 'active' : ''}`} type="button" onClick={() => setShowPhotos(prev => !prev)} aria-expanded={showPhotos}>Photos <Icon d={icons.chevron} size={12} className="toggle-icon" /></button>
            </div>
            <div className={`dropdown-panel ${showSpecs ? 'open' : ''}`} aria-hidden={!showSpecs}>
              {car.specDetails.map(row => <div key={row.label} className="spec-row"><span className="spec-key">{row.label}</span><span>{row.value}</span></div>)}
            </div>
            <div className={`dropdown-panel ${showPhotos ? 'open' : ''}`} aria-hidden={!showPhotos}>
              <div className="photo-grid">{car.photos.map((src, idx) => <img key={`${car.id}-${idx}`} src={src} alt={`${car.name} ${idx + 1}`} />)}</div>
              {!car.photos.length && <div className="spec-row"><span className="spec-key">No photos available</span></div>}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 17, fontWeight: 600, color: 'var(--accent)' }}>{formatMoney(car.price)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-2)' }}> /day</span></div>
        </div>

        <div className="divider" />
        {detailError ? <div style={{ marginBottom: 12, color: 'var(--red)', fontSize: 12 }}>{detailError}</div> : null}
        <div className="date-range">
          <div>
            <div className="label">Pickup date</div>
            <input type="date" min={todayKey} value={pickupDate} onChange={e => handlePickupDateChange(e.target.value)} />
          </div>
          <div>
            <div className="label">Pickup time</div>
            <input type="time" min={pickupDate === todayKey ? currentTimeKey : undefined} value={pickupTime} onChange={e => handlePickupTimeChange(e.target.value)} />
          </div>
          <div>
            <div className="label">Return date</div>
            <input type="date" min={pickupDate || todayKey} value={returnDate} onChange={e => handleReturnDateChange(e.target.value)} />
          </div>
          <div>
            <div className="label">Return time</div>
            <input type="time" min={returnDate === pickupDate ? pickupTime : undefined} value={returnTime} onChange={e => { setReturnTimeTouched(true); setReturnTime(e.target.value); }} />
          </div>
        </div>

        {!needDriver ? <>
          <div className="form-group">
            <div className="label">Driver full name</div>
            <input placeholder="Sereymongkol Thoeung" value={driverName} onChange={(event) => setDriverName(event.target.value)} />
          </div>
          <div className="form-group">
            <div className="label">Driver license number</div>
            <input placeholder="DL-12345678" value={driverLicense} onChange={(event) => setDriverLicense(event.target.value)} />
          </div>
          <div className="form-group">
            <div className="label">Phone number</div>
            <input placeholder="+855 17 420 0051" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
          </div>
        </> : null}

        <div className="total-box" style={{ marginTop: 18, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
              Total ({rentalSummary.valid ? `${rentalSummary.hours} billable hour${rentalSummary.hours === 1 ? '' : 's'}` : 'set valid period'})
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>
              Base rental: {formatMoney(rentalSummary.basePrice)} at {formatMoney(rentalSummary.hourlyRate)} / hour
            </div>
            {needDriver ? <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>Driver fee: {formatMoney(rentalSummary.driverFee)}</div> : null}
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
              Late returns are charged by each started extra hour at the same hourly rental rate.
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              Damage charges are assessed later by admin based on repair cost and damage severity.
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{formatMoney(rentalSummary.total)}</div>
        </div>

        <button
          type="button"
          className="ios-switch-row"
          onClick={() => setNeedDriver((current) => !current)}
          aria-pressed={needDriver}
        >
          <span>
            <span className="ios-switch-title">Need a driver</span>
            <span className="ios-switch-sub">Add a rated driver to this rental</span>
          </span>
          <span className={`ios-switch ${needDriver ? 'on' : ''}`} aria-hidden="true">
            <span className="ios-switch-knob" />
          </span>
        </button>

        {needDriver ? <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          {driversLoading ? <div className="page-sub">Loading available drivers...</div> : null}
          {driversError ? <div style={{ color: 'var(--red)', fontSize: 12 }}>{driversError}</div> : null}
          {!driversLoading && !driversError && !drivers.length ? <div className="page-sub">No drivers are available for that period.</div> : null}
          {drivers.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              selected={Number(selectedDriverId) === Number(driver.id)}
              open={Number(openDriverId) === Number(driver.id)}
              commentsOpen={Number(openDriverCommentsId) === Number(driver.id)}
              onSelect={() => setSelectedDriverId(driver.id)}
              onToggle={() => setOpenDriverId((current) => Number(current) === Number(driver.id) ? null : driver.id)}
              onCommentsToggle={() => setOpenDriverCommentsId((current) => Number(current) === Number(driver.id) ? null : driver.id)}
            />
          ))}
        </div> : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button className="btn btn-ghost btn-round-back" aria-label="Back" onClick={goBack}><Icon d={icons.back} size={15} /></button>
          <button className="btn btn-primary btn-lg" onClick={() => { if (validateDetails()) goStep(3); }}>
            Continue to Payment <Icon d={icons.arrow} size={15} color="#fff" />
          </button>
        </div>
      </div>
    </div>}

    {step === 3 && car && <div className="page" style={{ maxWidth: 560, padding: 0 }}>
      <div className="card">
        <div className="sec-title">Choose payment method</div>
        {paymentError ? <div style={{ marginBottom: 12, color: 'var(--red)', fontSize: 12 }}>{paymentError}</div> : null}
        {[{ id: 'aba', icon: 'ABA', name: 'ABA Bank', sub: 'Scan QR or transfer' }, { id: 'khqr', icon: 'KH', name: 'KHQR', sub: 'Cambodia QR payment standard' }].map(m => <div key={m.id} className={`pay-method ${payMethod === m.id ? 'selected' : ''}`} onClick={() => setPayMethod(m.id)}>
          <div className="pay-method-icon">{m.icon}</div>
          <div>
            <div className="pay-method-name">{m.name}</div>
            <div className="pay-method-sub">{m.sub}</div>
          </div>
          <div className={`pay-radio ${payMethod === m.id ? 'checked' : ''}`} />
        </div>)}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>Scan to pay deposit</div>
          <div className="qr-box">
            <div className="qr-pattern">
              {Array.from({ length: 100 }, (_, i) => <div key={i} className="qr-cell" style={{ background: Math.random() > 0.45 ? '#111' : 'transparent' }} />)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>Deposit: {formatMoney(rentalSummary.total * 0.2)}</div>
        </div>

        <div className="divider" />
        <div className="total-box">
          <span style={{ fontSize: 13, color: 'var(--accent)' }}>Remaining to pay on pickup</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{formatMoney(rentalSummary.total * 0.8)}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
          Rental period: {formatDateTime(rentalSummary.pickup)} to {formatDateTime(rentalSummary.dropoff)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button className="btn btn-ghost btn-round-back" aria-label="Back" onClick={goBack}><Icon d={icons.back} size={15} /></button>
          <button className="btn btn-primary btn-lg" onClick={confirmRental} disabled={savingRental}>
            {savingRental ? 'Saving...' : 'Confirm Rental'} <Icon d={icons.check} size={15} color="#fff" />
          </button>
        </div>
      </div>
    </div>}
  </div>;
}
