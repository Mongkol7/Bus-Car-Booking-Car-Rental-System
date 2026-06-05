import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon, icons } from '../../utils/sharedAdmin';

const RENTALS_SECTION_STORAGE_KEY = 'admin_rentals_section';
const RENTALS_SECTIONS = ['rentals', 'drivers'];
const STATUS_TABS = ['all', 'pending', 'upcoming', 'active', 'overdue', 'cancelled', 'returned'];
const DRIVER_STATUS_TABS = ['all', 'available', 'inactive'];
const EDIT_STATUS_OPTIONS = ['pending', 'confirmed', 'cancelled', 'returned'];
const PAYMENT_METHODS = ['aba', 'khqr', 'cash'];
const EMPTY_FORM = {
  pickup_datetime: '',
  return_datetime: '',
  driver_name: '',
  driver_license: '',
  payment_method: 'aba',
  status: 'pending',
  damage_description: '',
  damage_charge: '0'
};
const EMPTY_DRIVER_FORM = {
  name: '',
  license_number: '',
  phone: '',
  hourly_rate: '',
  status: 'available',
  profile_photo: '',
  background: '',
  experience_years: '0',
  languages: ''
};

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function normalizeSection(value) {
  return RENTALS_SECTIONS.includes(value) ? value : 'rentals';
}

function getStoredSection() {
  if (typeof window === 'undefined') return 'rentals';
  return normalizeSection(window.localStorage.getItem(RENTALS_SECTION_STORAGE_KEY));
}

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function driverKind(rental) {
  return rental?.hired_driver_id ? 'Hired driver' : 'Self-drive';
}

function displayDriverName(rental) {
  if (rental?.hired_driver_id) return rental.hired_driver_name || rental.driver_name || 'Assigned driver';
  return rental?.driver_name || 'Self-driver';
}

function formatLanguages(languages) {
  if (Array.isArray(languages)) return languages.filter(Boolean).join(', ') || 'Not set';
  return languages || 'Not set';
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

function getDriverAvailability(driver, now = new Date()) {
  if (driver?.status !== 'available') {
    return { badge: 'Inactive', badgeClass: 'badge-red', note: 'Not offered to users', noteColor: 'var(--red)' };
  }

  const rentals = (Array.isArray(driver.active_rental_details) ? driver.active_rental_details : [])
    .map((rental) => ({
      ...rental,
      pickupDate: new Date(rental.pickup_datetime),
      returnDate: new Date(rental.return_datetime)
    }))
    .filter((rental) => !Number.isNaN(rental.pickupDate.getTime()) && !Number.isNaN(rental.returnDate.getTime()))
    .sort((a, b) => a.pickupDate - b.pickupDate);

  const currentRental = rentals.find((rental) => rental.pickupDate <= now && rental.returnDate > now);
  if (currentRental) {
    return {
      badge: 'On rental',
      badgeClass: 'badge-red',
      note: `Busy for ${formatDuration(currentRental.returnDate - now)}`,
      noteColor: 'var(--red)',
      rental: currentRental
    };
  }

  const nextRental = rentals.find((rental) => rental.pickupDate > now);
  if (nextRental) {
    return {
      badge: 'Available',
      badgeClass: 'badge-green',
      note: `Available for ${formatDuration(nextRental.pickupDate - now)}`,
      noteColor: 'var(--amber)',
      rental: nextRental
    };
  }

  return { badge: 'Available', badgeClass: 'badge-green', note: 'No active rental scheduled', noteColor: 'var(--green)' };
}

function statusBadge(status) {
  if (status === 'confirmed' || status === 'upcoming' || status === 'active' || status === 'returned') return 'badge-green';
  if (status === 'overdue') return 'badge-red';
  if (status === 'pending') return 'badge-amber';
  return 'badge-red';
}

function displayStatus(status) {
  if (status === 'confirmed') return 'confirmed';
  return status;
}

function rentalStage(rental, now = new Date()) {
  const status = rental.status || 'pending';
  if (status !== 'confirmed') return status;
  const start = new Date(rental.pickup_datetime || rental.pickup_date);
  const end = new Date(rental.return_datetime || rental.return_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'active';
  if (now < start) return 'upcoming';
  if (now > end) return 'overdue';
  return 'active';
}

function rentalDays(rental) {
  const start = new Date(rental.pickup_datetime || rental.pickup_date);
  const end = new Date(rental.return_datetime || rental.return_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

function calculateRentalPreview(form, rental) {
  const start = new Date(form.pickup_datetime);
  const end = new Date(form.return_datetime);
  const dailyRate = Number(rental?.daily_rate || 0);
  const hourlyRate = dailyRate / 24;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { dailyRate, hourlyRate, hours: 0, charge: 0, valid: false };
  }
  const hours = Math.max(1, Math.ceil((end - start) / 3600000));
  return {
    dailyRate,
    hourlyRate,
    hours,
    charge: Number((hours * hourlyRate).toFixed(2)),
    valid: true
  };
}

function exportCsv(rows) {
  const headers = ['ID', 'User', 'Email', 'Phone', 'Car', 'Pickup date-time', 'Return date-time', 'Rental hours', 'Daily rate', 'Hourly rate', 'Hourly charge', 'Driver type', 'Hired driver', 'Self-driver / actual driver', 'Driver phone', 'Driver license', 'Driver hourly rate', 'Driver fee', 'Late return hours', 'Late return charge', 'Damage responsibility', 'Damage charge', 'Damage description', 'Total', 'Payment', 'Status', 'Returned at'];
  const body = rows.map((rental) => [
    rental.id,
    rental.user_name,
    rental.email,
    rental.phone,
    rental.car_name,
    formatDateTime(rental.pickup_datetime || rental.pickup_date),
    formatDateTime(rental.return_datetime || rental.return_date),
    Number(rental.rental_hours || 0).toFixed(2),
    Number(rental.daily_rate || 0).toFixed(2),
    Number(rental.hourly_rate || 0).toFixed(2),
    Number(rental.hourly_charge || 0).toFixed(2),
    driverKind(rental),
    rental.hired_driver_name || '',
    rental.driver_name,
    rental.hired_driver_phone || '',
    rental.hired_driver_license_number || rental.driver_license,
    Number(rental.hired_driver_hourly_rate || 0).toFixed(2),
    Number(rental.driver_fee || 0).toFixed(2),
    Number(rental.late_return_hours || 0).toFixed(0),
    Number(rental.late_return_charge || 0).toFixed(2),
    rental.damage_responsibility || '',
    Number(rental.damage_charge || 0).toFixed(2),
    rental.damage_description || '',
    Number(rental.total_price || 0).toFixed(2),
    rental.payment_method,
    rentalStage(rental),
    rental.returned_at ? formatDateTime(rental.returned_at) : ''
  ]);
  const csv = [headers, ...body]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'admin-rentals.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function RentalModal({ rental, form, error, saving, onChange, onSubmit, onClose }) {
  const preview = calculateRentalPreview(form, rental);
  const driverHourlyRate = Number(rental?.hired_driver_hourly_rate || 0);
  const driverFeePreview = rental?.hired_driver_id && preview.valid ? Number((preview.hours * driverHourlyRate).toFixed(2)) : 0;
  const returnedAtDate = form.status === 'returned'
    ? (rental?.status === 'returned' && rental?.returned_at ? new Date(rental.returned_at) : new Date())
    : null;
  const returnDate = new Date(form.return_datetime);
  const lateHours = returnedAtDate && !Number.isNaN(returnDate.getTime()) && returnedAtDate > returnDate
    ? Math.max(1, Math.ceil((returnedAtDate - returnDate) / 3600000))
    : 0;
  const lateHourlyRate = preview.hourlyRate + (rental?.hired_driver_id ? driverHourlyRate : 0);
  const lateChargePreview = Number((lateHours * lateHourlyRate).toFixed(2));
  const damageChargeRaw = Number(form.damage_charge || 0);
  const damageCharge = Number.isFinite(damageChargeRaw) ? Math.max(0, damageChargeRaw) : 0;
  const damageResponsibility = rental?.hired_driver_id ? 'driver' : 'renter';
  const renterDamageCharge = damageResponsibility === 'renter' ? damageCharge : 0;
  const totalPreview = Number((preview.charge + driverFeePreview + lateChargePreview + renterDamageCharge).toFixed(2));
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div className="modal-title">Edit rental</div>
            <div className="modal-sub">Update rental period, driver, payment, and status</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
            <Icon d={icons.x} size={12} />
          </button>
        </div>
        {error ? (
          <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>
            {error}
          </div>
        ) : null}
        <div className="form-row">
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
            Pickup date and time
            <input name="pickup_datetime" type="datetime-local" value={form.pickup_datetime} onChange={onChange} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
            Return date and time
            <input name="return_datetime" type="datetime-local" value={form.return_datetime} onChange={onChange} />
          </label>
        </div>
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <div className="sec-title" style={{ fontSize: 13, marginBottom: 4 }}>Driver details</div>
              <div className="td-muted" style={{ fontSize: 11 }}>{driverKind(rental)}</div>
            </div>
            <span className={`badge ${rental?.hired_driver_id ? 'badge-purple' : 'badge-blue'}`}>
              {rental?.hired_driver_id ? 'Hired' : 'Self-drive'}
            </span>
          </div>

          {rental?.hired_driver_id ? (
            <>
              <div className="grid2" style={{ gap: 10 }}>
                <div>
                  <div className="td-muted" style={{ fontSize: 11 }}>Hired driver</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{rental.hired_driver_name || rental.driver_name || 'Assigned driver'}</div>
                </div>
                <div>
                  <div className="td-muted" style={{ fontSize: 11 }}>Phone</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{rental.hired_driver_phone || 'Not set'}</div>
                </div>
                <div>
                  <div className="td-muted" style={{ fontSize: 11 }}>Driver license</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{rental.hired_driver_license_number || rental.driver_license || 'Not set'}</div>
                </div>
                <div>
                  <div className="td-muted" style={{ fontSize: 11 }}>Rating</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {Number(rental.hired_driver_rating || 0).toFixed(1)} / 5
                    <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> ({Number(rental.hired_driver_review_count || 0)} reviews)</span>
                  </div>
                </div>
                <div>
                  <div className="td-muted" style={{ fontSize: 11 }}>Hourly rate</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatMoney(rental.hired_driver_hourly_rate)} / hr</div>
                </div>
                <div>
                  <div className="td-muted" style={{ fontSize: 11 }}>Driver fee</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{formatMoney(driverFeePreview || rental.driver_fee)}</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="td-muted" style={{ fontSize: 11 }}>Background</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45, marginTop: 4 }}>
                  {rental.hired_driver_background || 'No background note.'}
                </div>
                <div className="td-muted" style={{ fontSize: 11, marginTop: 6 }}>
                  {Number(rental.hired_driver_experience_years || 0)} years experience | Languages: {formatLanguages(rental.hired_driver_languages)}
                </div>
              </div>
            </>
          ) : (
            <div className="grid2" style={{ gap: 10 }}>
              <div>
                <div className="td-muted" style={{ fontSize: 11 }}>Actual driver</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{rental?.driver_name || 'Self-driver'}</div>
              </div>
              <div>
                <div className="td-muted" style={{ fontSize: 11 }}>Driver license</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{rental?.driver_license || 'Not set'}</div>
              </div>
            </div>
          )}
        </div>
        <div className="td-muted" style={{ fontSize: 11, marginTop: 12, marginBottom: 6 }}>
          Actual driver fields
        </div>
        <div className="form-row">
          <input name="driver_name" placeholder="Driver name" value={form.driver_name} onChange={onChange} />
          <input name="driver_license" placeholder="Driver license" value={form.driver_license} onChange={onChange} />
        </div>
        <div className="form-row">
          <select name="payment_method" value={form.payment_method} onChange={onChange}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}
          </select>
          <select name="status" value={form.status} onChange={onChange}>
            {EDIT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--amber)' }}>
            Damage description
            <textarea name="damage_description" placeholder="Describe any damage found at return" value={form.damage_description} onChange={onChange} style={{ minHeight: 74 }} />
          </label>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--amber)' }}>
            Damage charge
            <input name="damage_charge" type="number" min="0" step="0.01" value={form.damage_charge} onChange={onChange} />
          </label>
          <div style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="td-muted" style={{ fontSize: 11 }}>Damage responsibility</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: damageResponsibility === 'renter' ? 'var(--amber)' : 'var(--red)' }}>
              {damageResponsibility === 'renter' ? 'Renter charge' : 'Driver responsibility'}
            </div>
            <div className="td-muted" style={{ fontSize: 11, marginTop: 4 }}>
              {damageResponsibility === 'renter' ? 'Added to customer total.' : 'Recorded for driver, not customer total.'}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          <div className="sec-title" style={{ fontSize: 13, marginBottom: 8 }}>Auto charge preview</div>
          <div className="grid2" style={{ gap: 10 }}>
            <div>
              <div className="td-muted" style={{ fontSize: 11 }}>Daily rate</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{formatMoney(preview.dailyRate)}</div>
            </div>
            <div>
              <div className="td-muted" style={{ fontSize: 11 }}>Hourly rate</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{formatMoney(preview.hourlyRate)}</div>
            </div>
            <div>
              <div className="td-muted" style={{ fontSize: 11 }}>Billable hours</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{preview.valid ? `${preview.hours} hour${preview.hours === 1 ? '' : 's'}` : 'Set valid period'}</div>
            </div>
            <div>
              <div className="td-muted" style={{ fontSize: 11 }}>Auto charge</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{formatMoney(preview.charge)}</div>
            </div>
            <div>
              <div className="td-muted" style={{ fontSize: 11 }}>Driver fee</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: Number(driverFeePreview || rental?.driver_fee || 0) > 0 ? 'var(--green)' : 'var(--text)' }}>{formatMoney(driverFeePreview || rental?.driver_fee)}</div>
            </div>
            <div>
              <div className="td-muted" style={{ fontSize: 11 }}>Late return</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: lateChargePreview > 0 ? 'var(--amber)' : 'var(--text)' }}>
                {lateHours} hr | {formatMoney(lateChargePreview)}
              </div>
            </div>
            <div>
              <div className="td-muted" style={{ fontSize: 11 }}>Damage impact</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: damageCharge > 0 ? 'var(--amber)' : 'var(--text)' }}>
                {damageResponsibility === 'renter' ? formatMoney(damageCharge) : `${formatMoney(damageCharge)} driver`}
              </div>
            </div>
            <div>
              <div className="td-muted" style={{ fontSize: 11 }}>Estimated total</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{formatMoney(totalPreview || preview.charge)}</div>
            </div>
          </div>
          <div className="td-muted" style={{ fontSize: 11, marginTop: 8 }}>
            Final total is recalculated by the server from rental charge, hired-driver fee, late return charge, and renter-responsible damage.
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="td-muted" style={{ fontSize: 11, marginBottom: 6 }}>Current total price</div>
          <input value={formatMoney(totalPreview || preview.charge)} readOnly />
        </div>
        {rental?.returned_at ? (
          <div className="td-muted" style={{ fontSize: 11, marginTop: 8 }}>
            Returned at {formatDateTime(rental.returned_at)}
          </div>
        ) : null}
        <div className="modal-btns" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ rental, deleting, onCancel, onConfirm }) {
  if (!rental) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 440 }}>
        <div className="modal-title">Delete rental?</div>
        <div className="modal-sub" style={{ marginBottom: 18 }}>
          Rental #{rental.id} will be removed from the database.
        </div>
        <div className="modal-btns">
          <button className="btn btn-ghost" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

function DriverModal({ mode, driver, form, error, saving, onChange, onSubmit, onClose }) {
  const activeRentals = Array.isArray(driver?.active_rental_details) ? driver.active_rental_details : [];
  const damageRows = Array.isArray(driver?.driver_damage_details) ? driver.driver_damage_details : [];
  const driverTotalRevenue = Number(driver?.driver_total_revenue || 0);
  const driverDamageTotal = Number(driver?.driver_damage_total || 0);
  const driverNetRevenue = Number(driver?.driver_net_revenue ?? (driverTotalRevenue - driverDamageTotal));
  const availability = getDriverAvailability(driver);

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div className="modal-title">{mode === 'edit' ? 'Edit driver' : 'Add driver'}</div>
            <div className="modal-sub">Manage driver profile, hourly rate, and availability</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
            <Icon d={icons.x} size={12} />
          </button>
        </div>
        {error ? (
          <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>
            {error}
          </div>
        ) : null}
        <div className="form-row">
          <input name="name" placeholder="Driver name" value={form.name} onChange={onChange} />
          <input name="license_number" placeholder="License number" value={form.license_number} onChange={onChange} />
        </div>
        <div className="form-row">
          <input name="phone" placeholder="Phone" value={form.phone} onChange={onChange} />
          <input name="hourly_rate" type="number" min="0" step="0.01" placeholder="Hourly rate" value={form.hourly_rate} onChange={onChange} />
        </div>
        <div className="form-row">
          <select name="status" value={form.status} onChange={onChange}>
            <option value="available">Available</option>
            <option value="inactive">Inactive</option>
          </select>
          <input name="experience_years" type="number" min="0" step="1" placeholder="Experience years" value={form.experience_years} onChange={onChange} />
        </div>
        <input name="profile_photo" placeholder="Profile photo URL" value={form.profile_photo} onChange={onChange} />
        <textarea name="background" placeholder="Driver background" value={form.background} onChange={onChange} style={{ marginTop: 12, minHeight: 90 }} />
        <input name="languages" placeholder="Languages, comma separated" value={form.languages} onChange={onChange} style={{ marginTop: 12 }} />
        {mode === 'edit' ? (
          <>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="sec-title" style={{ fontSize: 13, marginBottom: 8 }}>Driver revenue</div>
            <div className="grid2" style={{ gap: 10, marginBottom: 0 }}>
              <div>
                <div className="td-muted" style={{ fontSize: 11 }}>Total revenue</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)' }}>{formatMoney(driverTotalRevenue)}</div>
              </div>
              <div>
                <div className="td-muted" style={{ fontSize: 11 }}>Damage fees</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: driverDamageTotal > 0 ? 'var(--red)' : 'var(--text)' }}>{formatMoney(driverDamageTotal)}</div>
              </div>
              <div>
                <div className="td-muted" style={{ fontSize: 11 }}>Net after damage</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: driverNetRevenue >= 0 ? 'var(--accent)' : 'var(--red)' }}>{formatMoney(driverNetRevenue)}</div>
              </div>
              <div>
                <div className="td-muted" style={{ fontSize: 11 }}>Damage records</div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{damageRows.length}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="sec-title" style={{ fontSize: 13, marginBottom: 8 }}>Driver damage fees</div>
            {damageRows.length ? (
              <div style={{ display: 'grid', gap: 8, maxHeight: 190, overflow: 'auto', paddingRight: 4 }}>
                {damageRows.map((damage) => (
                  <div key={damage.id} style={{ padding: 10, borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>Rental #{damage.id} | {damage.car_name || 'Rental car'}</div>
                        <div className="td-muted" style={{ fontSize: 11 }}>{damage.plate_number || 'No plate'} | {damage.customer_name || damage.customer_email || 'Unknown customer'}</div>
                      </div>
                      <span style={{ color: 'var(--red)', fontWeight: 800, fontSize: 13 }}>{formatMoney(damage.damage_charge)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45, marginTop: 8 }}>
                      {damage.damage_description || 'No damage description.'}
                    </div>
                    <div className="td-muted" style={{ fontSize: 11, marginTop: 6 }}>
                      Returned {damage.returned_at ? formatDateTime(damage.returned_at) : formatDateTime(damage.return_datetime)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="td-muted" style={{ fontSize: 12 }}>No driver-responsible damage fees recorded.</div>
            )}
          </div>

          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div className="sec-title" style={{ fontSize: 13, marginBottom: 4 }}>Active rentals</div>
                <div className="td-muted" style={{ fontSize: 11 }}>Pending and confirmed rentals assigned to this driver</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${availability.badgeClass}`}>{availability.badge}</span>
                <div style={{ fontSize: 11, color: availability.noteColor, marginTop: 4, fontWeight: 600 }}>{availability.note}</div>
              </div>
            </div>
            {activeRentals.length ? (
              <div style={{ display: 'grid', gap: 8, maxHeight: 210, overflow: 'auto', paddingRight: 4 }}>
                {activeRentals.map((rental) => (
                  <div key={rental.id} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>Rental #{rental.id} | {rental.car_name || 'Rental car'}</div>
                        <div className="td-muted" style={{ fontSize: 11 }}>{rental.plate_number || 'No plate'} | {rental.customer_name || rental.customer_email || 'Unknown customer'}</div>
                      </div>
                      <span className={`badge ${rental.status === 'confirmed' ? 'badge-green' : 'badge-amber'}`}>{displayStatus(rental.status)}</span>
                    </div>
                    <div className="grid2" style={{ gap: 8, marginTop: 8, marginBottom: 0 }}>
                      <div className="td-muted" style={{ fontSize: 11 }}>Pickup <span style={{ color: 'var(--text)' }}>{formatDateTime(rental.pickup_datetime)}</span></div>
                      <div className="td-muted" style={{ fontSize: 11 }}>Return <span style={{ color: 'var(--text)' }}>{formatDateTime(rental.return_datetime)}</span></div>
                      <div className="td-muted" style={{ fontSize: 11 }}>Customer <span style={{ color: 'var(--text)' }}>{rental.customer_phone || rental.customer_email || 'Not set'}</span></div>
                      <div className="td-muted" style={{ fontSize: 11 }}>Driver fee <span style={{ color: 'var(--green)' }}>{formatMoney(rental.driver_fee)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="td-muted" style={{ fontSize: 12 }}>No active rentals assigned to this driver.</div>
            )}
          </div>
          </>
        ) : null}
        <div className="modal-btns" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save driver'}</button>
        </div>
      </div>
    </div>
  );
}

function DriverDeleteModal({ driver, deleting, error, onCancel, onConfirm }) {
  if (!driver) return null;
  const hasHistory = Number(driver.total_rentals || 0) > 0 || Number(driver.reviews_count || 0) > 0 || Number(driver.reports_count || 0) > 0;
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 460 }}>
        <div className="modal-title">{hasHistory ? 'Deactivate driver?' : 'Delete driver?'}</div>
        <div className="modal-sub" style={{ marginBottom: 18 }}>
          {hasHistory
            ? `${driver.name} has rental or feedback history, so this will mark the driver inactive and notify affected pending/confirmed rentals.`
            : `${driver.name} has no rental history and will be removed from the database.`}
        </div>
        {error ? (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>
            {error}
          </div>
        ) : null}
        <div className="modal-btns">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={deleting}>{deleting ? 'Working...' : hasHistory ? 'Deactivate' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ driver, type, rows, loading, error, savingReplyId, replyDrafts, onDraft, onSaveReply, onClose }) {
  if (!driver || !type) return null;
  const isReport = type === 'report';
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div className="modal-title">{isReport ? 'Driver reports' : 'Driver comments'}</div>
            <div className="modal-sub">{driver.name} | {driver.license_number}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon d={icons.x} size={12} />
          </button>
        </div>
        {error ? <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{error}</div> : null}
        {loading ? <div className="sec-sub">Loading feedback...</div> : null}
        {!loading && !rows.length ? <div className="sec-sub">No {isReport ? 'reports' : 'comments'} found.</div> : null}
        <div style={{ display: 'grid', gap: 12, maxHeight: '65vh', overflow: 'auto', paddingRight: 4 }}>
          {rows.map((item) => (
            <div key={item.id} style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.user_name || item.user_email || 'Unknown customer'}</div>
                  <div className="td-muted" style={{ fontSize: 11 }}>
                    Rental #{item.car_rental_id || 'N/A'} | {item.car_name || 'Unknown car'} {item.plate_number ? `| ${item.plate_number}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {!isReport ? <div className="badge badge-green">{Number(item.rating || 0)} / 5</div> : <div className="badge badge-red">Report</div>}
                  <div className="td-muted" style={{ fontSize: 11, marginTop: 4 }}>{formatDateTime(item.created_at)}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{item.comment}</div>
              {item.admin_reply ? (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(34,197,94,0.08)', color: 'var(--text-2)', fontSize: 12 }}>
                  <strong style={{ color: 'var(--green)' }}>Admin reply:</strong> {item.admin_reply}
                  <div className="td-muted" style={{ fontSize: 10, marginTop: 4 }}>Replied {formatDateTime(item.admin_replied_at)}</div>
                </div>
              ) : null}
              <textarea
                placeholder="Write a public admin reply"
                value={replyDrafts[item.id] ?? item.admin_reply ?? ''}
                onChange={(event) => onDraft(item.id, event.target.value)}
                style={{ marginTop: 10, minHeight: 72 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-ghost btn-sm" disabled={savingReplyId === item.id} onClick={() => onSaveReply(item.id)}>
                  {savingReplyId === item.id ? 'Saving...' : item.admin_reply ? 'Update reply' : 'Save reply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Rentals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.has('section') ? normalizeSection(searchParams.get('section')) : getStoredSection();
  const [section, setSection] = useState(initialSection);
  const [rentals, setRentals] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingRental, setDeletingRental] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState('');
  const [driverQuery, setDriverQuery] = useState('');
  const [driverStatus, setDriverStatus] = useState('all');
  const [driverModalMode, setDriverModalMode] = useState('');
  const [driverForm, setDriverForm] = useState(EMPTY_DRIVER_FORM);
  const [editingDriver, setEditingDriver] = useState(null);
  const [driverFormError, setDriverFormError] = useState('');
  const [savingDriver, setSavingDriver] = useState(false);
  const [deletingDriver, setDeletingDriver] = useState(null);
  const [driverDeleteError, setDriverDeleteError] = useState('');
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [savingReplyId, setSavingReplyId] = useState(null);

  useEffect(() => {
    loadRentals();
  }, []);

  useEffect(() => {
    if (section === 'drivers') loadDrivers();
  }, [section]);

  function changeSection(nextSection) {
    const normalized = normalizeSection(nextSection);
    setSection(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RENTALS_SECTION_STORAGE_KEY, normalized);
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('section', normalized);
    setSearchParams(nextParams, { replace: true });
  }

  async function loadRentals(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      setPageError('');
      const data = await parseJsonResponse(await fetch('/api/admin/rentals'));
      setRentals(data.rentals || []);
    } catch (error) {
      setPageError(error.message || 'Unable to load rentals.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDrivers(showSpinner = true) {
    if (showSpinner) setDriversLoading(true);
    try {
      setDriversError('');
      const data = await parseJsonResponse(await fetch('/api/admin/rental-drivers'));
      setDrivers(data.drivers || []);
    } catch (error) {
      setDriversError(error.message || 'Unable to load drivers.');
    } finally {
      setDriversLoading(false);
    }
  }

  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const now = new Date();
    return rentals.filter((rental) => {
      const stage = rentalStage(rental, now);
      const matchesStatus = filter === 'all' || stage === filter;
      const haystack = [
        rental.id,
        rental.user_name,
        rental.email,
        rental.phone,
        rental.car_name,
        rental.driver_name,
        rental.driver_license,
        rental.hired_driver_name,
        rental.hired_driver_phone,
        rental.hired_driver_license_number,
        rental.damage_description,
        rental.damage_responsibility,
        rental.payment_method,
        rentalStage(rental)
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [filter, query, rentals]);

  const shownDrivers = useMemo(() => {
    const normalized = driverQuery.trim().toLowerCase();
    return drivers.filter((driver) => {
      const matchesStatus = driverStatus === 'all' || driver.status === driverStatus;
      const haystack = [
        driver.name,
        driver.license_number,
        driver.phone,
        driver.status,
        Array.isArray(driver.languages) ? driver.languages.join(' ') : driver.languages
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [driverQuery, driverStatus, drivers]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.observe-animate'));
    elements.forEach((el) => {
      if (!el.dataset.revealed) {
        el.dataset.revealed = 'true';
      }
    });
  }, [
    section,
    loading,
    driversLoading,
    rentals.length,
    drivers.length,
    shown.length,
    shownDrivers.length,
    filter,
    driverStatus,
    query,
    driverQuery
  ]);

  function openEdit(rental) {
    setEditing(rental);
    setForm({
      pickup_datetime: toDateTimeInput(rental.pickup_datetime || rental.pickup_date),
      return_datetime: toDateTimeInput(rental.return_datetime || rental.return_date),
      driver_name: rental.driver_name || '',
      driver_license: rental.driver_license || '',
      payment_method: rental.payment_method || 'aba',
      status: rental.status || 'pending',
      damage_description: rental.damage_description || '',
      damage_charge: Number(rental.damage_charge || 0).toFixed(2)
    });
    setFormError('');
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveRental() {
    if (!editing) return;
    setSaving(true);
    setFormError('');
    try {
      await parseJsonResponse(
        await fetch(`/api/admin/rentals/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        })
      );
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormError('');
      await loadRentals(false);
    } catch (error) {
      setFormError(error.message || 'Unable to save rental.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRental() {
    if (!deletingRental) return;
    setDeleting(true);
    setPageError('');
    try {
      await parseJsonResponse(await fetch(`/api/admin/rentals/${deletingRental.id}`, { method: 'DELETE' }));
      setDeletingRental(null);
      await loadRentals(false);
    } catch (error) {
      setPageError(error.message || 'Unable to delete rental.');
    } finally {
      setDeleting(false);
    }
  }

  function openAddDriver() {
    setDriverModalMode('add');
    setEditingDriver(null);
    setDriverForm(EMPTY_DRIVER_FORM);
    setDriverFormError('');
  }

  function openEditDriver(driver) {
    setDriverModalMode('edit');
    setEditingDriver(driver);
    setDriverForm({
      name: driver.name || '',
      license_number: driver.license_number || '',
      phone: driver.phone || '',
      hourly_rate: driver.hourly_rate ?? '',
      status: driver.status || 'available',
      profile_photo: driver.profile_photo || '',
      background: driver.background || '',
      experience_years: driver.experience_years ?? '0',
      languages: Array.isArray(driver.languages) ? driver.languages.join(', ') : driver.languages || ''
    });
    setDriverFormError('');
  }

  function closeDriverModal() {
    if (savingDriver) return;
    setDriverModalMode('');
    setEditingDriver(null);
    setDriverForm(EMPTY_DRIVER_FORM);
    setDriverFormError('');
  }

  function handleDriverChange(event) {
    const { name, value } = event.target;
    setDriverForm((current) => ({ ...current, [name]: value }));
  }

  async function saveDriver() {
    setSavingDriver(true);
    setDriverFormError('');
    try {
      const endpoint = driverModalMode === 'edit' ? `/api/admin/rental-drivers/${editingDriver.id}` : '/api/admin/rental-drivers';
      const method = driverModalMode === 'edit' ? 'PUT' : 'POST';
      await parseJsonResponse(await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(driverForm)
      }));
      setDriverModalMode('');
      setEditingDriver(null);
      setDriverForm(EMPTY_DRIVER_FORM);
      setDriverFormError('');
      await loadDrivers(false);
    } catch (error) {
      setDriverFormError(error.message || 'Unable to save driver.');
    } finally {
      setSavingDriver(false);
    }
  }

  async function deleteDriver() {
    if (!deletingDriver) return;
    setDeleting(true);
    setDriversError('');
    setDriverDeleteError('');
    try {
      await parseJsonResponse(await fetch(`/api/admin/rental-drivers/${deletingDriver.id}`, { method: 'DELETE' }));
      setDeletingDriver(null);
      await loadDrivers(false);
    } catch (error) {
      setDriverDeleteError(error.message || 'Unable to deactivate driver.');
    } finally {
      setDeleting(false);
    }
  }

  async function openFeedback(driver, type) {
    setFeedbackModal({ driver, type });
    setFeedbackRows([]);
    setReplyDrafts({});
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const data = await parseJsonResponse(await fetch(`/api/admin/rental-drivers/${driver.id}/feedback?type=${type}`));
      setFeedbackRows(data.feedback || []);
    } catch (error) {
      setFeedbackError(error.message || 'Unable to load feedback.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function saveFeedbackReply(feedbackId) {
    const reply = replyDrafts[feedbackId] ?? feedbackRows.find((item) => item.id === feedbackId)?.admin_reply ?? '';
    setSavingReplyId(feedbackId);
    setFeedbackError('');
    try {
      await parseJsonResponse(await fetch(`/api/admin/rental-driver-feedback/${feedbackId}/reply`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_reply: reply })
      }));
      if (feedbackModal) await openFeedback(feedbackModal.driver, feedbackModal.type);
    } catch (error) {
      setFeedbackError(error.message || 'Unable to save reply.');
    } finally {
      setSavingReplyId(null);
    }
  }

  const counts = STATUS_TABS.reduce((acc, status) => {
    if (status !== 'all') acc[status] = rentals.filter((rental) => rentalStage(rental) === status).length;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header observe-animate" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Rentals</div>
          <div className="page-sub">Approve requests, track car returns, and manage rental drivers</div>
        </div>
        {section === 'rentals' ? (
          <button className="btn btn-ghost btn-sm" onClick={() => exportCsv(shown)}>
            <Icon d={icons.download} size={13} /> Export CSV
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={openAddDriver}>
            <Icon d={icons.plus} size={13} /> Add driver
          </button>
        )}
      </div>

      <div className="pill-nav observe-animate" style={{ marginBottom: 18 }}>
        {[{ id: 'rentals', label: 'Rentals' }, { id: 'drivers', label: 'Drivers' }].map((item) => (
          <div key={item.id} className={`pill-tab ${section === item.id ? 'active' : ''}`} onClick={() => changeSection(item.id)}>
            {item.label}
          </div>
        ))}
      </div>

      {section === 'rentals' ? (
        <>
      <div className="metrics observe-animate" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {[
          { label: 'Pending approval', val: counts.pending || 0, color: 'var(--amber)' },
          { label: 'Currently active', val: counts.active || 0, color: 'var(--green)' },
          { label: 'Returned', val: counts.returned || 0, color: 'var(--purple)' }
        ].map((metric) => (
          <div key={metric.label} className="metric-card">
            <div className="metric-label">{metric.label}</div>
            <div className="metric-val" style={{ color: metric.color, fontSize: 28 }}>{metric.val}</div>
          </div>
        ))}
      </div>

      {pageError ? <div className="observe-animate" style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{pageError}</div> : null}

      <div className="pill-nav observe-animate" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_TABS.map((status) => (
            <div key={status} className={`pill-tab ${filter === status ? 'active' : ''}`} onClick={() => setFilter(status)}>
              {status === 'all' ? 'All' : displayStatus(status)}
            </div>
          ))}
        </div>
        <div className="input-wrap" style={{ minWidth: 240, width: '34%' }}>
          <span className="search-icon"><Icon d={icons.search} size={13} /></span>
          <input className="search-input" placeholder="Search user, car, driver, license" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>

      <div className="card observe-animate">
        {loading ? (
          <div className="sec-sub">Loading rentals...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Car</th>
                  <th>Period</th>
                  <th>Hourly rate</th>
                  <th>Rental hours</th>
                  <th>Auto charge</th>
                  <th>Driver</th>
                  <th>License</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((rental) => (
                  <tr key={rental.id}>
                    {(() => {
                      const stage = rentalStage(rental);
                      return (
                        <>
                    <td style={{ color: 'var(--accent)', fontSize: 12 }}>#{rental.id}</td>
                    <td style={{ fontWeight: 500 }}>{rental.user_name}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>{rental.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{rental.phone}</div>
                    </td>
                    <td>
                      <div className="td-muted">{rental.car_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{rental.car_type} • {rental.plate_number}</div>
                    </td>
                    <td className="td-muted">
                      <div>{formatDateTime(rental.pickup_datetime || rental.pickup_date)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>to {formatDateTime(rental.return_datetime || rental.return_date)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{rentalDays(rental)} day estimate</div>
                    </td>
                    <td className="td-muted">
                      {formatMoney(rental.hourly_rate)}
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatMoney(rental.daily_rate)} / day</div>
                    </td>
                    <td className="td-muted">{Number(rental.rental_hours || 0).toFixed(0)} hr</td>
                    <td style={{ color: 'var(--green)', fontWeight: 500 }}>
                      {formatMoney(rental.total_price || rental.hourly_charge)}
                      {Number(rental.driver_fee || 0) > 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          Driver {formatMoney(rental.driver_fee)}
                        </div>
                      ) : null}
                      {Number(rental.late_return_charge || 0) > 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--amber)' }}>
                          Late {Number(rental.late_return_hours || 0).toFixed(0)} hr | {formatMoney(rental.late_return_charge)}
                        </div>
                      ) : null}
                      {Number(rental.damage_charge || 0) > 0 ? (
                        <div style={{ fontSize: 11, color: rental.damage_responsibility === 'driver' ? 'var(--red)' : 'var(--amber)' }}>
                          Damage {formatMoney(rental.damage_charge)} {rental.damage_responsibility === 'driver' ? 'driver' : 'renter'}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{String(rental.payment_method || '').toUpperCase()}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{displayDriverName(rental)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{driverKind(rental)}</div>
                      {rental.hired_driver_id ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                          {Number(rental.hired_driver_rating || 0).toFixed(1)} rating | {formatMoney(rental.hired_driver_hourly_rate)} / hr
                        </div>
                      ) : null}
                    </td>
                    <td className="td-muted">
                      <div>{rental.driver_license}</div>
                      {rental.hired_driver_license_number && rental.hired_driver_license_number !== rental.driver_license ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Hired: {rental.hired_driver_license_number}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(stage)}`}>{displayStatus(stage)}</span>
                      {rental.returned_at ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                          Returned at {formatDateTime(rental.returned_at)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(rental)}><Icon d={icons.edit} size={12} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeletingRental(rental)}><Icon d={icons.trash} size={12} /></button>
                      </div>
                    </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
                {!shown.length && (
                  <tr><td colSpan={12} className="td-muted" style={{ padding: 18 }}>No rentals found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      ) : (
        <>
          {driversError ? <div className="observe-animate" style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{driversError}</div> : null}

          <div className="metrics observe-animate" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {[
              { label: 'Total drivers', val: drivers.length, color: 'var(--accent)' },
              { label: 'Available', val: drivers.filter((driver) => driver.status === 'available').length, color: 'var(--green)' },
              { label: 'Inactive', val: drivers.filter((driver) => driver.status === 'inactive').length, color: 'var(--red)' },
              { label: 'Open reports', val: drivers.reduce((sum, driver) => sum + Number(driver.reports_count || 0), 0), color: 'var(--amber)' }
            ].map((metric) => (
              <div key={metric.label} className="metric-card">
                <div className="metric-label">{metric.label}</div>
                <div className="metric-val" style={{ color: metric.color, fontSize: 28 }}>{metric.val}</div>
              </div>
            ))}
          </div>

          <div className="pill-nav observe-animate" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DRIVER_STATUS_TABS.map((status) => (
                <div key={status} className={`pill-tab ${driverStatus === status ? 'active' : ''}`} onClick={() => setDriverStatus(status)}>
                  {status === 'all' ? 'All' : status}
                </div>
              ))}
            </div>
            <div className="input-wrap" style={{ minWidth: 240, width: '34%' }}>
              <span className="search-icon"><Icon d={icons.search} size={13} /></span>
              <input className="search-input" placeholder="Search driver, phone, license, language" value={driverQuery} onChange={(event) => setDriverQuery(event.target.value)} />
            </div>
          </div>

          <div className="card observe-animate">
            {driversLoading ? (
              <div className="sec-sub">Loading drivers...</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>License</th>
                      <th>Phone</th>
                      <th>Rating</th>
                      <th>Hourly rate</th>
                      <th>Status</th>
                      <th>Active rentals</th>
                      <th>Feedback</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownDrivers.map((driver) => {
                      const availability = getDriverAvailability(driver);
                      const driverHasHistory = Number(driver.total_rentals || 0) > 0 || Number(driver.reviews_count || 0) > 0 || Number(driver.reports_count || 0) > 0;
                      return (
                        <tr key={driver.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{driver.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {Number(driver.experience_years || 0)} years | {formatLanguages(driver.languages)}
                            </div>
                          </td>
                          <td className="td-muted">{driver.license_number}</td>
                          <td className="td-muted">{driver.phone || 'Not set'}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{Number(driver.rating || 0).toFixed(1)} / 5</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{Number(driver.review_count || 0)} rated reviews</div>
                          </td>
                          <td style={{ color: 'var(--green)', fontWeight: 600 }}>{formatMoney(driver.hourly_rate)} / hr</td>
                          <td>
                            <span className={`badge ${availability.badgeClass}`}>{availability.badge}</span>
                            <div style={{ fontSize: 11, color: availability.noteColor, marginTop: 4, fontWeight: 600 }}>{availability.note}</div>
                            {availability.rental ? (
                              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>
                                Next: #{availability.rental.id} at {formatDateTime(availability.rental.pickup_datetime)}
                              </div>
                            ) : null}
                          </td>
                          <td className="td-muted">
                            {Number(driver.active_rentals || 0)}
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{Number(driver.total_rentals || 0)} total</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => openFeedback(driver, 'review')}>
                                Comments ({Number(driver.reviews_count || 0)})
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ color: Number(driver.reports_count || 0) ? 'var(--red)' : undefined }} onClick={() => openFeedback(driver, 'report')}>
                                Reports ({Number(driver.reports_count || 0)})
                              </button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditDriver(driver)}>
                                <Icon d={icons.edit} size={12} /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  setDriverDeleteError('');
                                  setDeletingDriver(driver);
                                }}
                              >
                                <Icon d={icons.trash} size={12} /> {driverHasHistory ? 'Deactivate' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!shownDrivers.length && (
                      <tr><td colSpan={9} className="td-muted" style={{ padding: 18 }}>No drivers found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {editing ? (
        <RentalModal rental={editing} form={form} error={formError} saving={saving} onChange={handleChange} onSubmit={saveRental} onClose={closeEdit} />
      ) : null}
      <DeleteModal rental={deletingRental} deleting={deleting} onCancel={() => setDeletingRental(null)} onConfirm={deleteRental} />
      {driverModalMode ? (
        <DriverModal mode={driverModalMode} driver={editingDriver} form={driverForm} error={driverFormError} saving={savingDriver} onChange={handleDriverChange} onSubmit={saveDriver} onClose={closeDriverModal} />
      ) : null}
      <DriverDeleteModal
        driver={deletingDriver}
        deleting={deleting}
        error={driverDeleteError}
        onCancel={() => {
          if (deleting) return;
          setDeletingDriver(null);
          setDriverDeleteError('');
        }}
        onConfirm={deleteDriver}
      />
      <FeedbackModal
        driver={feedbackModal?.driver}
        type={feedbackModal?.type}
        rows={feedbackRows}
        loading={feedbackLoading}
        error={feedbackError}
        savingReplyId={savingReplyId}
        replyDrafts={replyDrafts}
        onDraft={(id, value) => setReplyDrafts((current) => ({ ...current, [id]: value }))}
        onSaveReply={saveFeedbackReply}
        onClose={() => {
          setFeedbackModal(null);
          setFeedbackRows([]);
          setFeedbackError('');
          setReplyDrafts({});
        }}
      />
    </div>
  );
}
