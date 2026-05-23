async function postConfirmation(url, payload, fallbackMessage) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(responseData.error || fallbackMessage);
  }

  return responseData;
}

function getRentalDays(pickupDate, returnDate) {
  if (!pickupDate || !returnDate) return 1;
  const start = new Date(pickupDate);
  const end = new Date(returnDate);
  const diffDays = Math.floor((end - start) / 86400000);
  return Number.isFinite(diffDays) ? Math.max(1, diffDays) : 1;
}

function getDateTimeLabel(dateValue, timeValue, rentalMode = 'self_drive') {
  if (!dateValue) return 'Not set';
  if (rentalMode === 'with_driver') return dateValue;
  const time = `${timeValue || ''}`.slice(0, 5);
  return time ? `${dateValue} ${time}` : dateValue;
}

function buildFallbackBusConfirmation(responseData, payload) {
  const booking = responseData.booking || responseData;
  const passenger = payload.passengerInfo || {};
  const summary = payload.confirmationSummary || {};

  return {
    type: 'bus',
    id: booking.id || booking.route_id || payload.route_id || 'Pending',
    status: booking.status || 'confirmed',
    paymentMethod: booking.payment_method || payload.payment_method || 'cash',
    total: Number(booking.total_price ?? payload.total_price ?? 0),
    summary: {
      Passenger: `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() || 'Not set',
      Contact: passenger.phone || 'Not set',
      Email: passenger.email || 'Not set',
      Route: summary.route || `Route #${payload.route_id}`,
      Date: summary.date || 'Not set',
      Vehicle: summary.vehicle || 'Bus',
      Seats: Array.isArray(payload.seat_number) ? payload.seat_number.join(', ') : `${payload.seat_number || 'Not set'}`,
    },
  };
}

function buildFallbackRentalConfirmation(responseData, payload) {
  const rental = responseData || {};
  const car = rental.car || {};
  const paymentMethod = rental.payment_method || payload.paymentMethod || 'cash';
  const rentalMode = rental.rental_mode || payload.rentalMode;
  const total = Number(rental.total_price || 0);
  const usesQr = paymentMethod === 'aba' || paymentMethod === 'khqr';

  return {
    type: 'rental',
    id: rental.id || 'Pending',
    status: rental.status || 'pending',
    paymentMethod,
    total,
    summary: {
      Car: car.name || 'Rental car',
      Plate: car.plate_number || 'N/A',
      Pickup: getDateTimeLabel(rental.pickup_date || payload.pickupDate, rental.pickup_time || payload.pickupTime, rentalMode),
      Return: getDateTimeLabel(rental.return_date || payload.returnDate, rental.return_time || payload.returnTime, rentalMode),
      'Rental days': getRentalDays(rental.pickup_date || payload.pickupDate, rental.return_date || payload.returnDate),
      Mode: rentalMode === 'with_driver' ? 'With driver' : 'Self-drive',
      [usesQr ? 'Deposit paid' : 'Payment method']: usesQr ? total * 0.2 : 'Cash',
      [usesQr ? 'Remaining on pickup' : 'Pay on pickup']: usesQr ? total * 0.8 : total,
    },
  };
}

export function confirmBusBooking(payload) {
  return postConfirmation('/api/bookings/bus', payload, 'Failed to create bus booking.')
    .then((responseData) => ({
      ...responseData,
      confirmation: responseData.confirmation || buildFallbackBusConfirmation(responseData, payload),
    }));
}

export function confirmRentalBooking(payload) {
  return postConfirmation('/api/cars/bookings', payload, 'Failed to create rental booking.')
    .then((responseData) => ({
      ...responseData,
      confirmation: responseData.confirmation || buildFallbackRentalConfirmation(responseData, payload),
    }));
}

export function saveCheckoutConfirmation(key, confirmation) {
  if (typeof window === 'undefined' || !confirmation) return;
  window.sessionStorage.setItem(key, JSON.stringify(confirmation));
}

export function loadCheckoutConfirmation(key) {
  if (typeof window === 'undefined') return null;

  try {
    const storedConfirmation = window.sessionStorage.getItem(key);
    return storedConfirmation ? JSON.parse(storedConfirmation) : null;
  } catch {
    return null;
  }
}
