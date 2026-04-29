import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

// ── PDF Export ────────────────────────────────────────────────
async function exportToPDF(filtered, filter, dateFrom, dateTo) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(13, 26, 58);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('National Finance House — Visitor Tracking System', 14, 10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Audit & Access Logs', 14, 17);

  doc.setTextColor(100, 110, 130);
  doc.setFontSize(9);
  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let meta = `Exported: ${now}  ·  ${filtered.length} entries`;
  if (filter !== 'all') meta += `  ·  Filter: ${filter.toUpperCase()}`;
  if (dateFrom)          meta += `  ·  From: ${dateFrom}`;
  if (dateTo)            meta += `  ·  To: ${dateTo}`;
  doc.text(meta, 14, 29);

  const rows = filtered.map(l => [
    new Date(l.performed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    l.staff_name   || '—',
    l.action       || '—',
    l.visitor_name || '—',
    l.visitor_cpr  || '—',
  ]);

  const actionColors = {
    CHECKIN:       [63, 185, 80],
    CHECKOUT:      [240, 160, 52],
    LOGIN:         [56, 139, 253],
    LOGOUT:        [139, 92, 246],
    ACCESS_DENIED: [248, 81, 73],
    CREATE_USER:   [56, 139, 253],
    CARD_SKIP:     [240, 160, 52],
    CARD_ISSUE_REPORT: [248, 81, 73],
  };

  doc.autoTable({
    head: [['Date & Time', 'Staff', 'Action', 'Visitor Name', 'CPR Number']],
    body: rows,
    startY: 33,
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 35, 45] },
    headStyles: { fillColor: [26, 58, 110], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 45 }, 2: { cellWidth: 38 }, 3: { cellWidth: 65 }, 4: { cellWidth: 35 } },
    willDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const c = actionColors[data.cell.raw];
        if (c) {
          data.cell.styles.textColor = c;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${data.pageNumber}`, pageW - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
    },
  });

  doc.save(`VTS_Logs_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Excel Export ─────────────────────────────────────────────
async function exportToExcel(filtered) {
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const rows = filtered.map(l => ({
    "Date & Time": new Date(l.performed_at).toLocaleString('en-GB'),
    "Staff": l.staff_name || '—',
    "Action": l.action || '—',
    "Visitor Name": l.visitor_name || '—',
    "CPR Number": l.visitor_cpr || '—'
  }));

  const worksheet = window.XLSX.utils.json_to_sheet(rows);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "VTS Logs");

  // Auto-fit columns
  const wscols = [
    {wch: 20}, // Date
    {wch: 20}, // Staff
    {wch: 15}, // Action
    {wch: 25}, // Visitor
    {wch: 15}  // CPR
  ];
  worksheet['!cols'] = wscols;

  window.XLSX.writeFile(workbook, `VTS_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const actionColor = {
  LOGIN:             'badge-blue',
  LOGOUT:            'badge-purple',
  CHECKIN:           'badge-green',
  CHECKOUT:          'badge-amber',
  ACCESS_DENIED:     'badge-red',
  CREATE_USER:       'badge-blue',
  CARD_SKIP:         'badge-amber',
  CARD_ISSUE_REPORT: 'badge-red',
};

export default function Logs() {
  const { user } = useAuth();
  const [logs,      setLogs]     = useState([]);
  const [filtered,  setFiltered] = useState([]);
  const [filter,    setFilter]   = useState('all');
  const [search,    setSearch]   = useState('');
  const [dateFrom,  setDateFrom] = useState('');
  const [dateTo,    setDateTo]   = useState('');
  const [selected,  setSelected] = useState(null);
  const [loading,   setLoading]  = useState(true);
  const [exporting, setExporting]= useState(false);

  useEffect(() => {
    api.get('/dashboard/activity').then(r => {
      setLogs(r.data);
      setFiltered(r.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let result = [...logs];
    const isAdmin = user?.role === 'admin' || user?.role === 'manager';

    if (!isAdmin) {
      result = result.filter(l => l.action === 'CHECKIN' || l.action === 'CHECKOUT');
    }

    if (filter !== 'all') {
      const map = { checkin: 'CHECKIN', checkout: 'CHECKOUT', login: 'LOGIN', logout: 'LOGOUT' };
      result = result.filter(l => l.action === map[filter]);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        (l.visitor_name || '').toLowerCase().includes(q) ||
        (l.visitor_cpr  || '').includes(q)               ||
        (l.staff_name   || '').toLowerCase().includes(q) ||
        (l.action       || '').toLowerCase().includes(q)
      );
    }
    if (dateFrom) result = result.filter(l => new Date(l.performed_at) >= new Date(dateFrom));
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
      result = result.filter(l => new Date(l.performed_at) <= end);
    }
    setFiltered(result);
  }, [logs, filter, search, dateFrom, dateTo, user]);

  function clearFilters() { setFilter('all'); setSearch(''); setDateFrom(''); setDateTo(''); }

  async function handleExportPDF() {
    setExporting(true);
    try { await exportToPDF(filtered, filter, dateFrom, dateTo); }
    catch (e) { alert('PDF export failed: ' + e.message); }
    setExporting(false);
  }

  async function handleExportExcel() {
    setExporting(true);
    try { await exportToExcel(filtered); }
    catch (e) { alert('Excel export failed: ' + e.message); }
    setExporting(false);
  }

  const inputStyle = {
    background: 'var(--panel2)', border: '1px solid var(--border2)',
    borderRadius: 7, padding: '7px 12px', fontSize: 13,
    color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none',
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div style={{ padding: 24 }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Audit & Access Logs</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
            {filtered.length} of {logs.length} entries
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleExportExcel}
            disabled={exporting || filtered.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: exporting || filtered.length === 0 ? 'not-allowed' : 'pointer', background: exporting ? 'var(--panel2)' : 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.3)', color: exporting ? 'var(--dim)' : 'var(--green)', fontWeight: 600 }}
          >
            {exporting ? '⏳...' : '📊 Excel'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || filtered.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: exporting || filtered.length === 0 ? 'not-allowed' : 'pointer', background: exporting ? 'var(--panel2)' : 'rgba(56,139,253,.12)', border: '1px solid rgba(56,139,253,.3)', color: exporting ? 'var(--dim)' : 'var(--blue)', fontWeight: 600 }}
          >
            {exporting ? '⏳...' : '📄 PDF'}
          </button>
        </div>
      </div>

      {/* Rest of the component (Filters, Table, LogDetail) remains exactly the same as your provided code */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }}>🔍</span>
          <input type="text" placeholder="Search visitor name, CPR, staff name or action…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 36 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['all','All Events'],['checkin','✅ Check-In'],['checkout','🔙 Check-Out']].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '5px 14px', borderRadius: 100, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border2)', background: filter === f ? 'rgba(56,139,253,.12)' : 'transparent', color: filter === f ? 'var(--blue)' : 'var(--dim)' }}>
              {label}
            </button>
          ))}
          {isAdmin && (
            <>
              <button onClick={() => setFilter('login')}
                style={{ padding: '5px 14px', borderRadius: 100, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border2)', background: filter === 'login' ? 'rgba(56,139,253,.12)' : 'transparent', color: filter === 'login' ? 'var(--blue)' : 'var(--dim)' }}>
                🔑 Login
              </button>
              <button onClick={() => setFilter('logout')}
                style={{ padding: '5px 14px', borderRadius: 100, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border2)', background: filter === 'logout' ? 'rgba(56,139,253,.12)' : 'transparent', color: filter === 'logout' ? 'var(--blue)' : 'var(--dim)' }}>
                🚪 Logout
              </button>
            </>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>FROM</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>TO</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            {(search || dateFrom || dateTo || filter !== 'all') && (
              <button onClick={clearFilters}
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.25)', color: 'var(--red)' }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Staff', 'Action', 'Visitor Name', 'CPR Number'].map(h => (
                  <th key={h} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--dim)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,.02)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--dim)' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--dim)' }}>No log entries match.</td></tr>
              ) : filtered.map((l, i) => (
                <tr key={i} onClick={() => setSelected(l)} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.06)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '11px 16px', fontFamily: 'var(--mono)', fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--dim)' }}>
                    {new Date(l.performed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    <div style={{ fontSize: 10, color: 'var(--faint)' }}>{new Date(l.performed_at).toLocaleDateString('en-GB')}</div>
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{l.staff_name}</td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                    <span className={`badge ${actionColor[l.action] || 'badge-blue'}`}>{l.action}</span>
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{l.visitor_name || '—'}</td>
                  <td style={{ padding: '11px 16px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)', borderBottom: '1px solid var(--border)' }}>{l.visitor_cpr || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && <LogDetail log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// LogDetail function remains exactly as you provided...
function LogDetail({ log, onClose }) {
  const [visit, setVisit] = useState(null);
  useEffect(() => {
    if ((log.action === 'CHECKIN' || log.action === 'CHECKOUT') && log.target_id) {
      api.get(`/visits?visit_id=${log.target_id}`).then(r => {
        if (r.data && r.data.length > 0) setVisit(r.data[0]);
      }).catch(() => {});
    }
  }, [log]);

  const rows = [
    ['Action',     <span className={`badge ${actionColor[log.action] || 'badge-blue'}`}>{log.action}</span>],
    ['Time',       new Date(log.performed_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })],
    ['Staff',      log.staff_name  || '—'],
    ['Visitor',    log.visitor_name|| '—'],
    ['CPR Number', log.visitor_cpr || '—'],
    ...(visit ? [
      ['Host',       visit.host_employee   || '—'],
      ['Purpose',    visit.purpose         || '—'],
      ['Department', visit.department_name || '—'],
      ['Floor',      visit.floor           || '—'],
      ['Card',       visit.card_uid         || '—'],
      ['Check-In',   visit.check_in_time  ? new Date(visit.check_in_time).toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit' }) : '—'],
      ['Check-Out',  visit.check_out_time ? new Date(visit.check_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'],
      ['Duration',   visit.duration_minutes ? `${Math.round(visit.duration_minutes)}m` : '—'],
    ] : []),
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 12, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Log Entry Details</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 22 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--dim)', minWidth: 100 }}>{label}</span>
              <span style={{ fontSize: 13, flex: 1, color: label === 'Floor' ? 'var(--blue)' : 'var(--text)' }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: 'var(--blue)', color: '#fff', border: 'none', fontWeight: 600 }}>Close</button>
        </div>
      </div>
    </div>
  );
}