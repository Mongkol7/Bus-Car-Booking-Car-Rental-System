import { useEffect, useMemo, useState } from 'react';
import { Icon, icons } from '../../utils/sharedAdmin';

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  national_id: '',
  role_id: '',
  password: '',
  password_label: ''
};

const EMPTY_ROLE_FORM = {
  name: '',
  label: '',
  description: ''
};

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return 'No activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function roleBadge(role) {
  return role === 'admin' ? 'badge-purple' : 'badge-blue';
}

function statusBadge(status) {
  return status === 'Active' ? 'badge-green' : 'badge-red';
}

function UserFormModal({ mode, form, formError, saving, roles, onChange, onSubmit, onClose }) {
  const isCreate = mode === 'create';

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div className="modal-title">{isCreate ? 'Add user' : 'Edit user'}</div>
            <div className="modal-sub">
              {isCreate ? 'Create a new system account' : 'Update details, role, or password'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
            <Icon d={icons.x} size={12} />
          </button>
        </div>

        {formError ? (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 8,
              color: 'var(--red)',
              background: 'var(--red-soft)'
            }}
          >
            {formError}
          </div>
        ) : null}

        <div className="form-row">
          <input
            name="first_name"
            placeholder="First name"
            value={form.first_name}
            onChange={onChange}
          />
          <input
            name="last_name"
            placeholder="Last name"
            value={form.last_name}
            onChange={onChange}
          />
        </div>
        <div className="form-row">
          <input name="email" placeholder="Email" value={form.email} onChange={onChange} />
          <input name="phone" placeholder="Phone" value={form.phone} onChange={onChange} />
        </div>
        <div className="form-row">
          <input
            name="national_id"
            placeholder="National ID"
            value={form.national_id}
            onChange={onChange}
          />
          <select name="role_id" value={form.role_id} onChange={onChange}>
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <input
            name="password"
            type="password"
            placeholder={isCreate ? 'Password' : 'New password (leave blank to keep same)'}
            value={form.password}
            onChange={onChange}
          />
          <div className="td-muted" style={{ alignSelf: 'center', fontSize: 12 }}>
            {isCreate
              ? 'New accounts are active automatically.'
              : `Current password: ${form.password_label || 'Password saved in database'}`}
          </div>
        </div>

        <div className="modal-btns" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : isCreate ? 'Create user' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleManagementModal({
  roles,
  form,
  editingRoleId,
  roleError,
  saving,
  deletingRoleId,
  onChange,
  onSubmit,
  onEdit,
  onDelete,
  onCancelEdit,
  onClose
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div className="modal-title">Role management</div>
            <div className="modal-sub">Create, rename, and remove account roles</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
            <Icon d={icons.x} size={12} />
          </button>
        </div>

        {roleError ? (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 8,
              color: 'var(--red)',
              background: 'var(--red-soft)'
            }}
          >
            {roleError}
          </div>
        ) : null}

        <div className="form-row">
          <input name="name" placeholder="Role name, e.g. manager" value={form.name} onChange={onChange} />
          <input name="label" placeholder="Display label, e.g. Manager" value={form.label} onChange={onChange} />
        </div>
        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={onChange}
          style={{ minHeight: 82, marginBottom: 14 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 18 }}>
          {editingRoleId ? (
            <button className="btn btn-ghost btn-sm" onClick={onCancelEdit} disabled={saving}>
              Cancel edit
            </button>
          ) : null}
          <button className="btn btn-primary btn-sm" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : editingRoleId ? 'Save role' : 'Add role'}
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Users</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{role.label}</div>
                    <div className="td-muted">{role.name}</div>
                  </td>
                  <td className="td-muted">{role.description || 'No description'}</td>
                  <td style={{ fontWeight: 600 }}>{role.user_count}</td>
                  <td>
                    <span className={`badge ${role.is_system ? 'badge-purple' : 'badge-blue'}`}>
                      {role.is_system ? 'System' : 'Custom'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(role)} disabled={saving}>
                        <Icon d={icons.edit} size={12} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(role)}
                        disabled={saving || deletingRoleId === role.id || !role.can_delete}
                      >
                        <Icon d={icons.trash} size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ user, deleting, onCancel, onConfirm }) {
  if (!user) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 460 }}>
        <div className="modal-title">Delete user?</div>
        <div className="modal-sub" style={{ marginBottom: 18 }}>
          {user.full_name} will be removed from the database. Related bookings, rentals, sessions, and transactions may be removed by database cascades.
        </div>
        <div className="modal-btns">
          <button className="btn btn-ghost" onClick={onCancel} disabled={deleting}>
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

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    newThisMonth: 0,
    totalActivity: 0
  });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [roleError, setRoleError] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      setPageError('');
      const data = await parseJsonResponse(await fetch('/api/admin/users'));
      setUsers(data.users || []);
      setRoles(data.roles || []);
      setStats(data.stats || {});
    } catch (error) {
      setPageError(error.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const searchable = [
        user.user_code,
        user.full_name,
        user.email,
        user.phone,
        user.national_id,
        user.role,
        user.role_label
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesStatus =
        statusFilter === 'all' || user.status.toLowerCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, users]);

  function openCreateModal() {
    setModalMode('create');
    const defaultRole = roles.find((role) => role.name === 'user') || roles[0];
    setForm({ ...EMPTY_FORM, role_id: defaultRole ? String(defaultRole.id) : '' });
    setFormError('');
  }

  function openAddRoleModal() {
    setRoleModalOpen(true);
    setRoleForm(EMPTY_ROLE_FORM);
    setEditingRoleId(null);
    setRoleError('');
  }

  function openEditModal(user) {
    setModalMode('edit');
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
      national_id: user.national_id || '',
      role_id: user.role_id ? String(user.role_id) : '',
      password: '',
      password_label: user.password_label || '',
      id: user.id
    });
    setFormError('');
  }

  function closeModal() {
    if (saving) return;
    setModalMode(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function validateForm() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || !form.phone.trim()) {
      return 'First name, last name, email, and phone are required.';
    }
    if (!form.role_id) {
      return 'Role is required.';
    }
    if (form.password && form.password.length < 3) {
      return 'Password must be at least 3 characters.';
    }
    if (modalMode === 'create' && !form.password) {
      return 'Password must be at least 3 characters.';
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
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        national_id: form.national_id,
        role_id: Number(form.role_id)
      };
      if (modalMode === 'create') {
        payload.password = form.password;
      } else if (form.password) {
        payload.password = form.password;
      }

      const endpoint = modalMode === 'edit' ? `/api/admin/users/${form.id}` : '/api/admin/users';
      const method = modalMode === 'edit' ? 'PUT' : 'POST';
      await parseJsonResponse(
        await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      );
      setModalMode(null);
      setForm(EMPTY_FORM);
      setFormError('');
      await loadUsers(false);
    } catch (error) {
      setFormError(error.message || 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingUser) return;
    setDeleting(true);
    setPageError('');

    try {
      await parseJsonResponse(
        await fetch(`/api/admin/users/${deletingUser.id}`, {
          method: 'DELETE'
        })
      );
      setDeletingUser(null);
      await loadUsers(false);
    } catch (error) {
      setPageError(error.message || 'Unable to delete user.');
    } finally {
      setDeleting(false);
    }
  }

  function handleRoleChange(event) {
    const { name, value } = event.target;
    setRoleForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function editRole(role) {
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name || '',
      label: role.label || '',
      description: role.description || ''
    });
    setRoleError('');
  }

  function cancelRoleEdit() {
    setEditingRoleId(null);
    setRoleForm(EMPTY_ROLE_FORM);
    setRoleError('');
  }

  async function submitRole() {
    if (!roleForm.name.trim() || !roleForm.label.trim()) {
      setRoleError('Role name and label are required.');
      return;
    }

    setRoleSaving(true);
    setRoleError('');

    try {
      const endpoint = editingRoleId ? `/api/admin/roles/${editingRoleId}` : '/api/admin/roles';
      const method = editingRoleId ? 'PUT' : 'POST';
      await parseJsonResponse(
        await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(roleForm)
        })
      );
      cancelRoleEdit();
      await loadUsers(false);
    } catch (error) {
      setRoleError(error.message || 'Unable to save role.');
    } finally {
      setRoleSaving(false);
    }
  }

  async function deleteRole(role) {
    if (!role.can_delete) return;
    setDeletingRoleId(role.id);
    setRoleError('');

    try {
      await parseJsonResponse(
        await fetch(`/api/admin/roles/${role.id}`, {
          method: 'DELETE'
        })
      );
      if (editingRoleId === role.id) {
        cancelRoleEdit();
      }
      await loadUsers(false);
    } catch (error) {
      setRoleError(error.message || 'Unable to delete role.');
    } finally {
      setDeletingRoleId(null);
    }
  }

  return (
    <div>
      <div
        className="page-header observe-animate"
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
      >
        <div>
          <div className="page-title">Users</div>
          <div className="page-sub">Manage accounts, roles, and customer activity</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={openAddRoleModal}>
            <Icon d={icons.plus} size={13} /> Add role
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
            <Icon d={icons.plus} size={13} color="#fff" /> Add user
          </button>
        </div>
      </div>

      <div className="metrics observe-animate">
        {[
          { label: 'Total users', val: stats.totalUsers || 0, sub: 'All roles', color: 'var(--accent)' },
          { label: 'Active users', val: stats.activeUsers || 0, sub: `${stats.inactiveUsers || 0} inactive`, color: 'var(--green)' },
          { label: 'New this month', val: stats.newThisMonth || 0, sub: 'Recently joined', color: 'var(--purple)' },
          { label: 'Total activity', val: stats.totalActivity || 0, sub: 'Bookings and rentals', color: 'var(--amber)' }
        ].map((metric) => (
          <div key={metric.label} className="metric-card">
            <div className="metric-label">{metric.label}</div>
            <div className="metric-val" style={{ color: metric.color }}>
              {metric.val}
            </div>
            <div className="metric-sub">{metric.sub}</div>
          </div>
        ))}
      </div>

      {pageError ? (
        <div
          className="observe-animate"
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            color: 'var(--red)',
            background: 'var(--red-soft)'
          }}
        >
          {pageError}
        </div>
      ) : null}

      <div
        className="pill-nav observe-animate"
        style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'inactive', label: 'Inactive' }
          ].map((status) => (
            <div
              key={status.id}
              className={`pill-tab ${statusFilter === status.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(status.id)}
            >
              {status.label}
            </div>
          ))}
        </div>
        <div className="input-wrap" style={{ minWidth: 240, width: '34%' }}>
          <span className="search-icon">
            <Icon d={icons.search} size={13} />
          </span>
          <input
            className="search-input"
            placeholder="Search users, role, phone"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="card observe-animate">
        {loading ? (
          <div className="sec-sub">Loading users...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Activity</th>
                  <th>Total spent</th>
                  <th>Last activity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                      <div className="td-muted">{user.user_code}</div>
                    </td>
                    <td className="td-muted">{user.email}</td>
                    <td className="td-muted">{user.phone}</td>
                    <td>
                      <span className={`badge ${roleBadge(user.role)}`}>{user.role_label || user.role}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{user.total_activity_count}</td>
                    <td className="td-muted">{formatCurrency(user.total_spent)}</td>
                    <td className="td-muted">{formatDate(user.last_activity_at)}</td>
                    <td>
                      <span className={`badge ${statusBadge(user.status)}`}>{user.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(user)}>
                          <Icon d={icons.edit} size={12} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeletingUser(user)}
                        >
                          <Icon d={icons.trash} size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredUsers.length && (
                  <tr>
                    <td colSpan={9} className="td-muted" style={{ padding: 18 }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalMode ? (
        <UserFormModal
          mode={modalMode}
          form={form}
          formError={formError}
          saving={saving}
          roles={roles}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      ) : null}
      {roleModalOpen ? (
        <RoleManagementModal
          roles={roles}
          form={roleForm}
          editingRoleId={editingRoleId}
          roleError={roleError}
          saving={roleSaving}
          deletingRoleId={deletingRoleId}
          onChange={handleRoleChange}
          onSubmit={submitRole}
          onEdit={editRole}
          onDelete={deleteRole}
          onCancelEdit={cancelRoleEdit}
          onClose={() => {
            setRoleModalOpen(false);
            cancelRoleEdit();
          }}
        />
      ) : null}
      <DeleteModal
        user={deletingUser}
        deleting={deleting}
        onCancel={() => setDeletingUser(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
