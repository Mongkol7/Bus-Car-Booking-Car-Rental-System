import { useEffect, useMemo, useState } from 'react';
import { Icon, icons, getCompanyMeta } from '../../utils/sharedAdmin';

const REPORT_PROFILE = {
  companyName: 'BookRide Transport & Express',
  businessType: 'Passenger Bus Booking and Car Rental Operations',
  address: 'Phnom Penh, Kingdom of Cambodia',
  contact: 'Operations Administration Office',
  systemName: 'Bus Booking + Car Rental System'
};

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

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return 'No data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return 'No data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function reportMonthLabel(monthKey) {
  if (!monthKey) return 'Selected month';
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return String(monthKey);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function percent(value, max) {
  if (!max) return 0;
  return Math.max(4, Math.round((Number(value || 0) / max) * 100));
}

function csvEscape(cell) {
  return `"${String(cell ?? '').replace(/"/g, '""')}"`;
}

function addCsvSection(rows, title, headers, dataRows) {
  rows.push([], [title], headers, ...dataRows);
}

function exportReportCsv(report) {
  const summary = report.summary || {};
  const comparison = report.comparison || {};
  const details = report.details || {};
  const rows = [
    ['Admin report', report.month || ''],
    ['Previous month', comparison.month || ''],
    [],
    ['Metric', 'Value', 'Previous', 'Change', 'Change %'],
    ['Total revenue', report.metrics?.total_revenue || 0, comparison.total_revenue?.previous || 0, comparison.total_revenue?.change || 0, comparison.total_revenue?.percent || 0],
    ['Booking revenue', report.metrics?.booking_revenue || 0, comparison.booking_revenue?.previous || 0, comparison.booking_revenue?.change || 0, comparison.booking_revenue?.percent || 0],
    ['Rental revenue', report.metrics?.rental_revenue || 0, comparison.rental_revenue?.previous || 0, comparison.rental_revenue?.change || 0, comparison.rental_revenue?.percent || 0],
    ['Transactions', report.metrics?.transactions || 0, comparison.transactions?.previous || 0, comparison.transactions?.change || 0, comparison.transactions?.percent || 0],
    ['Average transaction value', summary.average_transaction_value || 0],
    ['Cancellation count', summary.cancellation_count || 0],
    ['Cancellation rate', summary.cancellation_rate || 0],
    ['Active customers', summary.active_customers || 0],
    ['New customers', summary.new_customers || 0],
    ['Best revenue day', summary.best_revenue_day?.date || '', summary.best_revenue_day?.revenue || 0]
  ];

  addCsvSection(rows, 'Daily revenue', ['Date', 'Booking revenue', 'Rental revenue', 'Total revenue'], (report.daily || []).map((day) => [
    day.date,
    day.booking_revenue,
    day.rental_revenue,
    Number(day.booking_revenue || 0) + Number(day.rental_revenue || 0)
  ]));
  addCsvSection(rows, 'Booking route details', ['Route', 'Company', 'Bookings', 'Revenue', 'Average fare', 'Cancelled', 'Cancellation rate'], (details.bookings || []).map((row) => [
    `${row.origin} to ${row.destination}`,
    row.company_name,
    row.count,
    row.revenue,
    row.average_fare,
    row.cancelled_count,
    row.cancellation_rate
  ]));
  addCsvSection(rows, 'Rental car details', ['Car', 'Type', 'Rentals', 'Revenue', 'Average rental value', 'Returned', 'Cancelled', 'Cancellation rate'], (details.rentals || []).map((row) => [
    row.name,
    row.type,
    row.count,
    row.revenue,
    row.average_rental_value,
    row.returned_count,
    row.cancelled_count,
    row.cancellation_rate
  ]));
  addCsvSection(rows, 'Customer details', ['Customer', 'Email', 'Spend', 'Transactions', 'Bookings', 'Rentals', 'Last activity'], (details.customers || []).map((row) => [
    row.user_name,
    row.email,
    row.spend,
    row.transaction_count,
    row.booking_count,
    row.rental_count,
    row.last_activity
  ]));
  addCsvSection(rows, 'Company details', ['Company', 'Bookings', 'Revenue'], (details.companies || report.top_companies || []).map((row) => [
    row.name || 'Unknown company',
    row.count,
    row.revenue
  ]));
  addCsvSection(rows, 'Payment mix', ['Payment method', 'Count', 'Revenue', 'Count share', 'Revenue share'], (details.payments || []).map((row) => [
    row.payment_method,
    row.count,
    row.revenue,
    row.count_share,
    row.revenue_share
  ]));

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `admin-report-${report.month || 'month'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function drawReportChrome(doc, generatedAt, report) {
  const pageCount = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(33, 50, 82);
    doc.setFillColor(33, 50, 82);
    doc.rect(0, 0, width, 52, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(REPORT_PROFILE.companyName, 42, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(REPORT_PROFILE.businessType, 42, 36);
    doc.text(`Report month: ${reportMonthLabel(report.month)}`, width - 42, 22, { align: 'right' });
    doc.text(`Generated: ${formatDateTime(generatedAt)}`, width - 42, 36, { align: 'right' });

    doc.setDrawColor(217, 226, 236);
    doc.line(42, height - 44, width - 42, height - 44);
    doc.setTextColor(91, 107, 127);
    doc.setFontSize(8);
    doc.text(`${REPORT_PROFILE.systemName} - Confidential internal report`, 42, height - 25);
    doc.text(`Page ${page} of ${pageCount}`, width - 42, height - 25, { align: 'right' });
  }
}

function addPdfSectionTitle(doc, title, startY) {
  const width = doc.internal.pageSize.getWidth();
  const bottomLimit = doc.internal.pageSize.getHeight() - 90;
  let y = startY;
  if (y > bottomLimit) {
    doc.addPage();
    y = 86;
  }
  doc.setDrawColor(33, 50, 82);
  doc.setFillColor(246, 248, 251);
  doc.roundedRect(42, y - 12, width - 84, 24, 4, 4, 'F');
  doc.setTextColor(33, 50, 82);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 52, y + 4);
  return y + 20;
}

function addPdfTable(doc, autoTable, title, headers, rows, startY, options = {}) {
  const y = addPdfSectionTitle(doc, title, startY);
  const body = rows.length ? rows : [headers.map((_, index) => (index === 0 ? 'No records for this period' : ''))];
  autoTable(doc, {
    head: [headers],
    body,
    startY: y,
    margin: { left: 42, right: 42, top: 72, bottom: 64 },
    styles: {
      font: 'helvetica',
      fontSize: options.fontSize || 8,
      cellPadding: 5,
      lineColor: [217, 226, 236],
      lineWidth: 0.4,
      textColor: [33, 50, 82],
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [33, 50, 82],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: options.columnStyles || {},
    didDrawPage: () => {},
    rowPageBreak: 'avoid'
  });
  return (doc.lastAutoTable?.finalY || y) + 18;
}

function addSignatureBlock(doc, startY) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  let y = startY;
  if (y > height - 220) {
    doc.addPage();
    y = 90;
  }

  y = addPdfSectionTitle(doc, 'Approval and Signature', y);
  const left = 42;
  const gap = 14;
  const boxWidth = (width - 84 - gap * 2) / 3;
  const labels = ['Prepared by', 'Checked by', 'Approved by / Owner'];

  labels.forEach((label, index) => {
    const x = left + index * (boxWidth + gap);
    doc.setDrawColor(186, 198, 213);
    doc.roundedRect(x, y, boxWidth, 84, 4, 4);
    doc.setTextColor(33, 50, 82);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, x + 10, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Name:', x + 10, y + 38);
    doc.line(x + 38, y + 39, x + boxWidth - 10, y + 39);
    doc.text('Signature:', x + 10, y + 58);
    doc.line(x + 55, y + 59, x + boxWidth - 10, y + 59);
    doc.text('Date:', x + 10, y + 76);
    doc.line(x + 34, y + 77, x + boxWidth - 10, y + 77);
  });

  doc.setDrawColor(186, 198, 213);
  doc.roundedRect(width - 176, y + 104, 134, 72, 4, 4);
  doc.setTextColor(91, 107, 127);
  doc.setFontSize(8);
  doc.text('Company stamp', width - 109, y + 142, { align: 'center' });
}

async function exportReportPdf(report) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  const autoTable = autoTableModule.default;
  const generatedAt = new Date();
  const summary = report.summary || {};
  const comparison = report.comparison || {};
  const details = report.details || {};
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  let y = 92;

  doc.setTextColor(33, 50, 82);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Transportation Operations Report', 42, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Revenue, booking, rental, customer, company, and payment performance', 42, y + 18);
  doc.setDrawColor(33, 50, 82);
  doc.line(42, y + 32, width - 42, y + 32);
  y += 58;

  autoTable(doc, {
    startY: y,
    margin: { left: 42, right: 42, top: 72, bottom: 64 },
    theme: 'plain',
    body: [
      ['Company / Operator', REPORT_PROFILE.companyName, 'Report Period', reportMonthLabel(report.month)],
      ['Business Type', REPORT_PROFILE.businessType, 'Previous Period', reportMonthLabel(comparison.month)],
      ['Address', REPORT_PROFILE.address, 'Prepared Date', formatDateTime(generatedAt)],
      ['Contact', REPORT_PROFILE.contact, 'Document Type', 'Internal management report']
    ],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: [33, 50, 82] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [246, 248, 251], cellWidth: 105 },
      1: { cellWidth: 165 },
      2: { fontStyle: 'bold', fillColor: [246, 248, 251], cellWidth: 95 },
      3: { cellWidth: 145 }
    }
  });
  y = (doc.lastAutoTable?.finalY || y) + 20;

  y = addPdfTable(doc, autoTable, 'Executive Summary', ['Item', 'Value', 'Note'], [
    ['Total revenue', formatMoney(report.metrics?.total_revenue), `${formatPercent(summary.revenue_source_split?.booking_percent)} booking / ${formatPercent(summary.revenue_source_split?.rental_percent)} rental`],
    ['Transactions', formatNumber(report.metrics?.transactions), 'Non-cancelled bus bookings and car rentals'],
    ['Average transaction value', formatMoney(summary.average_transaction_value), 'Total revenue divided by transactions'],
    ['Cancellation count', formatNumber(summary.cancellation_count), `${formatPercent(summary.cancellation_rate)} cancellation rate`],
    ['Active customers', formatNumber(summary.active_customers), `${formatNumber(summary.new_customers)} new users in period`],
    ['Best revenue day', formatMoney(summary.best_revenue_day?.revenue), summary.best_revenue_day?.date ? formatDate(summary.best_revenue_day.date) : 'No revenue yet']
  ], y);

  const comparisonRows = [
    ['Total revenue', formatMoney(report.metrics?.total_revenue), formatMoney(comparison.total_revenue?.previous), formatMoney(comparison.total_revenue?.change), formatPercent(comparison.total_revenue?.percent)],
    ['Booking revenue', formatMoney(report.metrics?.booking_revenue), formatMoney(comparison.booking_revenue?.previous), formatMoney(comparison.booking_revenue?.change), formatPercent(comparison.booking_revenue?.percent)],
    ['Rental revenue', formatMoney(report.metrics?.rental_revenue), formatMoney(comparison.rental_revenue?.previous), formatMoney(comparison.rental_revenue?.change), formatPercent(comparison.rental_revenue?.percent)],
    ['Transactions', formatNumber(report.metrics?.transactions), formatNumber(comparison.transactions?.previous), formatNumber(comparison.transactions?.change), formatPercent(comparison.transactions?.percent)]
  ];
  y = addPdfTable(doc, autoTable, 'Monthly KPI Comparison', ['Metric', 'Current', 'Previous', 'Change', 'Change %'], comparisonRows, y);

  y = addPdfTable(doc, autoTable, 'Daily Revenue', ['Date', 'Booking revenue', 'Rental revenue', 'Total revenue'], (report.daily || []).map((day) => [
    formatDate(day.date),
    formatMoney(day.booking_revenue),
    formatMoney(day.rental_revenue),
    formatMoney(Number(day.booking_revenue || 0) + Number(day.rental_revenue || 0))
  ]), y);

  y = addPdfTable(doc, autoTable, 'Bus Booking Route and Company Performance', ['Route', 'Company', 'Bookings', 'Revenue', 'Avg fare', 'Cancelled', 'Cancel rate'], (details.bookings || []).map((row) => [
    `${row.origin} to ${row.destination}`,
    row.company_name || 'Unknown company',
    formatNumber(row.count),
    formatMoney(row.revenue),
    formatMoney(row.average_fare),
    formatNumber(row.cancelled_count),
    formatPercent(row.cancellation_rate)
  ]), y, { fontSize: 7.5 });

  y = addPdfTable(doc, autoTable, 'Car Rental Performance', ['Car', 'Type', 'Rentals', 'Revenue', 'Avg rental', 'Returned', 'Cancelled', 'Cancel rate'], (details.rentals || []).map((row) => [
    row.name,
    row.type,
    formatNumber(row.count),
    formatMoney(row.revenue),
    formatMoney(row.average_rental_value),
    formatNumber(row.returned_count),
    formatNumber(row.cancelled_count),
    formatPercent(row.cancellation_rate)
  ]), y, { fontSize: 7.5 });

  y = addPdfTable(doc, autoTable, 'Customer Activity', ['Customer', 'Email', 'Spend', 'Transactions', 'Bookings', 'Rentals', 'Last activity'], (details.customers || []).map((row) => [
    row.user_name,
    row.email,
    formatMoney(row.spend),
    formatNumber(row.transaction_count),
    formatNumber(row.booking_count),
    formatNumber(row.rental_count),
    formatDate(row.last_activity)
  ]), y, { fontSize: 7.5 });

  y = addPdfTable(doc, autoTable, 'Payment Mix', ['Method', 'Count', 'Revenue', 'Count share', 'Revenue share'], (details.payments || []).map((row) => [
    String(row.payment_method || 'unknown').toUpperCase(),
    formatNumber(row.count),
    formatMoney(row.revenue),
    formatPercent(row.count_share),
    formatPercent(row.revenue_share)
  ]), y);

  y = addPdfTable(doc, autoTable, 'Company Performance', ['Company', 'Bookings', 'Revenue'], (details.companies || report.top_companies || []).map((row) => [
    row.name || 'Unknown company',
    formatNumber(row.count),
    formatMoney(row.revenue)
  ]), y);

  addSignatureBlock(doc, y);
  drawReportChrome(doc, generatedAt, report);
  doc.save(`admin-company-report-${report.month || 'month'}.pdf`);
}

function TrendBadge({ data }) {
  if (!data) return <span className="badge">No comparison</span>;
  const value = Number(data.percent || 0);
  const positive = value > 0;
  const negative = value < 0;
  const color = positive ? 'var(--green)' : negative ? 'var(--red)' : 'var(--text-3)';
  const bg = positive ? 'rgba(34,197,94,0.12)' : negative ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)';
  const sign = positive ? '+' : '';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 999, fontSize: 11, color, background: bg }}>
      {sign}{formatPercent(value)}
    </span>
  );
}

function MetricCard({ label, value, sub, color, trend, loading }) {
  return (
    <div className="metric-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div className="metric-label">{label}</div>
        {trend ? <TrendBadge data={trend} /> : null}
      </div>
      <div className="metric-val" style={{ color }}>{loading ? '...' : value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

function SummaryTile({ label, value, sub, color = 'var(--text-1)' }) {
  return (
    <div style={{ padding: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
      <div className="metric-label">{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color }}>{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

function Panel({ id, title, subtitle, openPanels, setOpenPanels, children }) {
  const isOpen = openPanels[id];
  return (
    <div className="card observe-animate" style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={() => setOpenPanels((current) => ({ ...current, [id]: !current[id] }))}
        style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', padding: 0, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', cursor: 'pointer', textAlign: 'left' }}
      >
        <div>
          <div className="sec-title">{title}</div>
          <div className="sec-sub">{subtitle}</div>
        </div>
        <span className="badge badge-blue" style={{ minWidth: 34, justifyContent: 'center' }}>{isOpen ? 'Hide' : 'Open'}</span>
      </button>
      {isOpen ? <div style={{ marginTop: 16 }}>{children}</div> : null}
    </div>
  );
}

function DetailTable({ columns, rows, emptyText }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id || `${columns[0]?.key}-${index}`}>
              {columns.map((column) => (
                <td key={column.key} className={column.muted ? 'td-muted' : ''}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="td-muted" style={{ padding: 18 }}>{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProgressRows({ rows, labelFor, valueFor, colorFor, emptyText }) {
  const max = Math.max(0, ...rows.map((row) => Number(valueFor(row) || 0)));
  return rows.length ? rows.map((row, index) => {
    const color = colorFor ? colorFor(row) : 'var(--accent)';
    return (
      <div key={`${labelFor(row)}-${index}`} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
          <span style={{ fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            {labelFor(row)}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{valueFor(row)}</span>
        </div>
        <div className="prog-track">
          <div className="prog-fill" style={{ width: `${percent(valueFor(row), max)}%`, background: color }} />
        </div>
      </div>
    );
  }) : <div className="td-muted">{emptyText}</div>;
}

export default function Reports() {
  const [month, setMonth] = useState(currentMonthKey());
  const [report, setReport] = useState({
    metrics: {},
    comparison: {},
    summary: {},
    daily: [],
    top_routes: [],
    top_cars: [],
    top_companies: [],
    top_customers: [],
    payment_mix: [],
    details: { bookings: [], rentals: [], customers: [], companies: [], payments: [] }
  });
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [openPanels, setOpenPanels] = useState({
    revenue: true,
    bookings: true,
    rentals: true,
    customers: false,
    companies: false,
    payments: false
  });

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

  const summary = report.summary || {};
  const details = report.details || {};
  const maxDailyRevenue = useMemo(
    () => Math.max(0, ...(report.daily || []).map((day) => Number(day.booking_revenue || 0) + Number(day.rental_revenue || 0))),
    [report.daily]
  );
  const bookingSplit = Number(summary.revenue_source_split?.booking_percent || 0);
  const rentalSplit = Number(summary.revenue_source_split?.rental_percent || 0);

  const metricCards = [
    { label: 'Total revenue', value: formatMoney(report.metrics?.total_revenue), sub: report.month || month, color: 'var(--accent)', trend: report.comparison?.total_revenue },
    { label: 'Booking revenue', value: formatMoney(report.metrics?.booking_revenue), sub: 'bus seats sold', color: 'var(--green)', trend: report.comparison?.booking_revenue },
    { label: 'Rental revenue', value: formatMoney(report.metrics?.rental_revenue), sub: 'car rentals', color: 'var(--purple)', trend: report.comparison?.rental_revenue },
    { label: 'Transactions', value: formatNumber(report.metrics?.transactions), sub: 'non-cancelled records', color: 'var(--amber)', trend: report.comparison?.transactions },
    { label: 'Average transaction', value: formatMoney(report.metrics?.average_transaction_value), sub: 'revenue per record', color: 'var(--text-1)' },
    { label: 'Cancellation rate', value: formatPercent(report.metrics?.cancellation_rate), sub: `${formatNumber(summary.cancellation_count)} cancelled`, color: 'var(--red)' }
  ];

  return (
    <div>
      <div className="page-header observe-animate" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Professional revenue, operations, customer, and payment analytics</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select style={{ width: 160, fontSize: 12 }} value={month} onChange={(event) => setMonth(event.target.value)}>
            {monthOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => exportReportPdf(report)} disabled={loading}>
            <Icon d={icons.download} size={13} /> Export PDF
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportReportCsv(report)}>
            <Icon d={icons.download} size={13} /> Export CSV
          </button>
        </div>
      </div>

      {pageError ? (
        <div className="observe-animate" style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: 'var(--red)', background: 'var(--red-soft)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <span>{pageError}</span>
          <button className="btn btn-ghost btn-sm" onClick={loadReport}>Retry</button>
        </div>
      ) : null}

      <div className="metrics observe-animate">
        {metricCards.map((metric) => <MetricCard key={metric.label} {...metric} loading={loading} />)}
      </div>

      <div className="card observe-animate" style={{ marginTop: 16 }}>
        <div className="sec-title">Executive summary</div>
        <div className="sec-sub">Selected month compared with {report.comparison?.month || 'previous month'}</div>
        <div className="grid2" style={{ marginTop: 14, gap: 12 }}>
          <SummaryTile label="Revenue split" value={`${formatPercent(bookingSplit)} booking / ${formatPercent(rentalSplit)} rental`} sub="gross revenue mix" color="var(--accent)" />
          <SummaryTile label="Average transaction value" value={formatMoney(summary.average_transaction_value)} sub="total revenue divided by transactions" color="var(--green)" />
          <SummaryTile label="Cancellation rate" value={formatPercent(summary.cancellation_rate)} sub={`${formatNumber(summary.cancellation_count)} cancelled records`} color="var(--red)" />
          <SummaryTile label="Customer activity" value={`${formatNumber(summary.active_customers)} active`} sub={`${formatNumber(summary.new_customers)} new users this month`} color="var(--purple)" />
          <SummaryTile label="Best revenue day" value={formatMoney(summary.best_revenue_day?.revenue)} sub={summary.best_revenue_day?.date ? formatDate(summary.best_revenue_day.date) : 'No revenue yet'} color="var(--amber)" />
        </div>
      </div>

      <Panel
        id="revenue"
        title="Revenue detail"
        subtitle="Daily revenue by bus bookings and rentals, with the best day highlighted."
        openPanels={openPanels}
        setOpenPanels={setOpenPanels}
      >
        {loading ? <div className="sec-sub">Loading chart...</div> : (
          <>
            <div className="chart-row chart-animate observe-animate" style={{ height: 92, alignItems: 'flex-end' }}>
              {(report.daily || []).map((day) => {
                const total = Number(day.booking_revenue || 0) + Number(day.rental_revenue || 0);
                const bookingHeight = percent(day.booking_revenue, maxDailyRevenue);
                const rentalHeight = percent(day.rental_revenue, maxDailyRevenue);
                return (
                  <div key={day.date} style={{ flex: 1, minWidth: 6, height: `${percent(total, maxDailyRevenue)}%`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2 }} title={`${day.label} - ${formatMoney(total)}`}>
                    <div className="bar lit" style={{ '--bar-h': `${rentalHeight}%`, height: `${rentalHeight}%`, background: 'var(--purple-soft)', borderColor: 'rgba(167,139,250,0.35)' }} />
                    <div className="bar" style={{ '--bar-h': `${bookingHeight}%`, height: `${bookingHeight}%` }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{report.daily?.[0]?.label || 'No data'}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{report.daily?.[report.daily.length - 1]?.label || ''}</span>
            </div>
            <DetailTable
              columns={[
                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                { key: 'booking_revenue', label: 'Booking revenue', render: (row) => formatMoney(row.booking_revenue) },
                { key: 'rental_revenue', label: 'Rental revenue', render: (row) => formatMoney(row.rental_revenue) },
                { key: 'total', label: 'Total', render: (row) => formatMoney(Number(row.booking_revenue || 0) + Number(row.rental_revenue || 0)) }
              ]}
              rows={report.daily || []}
              emptyText="No daily revenue for this month."
            />
          </>
        )}
      </Panel>

      <Panel
        id="bookings"
        title="Booking detail"
        subtitle="Route and company performance for bus bookings."
        openPanels={openPanels}
        setOpenPanels={setOpenPanels}
      >
        <DetailTable
          columns={[
            { key: 'route', label: 'Route', render: (row) => `${row.origin} to ${row.destination}` },
            { key: 'company_name', label: 'Company', render: (row) => {
              const color = row.color || getCompanyMeta(row.company_name).color;
              return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />{row.company_name}</span>;
            } },
            { key: 'count', label: 'Bookings', render: (row) => formatNumber(row.count) },
            { key: 'revenue', label: 'Revenue', render: (row) => formatMoney(row.revenue) },
            { key: 'average_fare', label: 'Avg fare', render: (row) => formatMoney(row.average_fare) },
            { key: 'cancelled_count', label: 'Cancelled', render: (row) => formatNumber(row.cancelled_count) },
            { key: 'cancellation_rate', label: 'Cancel rate', render: (row) => formatPercent(row.cancellation_rate) }
          ]}
          rows={details.bookings || []}
          emptyText="No booking route detail for this month."
        />
      </Panel>

      <Panel
        id="rentals"
        title="Rental detail"
        subtitle="Rental car performance and return/cancellation mix."
        openPanels={openPanels}
        setOpenPanels={setOpenPanels}
      >
        <DetailTable
          columns={[
            { key: 'name', label: 'Car' },
            { key: 'type', label: 'Type', muted: true },
            { key: 'count', label: 'Rentals', render: (row) => formatNumber(row.count) },
            { key: 'revenue', label: 'Revenue', render: (row) => formatMoney(row.revenue) },
            { key: 'average_rental_value', label: 'Avg rental', render: (row) => formatMoney(row.average_rental_value) },
            { key: 'returned_count', label: 'Returned', render: (row) => formatNumber(row.returned_count) },
            { key: 'cancelled_count', label: 'Cancelled', render: (row) => formatNumber(row.cancelled_count) },
            { key: 'cancellation_rate', label: 'Cancel rate', render: (row) => formatPercent(row.cancellation_rate) }
          ]}
          rows={details.rentals || []}
          emptyText="No rental car detail for this month."
        />
      </Panel>

      <Panel
        id="customers"
        title="Customer detail"
        subtitle="Top customers by spend across bus bookings and car rentals."
        openPanels={openPanels}
        setOpenPanels={setOpenPanels}
      >
        <DetailTable
          columns={[
            { key: 'user_name', label: 'Customer' },
            { key: 'email', label: 'Email', muted: true },
            { key: 'spend', label: 'Spend', render: (row) => formatMoney(row.spend) },
            { key: 'transaction_count', label: 'Transactions', render: (row) => formatNumber(row.transaction_count) },
            { key: 'booking_count', label: 'Bookings', render: (row) => formatNumber(row.booking_count) },
            { key: 'rental_count', label: 'Rentals', render: (row) => formatNumber(row.rental_count) },
            { key: 'last_activity', label: 'Last activity', render: (row) => formatDate(row.last_activity) }
          ]}
          rows={details.customers || []}
          emptyText="No customer activity for this month."
        />
      </Panel>

      <Panel
        id="companies"
        title="Company detail"
        subtitle="Bus company share by booking count and revenue."
        openPanels={openPanels}
        setOpenPanels={setOpenPanels}
      >
        <ProgressRows
          rows={details.companies || report.top_companies || []}
          labelFor={(row) => row.name || 'Unknown company'}
          valueFor={(row) => Number(row.revenue || 0)}
          colorFor={(row) => row.color || getCompanyMeta(row.name).color}
          emptyText="No company performance for this month."
        />
      </Panel>

      <Panel
        id="payments"
        title="Payment detail"
        subtitle="Payment method share by transaction count and revenue."
        openPanels={openPanels}
        setOpenPanels={setOpenPanels}
      >
        <DetailTable
          columns={[
            { key: 'payment_method', label: 'Method', render: (row) => String(row.payment_method || 'unknown').toUpperCase() },
            { key: 'count', label: 'Count', render: (row) => formatNumber(row.count) },
            { key: 'count_share', label: 'Count share', render: (row) => formatPercent(row.count_share) },
            { key: 'revenue', label: 'Revenue', render: (row) => formatMoney(row.revenue) },
            { key: 'revenue_share', label: 'Revenue share', render: (row) => formatPercent(row.revenue_share) }
          ]}
          rows={details.payments || []}
          emptyText="No payment activity for this month."
        />
      </Panel>
    </div>
  );
}
