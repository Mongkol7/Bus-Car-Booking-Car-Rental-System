﻿
import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, icons, setupScrollReveal } from '../../utils/sharedUser';
import AuthModal from './AuthModal';

function normalizeCar(car) {
  const status = car.status ? `${car.status}` : 'maintenance';
  const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const type = `${car.type || ''}`;
  const lowerType = type.toLowerCase();
  const isSuv = lowerType.includes('suv');
  const isPickup = lowerType.includes('pickup');
  const isLuxury = lowerType.includes('luxury');
  const isHybrid = lowerType.includes('hybrid');
  const seats = car.seats ?? car.total_seats ?? 0;
  const luggageCount = isPickup || isSuv ? 4 : 3;
  const doorCount = seats >= 5 ? 5 : 3;
  const subtitle = isLuxury ? 'or similar Premium SUV' : isPickup ? 'or similar Utility Pickup' : isHybrid ? 'or similar Efficient Sedan' : isSuv ? 'or similar Standard SUV' : 'or similar Standard Sedan';
  const filterCategory = isLuxury ? 'Luxury SUV' : isPickup ? 'Pickup' : isHybrid ? 'Hybrid Sedan' : isSuv ? 'SUV' : 'Sedan';

  return {
    id: car.id,
    name: car.name,
    type,
    location: car.location ?? 'Phnom Penh, Cambodia',
    plateNumber: car.plateNumber ?? car.plate_number ?? 'N/A',
    seats,
    trans: car.trans ?? car.transmission ?? 'Auto',
    price: Number(car.price ?? car.daily_rate ?? 0),
    status: normalizedStatus,
    emoji: car.emoji ?? (isPickup ? 'PICKUP' : isLuxury ? 'LUXURY' : isSuv ? 'SUV' : isHybrid ? 'HYBRID' : 'CAR'),
    subtitle,
    filterCategory,
    luggageCount,
    doorCount,
    providerName: isLuxury ? 'PREMIUM DRIVE' : 'BOOKRIDE',
    photos: Array.isArray(car.photos) ? car.photos : [],
    detailSummary: `${type} · ${seats} seats · ${car.trans ?? car.transmission ?? 'Auto'}`,
    specDetails: [
      { label: 'Seats', value: seats },
      { label: 'Transmission', value: car.trans ?? car.transmission ?? 'Auto' },
      { label: 'Luggage', value: isPickup || isSuv ? '4 large bags' : '2 large bags' }
    ]
  };
}

const USD_TO_KHR = 4000;

function formatPaymentAmount(amountUsd, method) {
  if (method === 'khqr') {
    return `${Math.round(amountUsd * USD_TO_KHR).toLocaleString()}៛`;
  }

  return `$${amountUsd.toFixed(2)}`;
}

export default function CarRental({
  role,
  setActive,
  setBookingsTab
}) {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [selected, setSelected] = useState(null);
  const [payMethod, setPayMethod] = useState('aba');
  const [done] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [shaking, setShaking] = useState(null);
  const [pickupDate, setPickupDate] = useState('2026-04-05');
  const [returnDate, setReturnDate] = useState('2026-04-08');
  const [showSpecs, setShowSpecs] = useState(false);
  const [selectedCarType, setSelectedCarType] = useState('All');
  const [carTypes, setCarTypes] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [draftLocation, setDraftLocation] = useState('All');
  const [draftPickupDate, setDraftPickupDate] = useState('2026-04-05');
  const [draftReturnDate, setDraftReturnDate] = useState('2026-04-08');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [locationOptions, setLocationOptions] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
const qrPattern = useMemo(
  () => Array.from({ length: 100 }, () => Math.random() > 0.45),
  [],
);

  const goBack = () => {
    const next = Math.max(1, step - 1);
    if (next === 1) setSelected(null);
    goStep(next);
  };
  const [cars, setCars] = useState([]);
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
    const params = new URLSearchParams();
    if (selectedLocation && selectedLocation !== 'All') {
      params.set('location', selectedLocation);
    }
    if (selectedStatus && selectedStatus !== 'All') {
      params.set('status', selectedStatus);
    }
    if (pickupDate) {
      params.set('pickupDate', pickupDate);
    }
    if (returnDate) {
      params.set('returnDate', returnDate);
    }
    const apiUrl = `/api/cars${params.toString() ? `?${params.toString()}` : ''}`;

    fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        const normalizedCars = Array.isArray(data) ? data.map(normalizeCar) : [];
        const filteredCars = normalizedCars.filter(car => {
          const matchesType = selectedCarType === 'All' || car.filterCategory === selectedCarType;
          const matchesLocation = selectedLocation === 'All' || car.location === selectedLocation;
          const matchesStatus = selectedStatus === 'All' || car.status.toLowerCase() === selectedStatus.toLowerCase();

          return matchesType && matchesLocation && matchesStatus;
        });

        setCars(filteredCars);
      })
      .catch(err => console.error("Error fetching vehicles:", err));
  }, [pickupDate, returnDate, selectedCarType, selectedLocation, selectedStatus]);
  useEffect(() => {
    fetch('/api/cars')
      .then(res => res.json())
      .then(data => {
        const types = Array.isArray(data)
          ? [...new Set(data.map(normalizeCar).map(car => car.filterCategory).filter(Boolean))].sort((a, b) => a.localeCompare(b))
          : [];
        const locations = Array.isArray(data)
          ? [...new Set(data.map(car => car.location).filter(Boolean))].sort((a, b) => a.localeCompare(b))
          : [];
        setCarTypes(types);
        setLocationOptions(locations);
      })
      .catch(err => console.error('Error fetching car filters:', err));
  }, []);
  const handleSearch = () => {
    if (draftPickupDate && draftReturnDate && draftReturnDate < draftPickupDate) {
      setSearchError('Return date must be on or after pickup date.');
      return;
    }

    setSearchError('');
    setHasSearched(true);
    setSelectedLocation(draftLocation);
    setPickupDate(draftPickupDate);
    setReturnDate(draftReturnDate);
  };
  const handleLocationChange = event => {
    const value = event.target.value;
    setDraftLocation(value);
  };
  const handlePickupDateChange = event => {
    const value = event.target.value;
    setDraftPickupDate(value);
  };
  const handleReturnDateChange = event => {
    const value = event.target.value;
    setDraftReturnDate(value);
  };
  const car = cars.find(c => c.id === selected);
  const startDate = new Date(pickupDate);
  const endDate = new Date(returnDate);
  const diffDays = Math.floor((endDate - startDate) / 86400000);
  const days = Number.isFinite(diffDays) ? Math.max(1, diffDays) : 1;
  const totalAmount = car ? car.price * days : 0;
  const depositAmount = totalAmount * 0.2;
  const remainingAmount = totalAmount * 0.8;
  useEffect(() => {
    setShowSpecs(false);
    setShowPhotos(false);
    setActivePhotoIndex(0);
  }, [selected, step]);
  useEffect(() => {
    if (step >= 2 && !selected) {
      navigate('/cars', { replace: true });
    }
  }, [step, selected, navigate]);
  if (paymentSuccess || step === 4) return <div className="page" style={{
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
          if (setBookingsTab) setBookingsTab('rentals');
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
          <div className="page-title">Rental Request Sent!</div>
          <div className="page-sub">Your rental is being processed.</div>
          <button className="btn btn-primary btn-full" onClick={() => setActive('bookings')}>
            Go to My Bookings
          </button>
        </div>
      </div>;
  return <div className="page-wide">
      {showAuthModal && <AuthModal onConfirm={() => navigate('/login')} onClose={() => setShowAuthModal(false)} />}

      <div className="page-title">Car rental</div>
      <div className="page-sub">Premium vehicles for your personal use</div>
      {step === 1 && <div className="rental-search-shell">
          <div className="rental-search-bar">
            <label className="rental-search-field rental-search-field-wide">
              <span className="rental-search-icon">📍</span>
              <select className="rental-search-select" value={draftLocation} onChange={handleLocationChange}>
                <option value="All">All locations</option>
                {locationOptions.map(location => <option key={location} value={location}>
                    {location}
                  </option>)}
              </select>
            </label>
            <label className="rental-search-field">
              <span className="rental-search-icon">📅</span>
              <input className="rental-search-input" type="date" value={draftPickupDate} onChange={handlePickupDateChange} />
            </label>
            <label className="rental-search-field">
              <span className="rental-search-icon">📅</span>
              <input className="rental-search-input" type="date" value={draftReturnDate} onChange={handleReturnDateChange} />
            </label>
            <button type="button" className="rental-search-btn" onClick={handleSearch}>
              Search
            </button>
          </div>
          {searchError && <div className="rental-search-note rental-search-error">{searchError}</div>}
          {!searchError && hasSearched && <div className="rental-search-note">
              {cars.length
            ? `Found ${cars.length} car${cars.length > 1 ? 's' : ''}${selectedLocation !== 'All' ? ` in ${selectedLocation}` : ''} from ${pickupDate} to ${returnDate}.`
            : `No cars found${selectedLocation !== 'All' ? ` in ${selectedLocation}` : ''} from ${pickupDate} to ${returnDate}.`}
            </div>}
          <div className="rental-filter-row">
            <button
              type="button"
              className={`rental-filter-pill ${selectedCarType === 'All' ? 'active' : ''}`}
              onClick={() => {
                handleSearch();
                setSelectedCarType('All');
              }}
            >
              All cars
            </button>
            {carTypes.map(type => <button
                key={type}
                type="button"
                className={`rental-filter-pill ${selectedCarType === type ? 'active' : ''}`}
                onClick={() => {
                handleSearch();
                setSelectedCarType(type);
              }}
              >
                {type}
              </button>)}
            <button
              type="button"
              className={`rental-filter-pill ${selectedStatus === 'available' ? 'active' : ''}`}
              onClick={() => {
                handleSearch();
                setSelectedStatus(prev => prev === 'available' ? 'All' : 'available');
              }}
            >
              Available only
            </button>
          </div>
        </div>}

      {step > 1 && <div className="steps" style={{
      maxWidth: 640,
      margin: '0 auto 32px'
    }}>
          {['Details', 'Payment'].map((s, i) => <div key={s} style={{
        display: 'flex',
        alignItems: 'center',
        flex: i === 1 ? 'initial' : 1
      }}>
              <div className={`step ${i + 2 === step ? 'active' : i + 2 < step ? 'done' : 'idle'}`}>
                <div className="step-num">{i + 2 < step ? '?' : i + 1}</div>
                <div className="step-label" style={{
            marginLeft: 6,
            fontSize: 11
          }}>
                  {s}
                </div>
              </div>
              {i < 1 && <div className="step-line" />}
            </div>)}
        </div>}

      {step === 1 && <div className="car-grid">
          {cars.map((c, i) => <div key={c.id} className={`car-card ticket-card scroll-animate ${shaking === c.id ? 'shake-anim' : ''}`} style={{
        '--delay': `${i * 40}ms`
      }} onClick={() => {
        if (c.status !== 'Available') {
          setShaking(c.id);
          if (window.navigator.vibrate) window.navigator.vibrate(50); // Haptic feedback
          setTimeout(() => setShaking(null), 400);
        } else if (role === 'guest') {
          setShowAuthModal(true);
        } else {
          setSelected(c.id);
          goStep(2);
        }
      }}>
              <div className="car-img-wrap">
                {c.photos.length ? (
                  <img
                    src={c.photos[0]}
                    alt={c.name}
                    className="car-photo"
                  />
                ) : (
                  c.emoji
                )}
              </div>
              <div className="car-body">
                <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4
          }}>
                  <div className="car-name">{c.name}</div>
                  <span className={`badge ${c.status === 'Available' ? 'badge-green' : 'badge-red'}`}>
                    {c.status}
                  </span>
                </div>
                <div className="car-type-line">{c.subtitle}</div>
                <div className="car-facts">
                  <span className="car-fact">{c.seats} seats</span>
                  <span className="car-fact">{c.luggageCount} bags</span>
                  <span className="car-fact">{c.doorCount} doors</span>
                </div>
                <div className="car-provider">{c.providerName}</div>
                <div className="car-location">{c.location}</div>
                <div className="car-price">
                  ${c.price}
                  <span>/day</span>
                </div>
                <button className={`btn btn-full btn-sm ${c.status === 'Available' ? 'btn-primary' : 'btn-ghost'}`} style={{
            marginTop: 12
          }}>
                  {c.status !== 'Available' ? 'Not Available' : role === 'guest' ? 'Sign in to rent' : 'Rent now'}
                </button>
              </div>
            </div>)}
        </div>}

      {step === 2 && car && <div className="page" style={{
      maxWidth: 560,
      padding: 0
    }}>
          <div className="card">
            <div className="car-detail-stage">
              {car.photos.length ? (
                <img
                  className="car-detail-hero"
                  src={car.photos[activePhotoIndex] || car.photos[0]}
                  alt={car.name}
                />
              ) : (
                <div className="car-detail-fallback">{car.emoji}</div>
              )}
            </div>
            {car.photos.length > 1 && <div className="car-thumb-row">
                {car.photos.map((src, idx) => <button
                  key={`${car.id}-thumb-${idx}`}
                  type="button"
                  className={`car-thumb ${activePhotoIndex === idx ? 'active' : ''}`}
                  onClick={() => setActivePhotoIndex(idx)}
                >
                    <img src={src} alt={`${car.name} ${idx + 1}`} />
                  </button>)}
              </div>}
            <div className="car-detail-head">
              <div className="car-detail-meta">
                <div className="car-detail-name">{car.name}</div>
                <div className="car-detail-subline">
                  {car.type} · {car.seats} seats · {car.trans}
                </div>
                <div className="toggle-row">
                  <button className={`toggle-btn ${showSpecs ? 'active' : ''}`} type="button" onClick={() => setShowSpecs(prev => !prev)} aria-expanded={showSpecs}>
                    Specs{' '}
                    <Icon d={icons.chevron} size={12} className="toggle-icon" />
                  </button>
                  <button className={`toggle-btn ${showPhotos ? 'active' : ''}`} type="button" onClick={() => setShowPhotos(prev => !prev)} aria-expanded={showPhotos}>
                    Photos{' '}
                    <Icon d={icons.chevron} size={12} className="toggle-icon" />
                  </button>
                </div>
                <div className={`dropdown-panel ${showSpecs ? 'open' : ''}`} aria-hidden={!showSpecs}>
                  {car.specDetails.map(row => <div key={row.label} className="spec-row">
                      <span className="spec-key">{row.label}</span>
                      <span>{row.value}</span>
                    </div>)}
                  {!car.specDetails.length && <div className="spec-row">
                      <span className="spec-key">No specs available</span>
                    </div>}
                </div>
                <div className={`dropdown-panel photo-dropdown ${showPhotos ? 'open' : ''}`} aria-hidden={!showPhotos}>
                  {car.photos.length ? <div className="photo-grid">
                      {car.photos.slice(0, 4).map((src, idx) => <img key={`${car.id}-${idx}`} src={src} alt={`${car.name} ${idx + 1}`} />)}
                    </div> : <div className="car-db-details car-db-details-compact">
                      <div className="car-db-copy">No extra detail photos in database for this car yet.</div>
                      <div className="car-db-grid">
                        <div className="car-db-item">
                          <span className="car-db-label">Car</span>
                          <strong>{car.name}</strong>
                        </div>
                        <div className="car-db-item">
                          <span className="car-db-label">Plate</span>
                          <strong>{car.plateNumber}</strong>
                        </div>
                        <div className="car-db-item">
                          <span className="car-db-label">Details</span>
                          <strong>{car.detailSummary}</strong>
                        </div>
                        <div className="car-db-item">
                          <span className="car-db-label">Rate</span>
                          <strong>${car.price}/day</strong>
                        </div>
                      </div>
                    </div>}
                </div>
              </div>
              <div className="car-detail-price">
                ${car.price}
                <span>
                  /day
                </span>
              </div>
            </div>
            <div className="divider" />
            <div className="date-range">
              <div>
                <div className="label">Pickup</div>
                <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
              </div>
              <div>
                <div className="label">Return</div>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <div className="label">Driver full name</div>
              <input placeholder="Sereymongkol Thoeung" />
            </div>
            <div className="form-group">
              <div className="label">Driver license number</div>
              <input placeholder="DL-12345678" />
            </div>
            <div className="form-group">
              <div className="label">Phone number</div>
              <input placeholder="+855 17 420 0051" />
            </div>
            <div className="total-box">
              <div>
                <div style={{
              fontSize: 12,
              color: 'var(--accent)'
            }}>
                  Total ({days} days × ${car.price})
                </div>
              </div>
              <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--accent)'
          }}>
                ${car.price * days}
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
              <button className="btn btn-primary btn-lg" onClick={() => goStep(3)}>
                Continue to Payment{' '}
                <Icon d={icons.arrow} size={15} color="#fff" />
              </button>
            </div>
          </div>
        </div>}

      {step === 3 && car && <div className="page" style={{
      maxWidth: 560,
      padding: 0
    }}>
          <div className="card">
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
        }].map(m => <div key={m.id} className={`pay-method ${payMethod === m.id ? 'selected' : ''}`} onClick={() => setPayMethod(m.id)}>
                <div className="pay-method-icon">{m.icon}</div>
                <div>
                  <div className="pay-method-name">{m.name}</div>
                  <div className="pay-method-sub">{m.sub}</div>
                </div>
                <div className={`pay-radio ${payMethod === m.id ? 'checked' : ''}`} />
              </div>)}

            <div style={{
          textAlign: 'center',
          marginTop: 20
        }}>
              <div style={{
            fontSize: 12,
            color: 'var(--text-2)',
            marginBottom: 12
          }}>
                Scan to pay deposit
              </div>
              <div className="qr-box">
                <div className="qr-pattern">
                  {Array.from({
                length: 100
              }, (_, i) => <div key={i} className="qr-cell" style={{
                background: qrPattern[i] ? '#111' : 'transparent'
              }} />)}
                </div>
              </div>
              <div style={{
            fontSize: 11,
            color: 'var(--text-3)',
            marginTop: 10
          }}>
                Deposit: {formatPaymentAmount(depositAmount, payMethod)}
              </div>
            </div>

            <div className="divider" />
            <div className="total-box">
              <span style={{
            fontSize: 13,
            color: 'var(--accent)'
          }}>
                Remaining to pay on pickup
              </span>
              <span style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--accent)'
          }}>
                {formatPaymentAmount(remainingAmount, payMethod)}
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
            goStep(4);
          }}>
                Confirm Rental <Icon d={icons.check} size={15} color="#fff" />
              </button>
            </div>
          </div>
        </div>}
    </div>;
}

