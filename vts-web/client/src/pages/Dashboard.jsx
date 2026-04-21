import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function KPI({ label, value, color, sub }) {
  const colors = {
    blue:  { bg: 'rgba(56,139,253,.08)',  border: 'rgba(56,139,253,.2)',  text: 'var(--blue)'   },
    green: { bg: 'rgba(63,185,80,.08)',   border: 'rgba(63,185,80,.2)',   text: 'var(--green)'  },
    amber: { bg: 'rgba(240,160,52,.08)',  border: 'rgba(240,160,52,.25)', text: 'var(--amber)'  },
    red:   { bg: 'rgba(248,81,73,.08)',   border: 'rgba(248,81,73,.2)',   text: 'var(--red)'    },
  };
  const c = colors[color] || colors.blue;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '18px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: c.text, lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function duration(mins) {
  if (!mins && mins !== 0) return '—';
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function getThresholds(purpose) {
  if (purpose?.toLowerCase().includes('delivery')) return { warn: 5, expire: 10 };
  return { warn: 105, expire: 120 };
}

function getLiveStatus(v) {
  const mins = v.duration_minutes || 0;
  if (v.status === 'overstay') return 'overstay';
  const { expire } = getThresholds(v.purpose);
  if (mins >= expire) return 'overstay';
  return v.status || 'active';
}

function StatusBadge({ status }) {
  const map = {
    active:   { bg: 'rgba(63,185,80,.12)',  color: 'var(--green)', dot: '●', label: 'Active'   },
    overstay: { bg: 'rgba(248,81,73,.12)',  color: 'var(--red)',   dot: '⚠', label: 'Overstay' },
  };
  const s = map[status] || map.active;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 100, padding: '3px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
      {s.dot} {s.label}
    </span>
  );
}

export default function Dashboard() {
  const navigate  = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [visits,  setVisits]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking,setChecking]= useState(null);
  const [filter,  setFilter]  = useState('all');

  const fetchAll = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/active-visits'),
      ]);
      setStats(s.data);
      setVisits(v.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, [fetchAll]);

  async function handleCheckout(visitId, name) {
    if (!window.confirm(`Check out ${name}?`)) return;
    setChecking(visitId);
    try {
      await api.patch(`/visits/${visitId}/checkout`);
      fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Checkout failed.'); }
    setChecking(null);
  }

  const now = new Date().toLocaleString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const warningVisits  = visits.filter(v => {
    const liveStatus = getLiveStatus(v);
    if (liveStatus === 'overstay') return false;
    const { warn } = getThresholds(v.purpose);
    return (v.duration_minutes || 0) >= warn;
  });

  const overstayVisits = visits.filter(v => getLiveStatus(v) === 'overstay');
  const liveOverstayCount = overstayVisits.length;

  const filteredVisits = visits.filter(v => {
    const live = getLiveStatus(v);
    if (filter === 'all')       return true;
    if (filter === 'active')    return live === 'active';
    if (filter === 'overstay')  return live === 'overstay';
    if (filter === 'delivery')  return v.purpose?.toLowerCase().includes('delivery');
    return true;
  });

  return (
    <div style={{ padding: 24 }} className="fade-in">

    
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Security Dashboard</h1>
            <p style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{now}</p>
                      <button
            onClick={() => navigate('/checkin')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', flexShrink: 0 }}
          >
            ✚ New Check-In
          </button>
          <div>
          </div>
        </div>
      </div>

      {/* ── Warning banners ── */}
      {warningVisits.length > 0 && (
        <div style={{ background: 'rgba(240,160,52,.08)', border: '1px solid rgba(240,160,52,.4)', borderRadius: 8, padding: '12px 16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {warningVisits.map(v => {
            const mins = Math.round(v.duration_minutes || 0);
            const { expire } = getThresholds(v.purpose);
            const remaining = expire - mins;
            const isDelivery = v.purpose?.toLowerCase().includes('delivery');
            return (
              <div key={v.visit_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--amber)' }}>
                <span>⏰</span>
                <span>
                  <strong>{v.visitor_name}</strong>
                  {isDelivery
                    ? ` — delivery expires in ${remaining} min${remaining !== 1 ? 's' : ''} (${mins}m elapsed).`
                    : ` — visit expires in ${Math.floor(remaining / 60)}h ${remaining % 60}m.`}
                  {' '}In since {new Date(v.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
                </span>
              </div>
            );
          })}
        </div>
      )}

      {overstayVisits.length > 0 && (
        <div style={{ background: 'rgba(248,81,73,.06)', border: '1px solid rgba(248,81,73,.35)', borderRadius: 8, padding: '12px 16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {overstayVisits.map(v => {
            const isDelivery = v.purpose?.toLowerCase().includes('delivery');
            return (
              <div key={v.visit_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--red)' }}>
                <span>⛔</span>
                <span>
                  <strong>{v.visitor_name}</strong>
                  {isDelivery
                    ? ` — delivery exceeded 10 minutes (${Math.round(v.duration_minutes)}m elapsed).`
                    : ` — overstay (${duration(v.duration_minutes)} elapsed). Please follow up.`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <KPI label="Visitors Inside"  value={stats?.visitors_inside} color="blue"  sub="currently active" />
        <KPI label="Cards Available"  value={stats?.cards_available} color="green" sub="ready to assign" />
        <KPI label="Overstay Alerts"  value={liveOverstayCount}      color="amber" sub="exceeding time limit" />
        <KPI label="Check-Ins Today"  value={stats?.checkins_today}  color="blue"  sub="total today" />
      </div>

      {/* ── Active Visits Table ── */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>

        {/* Panel header with filters */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>🟢 Active Visitors</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[
              ['all',      'All'],
              ['active',   'Active'],
              ['overstay', '⚠ Overstay'],
              // ['delivery', '📦 Delivery'],
            ].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{
                  padding: '4px 12px', borderRadius: 100, fontSize: 11,
                  fontFamily: 'var(--sans)', cursor: 'pointer', transition: 'all .15s',
                  border: `1px solid ${filter === val ? 'rgba(56,139,253,.4)' : 'var(--border2)'}`,
                  background: filter === val ? 'rgba(56,139,253,.12)' : 'transparent',
                  color:      filter === val ? 'var(--blue)' : 'var(--dim)',
                  position: 'relative',
                }}>
                {label}
                {val === 'overstay' && liveOverstayCount > 0 && (
                  <span style={{ marginLeft: 5, background: 'var(--red)', color: '#fff', borderRadius: 100, padding: '1px 5px', fontSize: 10 }}>
                    {liveOverstayCount}
                  </span>
                )}
              </button>
            ))}
            <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--mono)', marginLeft: 4 }}>↻ 15s</span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>Loading…</div>
        ) : filteredVisits.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            {filter === 'all' ? 'No active visitors at the moment.' : `No ${filter} visitors.`}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Visitor', 'Card', 'Department', 'Floor', 'Host', 'Staff', 'Check-In', 'Valid Until', 'Duration', 'Status', ''].map(h => (
                    <th key={h} style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.08em', color: 'var(--dim)', textAlign: 'left', padding: '9px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,.02)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVisits.map(v => {
                  const liveStatus = getLiveStatus(v);
                  const isDelivery = v.purpose?.toLowerCase().includes('delivery');
                  const mins = Math.round(v.duration_minutes || 0);
                  const { warn } = getThresholds(v.purpose);
                  const isWarning  = mins >= warn && liveStatus !== 'overstay';
                  const isOverstay = liveStatus === 'overstay';
                  const rowBg = isOverstay ? 'rgba(248,81,73,.04)' : isWarning ? 'rgba(240,160,52,.03)' : 'transparent';

                  return (
                    <tr key={v.visit_id}
                      style={{ background: rowBg, transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = isOverstay ? 'rgba(248,81,73,.07)' : 'rgba(56,139,253,.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = rowBg}
                    >
                      {/* Visitor */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#1a3a6e,var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {v.visitor_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{v.visitor_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>{v.cpr_number}</div>
                          </div>
                          {/* {isDelivery && <span title="Delivery" style={{ fontSize: 14 }}>📦</span>} */}
                        </div>
                      </td>

                      {/* Card */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ background: 'rgba(56,139,253,.1)', color: 'var(--blue)', borderRadius: 5, padding: '3px 8px', fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600 }}>
                          {v.card_uid || '—'}
                        </span>
                      </td>

                      {/* Department */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>{v.department_name || '—'}</td>

                      {/* Floor */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>{v.floor || '—'}</td>

                      {/* Host */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--dim)' }}>{v.host_employee || '—'}</td>

                      {/* Staff */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--dim)' }}>{v.checked_in_by_name || '—'}</td>

                      {/* Check-in time */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
                        {new Date(v.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Valid Until */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 12, color: isOverstay ? 'var(--red)' : isWarning ? 'var(--amber)' : 'var(--dim)', whiteSpace: 'nowrap' }}>
                        {v.valid_until
                          ? new Date(v.valid_until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 12, color: isOverstay ? 'var(--red)' : isWarning ? 'var(--amber)' : 'var(--dim)', whiteSpace: 'nowrap' }}>
                        {duration(v.duration_minutes)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                        <StatusBadge status={liveStatus} />
                      </td>

                      {/* Checkout button */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                        <button
                          onClick={() => handleCheckout(v.visit_id, v.visitor_name)}
                          disabled={checking === v.visit_id}
                          style={{
                            padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            fontFamily: 'var(--sans)', cursor: checking === v.visit_id ? 'not-allowed' : 'pointer',
                            border: '1px solid rgba(248,81,73,.3)',
                            background: checking === v.visit_id ? 'transparent' : 'rgba(248,81,73,.08)',
                            color: checking === v.visit_id ? 'var(--dim)' : 'var(--red)',
                            transition: 'all .15s', whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => { if (checking !== v.visit_id) { e.currentTarget.style.background = 'rgba(248,81,73,.18)'; e.currentTarget.style.borderColor = 'var(--red)'; }}}
                          onMouseLeave={e => { e.currentTarget.style.background = checking === v.visit_id ? 'transparent' : 'rgba(248,81,73,.08)'; e.currentTarget.style.borderColor = 'rgba(248,81,73,.3)'; }}
                        >
                          {checking === v.visit_id ? '…' : '↩ Check Out'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}