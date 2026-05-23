import React, { useMemo } from 'react';
import { Icon, icons } from '../../../utils/sharedUser';
import { formatDisplayDate, formatDisplayDateTime, formatPaymentAmount } from './paymentUtils';

const PAYMENT_METHODS = [
  {
    id: 'aba',
    badge: 'ABA',
    name: 'ABA Bank',
    sub: 'Scan QR or transfer'
  },
  {
    id: 'khqr',
    badge: 'KHQR',
    name: 'KHQR',
    sub: 'Cambodia QR payment standard'
  },
  {
    id: 'cash',
    badge: 'CASH',
    name: 'Cash',
    sub: 'Pay on pickup'
  }
];

export default function RentalPaymentPanel({
  paymentMethod,
  onPaymentMethodChange,
  pickupDate,
  pickupTime,
  returnDate,
  returnTime,
  rentalMode = 'self_drive',
  days,
  dailyTotal,
  totalAmount,
  depositAmount,
  remainingAmount,
  isSubmitting,
  error,
  onBack,
  onConfirm
}) {
  const qrPattern = useMemo(
    () => Array.from({ length: 100 }, (_, index) => (index * 7 + 3) % 11 < 5),
    []
  );
  const usesQr = paymentMethod === 'aba' || paymentMethod === 'khqr';
  const isWithDriver = rentalMode === 'with_driver';

  return (
    <div className="card">
      <div className="sec-title">Choose payment method</div>
      {PAYMENT_METHODS.map(method => (
        <div
          key={method.id}
          className={`pay-method ${paymentMethod === method.id ? 'selected' : ''}`}
          onClick={() => onPaymentMethodChange(method.id)}
        >
          <div className="pay-method-icon payment-badge">{method.badge}</div>
          <div>
            <div className="pay-method-name">{method.name}</div>
            <div className="pay-method-sub">{method.sub}</div>
          </div>
          <div className={`pay-radio ${paymentMethod === method.id ? 'checked' : ''}`} />
        </div>
      ))}

      {usesQr ? (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
            Scan to pay deposit
          </div>
          <div className="qr-box">
            <div className="qr-pattern">
              {qrPattern.map((isDark, index) => (
                <div
                  key={index}
                  className="qr-cell"
                  style={{ background: isDark ? '#111' : 'transparent' }}
                />
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
            Deposit: {formatPaymentAmount(depositAmount, paymentMethod)}
          </div>
        </div>
      ) : (
        <div className="booking-summary-list" style={{ marginTop: 20 }}>
          <div className="booking-summary-row">
            <span>Payment</span>
            <strong>Cash on pickup</strong>
          </div>
          <div className="booking-summary-row">
            <span>Due at pickup</span>
            <strong>{formatPaymentAmount(totalAmount, paymentMethod)}</strong>
          </div>
        </div>
      )}

      <div className="divider" />
      <div className="booking-summary-list" style={{ marginBottom: 12 }}>
        <div className="booking-summary-row">
          <span>Pickup</span>
          <strong>{isWithDriver ? formatDisplayDate(pickupDate) : formatDisplayDateTime(pickupDate, pickupTime)}</strong>
        </div>
        <div className="booking-summary-row">
          <span>Return</span>
          <strong>{isWithDriver ? formatDisplayDate(returnDate) : formatDisplayDateTime(returnDate, returnTime)}</strong>
        </div>
        <div className="booking-summary-row">
          <span>Rental days</span>
          <strong>{days}</strong>
        </div>
        <div className="booking-summary-row">
          <span>Daily rate</span>
          <strong>{formatPaymentAmount(dailyTotal, paymentMethod)}/day</strong>
        </div>
      </div>
      <div className="total-box" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--accent)' }}>Rental total</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
          {formatPaymentAmount(totalAmount, paymentMethod)}
        </span>
      </div>
      {usesQr && (
        <div className="total-box" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--accent)' }}>Deposit paid now</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
            {formatPaymentAmount(depositAmount, paymentMethod)}
          </span>
        </div>
      )}
      <div className="total-box">
        <span style={{ fontSize: 13, color: 'var(--accent)' }}>
          {usesQr ? 'Remaining to pay on pickup' : 'Pay on pickup'}
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
          {formatPaymentAmount(usesQr ? remainingAmount : totalAmount, paymentMethod)}
        </span>
      </div>
      {error && <div className="rental-search-note rental-search-error" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button className="btn btn-ghost btn-round-back" aria-label="Back" onClick={onBack}>
          <Icon d={icons.back} size={15} />
        </button>
        <button className="btn btn-primary btn-lg" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Confirming...' : 'Confirm Rental'} <Icon d={icons.check} size={15} color="#fff" />
        </button>
      </div>
    </div>
  );
}
