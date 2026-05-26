import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon, icons, getCompanyMeta } from '../../utils/sharedAdmin';

const STATUS_TABS = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_METHODS = ['aba', 'khqr', 'cash'];
const PACKAGE_ALLOWANCE_KG = 20;
const OVERWEIGHT_RATE = 0.5;
const BOOKING_FILTER_STORAGE_KEY = 'admin.bookings.filters';
const BOOKING_FILTER_QUERY_KEYS = ['status', 'date', 'company', 'q', 'sort', 'dir'];
const SORT_OPTIONS = [
  { value: 'id', label: 'ID' },
  { value: 'departure_time', label: 'Departure time' },
  { value: 'destination', label: 'Destination' }
];
const EMPTY_FORM = {
  seat_number: '',
  total_price: '',
  base_booking_price: '',
  package_weight_kg: '',
  overweight_charge: '',
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

function getScheduleParts(value) {
  if (!value) return { date: 'Not set', time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: 'Not set', time: '' };
  return {
    date: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  };
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

function calculatePackageSummary(form) {
  const parsedBasePrice = Number(form.base_booking_price || 0);
  const parsedPackageWeight = Number(form.package_weight_kg || 0);
  const basePrice = Number.isFinite(parsedBasePrice) ? parsedBasePrice : 0;
  const packageWeight = Number.isFinite(parsedPackageWeight) ? Math.max(parsedPackageWeight, 0) : 0;
  const overweightKg = Math.max(packageWeight - PACKAGE_ALLOWANCE_KG, 0);
  const overweightCharge = overweightKg * OVERWEIGHT_RATE;
  return {
    basePrice,
    packageWeight,
    overweightKg,
    overweightCharge,
    finalPrice: basePrice + overweightCharge
  };
}

function isDateFilterValue(value) {
  return value === 'all' || value === 'today' || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeBookingFilterState(value = {}) {
  const sortValues = SORT_OPTIONS.map((option) => option.value);
  return {
    filter: STATUS_TABS.includes(value.filter) ? value.filter : 'all',
    dateFilter: isDateFilterValue(value.dateFilter) ? value.dateFilter : 'all',
    companyFilter: value.companyFilter ? String(value.companyFilter) : 'all',
    query: String(value.query || ''),
    sortBy: sortValues.includes(value.sortBy) ? value.sortBy : 'id',
    sortDirection: value.sortDirection === 'asc' || value.sortDirection === 'desc' ? value.sortDirection : 'desc'
  };
}

function hasBookingFilterQuery(searchParams) {
  return BOOKING_FILTER_QUERY_KEYS.some((key) => searchParams.has(key));
}

function readStoredBookingFilters() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BOOKING_FILTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getBookingFiltersFromSearch(searchParams) {
  return normalizeBookingFilterState({
    filter: searchParams.get('status') || 'all',
    dateFilter: searchParams.get('date') || 'all',
    companyFilter: searchParams.get('company') || 'all',
    query: searchParams.get('q') || '',
    sortBy: searchParams.get('sort') || 'id',
    sortDirection: searchParams.get('dir') || 'desc'
  });
}

function getInitialBookingFilters(searchParams) {
  if (hasBookingFilterQuery(searchParams)) return getBookingFiltersFromSearch(searchParams);
  return normalizeBookingFilterState(readStoredBookingFilters() || {});
}

function buildBookingFilterSearch(state) {
  const params = new URLSearchParams();
  params.set('status', state.filter);
  params.set('date', state.dateFilter);
  params.set('company', state.companyFilter);
  params.set('sort', state.sortBy);
  params.set('dir', state.sortDirection);
  if (state.query.trim()) params.set('q', state.query.trim());
  return params;
}

function exportCsv(rows) {
  const headers = ['ID', 'User', 'Email', 'Phone', 'Route', 'Departure', 'Arrival', 'Seat', 'Package Weight', 'Overweight Charge', 'Booked At', 'Paid', 'Payment', 'Status'];
  const body = rows.map((booking) => [
    booking.id,
    booking.user_name,
    booking.email,
    booking.phone,
    `${booking.origin} -> ${booking.destination}`,
    formatDateTime(booking.departure_time),
    formatDateTime(booking.arrival_time),
    booking.seat_number,
    Number(booking.package_weight_kg || 0).toFixed(2),
    Number(booking.overweight_charge || 0).toFixed(2),
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
  const packageSummary = calculatePackageSummary(form);
  const packageLocked = form.status === 'cancelled';

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
          <input name="total_price" type="number" min="0" step="0.01" placeholder="Total price" value={packageSummary.finalPrice.toFixed(2)} readOnly />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--amber)', marginBottom: 6 }}>Package weight (kg)</label>
          <input
            name="package_weight_kg"
            type="number"
            min="0"
            step="0.01"
            placeholder="Passenger package weight"
            value={form.package_weight_kg}
            onChange={onChange}
            disabled={packageLocked}
            style={{
              color: packageLocked ? 'var(--text-3)' : 'var(--amber)',
              borderColor: packageLocked ? 'var(--glass-border)' : 'rgba(251,191,36,0.35)',
              opacity: packageLocked ? 0.72 : 1
            }}
          />
          <div className="td-muted" style={{ fontSize: 11, marginTop: 6 }}>
            {packageLocked ? 'Cancelled bookings cannot edit overweight package charge.' : 'Allowance 20kg. Overweight charge $0.50/kg.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--glass)', border: '0.5px solid var(--glass-border)' }}>
              <div className="td-muted" style={{ fontSize: 11 }}>Overweight</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{packageSummary.overweightKg.toFixed(2)} kg</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--glass)', border: '0.5px solid var(--glass-border)' }}>
              <div className="td-muted" style={{ fontSize: 11 }}>Charge</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{formatMoney(packageSummary.overweightCharge)}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--glass)', border: '0.5px solid var(--glass-border)' }}>
              <div className="td-muted" style={{ fontSize: 11 }}>Final price</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{formatMoney(packageSummary.finalPrice)}</div>
            </div>
          </div>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = useMemo(() => getInitialBookingFilters(searchParams), []);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState(initialFilters.filter);
  const [dateFilter, setDateFilter] = useState(initialFilters.dateFilter);
  const [companyFilter, setCompanyFilter] = useState(initialFilters.companyFilter);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);
  const [sortDirection, setSortDirection] = useState(initialFilters.sortDirection);
  const [query, setQuery] = useState(initialFilters.query);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  useEffect(() => {
    const nextState = normalizeBookingFilterState({
      filter,
      dateFilter,
      companyFilter,
      query,
      sortBy,
      sortDirection
    });

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(BOOKING_FILTER_STORAGE_KEY, JSON.stringify(nextState));
      } catch {
        // Ignore storage failures; URL params still preserve the current view.
      }
    }

    const nextParams = buildBookingFilterSearch(nextState);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [companyFilter, dateFilter, filter, query, searchParams, setSearchParams, sortBy, sortDirection]);

  async function loadBookings(showSpinner = true) {
    if (showSpinner) setLoading(true);
    if (!showSpinner) setRefreshing(true);
    try {
      setPageError('');
      const data = await parseJsonResponse(await fetch('/api/admin/bookings'));
      setBookings(data.bookings || []);
    } catch (error) {
      setPageError(error.message || 'Unable to load bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const todayKey = getDateKey(new Date());
    const filtered = bookings.filter((booking) => {
      const matchesStatus = filter === 'all' || booking.status === filter;
      const bookingDateKey = getDateKey(booking.departure_time);
      const matchesDate = dateFilter === 'all'
        || (dateFilter === 'today' && bookingDateKey === todayKey)
        || bookingDateKey === dateFilter;
      const matchesCompany = companyFilter === 'all'
        || String(booking.company_id || 'none') === companyFilter;
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
      return matchesStatus && matchesDate && matchesCompany && (!normalized || haystack.includes(normalized));
    });

    return [...filtered].sort((a, b) => {
      let compare = 0;
      if (sortBy === 'id') {
        compare = Number(a.id || 0) - Number(b.id || 0);
      } else if (sortBy === 'departure_time') {
        compare = new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime();
      } else if (sortBy === 'destination') {
        compare = String(a.destination || '').localeCompare(String(b.destination || ''), undefined, { sensitivity: 'base' });
      }
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [bookings, companyFilter, dateFilter, filter, query, sortBy, sortDirection]);

  const companyOptions = useMemo(() => {
    const options = new Map();
    bookings.forEach((booking) => {
      const key = String(booking.company_id || 'none');
      if (!options.has(key)) {
        options.set(key, {
          value: key,
          label: booking.company_name || 'No company'
        });
      }
    });
    return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [bookings]);

  useEffect(() => {
    if (loading || companyFilter === 'all') return;
    if (!companyOptions.some((company) => company.value === companyFilter)) {
      setCompanyFilter('all');
    }
  }, [companyFilter, companyOptions, loading]);

  const customDateLabel = dateFilter !== 'all' && dateFilter !== 'today' ? formatDateLabel(dateFilter) : '';

  function openEdit(booking) {
    const overweightCharge = Number(booking.overweight_charge || 0);
    const baseBookingPrice = Math.max(Number(booking.total_price || 0) - overweightCharge, 0);
    setEditing(booking);
    setForm({
      seat_number: booking.seat_number || '',
      total_price: String(booking.total_price || ''),
      base_booking_price: baseBookingPrice.toFixed(2),
      package_weight_kg: String(booking.package_weight_kg || ''),
      overweight_charge: overweightCharge.toFixed(2),
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => loadBookings(false)} disabled={refreshing}>
            <Icon d={icons.clock} size={13} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCsv(shown)}>
            <Icon d={icons.download} size={13} /> Export CSV
          </button>
        </div>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          <span className="td-muted" style={{ fontSize: 12, marginRight: 2 }}>Schedule date</span>
          <div className={`pill-tab ${dateFilter === 'all' ? 'active' : ''}`} onClick={() => setDateFilter('all')}>
            All
          </div>
          <div className={`pill-tab ${dateFilter === 'today' ? 'active' : ''}`} onClick={() => setDateFilter('today')}>
            Today
          </div>
          <input
            type="date"
            aria-label="Select schedule date"
            value={dateFilter !== 'all' && dateFilter !== 'today' ? dateFilter : ''}
            onChange={(event) => setDateFilter(event.target.value || 'all')}
            style={{ width: 150, fontSize: 12 }}
          />
          {customDateLabel ? (
            <span className="td-muted" style={{ fontSize: 12 }}>{customDateLabel}</span>
          ) : null}
          <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} style={{ width: 170, fontSize: 12, marginLeft: 'auto' }}>
            <option value="all">All companies</option>
            {companyOptions.map((company) => (
              <option key={company.value} value={company.value}>{company.label}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={{ width: 160, fontSize: 12 }}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>Sort by {option.label}</option>
            ))}
          </select>
          <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)} style={{ width: 110, fontSize: 12 }}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
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
                  <th>Overweight</th>
                  <th>Booked</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((booking) => {
                  const companyColor = booking.color || getCompanyMeta(booking.company_name).color;
                  const departure = getScheduleParts(booking.departure_time);
                  const arrival = getScheduleParts(booking.arrival_time);
                  const packageWeight = Number(booking.package_weight_kg || 0);
                  const overweightCharge = Number(booking.overweight_charge || 0);
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
                        <div style={{ color: 'var(--accent)', fontWeight: 500 }}>
                          Depart: {departure.date}
                          {departure.time ? <span style={{ color: 'var(--amber)' }}>, {departure.time}</span> : null}
                        </div>
                        <div className="td-muted" style={{ fontSize: 11 }}>
                          Arrive: {arrival.date}{arrival.time ? `, ${arrival.time}` : ''}
                        </div>
                      </td>
                      <td className="td-muted">{booking.seat_number}</td>
                      <td>
                        <div className="td-muted">{packageWeight.toFixed(2)} kg</div>
                        <div style={{ fontSize: 11, color: overweightCharge > 0 ? 'var(--amber)' : 'var(--text-3)', fontWeight: overweightCharge > 0 ? 600 : 400 }}>
                          {formatMoney(overweightCharge)}
                        </div>
                      </td>
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
                  <tr><td colSpan={11} className="td-muted" style={{ padding: 18 }}>No bookings found.</td></tr>
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
