import React from 'react';
import { Icon, icons } from '../../../utils/sharedUser';
import { formatDisplayDate, formatPaymentAmount } from '../payment/paymentUtils';

const MONEY_LABELS = new Set([
  'Deposit paid',
  'Remaining on pickup',
  'Pay on pickup',
]);

function formatValue(label, value, paymentMethod) {
  if (value === null || value === undefined || value === '') return 'Not set';

  if (label === 'Rental days') {
    const days = Number(value || 0);
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  if (label === 'Pickup' || label === 'Return') {
    return formatDisplayDate(value);
  }

  if (typeof value === 'number' && MONEY_LABELS.has(label)) {
    return formatPaymentAmount(value, paymentMethod);
  }

  return value || 'Not set';
}

export default function CheckoutSuccess({ confirmation, onMyBookings, onHome }) {
  if (!confirmation) {
    return (
      <div className="page" style={{ maxWidth: 520 }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="page-title">Checkout confirmation not found</div>
          <div className="page-sub">Complete a payment first to see the final checkout summary.</div>
          <div className="success-actions">
            <button className="btn btn-primary btn-full" onClick={onMyBookings}>
              My Bookings
            </button>
            <button className="btn btn-ghost btn-full" onClick={onHome}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const paymentMethod = confirmation?.paymentMethod || 'cash';
  const summary = confirmation?.summary || {};
  const rows = Object.entries(summary);

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div
          className="confirm-icon"
          style={{
            background: 'var(--green-soft)',
            color: 'var(--green)',
            width: 60,
            height: 60,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 24,
          }}
        >
          <Icon d={icons.check} size={24} />
        </div>
        <div className="page-title">Payment successful!</div>
        <div className="page-sub">
          {confirmation?.type === 'rental'
            ? 'Your rental is now saved in My bookings.'
            : 'Your bus booking is now saved in My bookings.'}
        </div>

        <div className="total-box" style={{ margin: '20px 0 12px', textAlign: 'left' }}>
          <span style={{ fontSize: 13, color: 'var(--accent)' }}>Confirmation</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
            #{confirmation?.id || 'Pending'}
          </span>
        </div>

        <div className="booking-summary-list" style={{ textAlign: 'left', marginBottom: 20 }}>
          <div className="booking-summary-row">
            <span>Status</span>
            <strong>{confirmation?.status || 'confirmed'}</strong>
          </div>
          <div className="booking-summary-row">
            <span>Payment</span>
            <strong>{paymentMethod.toUpperCase()}</strong>
          </div>
          {rows.map(([label, value]) => (
            <div key={label} className="booking-summary-row">
              <span>{label}</span>
              <strong>{formatValue(label, value, paymentMethod)}</strong>
            </div>
          ))}
          <div className="booking-summary-row">
            <span>Total</span>
            <strong>{formatPaymentAmount(confirmation?.total, paymentMethod)}</strong>
          </div>
        </div>

        <div className="success-actions">
          <button className="btn btn-primary btn-full" onClick={onMyBookings}>
            My Bookings
          </button>
          <button className="btn btn-ghost btn-full" onClick={onHome}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
