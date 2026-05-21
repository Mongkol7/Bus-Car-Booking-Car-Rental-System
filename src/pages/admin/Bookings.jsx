import { useEffect, useMemo, useState } from 'react';
import { Icon, icons, getCompanyMeta } from '../../utils/sharedAdmin';

const STATUS_TABS = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_METHODS = ['aba', 'khqr', 'cash'];
const EMPTY_FORM = {
  seat_number: '',
  total_price: '',
  payment_method: 'aba',
  status: 'pending'
};

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

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
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function statusBadge(status) {
  if (status === 'confirmed' || status === 'completed') return 'badge-green';
  if (status === 'pending') return 'badge-amber';
  return 'badge-red';
}

function exportCsv(rows) {
  const headers = ['ID', 'User', 'Email', 'Phone', 'Route', 'Departure', 'Arrival', 'Seat', 'Booked At', 'Paid', 'Payment', 'Status'];
  const body = rows.map((booking) => [
    booking.id,
    booking.user_name,
    booking.email,
    booking.phone,
    `${booking.origin} -> ${booking.destination}`,
    formatDateTime(booking.departure_time),
    formatDateTime(booking.arrival_time),
    booking.seat_number,
    formatDateTime(booking.created_at),
    Number(booking.total_price || 0).toFixed(2),
    booking.payment_method,
    booking.status
  ]);
  const csv = [headers, ...body]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'admin-bookings.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function BookingModal({ form, error, saving, onChange, onSubmit, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div className="modal-title">Edit booking</div>
            <div className="modal-sub">Update seat, payment, and status</div>
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
          <input name="seat_number" placeholder="Seat number" value={form.seat_number} onChange={onChange} />
          <input name="total_price" type="number" min="0" step="0.01" placeholder="Total price" value={form.total_price} onChange={onChange} />
        </div>
        <div className="form-row">
          <select name="payment_method" value={form.payment_method} onChange={onChange}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}
          </select>
          <select name="status" value={form.status} onChange={onChange}>
            {STATUS_TABS.filter((status) => status !== 'all').map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="modal-btns" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ booking, deleting, onCancel, onConfirm }) {
  if (!booking) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 440 }}>
        <div className="modal-title">Delete booking?</div>
        <div className="modal-sub" style={{ marginBottom: 18 }}>
          Booking #{booking.id} will be removed from the database.
        </div>
        <div className="modal-btns">
          <button className="btn btn-ghost" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingBooking, setDeletingBooking] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      setPageError('');
      const data = await parseJsonResponse(await fetch('/api/admin/bookings'));
      setBookings(data.bookings || []);
    } catch (error) {
      setPageError(error.message || 'Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  }

  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesStatus = filter === 'all' || booking.status === filter;
      const matchesDate = dateFilter === 'all' || getDateKey(booking.departure_time) === dateFilter;
      const haystack = [
        booking.id,
        booking.user_name,
        booking.email,
        booking.phone,
        booking.origin,
        booking.destination,
        formatDateTime(booking.departure_time),
        formatDateTime(booking.arrival_time),
        booking.seat_number,
        booking.company_name,
        booking.bus_name,
        booking.bus_type,
        booking.payment_method
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && matchesDate && (!normalized || haystack.includes(normalized));
    });
  }, [bookings, dateFilter, filter, query]);

  const dateOptions = useMemo(() => {
    const dateCounts = new Map();
    bookings.forEach((booking) => {
      const key = getDateKey(booking.departure_time);
      if (!key) return;
      if (!dateCounts.has(key)) {
        dateCounts.set(key, {
          key,
          label: formatDateLabel(booking.departure_time),
          count: 0
        });
      }
      dateCounts.get(key).count += 1;
    });
    return Array.from(dateCounts.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [bookings]);

  function openEdit(booking) {
    setEditing(booking);
    setForm({
      seat_number: booking.seat_number || '',
      total_price: String(booking.total_price || ''),
      payment_method: booking.payment_method || 'aba',
      status: booking.status || 'pending'
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

  async function saveBooking() {
    if (!editing) return;
    setSaving(true);
    setFormError('');
    try {
      await parseJsonResponse(
        await fetch(`/api/admin/bookings/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        })
      );
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormError('');
      await loadBookings(false);
    } catch (error) {
      setFormError(error.message || 'Unable to save booking.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteBooking() {
    if (!deletingBooking) return;
    setDeleting(true);
    setPageError('');
    try {
      await parseJsonResponse(await fetch(`/api/admin/bookings/${deletingBooking.id}`, { method: 'DELETE' }));
      setDeletingBooking(null);
      await loadBookings(false);
    } catch (error) {
      setPageError(error.message || 'Unable to delete booking.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="page-header observe-animate" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Bookings</div>
          <div className="page-sub">View and manage all seat bookings</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => exportCsv(shown)}>
          <Icon d={icons.download} size={13} /> Export CSV
        </button>
      </div>

      {pageError ? <div className="observe-animate" style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{pageError}</div> : null}

      <div className="pill-nav observe-animate" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_TABS.map((status) => (
            <div key={status} className={`pill-tab ${filter === status ? 'active' : ''}`} onClick={() => setFilter(status)}>
              {status === 'all' ? 'All' : status}
            </div>
          ))}
        </div>
        <div className="input-wrap" style={{ minWidth: 240, width: '34%' }}>
          <span className="search-icon"><Icon d={icons.search} size={13} /></span>
          <input className="search-input" placeholder="Search user, route, booking ID" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>

      <div className="pill-nav observe-animate" style={{ width: '100%', flexWrap: 'wrap', marginTop: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="td-muted" style={{ fontSize: 12, marginRight: 2 }}>Schedule date</span>
          <div className={`pill-tab ${dateFilter === 'all' ? 'active' : ''}`} onClick={() => setDateFilter('all')}>
            All dates
          </div>
          {dateOptions.map((option) => (
            <div key={option.key} className={`pill-tab ${dateFilter === option.key ? 'active' : ''}`} onClick={() => setDateFilter(option.key)}>
              {option.label}
              <span style={{ marginLeft: 6, opacity: 0.72 }}>{option.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card observe-animate">
        {loading ? (
          <div className="sec-sub">Loading bookings...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Route</th>
                  <th>Schedule</th>
                  <th>Seat</th>
                  <th>Booked</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((booking) => {
                  const companyColor = booking.color || getCompanyMeta(booking.company_name).color;
                  return (
                    <tr key={booking.id}>
                      <td style={{ color: 'var(--accent)', fontSize: 12 }}>#{booking.id}</td>
                      <td style={{ fontWeight: 500 }}>{booking.user_name}</td>
                      <td>
                        <div style={{ fontSize: 12 }}>{booking.email}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{booking.phone}</div>
                      </td>
                      <td>
                        <div className="td-muted">{booking.origin} to {booking.destination}</div>
                        <div style={{ fontSize: 11, color: companyColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: companyColor }} />
                          {booking.company_name || booking.bus_name}
                        </div>
                      </td>
                      <td>
                        <div className="td-muted">
                          Depart: {formatDateTime(booking.departure_time)}
                        </div>
                        <div className="td-muted" style={{ fontSize: 11 }}>
                          Arrive: {formatDateTime(booking.arrival_time)}
                        </div>
                      </td>
                      <td className="td-muted">{booking.seat_number}</td>
                      <td className="td-muted">{formatDateTime(booking.created_at)}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 500 }}>
                        {formatMoney(booking.total_price)}
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{String(booking.payment_method || '').toUpperCase()}</div>
                      </td>
                      <td><span className={`badge ${statusBadge(booking.status)}`}>{booking.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(booking)}><Icon d={icons.edit} size={12} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeletingBooking(booking)}><Icon d={icons.trash} size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr><td colSpan={10} className="td-muted" style={{ padding: 18 }}>No bookings found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing ? (
        <BookingModal form={form} error={formError} saving={saving} onChange={handleChange} onSubmit={saveBooking} onClose={closeEdit} />
      ) : null}
      <DeleteModal booking={deletingBooking} deleting={deleting} onCancel={() => setDeletingBooking(null)} onConfirm={deleteBooking} />
    </div>
  );
}
