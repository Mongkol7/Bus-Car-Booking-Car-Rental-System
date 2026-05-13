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

function getRouteKey(route) {
  return `${route.origin} -> ${route.destination}`;
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
    <div className="modal-overlay" onClick={onClose}>
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

  const groupedRoutes = useMemo(() => {
    const groups = routes.reduce((map, route) => {
      const key = getRouteKey(route);
      if (!map.has(key)) {
        map.set(key, {
          key,
          origin: route.origin,
          destination: route.destination,
          schedules: 0,
          lowestPrice: Number(route.price),
          highestPrice: Number(route.price),
          nextDeparture: route.departure_time,
          companies: new Set()
        });
      }

      const group = map.get(key);
      group.schedules += 1;
      group.lowestPrice = Math.min(group.lowestPrice, Number(route.price));
      group.highestPrice = Math.max(group.highestPrice, Number(route.price));
      if (new Date(route.departure_time) < new Date(group.nextDeparture)) {
        group.nextDeparture = route.departure_time;
      }
      if (route.company_name) {
        group.companies.add(route.company_name);
      }
      return map;
    }, new Map());

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        companies: Array.from(group.companies)
      }))
      .sort((a, b) => new Date(a.nextDeparture) - new Date(b.nextDeparture));
  }, [routes]);

  const cityOptions = useMemo(() => {
    const cities = new Set();
    routes.forEach(route => {
      if (route.origin) cities.add(route.origin);
      if (route.destination) cities.add(route.destination);
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [routes]);

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
        value: groupedRoutes.length,
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
  }, [groupedRoutes.length, routes]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.observe-animate'));
    elements.forEach(el => {
      if (!el.dataset.revealed) {
        el.dataset.revealed = 'true';
      }
    });
  }, [loading, routes.length, modalOpen, deletingRoute]);

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
    setEditingId(null);
    setForm(EMPTY_FORM);
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

      <div className="grid2">
        <div className="card observe-animate">
          <div className="sec-title">Scheduled trips</div>
          {loading ? (
            <div className="sec-sub">Loading schedules...</div>
          ) : routes.length ? (
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
                  {routes.map(route => {
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
            <div className="sec-sub">No schedules yet. Add the first trip to start assigning buses.</div>
          )}
        </div>

        <div className="card observe-animate">
          <div className="sec-title">Route summary</div>
          {loading ? (
            <div className="sec-sub">Preparing route groups...</div>
          ) : groupedRoutes.length ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {groupedRoutes.map(group => (
                <div
                  key={group.key}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: 'var(--glass)',
                    border: '0.5px solid var(--glass-border)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>
                      {group.origin} {'->'} {group.destination}
                    </div>
                    <span className="badge badge-purple">{group.schedules} trips</span>
                  </div>
                  <div className="sec-sub" style={{ marginBottom: 10 }}>
                    Next departure {formatDateTime(group.nextDeparture)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <span className="badge badge-blue">
                      Fare {formatMoney(group.lowestPrice)}{group.lowestPrice !== group.highestPrice ? ` - ${formatMoney(group.highestPrice)}` : ''}
                    </span>
                    <span className="badge badge-green">{group.companies.length} operators</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {group.companies.map(company => {
                      const companyMeta = getCompanyMeta(company);
                      return (
                        <span
                          key={company}
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
                          {company}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sec-sub">Route summaries will appear after schedules are created.</div>
          )}
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
