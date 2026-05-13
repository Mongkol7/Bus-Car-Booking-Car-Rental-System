import React, { useEffect, useMemo, useState } from 'react';
import { Icon, icons, getCompanyMeta } from '../../utils/sharedAdmin';

const EMPTY_FORM = {
  bus_id: '',
  origin: '',
  destination: '',
  departure_time: '',
  arrival_time: '',
  price: ''
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

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function RouteFormModal({
  form,
  formError,
  onChange,
  onClose,
  onSubmit,
  buses,
  cityOptions,
  saving,
  editing
}) {
  const selectedBus = buses.find(bus => String(bus.id) === String(form.bus_id));
  const company = selectedBus?.company_name || 'No company';
  const duration = form.departure_time && form.arrival_time
    ? formatDuration(form.departure_time, form.arrival_time)
    : '--';

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

export default function Routes() {
  const todayKey = useMemo(() => getLocalDateKey(new Date()), []);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
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

  const summarySchedules = useMemo(() => {
    const now = new Date();
    const isTodayView = filterMode !== 'all' && activeDayKey === todayKey;
    return [...filteredRoutes]
      .map(route => {
        const departureDate = new Date(route.departure_time);
        return {
          ...route,
          departureLabel: departureDate > now
            ? 'Next departure'
            : (isTodayView || filterMode === 'all' ? 'Departure' : 'Departure'),
          departureValue: route.departure_time
        };
      })
      .sort((a, b) => new Date(a.departureValue) - new Date(b.departureValue));
  }, [activeDayKey, filteredRoutes, filterMode, todayKey]);

  const cityOptions = useMemo(() => {
    const cities = new Set();
    routes.forEach(route => {
      if (route.origin) cities.add(route.origin);
      if (route.destination) cities.add(route.destination);
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [routes]);

  const selectedDayInVisibleWeek = useMemo(
    () => weekDays.some(day => day.key === activeDayKey),
    [activeDayKey, weekDays]
  );

  const plannerSubLabel = filterMode === 'all'
    ? `${getTripLabel(filteredRoutes.length)} across all dates`
    : `${formatSelectedDate(activeDayKey)} • ${getTripLabel(filteredRoutes.length)}`;

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
        value: summarySchedules.length,
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
  }, [routes, summarySchedules.length]);

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
      price: String(route.price)
    });
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm(current => ({
      ...current,
      [name]: value
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

    return '';
  }

  async function handleSubmit() {
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
        price: Number(form.price)
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
      await loadRoutes(false);
    } catch (error) {
      setFormError(error.message || 'Unable to save schedule.');
    } finally {
      setSaving(false);
    }
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

      <div className="grid2 routes-planner-grid">
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
            <div style={{ marginBottom: 14 }}>
              <div className="sec-title" style={{ marginBottom: 4 }}>Route summary</div>
              <div className="sec-sub">{filterMode === 'all' ? 'Summary across all schedules' : `Summary for ${formatSelectedDate(activeDayKey)}`}</div>
            </div>
          {loading ? (
            <div className="sec-sub">Preparing route groups...</div>
          ) : summarySchedules.length ? (
            <div className="routes-summary-scroll" style={{ display: 'grid', gap: 12 }}>
              {summarySchedules.map(route => (
                <div
                  key={route.id}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: 'var(--glass)',
                    border: '0.5px solid var(--glass-border)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>
                      {route.origin} {'->'} {route.destination}
                    </div>
                    <span className="badge badge-purple">Schedule #{route.id}</span>
                  </div>
                  <div className="sec-sub" style={{ marginBottom: 10 }}>
                    {route.departureLabel} {formatDateTime(route.departureValue)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <span className="badge badge-blue">Fare {formatMoney(route.price)}</span>
                    <span className="badge badge-green">{route.bus_name}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(() => {
                      const companyMeta = getCompanyMeta(route.company_name);
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 9px',
                            borderRadius: 999,
                            fontSize: 12,
                            background: companyMeta.bg,
                            color: companyMeta.color
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: companyMeta.color
                            }}
                          />
                          {route.company_name || 'No company'}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sec-sub">
              {filterMode === 'all'
                ? 'Route summaries will appear after schedules are created.'
                : `Route summaries will appear after schedules are created for ${formatSelectedDate(activeDayKey)}.`}
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
          onClose={closeModal}
          onSubmit={handleSubmit}
          buses={buses}
          cityOptions={cityOptions}
          saving={saving}
          editing={editingId !== null}
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
