﻿
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, icons, setupScrollReveal } from '../../utils/sharedUser';
import AuthModal from './AuthModal';
import { useAuth } from '../../context/AuthContext';
import RentalBookingForm from '../../features/rental/booking-form/RentalBookingForm';
import RentalPaymentPanel from '../../features/checkout/payment/RentalPaymentPanel';
import CheckoutSuccess from '../../features/checkout/confirmation/CheckoutSuccess';
import {
  confirmRentalBooking,
  loadCheckoutConfirmation,
  saveCheckoutConfirmation
} from '../../features/checkout/confirmation/confirmationApi';

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
    location: car.location || 'Unknown location',
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

const DRIVER_FEE_PER_DAY = 25;
const RENTAL_CONFIRMATION_KEY = 'checkout-confirmation-rental';

function getDateInputValue(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CarRental({
  role,
  setActive,
  setBookingsTab
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
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
  const [pickupDate, setPickupDate] = useState(() => getDateInputValue());
  const [returnDate, setReturnDate] = useState(() => getDateInputValue(3));
  const [showSpecs, setShowSpecs] = useState(false);
  const [selectedCarType, setSelectedCarType] = useState('All');
  const [carTypes, setCarTypes] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [draftLocation, setDraftLocation] = useState('All');
  const [draftPickupDate, setDraftPickupDate] = useState(() => getDateInputValue());
  const [draftReturnDate, setDraftReturnDate] = useState(() => getDateInputValue(3));
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [locationOptions, setLocationOptions] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [rentalMode, setRentalMode] = useState('self_drive');
  const [driverName, setDriverName] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(() => loadCheckoutConfirmation(RENTAL_CONFIRMATION_KEY));

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
    if (selectedStatus === 'available') {
      params.set('status', selectedStatus);
    }
    if (selectedCarType && selectedCarType !== 'All') {
      params.set('type', selectedCarType);
    }
    if (selectedStatus === 'available' && pickupDate) {
      params.set('pickupDate', pickupDate);
    }
    if (selectedStatus === 'available' && returnDate) {
      params.set('returnDate', returnDate);
    }
    const apiUrl = `/api/cars${params.toString() ? `?${params.toString()}` : ''}`;

    fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        const normalizedCars = Array.isArray(data) ? data.map(normalizeCar) : [];
        setCars(normalizedCars);
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
        setCarTypes(types);
      })
      .catch(err => console.error('Error fetching car filters:', err));

    fetch('/api/cars/locations')
      .then(res => res.json())
      .then(data => {
        setLocationOptions(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('Error fetching car locations:', err));
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
  const validateRentalDetails = () => {
    if (pickupDate && returnDate && returnDate < pickupDate) {
      return 'Return date must be on or after pickup date.';
    }
    if (!driverName.trim()) {
      return rentalMode === 'with_driver' ? 'Passenger full name is required.' : 'Driver full name is required.';
    }
    if (rentalMode === 'self_drive' && !driverLicense.trim()) {
      return 'Driver license number is required for self-drive rentals.';
    }
    if (!phoneNumber.trim()) {
      return 'Phone number is required.';
    }

    return '';
  };
  const handleContinueToPayment = (details) => {
    setPickupDate(details.pickupDate);
    setReturnDate(details.returnDate);
    setRentalMode(details.rentalMode);
    setDriverName(details.driverName);
    setDriverLicense(details.driverLicense);
    setPhoneNumber(details.phone);
    setBookingError('');
    goStep(3);
  };
  const handleConfirmRental = async () => {
    const error = validateRentalDetails();
    if (error) {
      setBookingError(error);
      goStep(2);
      return;
    }

    setIsBookingSubmitting(true);
    setBookingError('');

    try {
      const responseData = await confirmRentalBooking({
        carId: car.id,
        pickupDate,
        returnDate,
        fullName: driverName.trim(),
        licenseNumber: rentalMode === 'self_drive' ? driverLicense.trim() : '',
        rentalMode,
        phoneNumber: phoneNumber.trim(),
        paymentMethod: payMethod,
        userId: user?.id || null
      });

      const nextConfirmation = responseData.confirmation;
      setConfirmation(nextConfirmation);
      saveCheckoutConfirmation(RENTAL_CONFIRMATION_KEY, nextConfirmation);
      setCars(prev => prev.map(item => (
        item.id === car.id ? { ...item, status: 'Rented' } : item
      )));
      setPaymentSuccess(true);
      goStep(4);
    } catch (err) {
      setBookingError(err.message || 'Failed to create rental booking.');
    } finally {
      setIsBookingSubmitting(false);
    }
  };
  const car = cars.find(c => c.id === selected);
  const startDate = new Date(pickupDate);
  const endDate = new Date(returnDate);
  const diffDays = Math.floor((endDate - startDate) / 86400000);
  const days = Number.isFinite(diffDays) ? Math.max(1, diffDays) : 1;
  const dailyDriverFee = rentalMode === 'with_driver' ? DRIVER_FEE_PER_DAY : 0;
  const dailyTotal = car ? car.price + dailyDriverFee : 0;
  const totalAmount = dailyTotal * days;
  const depositAmount = totalAmount * 0.2;
  const remainingAmount = totalAmount * 0.8;
  useEffect(() => {
    setShowSpecs(false);
    setShowPhotos(false);
    setActivePhotoIndex(0);
    setBookingError('');
  }, [selected, step]);
  useEffect(() => {
    if (step >= 2 && step !== 4 && !selected) {
      navigate('/cars', { replace: true });
    }
  }, [step, selected, navigate]);
  if (paymentSuccess || step === 4) return (
    <CheckoutSuccess
      confirmation={confirmation}
      onMyBookings={() => {
        if (setBookingsTab) setBookingsTab('rentals');
        setPaymentSuccess(false);
        setActive('bookings');
      }}
      onHome={() => {
        setPaymentSuccess(false);
        setActive('home');
      }}
    />
  );
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
              <input className="rental-search-input" type="date" value={draftPickupDate} min={getDateInputValue()} onChange={handlePickupDateChange} />
            </label>
            <label className="rental-search-field">
              <span className="rental-search-icon">📅</span>
              <input className="rental-search-input" type="date" value={draftReturnDate} min={draftPickupDate || getDateInputValue()} onChange={handleReturnDateChange} />
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
              className={`rental-filter-pill ${selectedCarType === 'All' && selectedStatus === 'All' ? 'active' : ''}`}
              onClick={() => {
                handleSearch();
                setSelectedCarType('All');
                setSelectedStatus('All');
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
                <div className="step-num">{i + 2 < step ? <Icon d={icons.check} size={12} /> : i + 1}</div>
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
            <RentalBookingForm
              initialPickupDate={pickupDate}
              initialReturnDate={returnDate}
              initialRentalMode={rentalMode}
              initialDriverName={driverName}
              initialDriverLicense={driverLicense}
              initialPhone={phoneNumber}
              dailyRate={car.price}
              submitError={bookingError}
              onSubmit={handleContinueToPayment}
              onCancel={goBack}
            />
          </div>
        </div>}

      {step === 3 && car && <div className="page" style={{
      maxWidth: 560,
      padding: 0
    }}>
          <RentalPaymentPanel
            paymentMethod={payMethod}
            onPaymentMethodChange={setPayMethod}
            pickupDate={pickupDate}
            returnDate={returnDate}
            days={days}
            dailyTotal={dailyTotal}
            totalAmount={totalAmount}
            depositAmount={depositAmount}
            remainingAmount={remainingAmount}
            isSubmitting={isBookingSubmitting}
            error={bookingError}
            onBack={goBack}
            onConfirm={handleConfirmRental}
          />
        </div>}
    </div>;
}

