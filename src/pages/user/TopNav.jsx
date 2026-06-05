
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { useAuth } from '../../context/AuthContext';
import { Icon, icons, setupScrollReveal, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedUser';

function formatNotificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function notificationIcon(type) {
  const normalized = String(type || '');
  if (normalized.includes('refund')) return icons.qr || icons.bell;
  if (normalized.includes('rental') || normalized.includes('driver')) return icons.car;
  if (normalized.includes('cancel')) return icons.close || icons.ticket;
  return icons.bell;
}

function userInitials(user) {
  const first = String(user?.first_name || '').trim();
  const last = String(user?.last_name || '').trim();
  const email = String(user?.email || '').trim();
  const initials = `${first[0] || ''}${last[0] || ''}`.toUpperCase();
  if (initials) return initials;
  return (email[0] || '?').toUpperCase();
}

function notificationTargetUrl(notification) {
  if (notification?.action_url) {
    try {
      const action = new URL(notification.action_url, window.location.origin);
      if (notification?.id && !action.searchParams.has('notice')) action.searchParams.set('notice', String(notification.id));
      return `${action.pathname}${action.search}${action.hash}`;
    } catch (error) {
      return notification.action_url;
    }
  }
  const type = String(notification?.type || '');
  const baseTab = type.includes('rental') || type.includes('driver') || notification?.car_rental_id ? 'rentals' : 'trips';
  const params = new URLSearchParams({ tab: baseTab });

  if (baseTab === 'rentals' && notification?.car_rental_id) {
    params.set('rental', String(notification.car_rental_id));
  }

  if (baseTab === 'trips') {
    const ticketReference = notification?.booking_reference || notification?.metadata?.ticket_reference;
    if (ticketReference) params.set('ticket', String(ticketReference));
  }
  if (notification?.metadata?.refund_claim_id) params.set('refund', String(notification.metadata.refund_claim_id));

  if (notification?.id) params.set('notice', String(notification.id));
  return `/bookings?${params.toString()}`;
}

export default function TopNav({
  active,
  setActive,
  role,
  onLogout
}) {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  async function loadNotifications({ silent = false } = {}) {
    if (!token || role === 'guest') {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (!silent) setNotificationLoading(true);
    setNotificationError('');
    try {
      const response = await fetch('/api/my/notifications', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load notifications.');
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unread_count || 0));
    } catch (error) {
      setNotificationError(error.message || 'Unable to load notifications.');
    } finally {
      if (!silent) setNotificationLoading(false);
    }
  }

  useEffect(() => {
    if (!menuOpen && !notificationOpen) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setNotificationOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuOpen, notificationOpen]);

  useEffect(() => {
    if (!token || role === 'guest') return;
    loadNotifications();
    const refresh = () => loadNotifications({ silent: true });
    const intervalId = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [token, role]);

  const handleNavChange = id => {
    if (role === 'guest' && id === 'profile') {
      navigate('/login');
      return;
    }
    setActive(id);
  };

  async function markNotificationRead(notification) {
    if (!token || !notification?.id || notification.is_read) return;
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      await fetch(`/api/my/notifications/${notification.id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      await loadNotifications({ silent: true });
    }
  }

  async function markAllNotificationsRead() {
    if (!token) return;
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/my/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      await loadNotifications({ silent: true });
    }
  }

  function navigateFromNotification(notification) {
    const actionUrl = notificationTargetUrl(notification);
    if (actionUrl.startsWith('/bookings')) {
      setActive('bookings');
    }
    navigate(actionUrl);
    setNotificationOpen(false);
  }

  async function handleNotificationClick(notification) {
    await markNotificationRead(notification);
    navigateFromNotification(notification);
  }

  return <>
      <nav className="topnav">
        <div className="topnav-logo" style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center'
      }} onClick={() => {
        setActive('home');
        navigate('/');
      }}>
          Book<span className="logo-dot">.</span>
          <span className="logo-ride">Ride</span>
        </div>
        <div className="topnav-links">
          {NAV.map(n => <div key={n.id} className={`topnav-link ${active === n.id ? 'active' : ''}`} onClick={() => handleNavChange(n.id)}>
              <span className="topnav-icon">
                <Icon d={icons[n.icon]} size={14} />
              </span>
              {n.label}
            </div>)}
        </div>
        <div className="topnav-right" style={{
        position: 'relative'
      }} ref={menuRef}>
          {role === 'guest' ? <button className="login-btn" onClick={() => navigate('/login')}>
              Login
            </button> : <div style={{
          fontSize: 12,
          color: 'var(--text-2)'
        }}>Welcome</div>}
          {role !== 'guest' && <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Notifications"
            onClick={() => {
              setMenuOpen(false);
              setNotificationOpen((current) => !current);
              if (!notificationOpen) loadNotifications({ silent: true });
            }}
            style={{
              width: 34,
              height: 34,
              padding: 0,
              borderRadius: '50%',
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Icon d={icons.bell} size={15} />
            {unreadCount > 0 ? <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 17,
              height: 17,
              borderRadius: 999,
              background: 'var(--red)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '1px solid rgba(255,255,255,0.85)'
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span> : null}
          </button>}
          <div className="avatar-sm" onClick={() => {
          if (role !== 'guest') setMenuOpen(prev => !prev);
        }}>
            {role === 'guest' ? '?' : userInitials(user)}
          </div>
          {role !== 'guest' && notificationOpen ? <div style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 10px)',
            width: 'min(380px, calc(100vw - 24px))',
            maxHeight: '72vh',
            overflowY: 'auto',
            zIndex: 40,
            padding: 12,
            borderRadius: 16,
            border: '1px solid var(--glass-border)',
            background: 'rgba(18, 22, 30, 0.96)',
            boxShadow: '0 18px 55px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(18px)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Notifications</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  Operational alerts for trips and rentals
                </div>
              </div>
              {unreadCount > 0 ? <button className="btn btn-ghost btn-sm" type="button" onClick={markAllNotificationsRead}>
                Mark all read
              </button> : null}
            </div>

            {notificationError ? <div style={{
              marginBottom: 10,
              padding: 9,
              borderRadius: 10,
              color: 'var(--red)',
              background: 'rgba(248,113,113,0.10)',
              border: '1px solid rgba(248,113,113,0.25)',
              fontSize: 12
            }}>
              {notificationError}
            </div> : null}

            {notificationLoading ? <div className="page-sub" style={{ margin: 0, padding: 10 }}>
              Loading notifications...
            </div> : null}

            {!notificationLoading && !notifications.length ? <div style={{
              padding: 14,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-2)',
              fontSize: 12
            }}>
              No operational alerts right now.
            </div> : null}

            <div style={{ display: 'grid', gap: 8 }}>
              {notifications.map((notification) => {
                return <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: notification.is_read ? '1px solid var(--glass-border)' : '1px solid rgba(56,189,248,0.32)',
                    background: notification.is_read ? 'rgba(255,255,255,0.035)' : 'rgba(56,189,248,0.10)',
                    borderRadius: 12,
                    color: 'var(--text)',
                    padding: 10,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      flex: '0 0 auto'
                    }}>
                      <Icon d={notificationIcon(notification.type)} size={14} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5 }}>{notification.title || 'Notification'}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          {formatNotificationTime(notification.created_at)}
                        </span>
                      </span>
                      <span style={{ display: 'block', marginTop: 4, color: 'var(--text-2)', fontSize: 11.5, lineHeight: 1.45 }}>
                        {notification.message || 'Open your booking for details.'}
                      </span>
                    </span>
                    {!notification.is_read ? <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      marginTop: 4,
                      flex: '0 0 auto'
                    }} /> : null}
                  </div>
                </button>;
              })}
            </div>
          </div> : null}
          {role !== 'guest' && <div className={`user-menu ${menuOpen ? 'open' : ''}`}>
              <div className="user-menu-item" onClick={onLogout}>
                <Icon d={icons.logout} size={12} /> Logout
              </div>
            </div>}
        </div>
      </nav>
      <div className="bottomnav">
        {NAV.map(n => {
        const mobileLabel = {
          home: 'Home',
          search: 'Bus booking',
          cars: 'Car rental',
          bookings: 'My booking',
          profile: 'Profile'
        }[n.id] || n.label;
        return <div key={`bottom-${n.id}`} className={`bottomnav-link ${active === n.id ? 'active' : ''}`} onClick={() => handleNavChange(n.id)}>
              <span className="bottomnav-icon">
                <Icon d={icons[n.icon]} size={12} />
              </span>
              {mobileLabel}
            </div>;
      })}
      </div>
    </>;
}
