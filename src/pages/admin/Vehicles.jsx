import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, icons, getCompanyMeta } from '../../utils/sharedAdmin';

const STATUS_TABS = ['all', 'available', 'rented', 'maintenance'];
const VEHICLE_STATUSES = ['available', 'rented', 'maintenance'];
const SEAT_CELL_TYPES = [
  { id: 'seat', label: 'Seat' },
  { id: 'empty', label: 'Empty' },
  { id: 'door', label: 'Door' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'driver', label: 'Driver' },
  { id: 'note', label: 'Note' }
];

const EMPTY_BUS = {
  company_id: '',
  name: '',
  type: '',
  plate_number: '',
  total_seats: '',
  status: 'available',
  maintenance_start: '',
  maintenance_end: ''
};

const EMPTY_CAR = {
  name: '',
  type: '',
  plate_number: '',
  total_seats: '',
  transmission: '',
  daily_rate: '',
  status: 'available',
  photosText: ''
};

const EMPTY_COMPANY = {
  name: '',
  theme_color: '#60a5fa',
  theme_bg: 'rgba(96,165,250,0.16)'
};

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.code = data.code;
    error.affected_routes = data.affected_routes || [];
    throw error;
  }
  return data;
}

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join(' ');
}

function statusBadge(status) {
  if (status === 'available') return 'badge-green';
  if (status === 'rented') return 'badge-blue';
  return 'badge-amber';
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDateTimeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
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

function getRentalCarAvailability(car, now = new Date()) {
  const rawStatus = String(car?.status || 'available').toLowerCase();
  if (rawStatus === 'maintenance') {
    return { status: 'maintenance', label: 'Maintenance', badgeClass: 'badge-amber', note: 'Temporarily unavailable', noteColor: 'var(--amber)' };
  }

  const rentals = (Array.isArray(car?.rental_windows) ? car.rental_windows : [])
    .map((rental) => ({
      ...rental,
      pickupDate: new Date(rental.pickup_datetime),
      returnDate: new Date(rental.return_datetime)
    }))
    .filter((rental) => !Number.isNaN(rental.pickupDate.getTime()) && !Number.isNaN(rental.returnDate.getTime()))
    .sort((a, b) => a.pickupDate - b.pickupDate);

  const currentRental = rentals.find((rental) => rental.pickupDate <= now && rental.returnDate > now);
  if (currentRental || rawStatus === 'rented') {
    const returnDate = currentRental?.returnDate;
    return {
      status: 'rented',
      label: 'Rented',
      badgeClass: 'badge-blue',
      note: returnDate ? `Free in ${formatDuration(returnDate - now)}` : 'Currently unavailable',
      noteColor: 'var(--accent)',
      rental: currentRental
    };
  }

  const nextRental = rentals.find((rental) => rental.pickupDate > now);
  if (nextRental) {
    return {
      status: 'available',
      label: 'Available',
      badgeClass: 'badge-green',
      note: `Available for ${formatDuration(nextRental.pickupDate - now)}`,
      noteColor: 'var(--amber)',
      rental: nextRental
    };
  }

  return { status: 'available', label: 'Available', badgeClass: 'badge-green', note: 'No booking scheduled', noteColor: 'var(--green)' };
}

function formatMaintenanceWindow(bus) {
  if (bus?.status !== 'maintenance') return '';
  const start = formatDateTime(bus.maintenance_start);
  const end = formatDateTime(bus.maintenance_end);
  if (start && end) return `${start} - ${end}`;
  return 'Maintenance window not set';
}

function rowLabel(index) {
  let label = '';
  let value = index + 1;
  while (value > 0) {
    const mod = (value - 1) % 26;
    label = String.fromCharCode(65 + mod) + label;
    value = Math.floor((value - mod) / 26);
  }
  return label;
}

function generateSeatMap(rowsValue, columnsValue) {
  const rows = Math.max(1, Number(rowsValue || 1));
  const columns = Math.max(1, Number(columnsValue || 1));
  const cells = [];
  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      cells.push({
        row,
        column,
        type: 'seat',
        label: `${rowLabel(row - 1)}${column}`,
        color: '',
        note: ''
      });
    }
  }
  return { rows, columns, cells };
}

function normalizeSeatMap(layout, fallbackSeats = 1) {
  if (layout?.rows && layout?.columns && Array.isArray(layout?.cells)) return layout;
  return generateSeatMap(Math.max(1, Math.ceil(Number(fallbackSeats || 1) / 4)), 4);
}

function seatCount(layout) {
  return (layout?.cells || []).filter((cell) => cell.type === 'seat').length;
}

function cellTitle(cell) {
  if (cell.type === 'seat') return cell.label;
  if (cell.type === 'empty') return '';
  if (cell.type === 'bathroom') return 'WC';
  if (cell.type === 'driver') return 'DR';
  if (cell.type === 'door') return 'DO';
  return cell.label || 'Note';
}

function cellStyle(cell, selected) {
  const base = {
    width: 46,
    height: 40,
    borderRadius: 7,
    border: selected ? '1px solid var(--accent)' : '0.5px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--text-2)',
    background: 'var(--glass-strong)'
  };
  if (cell.type === 'seat') return { ...base, background: cell.color || 'var(--glass-strong)', color: cell.color ? '#fff' : 'var(--text-2)' };
  if (cell.type === 'empty') return { ...base, background: 'transparent', borderStyle: 'dashed', color: 'var(--text-3)' };
  if (cell.type === 'door') return { ...base, background: 'rgba(96,165,250,0.16)', color: 'var(--accent)' };
  if (cell.type === 'bathroom') return { ...base, background: 'rgba(167,139,250,0.16)', color: 'var(--purple)' };
  if (cell.type === 'driver') return { ...base, background: 'rgba(245,158,11,0.16)', color: 'var(--amber)' };
  return { ...base, background: 'rgba(255,255,255,0.07)' };
}

function hexToRgba(hex, alpha = 0.16) {
  const clean = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return EMPTY_COMPANY.theme_bg;
  const red = parseInt(clean.slice(0, 2), 16);
  const green = parseInt(clean.slice(2, 4), 16);
  const blue = parseInt(clean.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function BusModal({ form, companies, editing, saving, error, onChange, onSubmit, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 720 }}>
        <div className="modal-title">{editing ? 'Edit bus' : 'Add bus'}</div>
        <div className="modal-text">Manage a bus in the operator fleet.</div>

        {error ? <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{error}</div> : null}

        <div className="form-row">
          <select name="company_id" value={form.company_id} onChange={onChange}>
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <input name="name" placeholder="Bus name" value={form.name} onChange={onChange} />
        </div>
        <div className="form-row">
          <input name="type" placeholder="Type, e.g. VIP Sleeper" value={form.type} onChange={onChange} />
          <input name="plate_number" placeholder="Plate number" value={form.plate_number} onChange={onChange} />
        </div>
        <div className="form-row">
          <input name="total_seats" type="number" min="1" placeholder="Total seats" value={form.total_seats} onChange={onChange} />
          <select name="status" value={form.status} onChange={onChange}>
            {VEHICLE_STATUSES.map((status) => (
              <option key={status} value={status}>{titleCase(status)}</option>
            ))}
          </select>
        </div>
        {form.status === 'maintenance' ? (
          <div>
            <div className="form-row">
              <label style={{ display: 'grid', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                From when
                <input name="maintenance_start" type="datetime-local" value={form.maintenance_start || ''} onChange={onChange} />
              </label>
              <label style={{ display: 'grid', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                To when
                <input name="maintenance_end" type="datetime-local" value={form.maintenance_end || ''} onChange={onChange} />
              </label>
            </div>
            <div className="td-muted" style={{ fontSize: 12 }}>
              The bus will return to available after the maintenance end date passes.
            </div>
          </div>
        ) : null}

        <div className="modal-btns" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving || !companies.length}>
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Create bus'}
          </button>
        </div>
        {!companies.length ? <div className="td-muted" style={{ marginTop: 10, fontSize: 12 }}>Create a company before adding buses.</div> : null}
      </div>
    </div>
  );
}

function MaintenanceRecoveryModal({ conflict, buses, saving, error, onChange, onClose, onSubmit }) {
  const routes = conflict?.affected_routes || [];

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 860, textAlign: 'left' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">Resolve booked maintenance trips</div>
        <div className="modal-text" style={{ marginBottom: 18 }}>
          This maintenance window overlaps booked trips. Move every affected booking to an existing compatible route or create a backup route.
        </div>

        {error ? <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{error}</div> : null}

        <div style={{ display: 'grid', gap: 12, maxHeight: 460, overflow: 'auto' }}>
          {routes.map((route) => {
            const action = conflict.actions?.[route.id] || {};
            const mode = action.mode || 'existing';
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

                <div className="form-row">
                  <select value={mode} onChange={(event) => onChange(route.id, { mode: event.target.value })} disabled={saving}>
                    <option value="existing">Move to existing route</option>
                    <option value="backup">Create backup route</option>
                  </select>

                  {mode === 'existing' ? (
                    <select value={action.replacement_route_id || ''} onChange={(event) => onChange(route.id, { replacement_route_id: event.target.value })} disabled={saving}>
                      <option value="">Select compatible route</option>
                      {(route.recovery_options || []).map((option) => (
                        <option key={option.id} value={option.id}>
                          #{option.id} {option.bus_name} - {formatDateTime(option.departure_time)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select value={action.bus_id || ''} onChange={(event) => onChange(route.id, { bus_id: event.target.value })} disabled={saving}>
                      <option value="">Select backup bus</option>
                      {buses.filter((bus) => Number(bus.id) !== Number(route.bus_id)).map((bus) => (
                        <option key={bus.id} value={bus.id}>{bus.name} - {bus.type} ({bus.plate_number})</option>
                      ))}
                    </select>
                  )}
                </div>

                {mode === 'backup' ? (
                  <div className="form-row">
                    <label style={{ display: 'grid', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                      Backup departure
                      <input type="datetime-local" value={action.departure_time || toDateTimeInputValue(route.departure_time)} onChange={(event) => onChange(route.id, { departure_time: event.target.value })} disabled={saving} />
                    </label>
                    <label style={{ display: 'grid', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                      Backup arrival
                      <input type="datetime-local" value={action.arrival_time || toDateTimeInputValue(route.arrival_time)} onChange={(event) => onChange(route.id, { arrival_time: event.target.value })} disabled={saving} />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="modal-btns" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>{saving ? 'Saving...' : 'Resolve and save maintenance'}</button>
        </div>
      </div>
    </div>
  );
}

function SeatMapModal({ bus, initialData, saving, error, notice, onClose, onSave, onRefreshHistory }) {
  const initialLayout = normalizeSeatMap(initialData?.layout, bus?.total_seats);
  const [layout, setLayout] = useState(initialLayout);
  const [selectedKey, setSelectedKey] = useState(initialLayout.cells[0] ? `${initialLayout.cells[0].row}-${initialLayout.cells[0].column}` : '');
  const [rows, setRows] = useState(String(initialLayout.rows || 1));
  const [columns, setColumns] = useState(String(initialLayout.columns || 4));
  const [templateName, setTemplateName] = useState(bus?.seat_map_template_name || `${bus?.company_name || 'Bus'} ${bus?.type || ''} layout`.trim());
  const [mode, setMode] = useState('override');
  const [selectedTemplateId, setSelectedTemplateId] = useState(bus?.seat_map_template_id ? String(bus.seat_map_template_id) : '');
  const [previewTemplateId, setPreviewTemplateId] = useState('');
  const [templatePreviewDirty, setTemplatePreviewDirty] = useState(false);
  const [loadedHistoryName, setLoadedHistoryName] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  useEffect(() => {
    onRefreshHistory(Number(rows), Number(columns));
  }, [rows, columns, onRefreshHistory]);

  const selectedCell = layout.cells.find((cell) => `${cell.row}-${cell.column}` === selectedKey) || layout.cells[0];
  const currentSeatCount = seatCount(layout);
  const seatDelta = currentSeatCount - Number(bus?.total_seats || 0);

  function markTemplatePreviewEdited() {
    if (!previewTemplateId) return;
    setTemplatePreviewDirty(true);
    setLoadedHistoryName('Edited reusable template preview');
  }

  function duplicateTemplate(targetMode) {
    const nextName = String(templateName || '').trim().toLowerCase();
    if (!nextName) return null;
    return (initialData?.templates || []).find((item) => {
      const sameName = String(item.name || '').trim().toLowerCase() === nextName;
      const sameTemplate = String(item.id) === String(selectedTemplateId);
      return sameName && !(targetMode === 'update-template' && sameTemplate);
    }) || null;
  }

  function handleSaveClick() {
    const applyTemplateOnly = Boolean(previewTemplateId && !templatePreviewDirty && mode !== 'template');
    const duplicate = !applyTemplateOnly ? duplicateTemplate(mode) : null;
    if (duplicate) {
      setDuplicateWarning(`"${templateName}" already exists as a reusable template. Please rename this map before saving.`);
      return;
    }
    if (mode === 'update-template' && !selectedTemplateId) {
      setDuplicateWarning('Select a reusable template before using Update on this template.');
      return;
    }
    onSave({
      layout,
      templateName,
      saveAsTemplate: mode === 'template',
      updateTemplate: mode === 'update-template',
      templateId: selectedTemplateId,
      applyTemplateOnly
    });
  }

  function updateCell(updates) {
    if (!selectedCell) return;
    markTemplatePreviewEdited();
    setLayout((current) => ({
      ...current,
      cells: current.cells.map((cell) => {
        if (`${cell.row}-${cell.column}` !== selectedKey) return cell;
        const next = { ...cell, ...updates };
        if (updates.type && updates.type !== 'seat' && !next.label) next.label = '';
        if (updates.type === 'seat' && !next.label) next.label = `${rowLabel(cell.row - 1)}${cell.column}`;
        return next;
      })
    }));
  }

  function generateNew() {
    const next = generateSeatMap(Number(rows), Number(columns));
    setLayout(next);
    setSelectedKey(next.cells[0] ? `${next.cells[0].row}-${next.cells[0].column}` : '');
    setSelectedTemplateId('');
    setPreviewTemplateId('');
    setTemplatePreviewDirty(true);
    setMode('override');
    setLoadedHistoryName('');
  }

  function autoLabelSeats() {
    markTemplatePreviewEdited();
    setLayout((current) => ({
      ...current,
      cells: current.cells.map((cell) => cell.type === 'seat'
        ? { ...cell, label: `${rowLabel(cell.row - 1)}${cell.column}` }
        : cell)
    }));
  }

  function loadHistory(item) {
    const next = normalizeSeatMap(item.layout_json, bus?.total_seats);
    setLayout(next);
    setRows(String(next.rows));
    setColumns(String(next.columns));
    setSelectedKey(next.cells[0] ? `${next.cells[0].row}-${next.cells[0].column}` : '');
    setTemplateName(item.name || templateName);
    setSelectedTemplateId('');
    setPreviewTemplateId('');
    setTemplatePreviewDirty(true);
    setMode('template');
    setLoadedHistoryName(item.name || 'history layout');
  }

  function previewTemplate(templateId) {
    setSelectedTemplateId(templateId);
    const template = (initialData?.templates || []).find((item) => String(item.id) === String(templateId));
    if (!template) return;
    const next = normalizeSeatMap(template.layout_json, bus?.total_seats);
    setLayout(next);
    setRows(String(next.rows));
    setColumns(String(next.columns));
    setSelectedKey(next.cells[0] ? `${next.cells[0].row}-${next.cells[0].column}` : '');
    setTemplateName(template.name || templateName);
    setPreviewTemplateId(String(templateId));
    setTemplatePreviewDirty(false);
    setMode('override');
    setLoadedHistoryName(`template preview: ${template.name}`);
  }

  function changeRows(value) {
    setRows(value);
    if (selectedTemplateId) {
      setSelectedTemplateId('');
      setPreviewTemplateId('');
      setTemplatePreviewDirty(false);
      setLoadedHistoryName('');
    }
  }

  function changeColumns(value) {
    setColumns(value);
    if (selectedTemplateId) {
      setSelectedTemplateId('');
      setPreviewTemplateId('');
      setTemplatePreviewDirty(false);
      setLoadedHistoryName('');
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 1040, textAlign: 'left', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <div className="modal-title">Seat map</div>
            <div className="modal-sub">{bus?.company_name || 'Unknown company'} - {bus?.name} - {bus?.type}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
            <Icon d={icons.x} size={12} />
          </button>
        </div>

        {error ? <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{error}</div> : null}
        {notice ? <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--green)', background: 'var(--green-soft)' }}>{notice}</div> : null}

        <div className="form-row">
          <input type="number" min="1" max="30" placeholder="Rows" value={rows} onChange={(event) => changeRows(event.target.value)} />
          <input type="number" min="1" max="12" placeholder="Columns" value={columns} onChange={(event) => changeColumns(event.target.value)} />
          <button className="btn btn-ghost" type="button" onClick={generateNew}>New map</button>
          <button className="btn btn-ghost" type="button" onClick={autoLabelSeats}>Auto-label</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 280px', gap: 18, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="sec-title">Layout editor</div>
              <div className="td-muted">{currentSeatCount} bookable seats</div>
            </div>
            {seatDelta !== 0 ? (
              <div style={{ marginBottom: 12, padding: '9px 11px', borderRadius: 8, color: 'var(--amber)', background: 'rgba(245,158,11,0.12)', fontSize: 12 }}>
                Seat count will change from {bus?.total_seats || 0} to {currentSeatCount}.
              </div>
            ) : null}
            <div className="bus-shell" style={{ display: 'inline-block' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${layout.columns}, 46px)`,
                  gap: 8,
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {layout.cells.map((cell) => {
                  const key = `${cell.row}-${cell.column}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      style={cellStyle(cell, selectedKey === key)}
                      title={cell.note || cell.label || cell.type}
                      onClick={() => setSelectedKey(key)}
                    >
                      {cellTitle(cell)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="sec-title">Matching layouts from history</div>
              <div className="td-muted" style={{ marginBottom: 8 }}>Same rows and columns. Pick one, then save it for this bus or as a reusable template.</div>
              <div style={{ display: 'grid', gap: 8, maxHeight: 170, overflow: 'auto' }}>
                {(initialData?.history || []).map((item) => (
                  <button key={item.id} className="btn btn-ghost btn-sm" style={{ justifyContent: 'space-between', textAlign: 'left' }} onClick={() => loadHistory(item)}>
                    <span>
                      {item.name}
                      <span className="td-muted" style={{ display: 'block', fontSize: 10 }}>
                        {item.company_name || bus?.company_name || 'Unknown company'} - {item.vehicle_type}
                      </span>
                    </span>
                    <span className="td-muted">{item.seat_count} seats</span>
                  </button>
                ))}
                {!initialData?.history?.length ? <div className="td-muted">No matching history yet. Create a new map for these dimensions.</div> : null}
              </div>
            </div>
          </div>

          <div>
            <div className="sec-title">Cell details</div>
            {selectedCell ? (
              <>
                <select value={selectedCell.type} onChange={(event) => updateCell({ type: event.target.value })} style={{ marginBottom: 10 }}>
                  {SEAT_CELL_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
                <input value={selectedCell.label || ''} placeholder="Label" onChange={(event) => updateCell({ label: event.target.value })} style={{ marginBottom: 10 }} />
                <input type="color" value={selectedCell.color || '#4f8ef7'} onChange={(event) => updateCell({ color: event.target.value })} style={{ marginBottom: 10 }} />
                <textarea value={selectedCell.note || ''} placeholder="Note, e.g. near bathroom" onChange={(event) => updateCell({ note: event.target.value })} style={{ minHeight: 86 }} />
              </>
            ) : <div className="td-muted">Select a cell to edit.</div>}

            <div className="sec-title" style={{ marginTop: 18 }}>Reusable templates</div>
            {bus?.seat_map_template_name && !bus?.has_seat_map_override ? (
              <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, color: 'var(--green)', background: 'var(--green-soft)', fontSize: 12 }}>
                Using reusable template: {bus.seat_map_template_name}
              </div>
            ) : null}
            {bus?.has_seat_map_override ? (
              <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, color: 'var(--amber)', background: 'rgba(245,158,11,0.12)', fontSize: 12 }}>
                This bus has a custom override.
              </div>
            ) : null}
            <select
              value={selectedTemplateId}
              onChange={(event) => {
                const nextTemplateId = event.target.value;
                if (nextTemplateId) {
                  previewTemplate(nextTemplateId);
                } else {
                  setSelectedTemplateId('');
                  setLoadedHistoryName('');
                }
              }}
              disabled={saving}
              style={{ marginBottom: 10 }}
            >
              <option value="">No template selected</option>
              {(initialData?.templates || []).map((template) => (
                <option key={template.id} value={template.id}>{template.name} - {template.company_name || 'Any company'} - {template.vehicle_type} ({template.seat_count} seats)</option>
              ))}
            </select>
            <div className="td-muted" style={{ fontSize: 11 }}>
              Templates shown here match the current row and column inputs. Selecting one previews it only; click Save seat map to save it.
            </div>
            {loadedHistoryName ? (
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, color: 'var(--accent)', background: 'var(--accent-soft)', fontSize: 12 }}>
                {loadedHistoryName}. {previewTemplateId && !templatePreviewDirty ? 'Click Save seat map to apply this reusable template.' : 'Choose whether to update this bus only or save as a reusable template.'}
              </div>
            ) : null}

            <div className="sec-title" style={{ marginTop: 18 }}>Save map</div>
            <input value={templateName} placeholder="Template/history name" onChange={(event) => setTemplateName(event.target.value)} style={{ marginBottom: 10 }} />
            <select value={mode} onChange={(event) => setMode(event.target.value)} style={{ marginBottom: 10 }}>
              <option value="override">Save this bus only</option>
              <option value="template">Save as a reusable template</option>
              <option value="update-template" disabled={!selectedTemplateId}>Update on this template</option>
            </select>
            <button
              className="btn btn-primary btn-full"
              disabled={saving}
              onClick={handleSaveClick}
            >
              {saving ? 'Saving...' : 'Save seat map'}
            </button>
          </div>
        </div>

        {duplicateWarning ? (
          <div className="modal-overlay" style={{ position: 'fixed', background: 'rgba(0,0,0,0.32)' }} onClick={() => setDuplicateWarning('')}>
            <div className="modal-card" style={{ maxWidth: 420, textAlign: 'center' }} onClick={(event) => event.stopPropagation()}>
              <div className="modal-icon" style={{ background: 'rgba(245,158,11,0.16)', color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.35)' }}>
                <Icon d={icons.x} size={22} />
              </div>
              <div className="modal-title">Duplicate template name</div>
              <div className="modal-text">{duplicateWarning}</div>
              <div className="modal-btns">
                <button className="btn btn-primary" onClick={() => setDuplicateWarning('')}>Rename</button>
                <button className="btn btn-ghost" onClick={() => setDuplicateWarning('')}>Close</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CarModal({ form, editing, saving, error, onChange, onSubmit, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 760 }}>
        <div className="modal-title">{editing ? 'Edit rental car' : 'Add rental car'}</div>
        <div className="modal-text">Manage a rental vehicle and its public catalog details.</div>

        {error ? <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{error}</div> : null}

        <div className="form-row">
          <input name="name" placeholder="Car name" value={form.name} onChange={onChange} />
          <input name="type" placeholder="Type, e.g. SUV" value={form.type} onChange={onChange} />
        </div>
        <div className="form-row">
          <input name="plate_number" placeholder="Plate number" value={form.plate_number} onChange={onChange} />
          <input name="transmission" placeholder="Transmission, e.g. Auto" value={form.transmission} onChange={onChange} />
        </div>
        <div className="form-row">
          <input name="total_seats" type="number" min="1" placeholder="Total seats" value={form.total_seats} onChange={onChange} />
          <input name="daily_rate" type="number" min="0" step="0.01" placeholder="Daily rate" value={form.daily_rate} onChange={onChange} />
        </div>
        <div className="form-row">
          <select name="status" value={form.status} onChange={onChange}>
            {VEHICLE_STATUSES.map((status) => (
              <option key={status} value={status}>{titleCase(status)}</option>
            ))}
          </select>
        </div>
        <textarea
          name="photosText"
          placeholder="Photo URLs, one per line"
          value={form.photosText}
          onChange={onChange}
          style={{ minHeight: 96, marginTop: 10 }}
        />

        <div className="modal-btns" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Create rental car'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompanyModal({
  companies,
  form,
  editingId,
  saving,
  error,
  onChange,
  onSubmit,
  onEdit,
  onDelete,
  onCancelEdit,
  onClose
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 820 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div className="modal-title">Company management</div>
            <div className="modal-sub">Create, edit, and remove bus operators.</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
            <Icon d={icons.x} size={12} />
          </button>
        </div>

        {error ? <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{error}</div> : null}

        <div className="form-row">
          <input name="name" placeholder="Company name" value={form.name} onChange={onChange} />
          <input name="theme_color" type="color" value={form.theme_color} onChange={onChange} />
        </div>
        <input name="theme_bg" placeholder="Theme background, e.g. rgba(96,165,250,0.16)" value={form.theme_bg} onChange={onChange} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 18 }}>
          {editingId ? <button className="btn btn-ghost btn-sm" onClick={onCancelEdit} disabled={saving}>Cancel edit</button> : null}
          <button className="btn btn-primary btn-sm" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Save company' : 'Add company'}
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Color</th>
                <th>Buses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td style={{ fontWeight: 600 }}>{company.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', background: company.theme_color || getCompanyMeta(company.name).color }} />
                      <span className="td-muted">{company.theme_color || 'No color'}</span>
                    </div>
                  </td>
                  <td>{company.bus_count || 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(company)} disabled={saving}>
                        <Icon d={icons.edit} size={12} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(company)} disabled={saving || Number(company.bus_count || 0) > 0} title={Number(company.bus_count || 0) > 0 ? 'Company is assigned to buses' : 'Delete company'}>
                        <Icon d={icons.trash} size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!companies.length ? <tr><td colSpan={4} className="td-muted" style={{ padding: 18 }}>No companies found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ target, deleting, onClose, onConfirm }) {
  if (!target) return null;
  const labels = {
    bus: 'bus',
    car: 'rental car',
    company: 'company'
  };
  const label = labels[target.kind] || 'record';
  const name = target.item.name;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-icon" style={{ background: 'var(--red-soft)', color: 'var(--red)', borderColor: 'rgba(248,113,113,0.35)' }}>
          <Icon d={icons.trash} size={24} />
        </div>
        <div className="modal-title">Delete {label}?</div>
        <div className="modal-text">{name} will be removed permanently if it is not in use.</div>
        <div className="modal-btns">
          <button className="btn btn-ghost" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Vehicles() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = location.pathname === '/admin/vehicles/rental-cars' ? 'cars' : 'buses';
  const [buses, setBuses] = useState([]);
  const [cars, setCars] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busForm, setBusForm] = useState(EMPTY_BUS);
  const [carForm, setCarForm] = useState(EMPTY_CAR);
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY);
  const [editingBus, setEditingBus] = useState(null);
  const [editingCar, setEditingCar] = useState(null);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [busModalOpen, setBusModalOpen] = useState(false);
  const [carModalOpen, setCarModalOpen] = useState(false);
  const [vehicleError, setVehicleError] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [saving, setSaving] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [deletingTarget, setDeletingTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [seatMapBus, setSeatMapBus] = useState(null);
  const [seatMapData, setSeatMapData] = useState(null);
  const [seatMapLoading, setSeatMapLoading] = useState(false);
  const [seatMapError, setSeatMapError] = useState('');
  const [seatMapNotice, setSeatMapNotice] = useState('');
  const [maintenanceConflict, setMaintenanceConflict] = useState(null);
  const [maintenanceRecoveryError, setMaintenanceRecoveryError] = useState('');

  function setTab(nextTab) {
    navigate(nextTab === 'cars' ? '/admin/vehicles/rental-cars' : '/admin/vehicles/buses');
    setStatusFilter('all');
    setQuery('');
  }

  async function loadVehicles(showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      setPageError('');
      const data = await parseJsonResponse(await fetch('/api/admin/vehicles'));
      setBuses(data.buses || []);
      setCars(data.cars || []);
      setCompanies(data.companies || []);
    } catch (error) {
      setPageError(error.message || 'Unable to load vehicles.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  const filteredBuses = useMemo(() => {
    const term = query.trim().toLowerCase();
    return buses.filter((bus) => {
      const matchesStatus = statusFilter === 'all' || bus.status === statusFilter;
      const text = [bus.name, bus.type, bus.plate_number, bus.company_name, bus.status].join(' ').toLowerCase();
      return matchesStatus && (!term || text.includes(term));
    });
  }, [buses, query, statusFilter]);

  const filteredCars = useMemo(() => {
    const term = query.trim().toLowerCase();
    return cars.filter((car) => {
      const availability = getRentalCarAvailability(car);
      const matchesStatus = statusFilter === 'all' || availability.status === statusFilter;
      const text = [car.name, car.type, car.plate_number, car.transmission, car.status, availability.label, availability.note].join(' ').toLowerCase();
      return matchesStatus && (!term || text.includes(term));
    });
  }, [cars, query, statusFilter]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.observe-animate'));
    elements.forEach((el) => {
      if (!el.dataset.revealed) {
        el.dataset.revealed = 'true';
      }
    });
  }, [loading, tab, buses.length, cars.length, companies.length, filteredBuses.length, filteredCars.length, query, statusFilter]);

  function clearFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  function openCreateBus() {
    setEditingBus(null);
    setBusForm({ ...EMPTY_BUS, company_id: companies[0]?.id ? String(companies[0].id) : '' });
    setVehicleError('');
    setBusModalOpen(true);
  }

  function openEditBus(bus) {
    setEditingBus(bus);
    setBusForm({
      company_id: bus.company_id ? String(bus.company_id) : '',
      name: bus.name || '',
      type: bus.type || '',
      plate_number: bus.plate_number || '',
      total_seats: String(bus.total_seats || ''),
      status: bus.status || 'available',
      maintenance_start: toDateTimeInputValue(bus.maintenance_start),
      maintenance_end: toDateTimeInputValue(bus.maintenance_end)
    });
    setVehicleError('');
    setBusModalOpen(true);
  }

  async function openSeatMap(bus) {
    setSeatMapBus(bus);
    setSeatMapData(null);
    setSeatMapError('');
    setSeatMapNotice('');
    setSeatMapLoading(true);
    try {
      const data = await parseJsonResponse(await fetch(`/api/admin/buses/${bus.id}/seat-map`));
      setSeatMapData(data);
    } catch (error) {
      setSeatMapError(error.message || 'Unable to load seat map.');
    } finally {
      setSeatMapLoading(false);
    }
  }

  function openCreateCar() {
    setEditingCar(null);
    setCarForm(EMPTY_CAR);
    setVehicleError('');
    setCarModalOpen(true);
  }

  function openEditCar(car) {
    setEditingCar(car);
    setCarForm({
      name: car.name || '',
      type: car.type || '',
      plate_number: car.plate_number || '',
      total_seats: String(car.total_seats || ''),
      transmission: car.transmission || '',
      daily_rate: String(car.daily_rate || ''),
      status: car.status || 'available',
      photosText: Array.isArray(car.photos) ? car.photos.join('\n') : ''
    });
    setVehicleError('');
    setCarModalOpen(true);
  }

  function closeVehicleModal() {
    if (saving) return;
    setEditingBus(null);
    setEditingCar(null);
    setBusModalOpen(false);
    setCarModalOpen(false);
    setBusForm(EMPTY_BUS);
    setCarForm(EMPTY_CAR);
    setVehicleError('');
    setMaintenanceConflict(null);
    setMaintenanceRecoveryError('');
  }

  function handleBusChange(event) {
    const { name, value } = event.target;
    setBusForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'status' && value !== 'maintenance' ? { maintenance_start: '', maintenance_end: '' } : {})
    }));
  }

  function handleCarChange(event) {
    const { name, value } = event.target;
    setCarForm((current) => ({ ...current, [name]: value }));
  }

  function handleCompanyChange(event) {
    const { name, value } = event.target;
    setCompanyForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'theme_color' ? { theme_bg: hexToRgba(value) } : {})
    }));
  }

  async function saveBus(recoveryPlan = null) {
    const safeRecoveryPlan = recoveryPlan && !recoveryPlan.nativeEvent ? recoveryPlan : null;
    setSaving(true);
    setVehicleError('');
    setMaintenanceRecoveryError('');
    try {
      const endpoint = editingBus ? `/api/admin/buses/${editingBus.id}` : '/api/admin/buses';
      const method = editingBus ? 'PUT' : 'POST';
      const payload = safeRecoveryPlan
        ? { ...busForm, maintenance_recovery_plan: safeRecoveryPlan }
        : busForm;
      await parseJsonResponse(await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }));
      setEditingBus(null);
      setBusModalOpen(false);
      setBusForm(EMPTY_BUS);
      setMaintenanceConflict(null);
      await loadVehicles(false);
    } catch (error) {
      if (error.code === 'MAINTENANCE_BOOKING_CONFLICT') {
        setMaintenanceConflict({
          affected_routes: error.affected_routes || [],
          actions: {}
        });
        setMaintenanceRecoveryError('');
        return;
      }
      if (safeRecoveryPlan) {
        setMaintenanceRecoveryError(error.message || 'Unable to resolve maintenance bookings.');
        return;
      }
      setVehicleError(error.message || 'Unable to save bus.');
    } finally {
      setSaving(false);
    }
  }

  function updateMaintenanceAction(routeId, patch) {
    setMaintenanceConflict((current) => ({
      ...current,
      actions: {
        ...(current?.actions || {}),
        [routeId]: {
          ...(current?.actions?.[routeId] || { mode: 'existing' }),
          ...patch
        }
      }
    }));
  }

  async function submitMaintenanceRecovery() {
    if (!maintenanceConflict) return;
    const actions = (maintenanceConflict.affected_routes || []).map((route) => {
      const action = maintenanceConflict.actions?.[route.id] || { mode: 'existing' };
      return {
        route_id: route.id,
        mode: action.mode || 'existing',
        replacement_route_id: action.replacement_route_id ? Number(action.replacement_route_id) : undefined,
        bus_id: action.bus_id ? Number(action.bus_id) : undefined,
        departure_time: action.departure_time || toDateTimeInputValue(route.departure_time),
        arrival_time: action.arrival_time || toDateTimeInputValue(route.arrival_time)
      };
    });
    await saveBus({ actions });
  }

  async function saveCar() {
    setSaving(true);
    setVehicleError('');
    try {
      const endpoint = editingCar ? `/api/admin/rental-cars/${editingCar.id}` : '/api/admin/rental-cars';
      const method = editingCar ? 'PUT' : 'POST';
      const payload = {
        ...carForm,
        photos: carForm.photosText.split(/\r?\n/).map((url) => url.trim()).filter(Boolean)
      };
      await parseJsonResponse(await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }));
      setEditingCar(null);
      setCarModalOpen(false);
      setCarForm(EMPTY_CAR);
      await loadVehicles(false);
    } catch (error) {
      setVehicleError(error.message || 'Unable to save rental car.');
    } finally {
      setSaving(false);
    }
  }

  async function saveCompany() {
    setSaving(true);
    setCompanyError('');
    try {
      const endpoint = editingCompanyId ? `/api/admin/companies/${editingCompanyId}` : '/api/admin/companies';
      const method = editingCompanyId ? 'PUT' : 'POST';
      await parseJsonResponse(await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm)
      }));
      setEditingCompanyId(null);
      setCompanyForm(EMPTY_COMPANY);
      await loadVehicles(false);
    } catch (error) {
      setCompanyError(error.message || 'Unable to save company.');
    } finally {
      setSaving(false);
    }
  }

  function editCompany(company) {
    setEditingCompanyId(company.id);
    setCompanyForm({
      name: company.name || '',
      theme_color: company.theme_color || EMPTY_COMPANY.theme_color,
      theme_bg: company.theme_bg || EMPTY_COMPANY.theme_bg
    });
    setCompanyError('');
  }

  function cancelCompanyEdit() {
    setEditingCompanyId(null);
    setCompanyForm(EMPTY_COMPANY);
    setCompanyError('');
  }

  async function deleteSelected() {
    if (!deletingTarget) return;
    const endpoints = {
      bus: `/api/admin/buses/${deletingTarget.item.id}`,
      car: `/api/admin/rental-cars/${deletingTarget.item.id}`,
      company: `/api/admin/companies/${deletingTarget.item.id}`
    };

    setDeleting(true);
    setPageError('');
    setCompanyError('');
    try {
      await parseJsonResponse(await fetch(endpoints[deletingTarget.kind], { method: 'DELETE' }));
      setDeletingTarget(null);
      await loadVehicles(false);
    } catch (error) {
      if (deletingTarget.kind === 'company') {
        setCompanyError(error.message || 'Unable to delete company.');
      } else {
        setPageError(error.message || 'Unable to delete vehicle.');
      }
    } finally {
      setDeleting(false);
    }
  }

  const refreshSeatMapHistory = useCallback(async (rows, columns) => {
    if (!rows || !columns) return;
    try {
      const params = new URLSearchParams({
        rows: String(rows),
        columns: String(columns)
      });
      const [history, templates] = await Promise.all([
        parseJsonResponse(await fetch(`/api/admin/seat-map-history?${params.toString()}`)),
        parseJsonResponse(await fetch(`/api/admin/seat-map-templates?${params.toString()}`))
      ]);
      setSeatMapData((current) => current ? { ...current, history, templates } : current);
    } catch (error) {
      setSeatMapError(error.message || 'Unable to load matching seat maps.');
    }
  }, []);

  async function saveSeatMap({ layout, templateName, saveAsTemplate, updateTemplate, templateId, applyTemplateOnly }) {
    if (!seatMapBus) return;
    setSaving(true);
    setSeatMapError('');
    setSeatMapNotice('');
    try {
      if (updateTemplate) {
        const currentBus = seatMapData?.bus || seatMapBus;
        await parseJsonResponse(await fetch(`/api/admin/seat-map-templates/${templateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: currentBus.company_id,
            vehicle_type: currentBus.type,
            name: templateName,
            layout
          })
        }));
      }

      const payload = applyTemplateOnly
        ? {
            template_id: templateId ? Number(templateId) : null,
            use_template_only: true
          }
        : updateTemplate
          ? {
              template_id: templateId ? Number(templateId) : null,
              use_template_only: true
            }
        : {
            layout,
            template_name: templateName,
            save_as_template: saveAsTemplate,
            template_id: saveAsTemplate && templateId ? Number(templateId) : null
          };

      await parseJsonResponse(await fetch(`/api/admin/buses/${seatMapBus.id}/seat-map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }));
      const data = await parseJsonResponse(await fetch(`/api/admin/buses/${seatMapBus.id}/seat-map`));
      setSeatMapData(data);
      await loadVehicles(false);
      navigate('/admin/vehicles/buses', { replace: true });
      setSeatMapBus(null);
      setSeatMapData(null);
      setSeatMapNotice('');
      setSeatMapError('');
    } catch (error) {
      setSeatMapError(error.message || 'Unable to save seat map.');
    } finally {
      setSaving(false);
    }
  }

  const activeRows = tab === 'buses' ? filteredBuses : filteredCars;

  return (
    <div>
      <div className="page-header observe-animate" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Vehicles</div>
          <div className="page-sub">Manage fleet, rental cars, and bus companies</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCompanyModalOpen(true)}>
            <Icon d={icons.settings} size={13} /> Manage companies
          </button>
          <button className="btn btn-primary btn-sm" onClick={tab === 'buses' ? openCreateBus : openCreateCar}>
            <Icon d={icons.plus} size={13} color="#fff" /> {tab === 'buses' ? 'Add bus' : 'Add rental car'}
          </button>
        </div>
      </div>

      {pageError ? <div className="observe-animate" style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{pageError}</div> : null}

      <div className="pill-nav observe-animate" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['buses', 'cars'].map((nextTab) => (
            <div key={nextTab} className={`pill-tab ${tab === nextTab ? 'active' : ''}`} onClick={() => setTab(nextTab)}>
              {nextTab === 'buses' ? 'Buses' : 'Rental cars'}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {STATUS_TABS.map((status) => (
            <div key={status} className={`pill-tab ${statusFilter === status ? 'active' : ''}`} onClick={() => setStatusFilter(status)}>
              {status === 'all' ? 'All' : titleCase(status)}
            </div>
          ))}
          <div className="input-wrap" style={{ minWidth: 240 }}>
            <span className="search-icon"><Icon d={icons.search} size={13} /></span>
            <input className="search-input" placeholder="Search vehicles" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {(query || statusFilter !== 'all') ? (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <Icon d={icons.x} size={12} /> Clear
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="card observe-animate">
          <div className="sec-sub">Loading vehicles...</div>
        </div>
      ) : tab === 'buses' ? (
        <div className="card observe-animate">
          <div className="toolbar">
            <div className="sec-title">Bus fleet</div>
            <div className="toolbar-right">
              <button className="btn btn-ghost btn-sm" onClick={() => loadVehicles(false)} disabled={refreshing}>
                <Icon d={icons.clock} size={13} /> {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Company</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Plate</th>
                  <th>Seats</th>
                  <th>Seat map</th>
                  <th>Routes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuses.map((bus) => {
                  const companyName = bus.company_name || 'Unknown company';
                  const companyColor = bus.color || getCompanyMeta(companyName).color;
                  return (
                    <tr key={bus.id}>
                      <td style={{ color: 'var(--accent)', fontSize: 12 }}>#{bus.id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: companyColor }} />
                          <span style={{ color: companyColor }}>{companyName}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{bus.name}</td>
                      <td className="td-muted">{bus.type}</td>
                      <td className="td-muted">{bus.plate_number}</td>
                      <td className="td-muted">{bus.total_seats}</td>
                      <td className="td-muted">
                        {bus.has_seat_map_override
                          ? 'Custom'
                          : bus.seat_map_template_name || 'Fallback'}
                      </td>
                      <td>{bus.route_count || 0}</td>
                      <td>
                        <span className={`badge ${statusBadge(bus.status)}`}>{titleCase(bus.status)}</span>
                        {bus.status === 'maintenance' ? (
                          <div className="td-muted" style={{ fontSize: 11, marginTop: 5, maxWidth: 210 }}>
                            {formatMaintenanceWindow(bus)}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openSeatMap(bus)} title="Edit seat map">
                            <Icon d={icons.grid || icons.settings} size={12} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditBus(bus)}>
                            <Icon d={icons.edit} size={12} />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeletingTarget({ kind: 'bus', item: bus })} disabled={Number(bus.route_count || 0) > 0} title={Number(bus.route_count || 0) > 0 ? 'Bus is assigned to routes' : 'Delete bus'}>
                            <Icon d={icons.trash} size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!activeRows.length ? <tr><td colSpan={10} className="td-muted" style={{ padding: 18 }}>No buses found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="toolbar">
            <div className="sec-title">Rental cars</div>
            <div className="toolbar-right">
              <button className="btn btn-ghost btn-sm" onClick={() => loadVehicles(false)} disabled={refreshing}>
                <Icon d={icons.clock} size={13} /> {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="car-grid">
            {filteredCars.map((car, index) => {
              const photo = Array.isArray(car.photos) ? car.photos[0] : '';
              const availability = getRentalCarAvailability(car);
              return (
                <div key={car.id} className="car-card observe-animate" style={{ '--delay': `${index * 40}ms` }}>
                  <div className="car-img" style={photo ? { backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!photo ? <Icon d={icons.car} size={34} color="var(--text-2)" /> : null}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
                      <div className="car-name">{car.name}</div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge ${availability.badgeClass}`}>{availability.label}</span>
                        <div style={{ fontSize: 10.5, color: availability.noteColor, fontWeight: 700, marginTop: 4 }}>{availability.note}</div>
                      </div>
                    </div>
                    <div className="car-type">
                      {car.type} - {car.plate_number} - {car.total_seats} seats - {car.transmission || 'No transmission'}
                    </div>
                    {availability.rental ? (
                      <div className="td-muted" style={{ fontSize: 11, marginTop: 6 }}>
                        {availability.status === 'rented' ? 'Current' : 'Next'} rental #{availability.rental.id}
                        {availability.rental.customer_name ? ` - ${availability.rental.customer_name}` : ''}
                      </div>
                    ) : null}
                    <div className="car-meta">
                      <div className="car-price">
                        {formatMoney(car.daily_rate)}
                        <span>/day</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditCar(car)}>
                          <Icon d={icons.edit} size={12} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeletingTarget({ kind: 'car', item: car })} disabled={Number(car.rental_count || 0) > 0} title={Number(car.rental_count || 0) > 0 ? 'Car has rental records' : 'Delete rental car'}>
                          <Icon d={icons.trash} size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="td-muted" style={{ fontSize: 11, marginTop: 8 }}>{car.rental_count || 0} rental records</div>
                  </div>
                </div>
              );
            })}
          </div>
          {!filteredCars.length ? <div className="card observe-animate"><div className="sec-sub">No rental cars found.</div></div> : null}
        </div>
      )}

      {busModalOpen ? (
        <BusModal
          form={busForm}
          companies={companies}
          editing={Boolean(editingBus)}
          saving={saving}
          error={vehicleError}
          onChange={handleBusChange}
          onSubmit={saveBus}
          onClose={closeVehicleModal}
        />
      ) : null}
      {carModalOpen ? (
        <CarModal
          form={carForm}
          editing={Boolean(editingCar)}
          saving={saving}
          error={vehicleError}
          onChange={handleCarChange}
          onSubmit={saveCar}
          onClose={closeVehicleModal}
        />
      ) : null}

      {maintenanceConflict ? (
        <MaintenanceRecoveryModal
          conflict={maintenanceConflict}
          buses={buses}
          saving={saving}
          error={maintenanceRecoveryError}
          onChange={updateMaintenanceAction}
          onClose={() => {
            if (!saving) {
              setMaintenanceConflict(null);
              setMaintenanceRecoveryError('');
            }
          }}
          onSubmit={submitMaintenanceRecovery}
        />
      ) : null}

      {seatMapBus ? (
        seatMapLoading || !seatMapData ? (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-title">Seat map</div>
              <div className="modal-text">{seatMapError || 'Loading seat map...'}</div>
              <button className="btn btn-ghost" onClick={() => setSeatMapBus(null)}>Close</button>
            </div>
          </div>
        ) : (
          <SeatMapModal
            key={`${seatMapBus.id}-${seatMapData.bus?.seat_map_template_id || 'custom'}-${seatMapData.bus?.has_seat_map_override ? 'override' : 'template'}-${seatMapData.layout?.rows || 0}-${seatMapData.layout?.columns || 0}`}
            bus={seatMapData.bus || seatMapBus}
            initialData={seatMapData}
            saving={saving}
            error={seatMapError}
            notice={seatMapNotice}
            onClose={() => {
              if (!saving) {
                setSeatMapBus(null);
                setSeatMapData(null);
                setSeatMapError('');
                setSeatMapNotice('');
              }
            }}
            onSave={saveSeatMap}
            onRefreshHistory={refreshSeatMapHistory}
          />
        )
      ) : null}

      {companyModalOpen ? (
        <CompanyModal
          companies={companies}
          form={companyForm}
          editingId={editingCompanyId}
          saving={saving}
          error={companyError}
          onChange={handleCompanyChange}
          onSubmit={saveCompany}
          onEdit={editCompany}
          onDelete={(company) => setDeletingTarget({ kind: 'company', item: company })}
          onCancelEdit={cancelCompanyEdit}
          onClose={() => {
            if (!saving) {
              setCompanyModalOpen(false);
              cancelCompanyEdit();
            }
          }}
        />
      ) : null}

      <DeleteConfirmModal
        target={deletingTarget}
        deleting={deleting}
        onClose={() => !deleting && setDeletingTarget(null)}
        onConfirm={deleteSelected}
      />
    </div>
  );
}
