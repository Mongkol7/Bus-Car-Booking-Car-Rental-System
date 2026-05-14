import { useEffect, useMemo, useState } from 'react';
import { Icon, icons, getCompanyMeta } from '../../utils/sharedAdmin';

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthOptions() {
  const now = new Date();
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      value,
      label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
  });
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function percent(value, max) {
  if (!max) return 0;
  return Math.max(4, Math.round((Number(value || 0) / max) * 100));
}

function exportReportCsv(report) {
  const rows = [
    ['Metric', 'Value'],
    ['Total revenue', report.metrics?.total_revenue || 0],
    ['Booking revenue', report.metrics?.booking_revenue || 0],
    ['Rental revenue', report.metrics?.rental_revenue || 0],
    ['Transactions', report.metrics?.transactions || 0],
    [],
    ['Date', 'Booking revenue', 'Rental revenue'],
    ...(report.daily || []).map((day) => [day.date, day.booking_revenue, day.rental_revenue])
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `admin-report-${report.month || 'month'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ProgressList({ title, rows, getLabel, getValue, getColor }) {
  const max = Math.max(0, ...rows.map((row) => Number(getValue(row) || 0)));
  return (
    <div className="card observe-animate">
      <div className="sec-title">{title}</div>
      {rows.length ? rows.map((row, index) => {
        const color = getColor ? getColor(row) : 'var(--accent)';
        return (
          <div key={`${title}-${index}`} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
              <span style={{ fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                {getLabel(row)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{getValue(row)}</span>
            </div>
            <div className="prog-track">
              <div className="prog-fill" style={{ width: `${percent(getValue(row), max)}%`, background: color }} />
            </div>
          </div>
        );
      }) : <div className="td-muted">No data for this month.</div>}
    </div>
  );
}

export default function Reports() {
  const [month, setMonth] = useState(currentMonthKey());
  const [report, setReport] = useState({
    metrics: {},
    daily: [],
    top_routes: [],
    top_cars: [],
    top_companies: [],
    top_customers: [],
    payment_mix: []
  });
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    loadReport();
  }, [month]);

  async function loadReport() {
    setLoading(true);
    try {
      setPageError('');
      const data = await parseJsonResponse(await fetch(`/api/admin/reports?month=${month}`));
      setReport(data);
    } catch (error) {
      setPageError(error.message || 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }

  const maxBooking = useMemo(() => Math.max(0, ...(report.daily || []).map((day) => Number(day.booking_revenue || 0))), [report.daily]);
  const maxRental = useMemo(() => Math.max(0, ...(report.daily || []).map((day) => Number(day.rental_revenue || 0))), [report.daily]);
  const paymentTotal = (report.payment_mix || []).reduce((sum, item) => sum + Number(item.count || 0), 0);

  return (
    <div>
      <div className="page-header observe-animate" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Revenue and usage analytics</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select style={{ width: 160, fontSize: 12 }} value={month} onChange={(event) => setMonth(event.target.value)}>
            {monthOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => exportReportCsv(report)}>
            <Icon d={icons.download} size={13} /> Export CSV
          </button>
        </div>
      </div>

      {pageError ? <div className="observe-animate" style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)' }}>{pageError}</div> : null}

      <div className="metrics observe-animate">
        {[
          { label: 'Total revenue', val: formatMoney(report.metrics?.total_revenue), sub: report.month || month, color: 'var(--accent)' },
          { label: 'Booking revenue', val: formatMoney(report.metrics?.booking_revenue), sub: 'from bus seats', color: 'var(--green)' },
          { label: 'Rental revenue', val: formatMoney(report.metrics?.rental_revenue), sub: 'from car rentals', color: 'var(--purple)' },
          { label: 'Transactions', val: report.metrics?.transactions || 0, sub: 'non-cancelled records', color: 'var(--amber)' }
        ].map((metric) => (
          <div key={metric.label} className="metric-card">
            <div className="metric-label">{metric.label}</div>
            <div className="metric-val" style={{ color: metric.color }}>{loading ? '...' : metric.val}</div>
            <div className="metric-sub">{metric.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="card observe-animate">
          <div className="sec-title">Booking revenue - daily</div>
          {loading ? <div className="sec-sub">Loading chart...</div> : (
            <>
              <div className="chart-row chart-animate observe-animate" style={{ height: 60 }}>
                {(report.daily || []).map((day, index) => (
                  <div key={day.date} className={`bar ${index === report.daily.length - 1 ? 'lit' : ''}`} style={{ '--bar-h': `${percent(day.booking_revenue, maxBooking)}%` }} title={`${day.label} • ${formatMoney(day.booking_revenue)}`} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{report.daily?.[0]?.label || 'No data'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{report.daily?.[report.daily.length - 1]?.label || ''}</span>
              </div>
            </>
          )}
        </div>
        <div className="card observe-animate">
          <div className="sec-title">Rental revenue - daily</div>
          {loading ? <div className="sec-sub">Loading chart...</div> : (
            <>
              <div className="chart-row chart-animate observe-animate" style={{ height: 60 }}>
                {(report.daily || []).map((day, index) => (
                  <div key={day.date} className={`bar ${index === report.daily.length - 1 ? 'lit' : ''}`} style={{ '--bar-h': `${percent(day.rental_revenue, maxRental)}%`, background: 'var(--purple-soft)', borderColor: 'rgba(167,139,250,0.35)' }} title={`${day.label} • ${formatMoney(day.rental_revenue)}`} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{report.daily?.[0]?.label || 'No data'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{report.daily?.[report.daily.length - 1]?.label || ''}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <ProgressList
          title="Top routes by bookings"
          rows={report.top_routes || []}
          getLabel={(row) => `${row.origin} -> ${row.destination}`}
          getValue={(row) => Number(row.count || 0)}
          getColor={() => 'var(--accent)'}
        />
        <ProgressList
          title="Top rental cars by bookings"
          rows={report.top_cars || []}
          getLabel={(row) => row.name}
          getValue={(row) => Number(row.count || 0)}
          getColor={() => 'var(--green)'}
        />
        <ProgressList
          title="Top booking bus companies"
          rows={report.top_companies || []}
          getLabel={(row) => row.name || 'Unassigned company'}
          getValue={(row) => Number(row.count || 0)}
          getColor={(row) => row.color || getCompanyMeta(row.name).color}
        />
        <ProgressList
          title="Top customers by spend"
          rows={report.top_customers || []}
          getLabel={(row) => row.user_name}
          getValue={(row) => Number(row.spend || 0)}
          getColor={() => 'var(--purple)'}
        />
        <div className="card observe-animate">
          <div className="sec-title">Payment mix</div>
          {(report.payment_mix || []).length ? report.payment_mix.map((payment) => {
            const pct = paymentTotal ? Math.round((Number(payment.count || 0) / paymentTotal) * 100) : 0;
            const color = payment.payment_method === 'aba' ? 'var(--accent)' : payment.payment_method === 'khqr' ? 'var(--green)' : 'var(--amber)';
            return (
              <div key={payment.payment_method || 'unknown'} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{String(payment.payment_method || 'unknown').toUpperCase()}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{pct}%</span>
                </div>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          }) : <div className="td-muted">No payments for this month.</div>}
        </div>
      </div>
    </div>
  );
}
