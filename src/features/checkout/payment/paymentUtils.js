const USD_TO_KHR = 4000;

export function formatPaymentAmount(amountUsd, method) {
  const amount = Number(amountUsd || 0);

  if (method === 'khqr') {
    return `${Math.round(amount * USD_TO_KHR).toLocaleString()}៛`;
  }

  return `$${amount.toFixed(2)}`;
}

export function formatDisplayDate(value) {
  if (!value) return 'Not selected';
  const [year, month, dayWithTime] = `${value}`.split('-');
  const day = dayWithTime?.slice(0, 2);
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
