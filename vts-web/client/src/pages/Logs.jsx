import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

// ── PDF Export ────────────────────────────────────────────────
async function exportToPDF(rows, filter, dateFrom, dateTo) {
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
  doc.text('Visitor Access Logs', 14, 17);

  doc.setTextColor(100, 110, 130);
  doc.setFontSize(9);
  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let meta = `Exported: ${now}  ·  ${rows.length} entries`;
  if (filter !== 'all') meta += `  ·  Filter: ${filter}`;
  if (dateFrom) meta += `  ·  From: ${dateFrom}`;
  if (dateTo)   meta += `  ·  To: ${dateTo}`;
  doc.text(meta, 14, 29);

  const tableRows = rows.map(r => [
    r.check_in_time  ? new Date(r.check_in_time).toLocaleString('en-GB',  { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—',
    r.check_out_time ? new Date(r.check_out_time).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Still inside',
    r.visitor_name        || '—',
    r.cpr_number          || '—',
    r.checked_in_by_name  || '—',
    r.department_name     || '—',
    r.floor               || '—',
    r.duration_str        || '—',
  ]);

  doc.autoTable({
    head: [['Check-In', 'Check-Out', 'Visitor', 'CPR', 'Staff', 'Department', 'Floor', 'Duration']],
    body: tableRows,
    startY: 33,
    styles: { fontSize: 8, cellPadding: 3, textColor: [30, 35, 45] },
    headStyles: { fillColor: [26, 58, 110], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 36 }, 1: { cellWidth: 36 }, 2: { cellWidth: 45 },
      3: { cellWidth: 26 }, 4: { cellWidth: 34 }, 5: { cellWidth: 34 },
      6: { cellWidth: 18 }, 7: { cellWidth: 18 },
    },
    didDrawPage: (data) => {
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`Page ${data.pageNumber}`, pageW - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
    },
  });

  doc.save(`VTS_Logs_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Excel Export ──────────────────────────────────────────────
async function exportToExcel(rows) {
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const data = rows.map(r => ({
    'Check-In Time':   r.check_in_time  ? new Date(r.check_in_time).toLocaleString('en-GB')  : '—',
    'Check-Out Time':  r.check_out_time ? new Date(r.check_out_time).toLocaleString('en-GB') : 'Still inside',
    'Visitor':         r.visitor_name       || '—',
    'CPR':             r.cpr_number         || '—',
    'Checked In By':   r.checked_in_by_name || '—',
    'Department':      r.department_name    || '—',
    'Floor':           r.floor              || '—',
    'Duration':        r.duration_str       || '—',
  }));
  const ws = window.XLSX.utils.json_to_sheet(data);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'VTS Logs');
  ws['!cols'] = [{ wch:22 },{ wch:22 },{ wch:28 },{ wch:14 },{ wch:22 },{ wch:22 },{ wch:10 },{ wch:10 }];
  window.XLSX.writeFile(wb, `VTS_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Duration helper ───────────────────────────────────────────
function fmtDuration(mins) {
  if (!mins && mins !== 0) return '—';
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h ${m%60}m`;
}

// ── Action badge colors (system events) ──────────────────────
const actionColor = {
  LOGIN:             'badge-blue',
  LOGOUT:            'badge-purple',
  ACCESS_DENIED:     'badge-red',
  CREATE_USER:       'badge-blue',
  CARD_SKIP:         'badge-amber',
  CARD_SKIP_FAST:    'badge-amber',
  CARD_ISSUE_REPORT: 'badge-red',
};

// ── Main Component ────────────────────────────────────────────
export default function Logs() {
  const { user }  = useAuth();
  const isAdmin   = user?.role === 'admin' || user?.role === 'manager';

  // visits = from /visits (paired check-in + check-out in one row)
  const [visits,    setVisits]    = useState([]);
  // actLogs = from /dashboard/activity (login/logout/system events)
  const [actLogs,   setActLogs]   = useState([]);

  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/visits'),
      api.get('/dashboard/activity').catch(() => ({ data: [] })),
    ]).then(([vRes, aRes]) => {
      // Add formatted duration string to each visit
      const enriched = (vRes.data || []).map(v => ({
        ...v,
        duration_str: fmtDuration(v.duration_minutes),
      }));
      setVisits(enriched);

      // Only keep non-visit events from activity log
      const sysOnly = (aRes.data || []).filter(
        l => l.action !== 'CHECKIN' && l.action !== 'CHECKOUT'
      );
      setActLogs(sysOnly);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Filter helpers ────────────────────────────────────────
  function matchesDate(dateStr) {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  }

  function matchesSearch(fields) {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return fields.some(f => (f || '').toLowerCase().includes(q));
  }

  // ── Filtered visits ───────────────────────────────────────
  const filteredVisits = visits.filter(v => {
    if (filter === 'active'    && v.status !== 'active'    && v.status !== 'overstay') return false;
    if (filter === 'completed' && v.status !== 'completed')                            return false;
    if (!matchesDate(v.check_in_time)) return false;
    return matchesSearch([v.visitor_name, v.cpr_number, v.checked_in_by_name, v.department_name, v.card_uid]);
  });

  // ── Filtered system events ────────────────────────────────
  const filteredSys = actLogs.filter(l => {
    if (!matchesDate(l.performed_at)) return false;
    return matchesSearch([l.visitor_name, l.visitor_cpr, l.staff_name, l.action]);
  });

  function clearFilters() { setSearch(''); setDateFrom(''); setDateTo(''); }

  const showVisits = filter !== 'system';
  const totalShown = showVisits ? filteredVisits.length : filteredSys.length;

  const inputStyle = {
    background: 'var(--panel2)', border: '1px solid var(--border2)',
    borderRadius: 7, padding: '7px 12px', fontSize: 13,
    color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none',
  };

  return (
    <div style={{ padding: 24 }} className="fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Audit & Access Logs</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
            {loading ? 'Loading…' : `${totalShown} ${showVisits ? 'visit' : 'event'}${totalShown !== 1 ? 's' : ''} shown`}
          </p>
        </div>
        {showVisits && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={async () => { setExporting(true); try { await exportToExcel(filteredVisits); } catch(e) { alert('Excel failed: '+e.message); } setExporting(false); }}
              disabled={exporting || filteredVisits.length === 0}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:8, fontSize:13, cursor: exporting||filteredVisits.length===0?'not-allowed':'pointer', background: exporting?'var(--panel2)':'rgba(63,185,80,.12)', border:'1px solid rgba(63,185,80,.3)', color: exporting?'var(--dim)':'var(--green)', fontWeight:600, opacity: filteredVisits.length===0?0.5:1 }}>
              {exporting ? '⏳...' : '📊 Excel'}
            </button>
            <button
              onClick={async () => { setExporting(true); try { await exportToPDF(filteredVisits, filter, dateFrom, dateTo); } catch(e) { alert('PDF failed: '+e.message); } setExporting(false); }}
              disabled={exporting || filteredVisits.length === 0}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:8, fontSize:13, cursor: exporting||filteredVisits.length===0?'not-allowed':'pointer', background: exporting?'var(--panel2)':'rgba(56,139,253,.12)', border:'1px solid rgba(56,139,253,.3)', color: exporting?'var(--dim)':'var(--blue)', fontWeight:600, opacity: filteredVisits.length===0?0.5:1 }}>
              {exporting ? '⏳...' : '📄 PDF'}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, padding:16, marginBottom:16, display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--dim)', pointerEvents:'none' }}>🔍</span>
          <input type="text" placeholder="Search visitor, CPR, staff, department…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width:'100%', paddingLeft:36 }} />
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {[
            ['all',       '📋 All Visits'],
            ['active',    '🟢 Still Inside'],
            ['completed', '✅ Completed'],
          ].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'5px 14px', borderRadius:100, fontSize:12, cursor:'pointer', border:'1px solid var(--border2)', background: filter===f?'rgba(56,139,253,.12)':'transparent', color: filter===f?'var(--blue)':'var(--dim)' }}>
              {label}
            </button>
          ))}
          {isAdmin && (
            <button onClick={() => setFilter('system')}
              style={{ padding:'5px 14px', borderRadius:100, fontSize:12, cursor:'pointer', border:'1px solid var(--border2)', background: filter==='system'?'rgba(139,92,246,.12)':'transparent', color: filter==='system'?'var(--purple)':'var(--dim)' }}>
              ⚙ System Events
            </button>
          )}

          <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'var(--dim)', fontFamily:'var(--mono)' }}>FROM</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, colorScheme:'dark' }} />
            <span style={{ fontSize:12, color:'var(--dim)', fontFamily:'var(--mono)' }}>TO</span>
            <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ ...inputStyle, colorScheme:'dark' }} />
            {(search || dateFrom || dateTo) && (
              <button onClick={clearFilters}
                style={{ padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer', background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.25)', color:'var(--red)' }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Visits Table — one row per visit, both times shown ── */}
      {showVisits && (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
              <thead>
                <tr>
                  {['Visitor','CPR','Check-In','Check-Out','Duration','Staff','Department','Floor','Card','Status'].map(h => (
                    <th key={h} style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)', textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,.02)', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign:'center', padding:'40px 0', color:'var(--dim)' }}>Loading…</td></tr>
                ) : filteredVisits.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign:'center', padding:'40px 0', color:'var(--dim)' }}>No visit records found.</td></tr>
                ) : filteredVisits.map((v, i) => {
                  const isActive   = v.status === 'active' || v.status === 'overstay';
                  const isOverstay = v.status === 'overstay';
                  return (
                    <tr key={v.visit_id || i}
                      onClick={() => setSelected({ _type:'visit', ...v })}
                      style={{ cursor:'pointer', background: isOverstay ? 'rgba(248,81,73,.03)' : 'transparent', transition:'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = isOverstay ? 'rgba(248,81,73,.03)' : 'transparent'}
                    >
                      {/* Visitor */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600, whiteSpace:'nowrap' }}>
                        {v.visitor_name || '—'}
                      </td>

                      {/* CPR */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:11, color:'var(--dim)' }}>
                        {v.cpr_number || '—'}
                      </td>

                      {/* Check-In */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                        <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--green)', fontWeight:600 }}>
                          {new Date(v.check_in_time).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                        </div>
                        <div style={{ fontSize:10, color:'var(--faint)', fontFamily:'var(--mono)' }}>
                          {new Date(v.check_in_time).toLocaleDateString('en-GB')}
                        </div>
                      </td>

                      {/* Check-Out */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                        {v.check_out_time ? (
                          <>
                            <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--amber)', fontWeight:600 }}>
                              {new Date(v.check_out_time).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                            </div>
                            <div style={{ fontSize:10, color:'var(--faint)', fontFamily:'var(--mono)' }}>
                              {new Date(v.check_out_time).toLocaleDateString('en-GB')}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize:11, color:'var(--blue)', fontFamily:'var(--mono)' }}>Still inside</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:12, color:'var(--dim)', whiteSpace:'nowrap' }}>
                        {v.duration_str}
                      </td>

                      {/* Staff */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--dim)', whiteSpace:'nowrap' }}>
                        {v.checked_in_by_name || '—'}
                      </td>

                      {/* Department */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text)' }}>
                        {v.department_name || '—'}
                      </td>

                      {/* Floor */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:12, color:'var(--blue)', fontWeight:600 }}>
                        {v.floor || '—'}
                      </td>

                      {/* Card */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)' }}>
                        {v.card_uid ? (
                          <span style={{ background:'rgba(56,139,253,.1)', color:'var(--blue)', borderRadius:5, padding:'2px 7px', fontSize:11, fontFamily:'var(--mono)', fontWeight:600 }}>
                            {v.card_uid}
                          </span>
                        ) : <span style={{ color:'var(--dim)', fontSize:12 }}>—</span>}
                      </td>

                      {/* Status */}
                      <td style={{ padding:'11px 12px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                        {v.status === 'completed' && (
                          <span style={{ background:'rgba(63,185,80,.1)', color:'var(--green)', borderRadius:100, padding:'2px 9px', fontSize:11, fontWeight:600, fontFamily:'var(--mono)' }}>✓ Done</span>
                        )}
                        {v.status === 'active' && (
                          <span style={{ background:'rgba(56,139,253,.1)', color:'var(--blue)', borderRadius:100, padding:'2px 9px', fontSize:11, fontWeight:600, fontFamily:'var(--mono)' }}>● Active</span>
                        )}
                        {v.status === 'overstay' && (
                          <span style={{ background:'rgba(248,81,73,.12)', color:'var(--red)', borderRadius:100, padding:'2px 9px', fontSize:11, fontWeight:600, fontFamily:'var(--mono)' }}>⚠ Overstay</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── System Events (admin only) ───────────────────────── */}
      {!showVisits && filter === 'system' && isAdmin && (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Time','Staff','Action','Visitor','CPR'].map(h => (
                    <th key={h} style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)', textAlign:'left', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,.02)', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:'40px 0', color:'var(--dim)' }}>Loading…</td></tr>
                ) : filteredSys.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:'40px 0', color:'var(--dim)' }}>No system events found.</td></tr>
                ) : filteredSys.map((l, i) => (
                  <tr key={l.audit_id || i}
                    onClick={() => setSelected({ _type:'system', ...l })}
                    style={{ cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding:'11px 16px', fontFamily:'var(--mono)', fontSize:12, borderBottom:'1px solid var(--border)', color:'var(--dim)' }}>
                      {new Date(l.performed_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                      <div style={{ fontSize:10, color:'var(--faint)' }}>{new Date(l.performed_at).toLocaleDateString('en-GB')}</div>
                    </td>
                    <td style={{ padding:'11px 16px', fontSize:13, borderBottom:'1px solid var(--border)' }}>{l.staff_name || '—'}</td>
                    <td style={{ padding:'11px 16px', borderBottom:'1px solid var(--border)' }}>
                      <span className={`badge ${actionColor[l.action] || 'badge-blue'}`}>{l.action}</span>
                    </td>
                    <td style={{ padding:'11px 16px', fontSize:13, borderBottom:'1px solid var(--border)' }}>{l.visitor_name || '—'}</td>
                    <td style={{ padding:'11px 16px', fontFamily:'var(--mono)', fontSize:12, color:'var(--dim)', borderBottom:'1px solid var(--border)' }}>{l.visitor_cpr || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <LogDetail log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Log Detail Modal ──────────────────────────────────────────
function LogDetail({ log, onClose }) {
  const actionColor = {
    LOGIN:'badge-blue', LOGOUT:'badge-purple', ACCESS_DENIED:'badge-red',
    CREATE_USER:'badge-blue', CARD_SKIP:'badge-amber', CARD_SKIP_FAST:'badge-amber',
    CARD_ISSUE_REPORT:'badge-red',
  };

  // Visit detail
  if (log._type === 'visit') {
    const rows = [
      ['Visitor',       log.visitor_name       || '—'],
      ['CPR',           log.cpr_number         || '—'],
      ['Company',       log.company            || '—'],
      ['Check-In',      log.check_in_time  ? new Date(log.check_in_time).toLocaleString('en-GB',  { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short', year:'numeric' }) : '—'],
      ['Check-Out',     log.check_out_time ? new Date(log.check_out_time).toLocaleString('en-GB', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short', year:'numeric' }) : 'Still inside'],
      ['Duration',      log.duration_str        || '—'],
      ['Staff',         log.checked_in_by_name  || '—'],
      ['Host',          log.host_employee        || '—'],
      ['Purpose',       log.purpose              || '—'],
      ['Department',    log.department_name      || '—'],
      ['Floor',         log.floor                || '—'],
      ['Card',          log.card_uid             || '—'],
      ['Notes',         log.notes                || '—'],
    ];

    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ background:'var(--panel)', border:'1px solid var(--border2)', borderRadius:12, width:480, maxWidth:'95vw', maxHeight:'90vh', overflow:'auto' }}>
          <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:15, fontWeight:700 }}>Visit Details</div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--dim)', fontSize:16, cursor:'pointer' }}>✕</button>
          </div>
          <div style={{ padding:22 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display:'flex', gap:16, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--dim)', minWidth:110 }}>{label}</span>
                <span style={{ fontSize:13, flex:1, wordBreak:'break-word',
                  color: label==='Check-In'  ? 'var(--green)'  :
                         label==='Check-Out' ? (log.check_out_time ? 'var(--amber)' : 'var(--blue)') :
                         label==='Floor'     ? 'var(--blue)'   : 'var(--text)' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div style={{ padding:'14px 22px', borderTop:'1px solid var(--border)', textAlign:'right' }}>
            <button onClick={onClose} style={{ padding:'8px 20px', borderRadius:7, fontSize:13, cursor:'pointer', background:'var(--blue)', color:'#fff', border:'none', fontWeight:600 }}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  // System event detail
  const rows = [
    ['Action',  <span className={`badge ${actionColor[log.action] || 'badge-blue'}`}>{log.action}</span>],
    ['Time',    new Date(log.performed_at).toLocaleString('en-GB', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short', year:'numeric' })],
    ['Staff',   log.staff_name   || '—'],
    ['Visitor', log.visitor_name || '—'],
    ['CPR',     log.visitor_cpr  || '—'],
  ];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'var(--panel)', border:'1px solid var(--border2)', borderRadius:12, width:460, maxWidth:'95vw', maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:15, fontWeight:700 }}>Event Details</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--dim)', fontSize:16, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:22 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display:'flex', gap:16, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--dim)', minWidth:100 }}>{label}</span>
              <span style={{ fontSize:13, flex:1, color:'var(--text)' }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ padding:'14px 22px', borderTop:'1px solid var(--border)', textAlign:'right' }}>
          <button onClick={onClose} style={{ padding:'8px 20px', borderRadius:7, fontSize:13, cursor:'pointer', background:'var(--blue)', color:'#fff', border:'none', fontWeight:600 }}>Close</button>
        </div>
      </div>
    </div>
  );
}