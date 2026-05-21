import React, { useEffect, useMemo, useState } from 'react';
import { Icon, icons, getCompanyMeta } from '../../utils/sharedAdmin';

const EMPTY_FORM = {
  bus_id: '',
  origin: '',
  destination: '',
  departure_time: '',
  arrival_time: '',
  price: '',
  availability_status: 'available',
  maintenance_start: '',
  maintenance_end: ''
};

const EMPTY_TEMPLATE_FORM = {
  bus_id: '',
  origin: '',
  destination: '',
  departure_time: '08:00',
  arrival_time: '10:00',
  price: '',
  is_active: true
};

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getLocalDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateTimeForDay(dayKey, hours, minutes = 0) {
  return `${dayKey}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDayLabel(dayKey, isToday) {
  const date = new Date(`${dayKey}T00:00:00`);
  return isToday ? `Today (${date.getDate()})` : String(date.getDate());
}

function formatDayMeta(dayKey) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString([], {
    weekday: 'short',
    month: 'short'
  });
}

function formatSelectedDate(dayKey) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

function getTripLabel(count) {
  return `${count} trip${count === 1 ? '' : 's'}`;
}

function getDayStatus(count) {
  if (count >= 3) return 'green';
  if (count >= 1) return 'yellow';
  return 'red';
}

function getDayStatusStyles(status, active) {
  const palette = {
    red: {
      background: 'var(--red-soft)',
      color: 'var(--red)',
      border: 'rgba(248,113,113,0.35)'
    },
    yellow: {
      background: 'var(--amber-soft)',
      color: 'var(--amber)',
      border: 'rgba(245,158,11,0.35)'
    },
    green: {
      background: 'var(--green-soft)',
      color: 'var(--green)',
      border: 'rgba(34,197,94,0.35)'
    }
  };

  const chosen = palette[status] || palette.red;
  return {
    background: chosen.background,
    color: chosen.color,
    border: `1px solid ${chosen.border}`,
    boxShadow: active ? `0 0 0 1px ${chosen.color} inset` : 'none'
  };
}

function formatDateTime(value) {
  if (!value) return '--';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatDuration(start, end) {
  const departure = new Date(start);
  const arrival = new Date(end);
  const diffMinutes = Math.max(0, Math.round((arrival - departure) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatMoney(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return '--';
  return `$${amount.toFixed(2)}`;
}

function normalizePassengers(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.code = data.code;
    error.routes = data.routes || data.affected_routes || [];
    error.preview = data.preview;
    throw error;
  }
  return data;
}

function formatTimeInput(value) {
  return String(value || '').slice(0, 5);
}

function RouteFormModal({
  form,
  formError,
  onChange,
  onPreviewMaintenance,
  onClose,
  onSubmit,
  buses,
  cityOptions,
  saving,
  editing,
  editingRoute
}) {
  const selectedBus = buses.find(bus => String(bus.id) === String(form.bus_id));
  const company = selectedBus?.company_name || 'No company';
  const duration = form.departure_time && form.arrival_time
    ? formatDuration(form.departure_time, form.arrival_time)
    : '--';
  const passengers = normalizePassengers(editingRoute?.passengers);
  const passengerTotal = Number(editingRoute?.booking_count || passengers.length || 0);

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{ maxWidth: 720, textAlign: 'left' }}
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-title">{editing ? 'Edit schedule' : 'Add schedule'}</div>
        <div className="modal-text" style={{ marginBottom: 18 }}>
          Assign a bus, set travel times, and manage the fare for this scheduled trip.
        </div>

        {formError ? (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--red-soft)',
              color: 'var(--red)',
              fontSize: 13
            }}
          >
            {formError}
          </div>
        ) : null}

        <div className="form-row">
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Vehicle</div>
            <select name="bus_id" value={form.bus_id} onChange={onChange} disabled={saving}>
              <option value="">Select a bus</option>
              {buses.map(bus => (
                <option key={bus.id} value={bus.id}>
                  {bus.name} - {bus.type} ({bus.plate_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Company</div>
            <div
              style={{
                minHeight: 38,
                display: 'flex',
                alignItems: 'center',
                padding: '9px 14px',
                borderRadius: 10,
                background: 'var(--glass)',
                border: '0.5px solid var(--glass-border)',
                color: selectedBus?.color || 'var(--text-2)'
              }}
            >
              {company}
            </div>
          </div>
        </div>

        <div className="form-row">
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Origin</div>
            <select
              name="origin"
              value={form.origin}
              onChange={onChange}
              disabled={saving}
            >
              <option value="">Select origin</option>
              {cityOptions.map(city => (
                <option key={`origin-${city}`} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Destination</div>
            <select
              name="destination"
              value={form.destination}
              onChange={onChange}
              disabled={saving}
            >
              <option value="">Select destination</option>
              {cityOptions.map(city => (
                <option key={`destination-${city}`} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Departure time</div>
            <input
              type="datetime-local"
              name="departure_time"
              value={form.departure_time}
              onChange={onChange}
              disabled={saving}
            />
          </div>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Arrival time</div>
            <input
              type="datetime-local"
              name="arrival_time"
              value={form.arrival_time}
              onChange={onChange}
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-row" style={{ marginBottom: 18 }}>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Fare</div>
            <input
              type="number"
              min="0"
              step="0.01"
              name="price"
              value={form.price}
              onChange={onChange}
              placeholder="12.00"
              disabled={saving}
            />
          </div>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Trip duration</div>
            <div
              style={{
                minHeight: 38,
                display: 'flex',
                alignItems: 'center',
                padding: '9px 14px',
                borderRadius: 10,
                background: 'var(--glass)',
                border: '0.5px solid var(--glass-border)',
                color: 'var(--text)'
              }}
            >
              {duration}
            </div>
          </div>
        </div>

        {editing ? (
          <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: 'var(--glass)', border: '0.5px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div className="sec-sub">Passengers</div>
                <div className="td-muted" style={{ fontSize: 12 }}>Current non-cancelled bookings for this schedule</div>
              </div>
              <span className="badge badge-blue">{passengerTotal} passenger{passengerTotal === 1 ? '' : 's'}</span>
            </div>
            {passengers.length ? (
              <div style={{ display: 'grid', gap: 8, maxHeight: 170, overflowY: 'auto', paddingRight: 4 }}>
                {passengers.map(passenger => (
                  <div key={passenger.booking_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{passenger.user_name || passenger.email || `Passenger #${passenger.user_id}`}</div>
                      <div className="td-muted" style={{ fontSize: 11 }}>
                        {passenger.email || 'No email'} {passenger.phone ? `| ${passenger.phone}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="badge badge-green">Seat {passenger.seat_number}</div>
                      <div className="td-muted" style={{ fontSize: 11, marginTop: 4 }}>#{passenger.booking_id} - {passenger.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="td-muted" style={{ fontSize: 12 }}>No passengers booked for this schedule.</div>
            )}
          </div>
        ) : null}

        {editing ? (
          <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: 'var(--glass)', border: '0.5px solid var(--glass-border)' }}>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Schedule availability</div>
            <div style={{ display: 'inline-flex', gap: 6, padding: 4, borderRadius: 999, background: 'var(--glass-strong)', marginBottom: form.availability_status === 'maintenance' ? 14 : 0 }}>
              {['available', 'maintenance'].map(status => (
                <button
                  key={status}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onChange({ target: { name: 'availability_status', value: status } })}
                  disabled={saving}
                  style={{
                    borderRadius: 999,
                    background: form.availability_status === status ? (status === 'maintenance' ? 'var(--amber)' : 'var(--green)') : 'transparent',
                    color: form.availability_status === status ? '#fff' : 'var(--text-2)'
                  }}
                >
                  {status === 'maintenance' ? 'Maintenance' : 'Available'}
                </button>
              ))}
            </div>
            {form.availability_status === 'maintenance' ? (
              <div>
                <div className="form-row">
                  <label style={{ display: 'grid', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                    Maintenance from
                    <input type="datetime-local" name="maintenance_start" value={form.maintenance_start || ''} onChange={onChange} disabled={saving} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                    Maintenance until
                    <input type="datetime-local" name="maintenance_end" value={form.maintenance_end || ''} onChange={onChange} disabled={saving} />
                  </label>
                </div>
                <div className="td-muted" style={{ fontSize: 12 }}>
                  If this trip has bookings, you can move them to another bus route or create a backup route.
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onPreviewMaintenance} disabled={saving} style={{ marginTop: 10 }}>
                  Preview impact
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="modal-btns">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Create schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ route, onClose, onConfirm, deleting }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={event => event.stopPropagation()}>
        <div className="modal-icon" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
          <Icon d={icons.trash} size={24} />
        </div>
        <div className="modal-title">Delete schedule?</div>
        <div className="modal-text">
          {route.origin} to {route.destination} on {formatDateTime(route.departure_time)} will be removed permanently.
        </div>
        <div className="modal-btns">
          <button className="btn btn-ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DestinationModal({
  value,
  error,
  saving,
  destinations,
  editingDestinationId,
  deletingDestinationId,
  onChange,
  onClose,
  onSubmit,
  onEdit,
  onDelete,
  onReset
}) {
  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{ maxWidth: 460, textAlign: 'left' }}
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-title">{editingDestinationId ? 'Edit destination' : 'Add destination'}</div>
        <div className="modal-text" style={{ marginBottom: 18 }}>
          Manage destination values stored in the database. Changes appear immediately in both Origin and Destination dropdowns.
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--red-soft)',
              color: 'var(--red)',
              fontSize: 13
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ marginBottom: 18 }}>
          <div className="sec-sub" style={{ marginBottom: 8 }}>Destination name</div>
          <input
            value={value}
            onChange={onChange}
            placeholder="Kampot"
            disabled={saving}
          />
        </div>

        {editingDestinationId ? (
          <div style={{ marginBottom: 18 }}>
            <button className="btn btn-ghost btn-sm" onClick={onReset} disabled={saving}>
              Cancel edit
            </button>
          </div>
        ) : null}

        <div style={{ marginBottom: 18 }}>
          <div className="sec-sub" style={{ marginBottom: 8 }}>Existing destinations</div>
          {destinations.length ? (
            <div style={{ display: 'grid', gap: 8, maxHeight: 160, overflowY: 'auto', paddingRight: 4 }}>
              {destinations.map(destination => (
                <div
                  key={destination.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--glass)',
                    border: '0.5px solid var(--glass-border)'
                  }}
                >
                  <span style={{ fontSize: 13 }}>{destination.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onEdit(destination)}
                      disabled={saving}
                    >
                      <Icon d={icons.edit} size={12} />
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => onDelete(destination)}
                      disabled={saving || deletingDestinationId === destination.id}
                    >
                      {deletingDestinationId === destination.id ? '...' : <Icon d={icons.trash} size={12} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sec-sub">No destinations saved yet.</div>
          )}
        </div>

        <div className="modal-btns">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? (editingDestinationId ? 'Saving...' : 'Adding...') : (editingDestinationId ? 'Save destination' : 'Add destination')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DailyRouteTemplateModal({
  templates,
  form,
  error,
  saving,
  editingId,
  buses,
  cityOptions,
  onChange,
  onClose,
  onSubmit,
  onEdit,
  onDelete,
  onReset
}) {
  const selectedBus = buses.find(bus => String(bus.id) === String(form.bus_id));

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 820, textAlign: 'left' }} onClick={event => event.stopPropagation()}>
        <div className="modal-title">Daily routes</div>
        <div className="modal-text" style={{ marginBottom: 18 }}>
          Create one daily route pattern and the system will keep the next 30 days of schedules generated from it.
        </div>

        {error ? (
          <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        <div className="form-row">
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Vehicle</div>
            <select name="bus_id" value={form.bus_id} onChange={onChange} disabled={saving}>
              <option value="">Select a bus</option>
              {buses.map(bus => (
                <option key={bus.id} value={bus.id}>{bus.name} - {bus.type} ({bus.plate_number})</option>
              ))}
            </select>
          </div>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Company</div>
            <div style={{ minHeight: 38, display: 'flex', alignItems: 'center', padding: '9px 14px', borderRadius: 10, background: 'var(--glass)', border: '0.5px solid var(--glass-border)', color: selectedBus?.color || 'var(--text-2)' }}>
              {selectedBus?.company_name || 'No company'}
            </div>
          </div>
        </div>

        <div className="form-row">
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Origin</div>
            <select name="origin" value={form.origin} onChange={onChange} disabled={saving}>
              <option value="">Select origin</option>
              {cityOptions.map(city => <option key={`template-origin-${city}`} value={city}>{city}</option>)}
            </select>
          </div>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Destination</div>
            <select name="destination" value={form.destination} onChange={onChange} disabled={saving}>
              <option value="">Select destination</option>
              {cityOptions.map(city => <option key={`template-destination-${city}`} value={city}>{city}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row" style={{ marginBottom: 16 }}>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Daily departure</div>
            <input type="time" name="departure_time" value={form.departure_time} onChange={onChange} disabled={saving} />
          </div>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Daily arrival</div>
            <input type="time" name="arrival_time" value={form.arrival_time} onChange={onChange} disabled={saving} />
          </div>
          <div>
            <div className="sec-sub" style={{ marginBottom: 8 }}>Fare</div>
            <input type="number" min="0" step="0.01" name="price" value={form.price} onChange={onChange} disabled={saving} />
          </div>
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18, color: 'var(--text-2)', fontSize: 13 }}>
          <input type="checkbox" name="is_active" checked={Boolean(form.is_active)} onChange={onChange} disabled={saving} />
          Generate future routes from this template
        </label>

        <div className="modal-btns" style={{ marginBottom: 18 }}>
          <button className="btn btn-ghost" onClick={onReset} disabled={saving}>New template</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Save daily route' : 'Create daily route'}
          </button>
        </div>

        <div className="sec-title" style={{ marginBottom: 10 }}>Saved daily routes</div>
        {templates.length ? (
          <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflow: 'auto' }}>
            {templates.map(template => (
              <div key={template.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, borderRadius: 10, background: 'var(--glass)', border: '0.5px solid var(--glass-border)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{template.origin} {'->'} {template.destination}</div>
                  <div className="td-muted" style={{ fontSize: 12 }}>
                    {template.bus_name} - {formatTimeInput(template.departure_time)} to {formatTimeInput(template.arrival_time)} - {formatMoney(template.price)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`badge ${template.is_active ? 'badge-green' : 'badge-amber'}`}>{template.is_active ? 'Active' : 'Paused'}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(template)} disabled={saving}>
                    <Icon d={icons.edit} size={12} />
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(template)} disabled={saving}>
                    <Icon d={icons.trash} size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="sec-sub">No daily route templates yet.</div>
        )}

        <div className="modal-btns" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Close</button>
        </div>
      </div>
    </div>
  );
}

function RouteMaintenanceRecoveryModal({ conflict, saving, error, onBackupChange, onClose, onSubmit }) {
  const preview = conflict?.preview || {};
  const routes = preview.affected_routes || [];
  const bookings = preview.affected_bookings || [];
  const assignments = preview.auto_plan?.assignments || [];
  const unassigned = preview.auto_plan?.unassigned_bookings || [];
  const backups = conflict?.backup_routes || {};

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 980, textAlign: 'left' }} onClick={event => event.stopPropagation()}>
        <div className="modal-title">Maintenance impact</div>
        <div className="modal-text" style={{ marginBottom: 18 }}>
          Review affected bookings, existing route capacity, and the auto-split plan before saving maintenance.
        </div>

        {error ? (
          <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 12, maxHeight: 520, overflow: 'auto' }}>
          {routes.map(route => {
            const routeBookings = bookings.filter(booking => Number(booking.route_id) === Number(route.id));
            const routeAssignments = assignments.filter(assignment => Number(assignment.old_route_id) === Number(route.id));
            const routeUnassigned = unassigned.filter(booking => Number(booking.route_id) === Number(route.id));
            const backup = backups[route.id] || {};
            const compatibleRoutes = preview.compatible_routes?.[route.id] || [];
            const backupCandidates = preview.backup_bus_candidates?.[route.id] || [];
            const routeDayKey = getLocalDateKey(route.departure_time);
            const backupDepartureValue = backup.departure_time || formatDateInput(route.departure_time);
            const backupArrivalValue = backup.arrival_time || formatDateInput(route.arrival_time);
            const latestSameDayDeparture = routeDayKey ? `${routeDayKey}T23:59` : '';
            const showBackupForm = Boolean(backup.show_form || backup.bus_id);

            return (
              <div key={route.id} style={{ padding: 14, borderRadius: 10, background: 'var(--glass)', border: '0.5px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{route.origin} {'->'} {route.destination}</div>
                    <div className="td-muted" style={{ fontSize: 12 }}>
                      {formatDateTime(route.departure_time)} - {formatDateTime(route.arrival_time)} - {route.booking_count} booking(s)
                    </div>
                  </div>
                  <span className="badge badge-amber">Seats {(route.booked_seats || []).join(', ')}</span>
                </div>

                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  <div>
                    <div className="sec-sub">Existing route capacity</div>
                    <div className="td-muted" style={{ fontSize: 12 }}>
                      Same route, same date, and same-or-later departure within the day.
                    </div>
                  </div>
                  {compatibleRoutes.length ? compatibleRoutes.map(option => (
                    <div key={option.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                      <span>#{option.id} {option.bus_name} - {formatDateTime(option.departure_time)} to {formatDateTime(option.arrival_time)}</span>
                      <span className="badge badge-green">{option.free_seat_count} free</span>
                    </div>
                  )) : <div className="td-muted" style={{ fontSize: 12 }}>No same-day route capacity has free seats.</div>}
                </div>

                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  <div className="sec-sub">Auto split preview</div>
                  {routeAssignments.length ? routeAssignments.map(assignment => {
                    const booking = routeBookings.find(item => Number(item.booking_id) === Number(assignment.booking_id));
                    return (
                      <div key={assignment.booking_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                        <span>{booking?.user_name || booking?.user_email || `Booking #${assignment.booking_id}`} - {assignment.old_seat_number}</span>
                        <span className="badge badge-blue">Route #{assignment.target_route_id} seat {assignment.target_seat_number}</span>
                      </div>
                    );
                  }) : <div className="td-muted" style={{ fontSize: 12 }}>No existing seats assigned yet.</div>}
                  {routeUnassigned.length ? <div className="td-muted" style={{ fontSize: 12, color: 'var(--amber)' }}>{routeUnassigned.length} booking(s) need backup route capacity.</div> : null}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: showBackupForm ? 10 : 0 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onBackupChange(route.id, showBackupForm
                      ? { show_form: false, bus_id: '', departure_time: '', arrival_time: '' }
                      : { show_form: true, departure_time: backupDepartureValue, arrival_time: backupArrivalValue })}
                    disabled={saving}
                  >
                    {showBackupForm ? 'Remove new schedule' : 'Add new schedule'}
                  </button>
                </div>

                {showBackupForm ? (
                  <div className="form-row">
                    <label style={{ display: 'grid', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                      Backup bus
                      <select value={backup.bus_id || ''} onChange={event => onBackupChange(route.id, { bus_id: event.target.value })} disabled={saving}>
                        <option value="">Select backup bus</option>
                        {backupCandidates.map(bus => (
                          <option key={bus.id} value={bus.id}>{bus.name} - {bus.type} ({bus.plate_number})</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                      Backup departure
                      <input type="datetime-local" min={formatDateInput(route.departure_time)} max={latestSameDayDeparture} value={backupDepartureValue} onChange={event => onBackupChange(route.id, { departure_time: event.target.value })} disabled={saving} />
                    </label>
                    <label style={{ display: 'grid', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                      Backup arrival
                      <input type="datetime-local" min={backupDepartureValue} value={backupArrivalValue} onChange={event => onBackupChange(route.id, { arrival_time: event.target.value })} disabled={saving} />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="modal-btns" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>{saving ? 'Saving...' : 'Confirm split and save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Routes() {
  const todayKey = useMemo(() => getLocalDateKey(new Date()), []);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [dailyTemplates, setDailyTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingRoute, setDeletingRoute] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE_FORM);
  const [templateError, setTemplateError] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [maintenanceConflict, setMaintenanceConflict] = useState(null);
  const [maintenanceRecoveryError, setMaintenanceRecoveryError] = useState('');
  const [newDestinationName, setNewDestinationName] = useState('');
  const [destinationModalError, setDestinationModalError] = useState('');
  const [destinationSaving, setDestinationSaving] = useState(false);
  const [editingDestinationId, setEditingDestinationId] = useState(null);
  const [deletingDestinationId, setDeletingDestinationId] = useState(null);
  const [filterMode, setFilterMode] = useState('preset-day');
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [customDateKey, setCustomDateKey] = useState('');

  const weekDays = useMemo(() => {
    const start = new Date(`${todayKey}T00:00:00`);
    return Array.from({ length: 8 }, (_, index) => {
      const day = addDays(start, index);
      const dayKey = getLocalDateKey(day);
      return {
        key: dayKey,
        label: formatDayLabel(dayKey, index === 0),
        meta: formatDayMeta(dayKey)
      };
    });
  }, [todayKey]);

  const routesByDayCount = useMemo(() => {
    return routes.reduce((counts, route) => {
      const key = getLocalDateKey(route.departure_time);
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }, [routes]);

  const activeDayKey = filterMode === 'custom-day'
    ? (customDateKey || selectedDayKey)
    : selectedDayKey;

  const filteredRoutes = useMemo(() => {
    if (filterMode === 'all') {
      return routes;
    }
    return routes.filter(route => getLocalDateKey(route.departure_time) === activeDayKey);
  }, [activeDayKey, filterMode, routes]);

  const cityOptions = useMemo(() => {
    const cityMap = new Map();
    routes.forEach(route => {
      [route.origin, route.destination].forEach(city => {
        const normalized = String(city || '').trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (!cityMap.has(key)) {
          cityMap.set(key, normalized);
        }
      });
    });
    destinations.forEach(item => {
      const normalized = String(item?.name || '').trim();
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (!cityMap.has(key)) {
        cityMap.set(key, normalized);
      }
    });
    return Array.from(cityMap.values()).sort((a, b) => a.localeCompare(b));
  }, [destinations, routes]);

  const selectedDayInVisibleWeek = useMemo(
    () => weekDays.some(day => day.key === activeDayKey),
    [activeDayKey, weekDays]
  );

  const plannerSubLabel = filterMode === 'all'
    ? `${getTripLabel(filteredRoutes.length)} across all dates`
    : `${formatSelectedDate(activeDayKey)} • ${getTripLabel(filteredRoutes.length)}`;
  const editingRoute = editingId !== null
    ? routes.find(route => Number(route.id) === Number(editingId))
    : null;

  const stats = useMemo(() => {
    const activeBuses = new Set(routes.map(route => route.bus_id)).size;
    const totalRevenuePotential = routes.reduce((sum, route) => sum + Number(route.price || 0), 0);

    return [
      {
        label: 'Scheduled trips',
        value: routes.length,
        icon: icons.route,
        tone: 'var(--accent)'
      },
      {
        label: 'Active route pairs',
        value: filteredRoutes.length,
        icon: icons.clock,
        tone: 'var(--green)'
      },
      {
        label: 'Buses assigned',
        value: activeBuses,
        icon: icons.truck,
        tone: 'var(--amber)'
      },
      {
        label: 'Fare total',
        value: formatMoney(totalRevenuePotential),
        icon: icons.dollar,
        tone: 'var(--purple)'
      }
    ];
  }, [filteredRoutes.length, routes]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.observe-animate'));
    elements.forEach(el => {
      if (!el.dataset.revealed) {
        el.dataset.revealed = 'true';
      }
    });
  }, [loading, routes.length, filteredRoutes.length, modalOpen, deletingRoute, filterMode, activeDayKey]);

  async function loadRoutes(showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      setPageError('');
      const data = await parseJsonResponse(await fetch('/api/admin/routes'));
      setRoutes(data.routes || []);
      setBuses(data.buses || []);
      setDestinations(data.destinations || []);
      setDailyTemplates(data.daily_templates || []);
    } catch (error) {
      setPageError(error.message || 'Unable to load schedules.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRoutes();
  }, []);

  function openCreateModal() {
    const defaultDayKey = filterMode === 'all' ? todayKey : activeDayKey;
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      departure_time: buildDateTimeForDay(defaultDayKey, 8),
      arrival_time: buildDateTimeForDay(defaultDayKey, 10)
    });
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(route) {
    setEditingId(route.id);
    setForm({
      bus_id: String(route.bus_id),
      origin: route.origin,
      destination: route.destination,
      departure_time: formatDateInput(route.departure_time),
      arrival_time: formatDateInput(route.arrival_time),
      price: String(route.price),
      availability_status: route.availability_status || 'available',
      maintenance_start: formatDateInput(route.maintenance_start),
      maintenance_end: formatDateInput(route.maintenance_end)
    });
    setFormError('');
    setMaintenanceConflict(null);
    setMaintenanceRecoveryError('');
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setMaintenanceConflict(null);
    setMaintenanceRecoveryError('');
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm(current => ({
      ...current,
      [name]: value,
      ...(name === 'availability_status' && value !== 'maintenance' ? { maintenance_start: '', maintenance_end: '' } : {})
    }));
  }

  function handleSelectAll() {
    setFilterMode('all');
  }

  function handleSelectPresetDay(dayKey) {
    setFilterMode('preset-day');
    setSelectedDayKey(dayKey);
    setCustomDateKey('');
  }

  function handleCustomDateChange(event) {
    const nextValue = event.target.value;
    setCustomDateKey(nextValue);

    if (!nextValue) {
      setFilterMode('all');
      return;
    }

    setFilterMode('custom-day');
    setSelectedDayKey(nextValue);
  }

  function openDestinationModal() {
    setShowDestinationModal(true);
    setNewDestinationName('');
    setDestinationModalError('');
    setEditingDestinationId(null);
  }

  function closeDestinationModal() {
    if (destinationSaving) return;
    setShowDestinationModal(false);
    setNewDestinationName('');
    setDestinationModalError('');
    setEditingDestinationId(null);
    setDeletingDestinationId(null);
  }

  function openDailyModal() {
    setShowDailyModal(true);
    setTemplateForm({
      ...EMPTY_TEMPLATE_FORM,
      bus_id: buses[0]?.id ? String(buses[0].id) : '',
      origin: cityOptions[0] || '',
      destination: cityOptions[1] || ''
    });
    setTemplateError('');
    setEditingTemplateId(null);
  }

  function closeDailyModal() {
    if (templateSaving) return;
    setShowDailyModal(false);
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setTemplateError('');
    setEditingTemplateId(null);
  }

  function resetTemplateEditor() {
    if (templateSaving) return;
    setEditingTemplateId(null);
    setTemplateError('');
    setTemplateForm({
      ...EMPTY_TEMPLATE_FORM,
      bus_id: buses[0]?.id ? String(buses[0].id) : '',
      origin: cityOptions[0] || '',
      destination: cityOptions[1] || ''
    });
  }

  function handleTemplateChange(event) {
    const { name, value, type, checked } = event.target;
    setTemplateForm(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  function handleEditTemplate(template) {
    setEditingTemplateId(template.id);
    setTemplateForm({
      bus_id: String(template.bus_id || ''),
      origin: template.origin || '',
      destination: template.destination || '',
      departure_time: formatTimeInput(template.departure_time),
      arrival_time: formatTimeInput(template.arrival_time),
      price: String(template.price || ''),
      is_active: Boolean(template.is_active)
    });
    setTemplateError('');
  }

  async function handleSaveTemplate() {
    if (!templateForm.bus_id || !templateForm.origin || !templateForm.destination || !templateForm.departure_time || !templateForm.arrival_time || !templateForm.price) {
      setTemplateError('All daily route fields are required.');
      return;
    }

    setTemplateSaving(true);
    setTemplateError('');
    try {
      const endpoint = editingTemplateId ? `/api/admin/daily-route-templates/${editingTemplateId}` : '/api/admin/daily-route-templates';
      const method = editingTemplateId ? 'PUT' : 'POST';
      await parseJsonResponse(await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...templateForm,
          bus_id: Number(templateForm.bus_id),
          price: Number(templateForm.price),
          effective_date: todayKey
        })
      }));

      resetTemplateEditor();
      await loadRoutes(false);
    } catch (error) {
      const blocked = error.code === 'DAILY_ROUTE_BOOKING_CONFLICT' && error.routes?.length
        ? ` ${error.routes.length} booked future route(s) must stay unchanged.`
        : '';
      setTemplateError(`${error.message || 'Unable to save daily route.'}${blocked}`);
    } finally {
      setTemplateSaving(false);
    }
  }

  async function handleDeleteTemplate(template) {
    const confirmed = window.confirm(`Deactivate daily route ${template.origin} to ${template.destination}?`);
    if (!confirmed) return;

    setTemplateSaving(true);
    setTemplateError('');
    try {
      await parseJsonResponse(await fetch(`/api/admin/daily-route-templates/${template.id}`, { method: 'DELETE' }));
      if (editingTemplateId === template.id) resetTemplateEditor();
      await loadRoutes(false);
    } catch (error) {
      setTemplateError(error.message || 'Unable to deactivate daily route.');
    } finally {
      setTemplateSaving(false);
    }
  }

  async function handleAddDestination() {
    const normalized = newDestinationName.trim();
    if (!normalized) {
      setDestinationModalError('Destination name is required.');
      return;
    }

    const exists = cityOptions.some(city => city.toLowerCase() === normalized.toLowerCase());
    const existingEditing = destinations.find(item => item.id === editingDestinationId);
    const duplicateWhileEditing = editingDestinationId
      ? destinations.some(item => item.id !== editingDestinationId && item.name.toLowerCase() === normalized.toLowerCase())
      : exists;
    if (duplicateWhileEditing) {
      setDestinationModalError('This destination already exists.');
      return;
    }

    setDestinationSaving(true);
    setDestinationModalError('');

    try {
      const created = await parseJsonResponse(
        await fetch(editingDestinationId ? `/api/admin/destinations/${editingDestinationId}` : '/api/admin/destinations', {
          method: editingDestinationId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: normalized })
        })
      );

      setDestinations(current => {
        const next = editingDestinationId
          ? current.map(item => (item.id === editingDestinationId ? created : item))
          : [...current, created];
        next.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        return next;
      });
      setRoutes(current => current.map(route => {
        if (!editingDestinationId || !existingEditing) return route;
        return {
          ...route,
          origin: route.origin === existingEditing.name ? created.name : route.origin,
          destination: route.destination === existingEditing.name ? created.name : route.destination
        };
      }));
      setShowDestinationModal(false);
      setNewDestinationName('');
      setDestinationModalError('');
      setEditingDestinationId(null);
    } catch (error) {
      setDestinationModalError(error.message || 'Unable to add destination.');
    } finally {
      setDestinationSaving(false);
    }
  }

  function handleEditDestination(destination) {
    setEditingDestinationId(destination.id);
    setNewDestinationName(destination.name);
    setDestinationModalError('');
  }

  function resetDestinationEditor() {
    if (destinationSaving) return;
    setEditingDestinationId(null);
    setNewDestinationName('');
    setDestinationModalError('');
  }

  async function handleDeleteDestination(destination) {
    const confirmed = window.confirm(`Delete destination "${destination.name}"?`);
    if (!confirmed) return;

    setDeletingDestinationId(destination.id);
    setDestinationModalError('');

    try {
      await parseJsonResponse(
        await fetch(`/api/admin/destinations/${destination.id}`, {
          method: 'DELETE'
        })
      );
      setDestinations(current => current.filter(item => item.id !== destination.id));
      if (editingDestinationId === destination.id) {
        resetDestinationEditor();
      }
    } catch (error) {
      setDestinationModalError(error.message || 'Unable to delete destination.');
    } finally {
      setDeletingDestinationId(null);
    }
  }

  function validateForm() {
    if (!form.bus_id || !form.origin.trim() || !form.destination.trim() || !form.departure_time || !form.arrival_time || !form.price) {
      return 'All schedule fields are required.';
    }

    const departure = new Date(form.departure_time);
    const arrival = new Date(form.arrival_time);
    if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime())) {
      return 'Departure and arrival time must be valid.';
    }

    if (arrival <= departure) {
      return 'Arrival time must be after departure time.';
    }

    if (Number(form.price) <= 0) {
      return 'Price must be greater than zero.';
    }
    if (editingId !== null && form.availability_status === 'maintenance') {
      if (!form.maintenance_start || !form.maintenance_end) {
        return 'Maintenance start and end date/time are required.';
      }
      const maintenanceStart = new Date(form.maintenance_start);
      const maintenanceEnd = new Date(form.maintenance_end);
      if (Number.isNaN(maintenanceStart.getTime()) || Number.isNaN(maintenanceEnd.getTime())) {
        return 'Maintenance start and end date/time must be valid.';
      }
      if (maintenanceEnd <= maintenanceStart) {
        return 'Maintenance until must be after maintenance from.';
      }
      if (!(maintenanceStart < arrival && maintenanceEnd > departure)) {
        return 'Maintenance duration must overlap this scheduled trip.';
      }
    }

    return '';
  }

  async function handleSubmit(recoveryPlan = null) {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        bus_id: Number(form.bus_id),
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        departure_time: form.departure_time,
        arrival_time: form.arrival_time,
        price: Number(form.price),
        availability_status: editingId !== null ? form.availability_status : 'available',
        maintenance_start: editingId !== null && form.availability_status === 'maintenance' ? form.maintenance_start : '',
        maintenance_end: editingId !== null && form.availability_status === 'maintenance' ? form.maintenance_end : '',
        ...(recoveryPlan ? { maintenance_recovery_plan: recoveryPlan } : {})
      };

      const endpoint = editingId ? `/api/admin/routes/${editingId}` : '/api/admin/routes';
      const method = editingId ? 'PUT' : 'POST';

      await parseJsonResponse(
        await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
      );

      const savedDayKey = getLocalDateKey(payload.departure_time);
      if (filterMode !== 'all' && savedDayKey) {
        if (weekDays.some(day => day.key === savedDayKey)) {
          setFilterMode('preset-day');
          setSelectedDayKey(savedDayKey);
          setCustomDateKey('');
        } else {
          setFilterMode('custom-day');
          setSelectedDayKey(savedDayKey);
          setCustomDateKey(savedDayKey);
        }
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormError('');
      setMaintenanceConflict(null);
      setMaintenanceRecoveryError('');
      await loadRoutes(false);
    } catch (error) {
      if (error.code === 'ROUTE_MAINTENANCE_BOOKING_CONFLICT') {
        setMaintenanceConflict({
          preview: error.preview || { affected_routes: error.routes || [] },
          backup_routes: {}
        });
        setMaintenanceRecoveryError('');
        return;
      }
      if (recoveryPlan) {
        setMaintenanceRecoveryError(error.message || 'Unable to resolve booked passengers.');
        return;
      }
      const blocked = error.code === 'DAILY_ROUTE_BOOKING_CONFLICT' && error.routes?.length
        ? ` ${error.routes.length} booked future route(s) would be affected.`
        : '';
      setFormError(`${error.message || 'Unable to save schedule.'}${blocked}`);
    } finally {
      setSaving(false);
    }
  }

  async function previewMaintenanceImpact() {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (!editingId || form.availability_status !== 'maintenance') return;

    setSaving(true);
    setFormError('');
    setMaintenanceRecoveryError('');
    try {
      const preview = await parseJsonResponse(await fetch(`/api/admin/routes/${editingId}/maintenance-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenance_start: form.maintenance_start,
          maintenance_end: form.maintenance_end,
          sync_bus_status: true
        })
      }));
      setMaintenanceConflict({ preview, backup_routes: {} });
    } catch (error) {
      setFormError(error.message || 'Unable to preview maintenance impact.');
    } finally {
      setSaving(false);
    }
  }

  function updateMaintenanceBackup(routeId, patch) {
    setMaintenanceConflict(current => ({
      ...current,
      backup_routes: {
        ...(current?.backup_routes || {}),
        [routeId]: {
          ...(current?.backup_routes?.[routeId] || {}),
          ...patch
        }
      }
    }));
  }

  async function submitMaintenanceRecovery() {
    if (!maintenanceConflict) return;
    const preview = maintenanceConflict.preview || {};
    const backupRoutes = Object.entries(maintenanceConflict.backup_routes || {})
      .filter(([, value]) => value.bus_id)
      .map(([routeId, value]) => ({
        source_route_id: Number(routeId),
        temp_id: `backup-${routeId}`,
        bus_id: Number(value.bus_id),
        departure_time: value.departure_time,
        arrival_time: value.arrival_time
      }));
    const backupSourceRouteIds = new Set(backupRoutes.map(route => Number(route.source_route_id)));
    const assignments = (preview.auto_plan?.assignments || [])
      .filter(assignment => !backupSourceRouteIds.has(Number(assignment.old_route_id)));

    await handleSubmit({
      assignments,
      backup_routes: backupRoutes
    });
  }

  async function handleDelete() {
    if (!deletingRoute) return;
    setDeleting(true);

    try {
      await parseJsonResponse(
        await fetch(`/api/admin/routes/${deletingRoute.id}`, {
          method: 'DELETE'
        })
      );
      setDeletingRoute(null);
      await loadRoutes(false);
    } catch (error) {
      setPageError(error.message || 'Unable to delete schedule.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div
        className="page-header observe-animate"
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
      >
        <div>
          <div className="page-title">Routes & Schedules</div>
          <div className="page-sub">
            Manage scheduled trips, assign buses, and control fares from one place.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => loadRoutes(false)} disabled={refreshing}>
            <Icon d={icons.clock} size={13} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={openDestinationModal}>
            <Icon d={icons.plus} size={13} /> Add destination
          </button>
          <button className="btn btn-ghost btn-sm" onClick={openDailyModal}>
            <Icon d={icons.clock} size={13} /> Daily routes
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
            <Icon d={icons.plus} size={13} color="#fff" /> Add schedule
          </button>
        </div>
      </div>

      {pageError ? (
        <div
          className="observe-animate"
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--red-soft)',
            color: 'var(--red)',
            fontSize: 13
          }}
        >
          {pageError}
        </div>
      ) : null}

      <div
        className="observe-animate"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16
        }}
      >
        {stats.map(stat => (
          <div key={stat.label} className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="sec-sub">{stat.label}</div>
              <span style={{ color: stat.tone }}>
                <Icon d={stat.icon} size={16} />
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="card observe-animate routes-planner-shell" style={{ marginBottom: 16 }}>
        <div className="sec-title" style={{ marginBottom: 8 }}>Week planner</div>
        <div className="sec-sub" style={{ marginBottom: 14 }}>
          Plan schedules for {formatSelectedDate(todayKey)} through {formatSelectedDate(weekDays[weekDays.length - 1].key)}.
        </div>
        <div className="routes-planner-controls">
          <div className="pill-nav routes-planner-nav">
            <button
              type="button"
              className="pill-tab routes-planner-pill"
              onClick={handleSelectAll}
              style={{
                background: filterMode === 'all' ? 'var(--accent)' : 'var(--glass-strong)',
                color: filterMode === 'all' ? '#fff' : 'var(--text)',
                border: '1px solid var(--glass-border)',
                fontWeight: filterMode === 'all' ? 700 : 600
              }}
            >
              All
            </button>
            {weekDays.map(day => {
              const count = routesByDayCount[day.key] || 0;
              const status = getDayStatus(count);
              const active = filterMode !== 'all' && day.key === activeDayKey;
              const statusStyles = getDayStatusStyles(status, active);

              return (
                <button
                  key={day.key}
                  type="button"
                  className="pill-tab routes-planner-pill"
                  onClick={() => handleSelectPresetDay(day.key)}
                  style={{
                    ...statusStyles,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    background: statusStyles.background,
                    fontWeight: active ? 700 : 600
                  }}
                >
                  <span style={{ color: statusStyles.color }}>{day.label}</span>
                  <span style={{ color: 'var(--text-2)', fontSize: 11 }}>
                    {day.meta} • {getTripLabel(count)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="routes-planner-date">
            <div className="sec-sub" style={{ marginBottom: 8 }}>Select date</div>
            <input
              type="date"
              value={customDateKey}
              onChange={handleCustomDateChange}
              aria-label="Select date"
            />
            {filterMode === 'custom-day' && !selectedDayInVisibleWeek ? (
              <div className="sec-sub" style={{ marginTop: 8 }}>
                Showing {formatSelectedDate(activeDayKey)}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="card observe-animate routes-summary-card">
          <div
            className="routes-summary-panel"
            style={{
              padding: 14,
              borderRadius: 12,
              background: 'var(--glass)',
              border: '0.5px solid var(--glass-border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div>
                <div className="sec-title" style={{ marginBottom: 4 }}>Scheduled trips</div>
                <div className="sec-sub">{plannerSubLabel}</div>
              </div>
              {filterMode === 'all' ? (
                <span className="badge badge-blue">All schedules</span>
              ) : (
                <span className={`badge ${getDayStatus(filteredRoutes.length) === 'green' ? 'badge-green' : getDayStatus(filteredRoutes.length) === 'yellow' ? 'badge-amber' : 'badge-red'}`}>
                  {getDayStatus(filteredRoutes.length) === 'green' ? 'Fully added' : getDayStatus(filteredRoutes.length) === 'yellow' ? 'Partially added' : 'No schedules'}
                </span>
              )}
            </div>
          {loading ? (
            <div className="sec-sub">Loading schedules...</div>
          ) : filteredRoutes.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Route</th>
                    <th>Bus</th>
                    <th>Company</th>
                    <th>Departure</th>
                    <th>Arrival</th>
                    <th>Duration</th>
                    <th>Passengers</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Fare</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map(route => {
                    const companyMeta = getCompanyMeta(route.company_name);
                    return (
                      <tr key={route.id}>
                        <td style={{ color: 'var(--accent)', fontSize: 12 }}>#{route.id}</td>
                        <td style={{ fontWeight: 500, fontSize: 13 }}>
                          {route.origin} {'->'} {route.destination}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span>{route.bus_name}</span>
                            <span className="td-muted">{route.bus_type} | {route.plate_number}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: companyMeta.color
                              }}
                            />
                            <span style={{ color: companyMeta.color }}>
                              {route.company_name || 'No company'}
                            </span>
                          </div>
                        </td>
                        <td className="td-muted">{formatDateTime(route.departure_time)}</td>
                        <td className="td-muted">{formatDateTime(route.arrival_time)}</td>
                        <td>
                          <span className="badge badge-blue">
                            {formatDuration(route.departure_time, route.arrival_time)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${Number(route.booking_count || 0) > 0 ? 'badge-blue' : 'badge-purple'}`}>
                            {Number(route.booking_count || 0)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${route.route_type === 'daily' ? 'badge-green' : 'badge-purple'}`}>
                            {route.route_type === 'daily' ? 'Daily' : 'Manual'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${route.availability_status === 'maintenance' ? 'badge-amber' : 'badge-green'}`}>
                            {route.availability_status === 'maintenance' ? 'Maintenance' : 'Available'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--green)', fontWeight: 600 }}>
                          {formatMoney(route.price)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(route)}>
                              <Icon d={icons.edit} size={12} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDeletingRoute(route)}>
                              <Icon d={icons.trash} size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sec-sub">
              {filterMode === 'all'
                ? 'No schedules yet. Add the first trip to start planning routes.'
                : `No schedules for ${formatSelectedDate(activeDayKey)} yet. Add a trip to start planning this day.`}
            </div>
          )}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <RouteFormModal
          form={form}
          formError={formError}
          onChange={handleChange}
          onPreviewMaintenance={previewMaintenanceImpact}
          onClose={closeModal}
          onSubmit={() => handleSubmit()}
          buses={buses}
          cityOptions={cityOptions}
          saving={saving}
          editing={editingId !== null}
          editingRoute={editingRoute}
        />
      ) : null}

      {showDestinationModal ? (
        <DestinationModal
          value={newDestinationName}
          error={destinationModalError}
          saving={destinationSaving}
          destinations={destinations}
          editingDestinationId={editingDestinationId}
          deletingDestinationId={deletingDestinationId}
          onChange={event => {
            setNewDestinationName(event.target.value);
            if (destinationModalError) {
              setDestinationModalError('');
            }
          }}
          onClose={closeDestinationModal}
          onSubmit={handleAddDestination}
          onEdit={handleEditDestination}
          onDelete={handleDeleteDestination}
          onReset={resetDestinationEditor}
        />
      ) : null}

      {showDailyModal ? (
        <DailyRouteTemplateModal
          templates={dailyTemplates}
          form={templateForm}
          error={templateError}
          saving={templateSaving}
          editingId={editingTemplateId}
          buses={buses}
          cityOptions={cityOptions}
          onChange={handleTemplateChange}
          onClose={closeDailyModal}
          onSubmit={handleSaveTemplate}
          onEdit={handleEditTemplate}
          onDelete={handleDeleteTemplate}
          onReset={resetTemplateEditor}
        />
      ) : null}

      {maintenanceConflict ? (
        <RouteMaintenanceRecoveryModal
          conflict={maintenanceConflict}
          saving={saving}
          error={maintenanceRecoveryError}
          onBackupChange={updateMaintenanceBackup}
          onClose={() => {
            if (!saving) {
              setMaintenanceConflict(null);
              setMaintenanceRecoveryError('');
            }
          }}
          onSubmit={submitMaintenanceRecovery}
        />
      ) : null}

      {deletingRoute ? (
        <DeleteModal
          route={deletingRoute}
          onClose={() => {
            if (!deleting) {
              setDeletingRoute(null);
            }
          }}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      ) : null}
    </div>
  );
}
