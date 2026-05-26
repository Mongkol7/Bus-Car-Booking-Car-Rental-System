import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon, icons, setupScrollReveal } from '../../utils/sharedUser';

const emptyProfile = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  national_id: ''
};

function formatMemberSince(value) {
  if (!value) return 'Member';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Member';
  return `Member since ${date.getFullYear()}`;
}

function initials(profile) {
  const first = String(profile.first_name || '').trim()[0] || '';
  const last = String(profile.last_name || '').trim()[0] || '';
  return `${first}${last}`.toUpperCase() || 'U';
}

export default function Profile({
  role,
  onLogout
}) {
  const navigate = useNavigate();
  const { token, user, updateUser } = useAuth();
  const [profile, setProfile] = useState(emptyProfile);
  const [stats, setStats] = useState({
    total_trips: 0,
    total_rentals: 0,
    cancelled_tickets: 0,
    cancelled_rentals: 0,
    favourite_route: 'No trips yet'
  });
  const [loading, setLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const cleanup = setupScrollReveal({
      threshold: 0.05,
      rootMargin: '0px 0px 18% 0px'
    });
    return cleanup;
  }, [loading, profile, stats]);

  useEffect(() => {
    setProfile((current) => ({
      ...current,
      first_name: current.first_name || user?.first_name || '',
      last_name: current.last_name || user?.last_name || '',
      email: current.email || user?.email || '',
      phone: current.phone || user?.phone || ''
    }));
  }, [user]);

  async function loadProfile() {
    if (!token || role === 'guest') return;
    setLoading(true);
    setProfileError('');
    try {
      const response = await fetch('/api/my/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load profile.');
      setProfile({
        first_name: data.user?.first_name || '',
        last_name: data.user?.last_name || '',
        email: data.user?.email || '',
        phone: data.user?.phone || '',
        national_id: data.user?.national_id || '',
        created_at: data.user?.created_at,
        role: data.user?.role,
        role_label: data.user?.role_label,
        is_active: data.user?.is_active
      });
      setStats({
        total_trips: Number(data.stats?.total_trips || 0),
        total_rentals: Number(data.stats?.total_rentals || 0),
        cancelled_tickets: Number(data.stats?.cancelled_tickets || 0),
        cancelled_rentals: Number(data.stats?.cancelled_rentals || 0),
        favourite_route: data.stats?.favourite_route || 'No trips yet'
      });
      if (data.user) updateUser(data.user);
    } catch (error) {
      setProfileError(error.message || 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [token, role]);

  function updateProfileField(field, value) {
    setProfileStatus('');
    setProfileError('');
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile() {
    setSavingProfile(true);
    setProfileStatus('');
    setProfileError('');
    try {
      const response = await fetch('/api/my/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          phone: profile.phone,
          national_id: profile.national_id
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save profile.');
      setProfile((current) => ({ ...current, ...(data.user || {}) }));
      if (data.user) updateUser(data.user);
      setProfileStatus(data.message || 'Profile updated successfully.');
    } catch (error) {
      setProfileError(error.message || 'Unable to save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  function updatePasswordField(field, value) {
    setPasswordStatus('');
    setPasswordError('');
    setPasswordForm((current) => ({ ...current, [field]: value }));
  }

  async function savePassword() {
    setPasswordStatus('');
    setPasswordError('');
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/my/profile/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update password.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordStatus(data.message || 'Password updated successfully.');
    } catch (error) {
      setPasswordError(error.message || 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  }

  if (role === 'guest') return <div className="page" style={{ textAlign: 'center' }}>
    <div className="profile-avatar" style={{ opacity: 0.3 }}>?</div>
    <div className="page-title">Private Profile</div>
    <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/login')}>
      Sign in now
    </button>
  </div>;

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your account';
  const statRows = [
    { k: 'Total trips', v: stats.total_trips },
    { k: 'Total rentals', v: stats.total_rentals },
    { k: 'Cancelled tickets', v: stats.cancelled_tickets },
    { k: 'Cancelled rentals', v: stats.cancelled_rentals },
    { k: 'Favourite route', v: stats.favourite_route }
  ];

  return <div className="page" style={{ maxWidth: 520 }}>
    <div className="page-title scroll-animate">My profile</div>
    <div className="page-sub scroll-animate">Manage your DB account details</div>

    {loading ? <div className="card scroll-animate"><div className="page-sub">Loading profile...</div></div> : null}
    {profileError && !loading ? <div className="card scroll-animate" style={{ borderColor: 'rgba(248,113,113,0.35)', marginBottom: 16 }}>
      <div className="page-sub" style={{ color: 'var(--red)' }}>{profileError}</div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={loadProfile}>Try again</button>
    </div> : null}

    <div className="card scroll-animate" style={{ textAlign: 'center', marginBottom: 16, padding: '28px' }}>
      <div className="profile-avatar">{initials(profile)}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{fullName}</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>{profile.email || 'No email set'}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className={profile.is_active === false ? 'badge badge-red' : 'badge badge-green'}>
          {profile.is_active === false ? 'Inactive' : 'Verified'}
        </span>
        <span className="badge badge-blue">{formatMemberSince(profile.created_at)}</span>
        {profile.role_label || profile.role ? <span className="badge badge-purple">{profile.role_label || profile.role}</span> : null}
      </div>
    </div>

    <div className="card scroll-animate" style={{ marginBottom: 16 }}>
      <div className="sec-title">Personal information</div>
      {profileStatus ? <div style={{ marginBottom: 12, color: 'var(--green)', fontSize: 12 }}>{profileStatus}</div> : null}
      {profileError ? <div style={{ marginBottom: 12, color: 'var(--red)', fontSize: 12 }}>{profileError}</div> : null}
      <div className="form-row">
        <div>
          <div className="label">First name</div>
          <input value={profile.first_name || ''} onChange={(event) => updateProfileField('first_name', event.target.value)} />
        </div>
        <div>
          <div className="label">Last name</div>
          <input value={profile.last_name || ''} onChange={(event) => updateProfileField('last_name', event.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <div className="label">Email</div>
        <input type="email" value={profile.email || ''} onChange={(event) => updateProfileField('email', event.target.value)} />
      </div>
      <div className="form-group">
        <div className="label">Phone</div>
        <input value={profile.phone || ''} onChange={(event) => updateProfileField('phone', event.target.value)} />
      </div>
      <div className="form-group">
        <div className="label">National ID</div>
        <input value={profile.national_id || ''} onChange={(event) => updateProfileField('national_id', event.target.value)} />
      </div>
      <button className="btn btn-primary btn-sm" disabled={savingProfile} onClick={saveProfile}>
        <Icon d={icons.edit} size={13} color="#fff" /> {savingProfile ? 'Saving...' : 'Save changes'}
      </button>
    </div>

    <div className="card scroll-animate" style={{ marginBottom: 16 }}>
      <div className="sec-title">Change password</div>
      {passwordStatus ? <div style={{ marginBottom: 12, color: 'var(--green)', fontSize: 12 }}>{passwordStatus}</div> : null}
      {passwordError ? <div style={{ marginBottom: 12, color: 'var(--red)', fontSize: 12 }}>{passwordError}</div> : null}
      <div className="form-group">
        <div className="label">Current password</div>
        <input type="password" value={passwordForm.current_password} onChange={(event) => updatePasswordField('current_password', event.target.value)} />
      </div>
      <div className="form-group">
        <div className="label">New password</div>
        <input type="password" value={passwordForm.new_password} onChange={(event) => updatePasswordField('new_password', event.target.value)} />
      </div>
      <div className="form-group">
        <div className="label">Confirm new password</div>
        <input type="password" value={passwordForm.confirm_password} onChange={(event) => updatePasswordField('confirm_password', event.target.value)} />
      </div>
      <button className="btn btn-ghost btn-sm" disabled={savingPassword} onClick={savePassword}>
        {savingPassword ? 'Updating...' : 'Update password'}
      </button>
    </div>

    <div className="card scroll-animate">
      <div className="sec-title" style={{ marginBottom: 8 }}>Trip stats</div>
      {statRows.map((item) => <div key={item.k} style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '9px 0',
        borderBottom: '0.5px solid rgba(255,255,255,0.05)'
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{item.k}</span>
        <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{item.v}</span>
      </div>)}
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-red btn-sm" onClick={onLogout}>
          <Icon d={icons.logout} size={12} /> Sign out
        </button>
      </div>
    </div>
  </div>;
}
