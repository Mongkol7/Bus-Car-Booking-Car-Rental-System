import { useEffect, useMemo, useState } from 'react';
import { Icon, icons } from '../../utils/sharedAdmin';

const STATUS_TABS = ['all', 'pending', 'confirmed', 'completed', 'cancelled', 'returned'];
const PAYMENT_METHODS = ['aba', 'khqr', 'cash'];
const EMPTY_FORM = {
  pickup_date: '',
  return_date: '',
  driver_name: '',
  driver_license: '',
  total_price: '',
  payment_method: 'aba',
  status: 'pending'
};

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function statusBadge(status) {
  if (status === 'confirmed' || status === 'completed' || status === 'returned') return 'badge-green';
  if (status === 'pending') return 'badge-amber';
  return 'badge-red';
}

function displayStatus(status) {
  return status === 'confirmed' ? 'active' : status;
}

function rentalDays(rental) {
  const start = new Date(rental.pickup_date);
  const end = new Date(rental.return_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

function exportCsv(rows) {
  const headers = ['ID', 'User', 'Email', 'Phone', 'Car', 'Pickup', 'Return', 'Driver', 'License', 'Total', 'Payment', 'Status'];
  const body = rows.map((rental) => [
    rental.id,
    rental.user_name,
    rental.email,
    rental.phone,
    rental.car_name,
    formatDate(rental.pickup_date),
    formatDate(rental.return_date),
    rental.driver_name,
    rental.driver_license,
    Number(rental.total_price || 0).toFixed(2),
    rental.payment_method,
    rental.status
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

function RentalModal({ form, error, saving, onChange, onSubmit, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div className="modal-title">Edit rental</div>
            <div className="modal-sub">Update dates, driver, payment, and status</div>
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
          <input name="pickup_date" type="date" value={form.pickup_date} onChange={onChange} />
          <input name="return_date" type="date" value={form.return_date} onChange={onChange} />
        </div>
        <div className="form-row">
          <input name="driver_name" placeholder="Driver name" value={form.driver_name} onChange={onChange} />
          <input name="driver_license" placeholder="Driver license" value={form.driver_license} onChange={onChange} />
        </div>
        <div className="form-row">
          <input name="total_price" type="number" min="0" step="0.01" placeholder="Total price" value={form.total_price} onChange={onChange} />
          <select name="payment_method" value={form.payment_method} onChange={onChange}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}
          </select>
        </div>
        <select name="status" value={form.status} onChange={onChange}>
          {STATUS_TABS.filter((status) => status !== 'all').map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}
        </select>
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

export default function Rentals() {
  const [rentals, setRentals] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingRental, setDeletingRental] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRentals();
  }, []);

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

  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rentals.filter((rental) => {
      const matchesStatus = filter === 'all' || rental.status === filter;
      const haystack = [
        rental.id,
        rental.user_name,
        rental.email,
        rental.phone,
        rental.car_name,
        rental.driver_name,
        rental.driver_license,
        rental.payment_method
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [filter, query, rentals]);

  function openEdit(rental) {
    setEditing(rental);
    setForm({
      pickup_date: toDateInput(rental.pickup_date),
      return_date: toDateInput(rental.return_date),
      driver_name: rental.driver_name || '',
      driver_license: rental.driver_license || '',
      total_price: String(rental.total_price || ''),
      payment_method: rental.payment_method || 'aba',
      status: rental.status || 'pending'
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

  const counts = STATUS_TABS.reduce((acc, status) => {
    if (status !== 'all') acc[status] = rentals.filter((rental) => rental.status === status).length;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header observe-animate" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Rentals</div>
          <div className="page-sub">Approve requests and track car returns</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => exportCsv(shown)}>
          <Icon d={icons.download} size={13} /> Export CSV
        </button>
      </div>

      <div className="metrics observe-animate" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {[
          { label: 'Pending approval', val: counts.pending || 0, color: 'var(--amber)' },
          { label: 'Currently active', val: counts.confirmed || 0, color: 'var(--green)' },
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
          <input className="search-input" placeholder="Search user, car, license" value={query} onChange={(event) => setQuery(event.target.value)} />
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
                  <th>License</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((rental) => (
                  <tr key={rental.id}>
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
                      {formatDate(rental.pickup_date)} to {formatDate(rental.return_date)}
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{rentalDays(rental)} days</div>
                    </td>
                    <td className="td-muted">{rental.driver_license}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 500 }}>
                      {formatMoney(rental.total_price)}
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{String(rental.payment_method || '').toUpperCase()}</div>
                    </td>
                    <td><span className={`badge ${statusBadge(rental.status)}`}>{displayStatus(rental.status)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(rental)}><Icon d={icons.edit} size={12} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeletingRental(rental)}><Icon d={icons.trash} size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr><td colSpan={9} className="td-muted" style={{ padding: 18 }}>No rentals found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing ? (
        <RentalModal form={form} error={formError} saving={saving} onChange={handleChange} onSubmit={saveRental} onClose={closeEdit} />
      ) : null}
      <DeleteModal rental={deletingRental} deleting={deleting} onCancel={() => setDeletingRental(null)} onConfirm={deleteRental} />
    </div>
  );
}
