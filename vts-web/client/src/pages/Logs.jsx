import { useState, useEffect } from 'react';
import api from '../api';

const actionColor = {
  LOGIN:       'badge-blue',
  LOGOUT:      'badge-purple',
  CHECKIN:     'badge-green',
  CHECKOUT:    'badge-amber',
  ACCESS_DENIED:'badge-red',
  CREATE_USER: 'badge-blue',
};

export default function Logs() {
  const [logs,        setLogs]        = useState([]);
  const [filtered,    setFiltered]    = useState([]);
  const [filter,      setFilter]      = useState('all');
  const [search,      setSearch]      = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [selected,    setSelected]    = useState(null); // clicked log detail
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    api.get('/dashboard/activity').then(r => {
      setLogs(r.data);
      setFiltered(r.data);
      setLoading(false);
    });
  }, []);

  // Apply all filters whenever any filter changes
  useEffect(() => {
    let result = [...logs];

    // Action filter
    if (filter !== 'all') {
      const map = { checkin:'CHECKIN', checkout:'CHECKOUT', login:'LOGIN', denied:'ACCESS_DENIED' };
      result = result.filter(l => l.action === map[filter]);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        (l.visitor_name  || '').toLowerCase().includes(q) ||
        (l.visitor_cpr   || '').includes(q)               ||
        (l.staff_name    || '').toLowerCase().includes(q) ||
        (l.action        || '').toLowerCase().includes(q)
      );
    }

    // Date from
    if (dateFrom) {
      result = result.filter(l => new Date(l.performed_at) >= new Date(dateFrom));
    }

    // Date to — include full end day
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      result = result.filter(l => new Date(l.performed_at) <= end);
    }

    setFiltered(result);
  }, [logs, filter, search, dateFrom, dateTo]);

  function clearFilters() {
    setFilter('all');
    setSearch('');
    setDateFrom('');
    setDateTo('');
  }

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
            {filtered.length} of {logs.length} entries — click a row for details
          </p>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => alert('Export coming soon')}>
          📥 Export
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="Search visitor name, CPR, staff name or action…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 36 }}
          />
        </div>

        {/* Action chips + date filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['all','All Events'],['checkin','✅ Check-In'],['checkout','🔙 Check-Out'],['login','🔑 Login'],['denied','🚫 Denied']].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '5px 14px', borderRadius: 100, fontSize: 12, fontFamily: 'var(--sans)', cursor: 'pointer', border: '1px solid var(--border2)', background: filter === f ? 'rgba(56,139,253,.12)' : 'transparent', color: filter === f ? 'var(--blue)' : 'var(--dim)', transition: 'all .15s' }}>
              {label}
            </button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>FROM</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>TO</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            {(search || dateFrom || dateTo || filter !== 'all') && (
              <button onClick={clearFilters}
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--sans)', cursor: 'pointer', background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.25)', color: 'var(--red)' }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Staff', 'Action', 'Visitor Name', 'CPR Number'].map(h => (
                  <th key={h} style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.08em', color: 'var(--dim)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,.02)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--dim)', fontSize: 13 }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--dim)', fontSize: 13 }}>No log entries match your filters.</td></tr>
              ) : filtered.map((l, i) => (
                <tr key={i}
                  onClick={() => setSelected(l)}
                  style={{ cursor: 'pointer', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '11px 16px', fontFamily: 'var(--mono)', fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--dim)', whiteSpace: 'nowrap' }}>
                    {new Date(l.performed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    <div style={{ fontSize: 10, color: 'var(--faint)' }}>
                      {new Date(l.performed_at).toLocaleDateString('en-GB')}
                    </div>
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

      {/* Detail modal */}
      {selected && <LogDetail log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Log Detail Modal ──────────────────────────────────────────
function LogDetail({ log, onClose }) {
  const [visit, setVisit] = useState(null);

  useEffect(() => {
    // Fetch full visit details if this is a checkin/checkout log
    if ((log.action === 'CHECKIN' || log.action === 'CHECKOUT') && log.target_id) {
      api.get(`/visits?visit_id=${log.target_id}`).then(r => {
        if (r.data && r.data.length > 0) setVisit(r.data[0]);
      }).catch(() => {});
    }
  }, [log]);

  const rows = [
    ['Action',       <span className={`badge ${actionColor[log.action] || 'badge-blue'}`}>{log.action}</span>],
    ['Time',         new Date(log.performed_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })],
    ['Staff',        log.staff_name || '—'],
    ['Visitor',      log.visitor_name || '—'],
    ['CPR Number',   log.visitor_cpr  || '—'],
    ...(visit ? [
      ['Host',         visit.host_employee   || '—'],
      ['Purpose',      visit.purpose         || '—'],
      ['Department',   visit.department_name || '—'],
      ['Floor',        visit.floor           || '—'],
      ['Card',         visit.card_uid        || '—'],
      ['Check-In',     visit.check_in_time  ? new Date(visit.check_in_time).toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit' }) : '—'],
      ['Check-Out',    visit.check_out_time ? new Date(visit.check_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'],
      ['Duration',     visit.duration_minutes ? `${Math.round(visit.duration_minutes)}m` : '—'],
    ] : []),
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 12, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.6)', animation: 'fadeIn .2s ease' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Log Entry Details</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--dim)', letterSpacing: '.08em', textTransform: 'uppercase', minWidth: 100, paddingTop: 2 }}>{label}</span>
              <span style={{ fontSize: 13, flex: 1, color: label === 'Floor' ? 'var(--blue)' : 'var(--text)', fontWeight: label === 'Floor' ? 600 : 400 }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 7, fontSize: 13, fontFamily: 'var(--sans)', cursor: 'pointer', background: 'var(--blue)', color: '#fff', border: 'none', fontWeight: 600 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}