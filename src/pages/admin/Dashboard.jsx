import React, { useEffect, useMemo, useState } from 'react';
import { Icon, icons, getCompanyMeta } from '../../utils/sharedAdmin';

const EMPTY_DASHBOARD = {
  month: '',
  metrics: {
    total_bookings: 0,
    booking_count: 0,
    rental_count: 0,
    active_rentals: 0,
    total_revenue: 0,
    total_users: 0,
    new_users: 0
  },
  activity: [],
  recent_bookings: [],
  fleet: {
    buses: { available: 0, total: 0, percent: 0 },
    cars: { available: 0, total: 0, percent: 0 },
    routes: { active: 0, total: 0, percent: 0 }
  },
  top_customers: [],
  top_companies: []
};

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadge(status) {
  if (status === 'confirmed' || status === 'completed' || status === 'returned') return 'badge-green';
  if (status === 'pending') return 'badge-amber';
  return 'badge-red';
}

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join(' ');
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-val" style={{ color }}>{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="td-muted" style={{ padding: '12px 0' }}>{children}</div>;
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setPageError('');
    try {
      const data = await parseJsonResponse(await fetch('/api/admin/dashboard'));
      setDashboard({ ...EMPTY_DASHBOARD, ...data });
    } catch (error) {
      setPageError(error.message || 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.observe-animate'));
    elements.forEach((el) => {
      if (!el.dataset.revealed) {
        el.dataset.revealed = 'true';
      }
    });
  }, [loading, dashboard]);

  const metrics = dashboard.metrics || EMPTY_DASHBOARD.metrics;
  const activity = dashboard.activity || [];
  const fleet = dashboard.fleet || EMPTY_DASHBOARD.fleet;
  const maxActivity = Math.max(...activity.map((day) => Number(day.total_count || 0)), 1);
  const firstActivity = activity[0]?.label || '';
  const lastActivity = activity[activity.length - 1]?.label || '';
  const topCompanyMax = Math.max(...(dashboard.top_companies || []).map((company) => Number(company.count || 0)), 1);

  const metricCards = useMemo(() => ([
    {
      label: 'Total bookings',
      value: formatNumber(metrics.total_bookings),
      sub: `${formatNumber(metrics.total_bookings)} this month`,
      color: 'var(--accent)'
    },
    {
      label: 'Active rentals',
      value: formatNumber(metrics.active_rentals),
      sub: `${formatNumber(metrics.active_rentals)} confirmed now`,
      color: 'var(--green)'
    },
    {
      label: `Revenue (${dashboard.month || 'month'})`,
      value: formatMoney(metrics.total_revenue),
      sub: 'Current month',
      color: 'var(--purple)'
    },
    {
      label: 'Users',
      value: formatNumber(metrics.total_users),
      sub: `${formatNumber(metrics.new_users)} new this month`,
      color: 'var(--amber)'
    }
  ]), [dashboard.month, metrics]);

  const fleetCards = [
    {
      label: 'Buses available',
      value: `${formatNumber(fleet.buses?.available)}/${formatNumber(fleet.buses?.total)}`,
      percent: fleet.buses?.percent || 0,
      color: 'var(--accent)'
    },
    {
      label: 'Rental cars available',
      value: `${formatNumber(fleet.cars?.available)}/${formatNumber(fleet.cars?.total)}`,
      percent: fleet.cars?.percent || 0,
      color: 'var(--green)'
    },
    {
      label: 'Active routes',
      value: `${formatNumber(fleet.routes?.active)}/${formatNumber(fleet.routes?.total)}`,
      percent: fleet.routes?.percent || 0,
      color: 'var(--purple)'
    }
  ];

  return (
    <div>
      <div className="page-header observe-animate" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Live overview from bookings, rentals, fleet, and users</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadDashboard} disabled={loading}>
          <Icon d={icons.clock} size={13} /> {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {pageError ? (
        <div className="observe-animate" style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>{pageError}</span>
          <button className="btn btn-danger btn-sm" onClick={loadDashboard}>Retry</button>
        </div>
      ) : null}

      {loading ? (
        <div className="card observe-animate">
          <div className="sec-sub">Loading dashboard...</div>
        </div>
      ) : (
        <>
          <div className="metrics observe-animate">
            {metricCards.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>

          <div className="grid2">
            <div className="card observe-animate">
              <div className="sec-title">Booking activity - last 12 days</div>
              <div className="chart-scroll">
                <div className="chart-row chart-animate observe-animate">
                  {activity.map((day, index) => {
                    const height = Math.round((Number(day.total_count || 0) / maxActivity) * 100);
                    return (
                      <div
                        key={day.date}
                        className={`bar ${index === activity.length - 1 ? 'lit' : ''}`}
                        style={{ '--bar-h': `${height}%` }}
                        title={`${day.label}: ${formatNumber(day.total_count)} total`}
                      />
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{firstActivity}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{lastActivity}</span>
              </div>
            </div>

            <div className="card observe-animate">
              <div className="sec-title">Recent bookings</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Route</th>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard.recent_bookings || []).map((booking) => {
                      const companyName = booking.company_name || 'Unknown company';
                      const companyColor = booking.color || getCompanyMeta(companyName).color;
                      return (
                        <tr key={booking.id}>
                          <td style={{ color: 'var(--accent)', fontSize: 12 }}>#B-{booking.id}</td>
                          <td className="td-muted">{booking.origin} to {booking.destination}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: companyColor }} />
                              <span style={{ color: companyColor }}>{companyName}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${statusBadge(booking.status)}`}>
                              {titleCase(booking.status)}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{formatMoney(booking.total_price)}</td>
                        </tr>
                      );
                    })}
                    {!dashboard.recent_bookings?.length && (
                      <tr><td colSpan={5} className="td-muted" style={{ padding: 18 }}>No recent bookings found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid3">
            {fleetCards.map((item) => (
              <div key={item.label} className="card card-sm observe-animate">
                <div className="sec-title" style={{ marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: item.color, marginBottom: 4 }}>
                  {item.value}
                </div>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: `${item.percent}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid3" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="sec-title">Top customers</div>
              {(dashboard.top_customers || []).map((customer) => (
                <div key={customer.user_id || customer.email} className="stat-row">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{customer.user_name || 'Unknown user'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{customer.email || 'No email saved'}</div>
                  </div>
                  <span className="stat-val">{formatNumber(customer.trips)} trips</span>
                </div>
              ))}
              {!dashboard.top_customers?.length && <EmptyState>No customer activity this month.</EmptyState>}
            </div>

            <div className="card">
              <div className="sec-title">Top booking bus companies</div>
              {(dashboard.top_companies || []).map((company) => {
                const companyName = company.name || 'Unknown company';
                const companyColor = company.color || getCompanyMeta(companyName).color;
                const width = Math.round((Number(company.count || 0) / topCompanyMax) * 100);
                return (
                  <div key={companyName} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: companyColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: companyColor }} />
                        {companyName}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{formatNumber(company.count)}</span>
                    </div>
                    <div className="prog-track">
                      <div className="prog-fill" style={{ width: `${width}%`, background: companyColor }} />
                    </div>
                  </div>
                );
              })}
              {!dashboard.top_companies?.length && <EmptyState>No company bookings this month.</EmptyState>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
