import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, icons, getCompanyMeta } from '../../utils/sharedAdmin';

const STATUS_TABS = ['all', 'available', 'rented', 'maintenance'];
const VEHICLE_STATUSES = ['available', 'rented', 'maintenance'];

const EMPTY_BUS = {
  company_id: '',
  name: '',
  type: '',
  plate_number: '',
  total_seats: '',
  status: 'available'
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
  if (!response.ok) throw new Error(data.error || 'Request failed.');
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
      const matchesStatus = statusFilter === 'all' || car.status === statusFilter;
      const text = [car.name, car.type, car.plate_number, car.transmission, car.status].join(' ').toLowerCase();
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
      status: bus.status || 'available'
    });
    setVehicleError('');
    setBusModalOpen(true);
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
  }

  function handleBusChange(event) {
    const { name, value } = event.target;
    setBusForm((current) => ({ ...current, [name]: value }));
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

  async function saveBus() {
    setSaving(true);
    setVehicleError('');
    try {
      const endpoint = editingBus ? `/api/admin/buses/${editingBus.id}` : '/api/admin/buses';
      const method = editingBus ? 'PUT' : 'POST';
      await parseJsonResponse(await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(busForm)
      }));
      setEditingBus(null);
      setBusModalOpen(false);
      setBusForm(EMPTY_BUS);
      await loadVehicles(false);
    } catch (error) {
      setVehicleError(error.message || 'Unable to save bus.');
    } finally {
      setSaving(false);
    }
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
                      <td>{bus.route_count || 0}</td>
                      <td><span className={`badge ${statusBadge(bus.status)}`}>{titleCase(bus.status)}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
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
                {!activeRows.length ? <tr><td colSpan={9} className="td-muted" style={{ padding: 18 }}>No buses found.</td></tr> : null}
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
              return (
                <div key={car.id} className="car-card observe-animate" style={{ '--delay': `${index * 40}ms` }}>
                  <div className="car-img" style={photo ? { backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!photo ? <Icon d={icons.car} size={34} color="var(--text-2)" /> : null}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
                      <div className="car-name">{car.name}</div>
                      <span className={`badge ${statusBadge(car.status)}`}>{titleCase(car.status)}</span>
                    </div>
                    <div className="car-type">
                      {car.type} - {car.plate_number} - {car.total_seats} seats - {car.transmission || 'No transmission'}
                    </div>
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
