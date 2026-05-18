import React, { useMemo, useState } from 'react';
import { Icon, icons } from '../../../utils/sharedUser';
import './RentalBookingForm.css';

const DRIVER_FEE_PER_DAY = 25;
const VALID_RENTAL_MODES = new Set(['self_drive', 'with_driver']);

function getDateInputValue(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RentalBookingForm({
  initialPickupDate = '',
  initialReturnDate = '',
  initialDriverName = '',
  initialDriverLicense = '',
  initialPhone = '',
  initialRentalMode = 'self_drive',
  dailyRate = 0,
  submitError = '',
  onSubmit,
  onCancel
}) {
  const [pickupDate, setPickupDate] = useState(initialPickupDate);
  const [returnDate, setReturnDate] = useState(initialReturnDate);
  const [driverName, setDriverName] = useState(initialDriverName);
  const [driverLicense, setDriverLicense] = useState(initialDriverLicense);
  const [phone, setPhone] = useState(initialPhone);
  const [rentalMode, setRentalMode] = useState(
    VALID_RENTAL_MODES.has(initialRentalMode) ? initialRentalMode : 'self_drive'
  );
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const today = getDateInputValue();

  const days = useMemo(() => {
    if (!pickupDate || !returnDate) return 1;
    const start = new Date(pickupDate);
    const end = new Date(returnDate);
    const diffDays = Math.floor((end - start) / 86400000);
    return Number.isFinite(diffDays) ? Math.max(1, diffDays) : 1;
  }, [pickupDate, returnDate]);

  const driverFeePerDay = rentalMode === 'with_driver' ? DRIVER_FEE_PER_DAY : 0;
  const dailyTotal = Number(dailyRate || 0) + driverFeePerDay;
  const totalPrice = dailyTotal * days;

  const values = {
    pickupDate,
    returnDate,
    driverName,
    driverLicense,
    phone
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'pickupDate':
        if (!value) return 'Pickup date is required';
        if (value < today) return 'Pickup date cannot be in the past';
        return '';
      case 'returnDate':
        if (!value) return 'Return date is required';
        if (pickupDate && value < pickupDate) return 'Return date must be on or after pickup date';
        return '';
      case 'driverName':
        if (!value.trim()) {
          return rentalMode === 'with_driver'
            ? 'Passenger full name is required'
            : 'Driver name is required';
        }
        if (value.trim().length < 3) return 'Name must be at least 3 characters';
        if (!/^[a-zA-Z\s]+$/.test(value.trim())) return 'Name should only contain letters and spaces';
        return '';
      case 'driverLicense':
        if (rentalMode === 'with_driver') return '';
        if (!value.trim()) return 'License number is required';
        if (!/^[A-Za-z0-9-]+$/.test(value.trim())) {
          return 'License should only contain letters, numbers, and hyphens';
        }
        if (value.trim().length < 5) return 'License number must be at least 5 characters';
        return '';
      case 'phone':
        if (!value.trim()) return 'Phone number is required';
        if (!/^\+?[0-9\s-]{8,20}$/.test(value.trim())) return 'Enter a valid phone number';
        return '';
      default:
        return '';
    }
  };

  const validateForm = () => {
    const nextErrors = {
      pickupDate: validateField('pickupDate', pickupDate),
      returnDate: validateField('returnDate', returnDate),
      driverName: validateField('driverName', driverName),
      driverLicense: validateField('driverLicense', driverLicense),
      phone: validateField('phone', phone)
    };

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleBlur = (fieldName) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    setErrors(prev => ({
      ...prev,
      [fieldName]: validateField(fieldName, values[fieldName])
    }));
  };

  const handleChange = (fieldName, value) => {
    const setters = {
      pickupDate: setPickupDate,
      returnDate: setReturnDate,
      driverName: setDriverName,
      driverLicense: setDriverLicense,
      phone: setPhone
    };

    setters[fieldName](value);

    if (touched[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: validateField(fieldName, value)
      }));
    }
  };

  const handleRentalModeChange = (nextMode) => {
    setRentalMode(nextMode);
    setErrors(prev => ({
      ...prev,
      driverLicense: '',
      driverName: touched.driverName ? validateField('driverName', driverName) : prev.driverName
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setTouched({
      pickupDate: true,
      returnDate: true,
      driverName: true,
      driverLicense: rentalMode === 'self_drive',
      phone: true
    });

    if (!validateForm()) return;

    onSubmit({
      pickupDate,
      returnDate,
      rentalMode,
      driverName: driverName.trim(),
      driverLicense: rentalMode === 'self_drive' ? driverLicense.trim() : '',
      phone: phone.trim(),
      days,
      dailyTotal,
      totalPrice
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rental-booking-form">
      <div className="date-range">
        <div className="form-group">
          <label className="label">Pickup</label>
          <input
            type="date"
            value={pickupDate}
            min={today}
            onChange={(event) => handleChange('pickupDate', event.target.value)}
            onBlur={() => handleBlur('pickupDate')}
            className={touched.pickupDate && errors.pickupDate ? 'input-error' : ''}
          />
          {touched.pickupDate && errors.pickupDate && (
            <div className="error-message">{errors.pickupDate}</div>
          )}
        </div>
        <div className="form-group">
          <label className="label">Return</label>
          <input
            type="date"
            value={returnDate}
            min={pickupDate || undefined}
            onChange={(event) => handleChange('returnDate', event.target.value)}
            onBlur={() => handleBlur('returnDate')}
            className={touched.returnDate && errors.returnDate ? 'input-error' : ''}
          />
          {touched.returnDate && errors.returnDate && (
            <div className="error-message">{errors.returnDate}</div>
          )}
        </div>
      </div>

      <div className="form-group">
        <div className="label">Rental type</div>
        <div className="rental-mode-group">
          <button
            type="button"
            className={`rental-mode-option ${rentalMode === 'self_drive' ? 'active' : ''}`}
            onClick={() => handleRentalModeChange('self_drive')}
          >
            Self-drive
          </button>
          <button
            type="button"
            className={`rental-mode-option ${rentalMode === 'with_driver' ? 'active' : ''}`}
            onClick={() => handleRentalModeChange('with_driver')}
          >
            With driver +${DRIVER_FEE_PER_DAY}/day
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="label">
          {rentalMode === 'with_driver' ? 'Passenger full name' : 'Driver full name'}
        </label>
        <input
          type="text"
          placeholder="Sereymongkol Thoeung"
          value={driverName}
          onChange={(event) => handleChange('driverName', event.target.value)}
          onBlur={() => handleBlur('driverName')}
          className={touched.driverName && errors.driverName ? 'input-error' : ''}
        />
        {touched.driverName && errors.driverName && (
          <div className="error-message">{errors.driverName}</div>
        )}
      </div>

      {rentalMode === 'self_drive' && (
        <div className="form-group">
          <label className="label">Driver license number</label>
          <input
            type="text"
            placeholder="DL-12345678"
            value={driverLicense}
            onChange={(event) => handleChange('driverLicense', event.target.value)}
            onBlur={() => handleBlur('driverLicense')}
            className={touched.driverLicense && errors.driverLicense ? 'input-error' : ''}
          />
          {touched.driverLicense && errors.driverLicense && (
            <div className="error-message">{errors.driverLicense}</div>
          )}
        </div>
      )}

      <div className="form-group">
        <label className="label">Phone number</label>
        <input
          type="tel"
          placeholder="+855 17 420 0051"
          value={phone}
          onChange={(event) => handleChange('phone', event.target.value)}
          onBlur={() => handleBlur('phone')}
          className={touched.phone && errors.phone ? 'input-error' : ''}
        />
        {touched.phone && errors.phone && (
          <div className="error-message">{errors.phone}</div>
        )}
      </div>

      {submitError && <div className="error-message">{submitError}</div>}

      <div className="total-box">
        <div>
          <div style={{ fontSize: 12, color: 'var(--accent)' }}>
            Total ({days} days x ${dailyTotal})
          </div>
          {driverFeePerDay > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
              Includes driver service: ${DRIVER_FEE_PER_DAY}/day
            </div>
          )}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
          ${totalPrice}
        </div>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button
            type="button"
            className="btn btn-ghost btn-round-back"
            aria-label="Back"
            onClick={onCancel}
          >
            <Icon d={icons.back} size={15} />
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-lg">
          Continue to Payment <Icon d={icons.arrow} size={15} color="#fff" />
        </button>
      </div>
    </form>
  );
}
