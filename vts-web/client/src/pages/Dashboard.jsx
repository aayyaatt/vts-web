import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import styles from './Dashboard.module.css';

function KPI({ label, value, color, sub, onClick }) {
  return (
    <div className={`${styles.kpi} ${styles[color]}`} onClick={onClick} style={onClick ? {cursor:'pointer'} : {}}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value ?? '—'}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  );
}

function duration(mins) {
  if (!mins) return '—';
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h ${m%60}m`;
}

function statusBadge(s) {
  const map = {
    active:    ['badge-green',  '● Active'],
    overstay:  ['badge-amber',  '⚠ Overstay'],
    completed: ['badge-purple', '✓ Done'],
    flagged:   ['badge-red',    '⚑ Flagged'],
  };
  const [cls, label] = map[s] || ['badge-blue', s];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [visits,  setVisits]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(null);

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
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  async function handleCheckout(visitId, name) {
    if (!window.confirm(`Check out ${name}?`)) return;
    setChecking(visitId);
    try {
      await api.patch(`/visits/${visitId}/checkout`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Checkout failed.');
    }
    setChecking(null);
  }

  const now = new Date().toLocaleString('en-GB', {
    weekday:'long', year:'numeric', month:'long', day:'numeric',
    hour:'2-digit', minute:'2-digit'
  });

  return (
    <div className={`${styles.page} fade-in`}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Security Dashboard</h1>
          <p className={styles.sub}>{now}</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/checkin')}>
          ✚ New Check-In
        </button>
      </div>

      {/* KPIs */}
      <div className={styles.kpiRow}>
        <KPI label="Visitors Inside"  value={stats?.visitors_inside} color="blue"  sub="currently active" />
        <KPI label="Cards Available"  value={stats?.cards_available} color="green" sub="ready to assign" />
        <KPI label="Overstay Alerts"  value={stats?.overstay_alerts} color="amber" sub="exceeding 8 hours" />
        <KPI label="Denied Today"     value={stats?.denied_today}    color="red"   sub="access denied"
             onClick={() => navigate('/logs')} />
      </div>

      {/* Active visits table */}
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}>🟢 Active Visitors</span>
          <span className={styles.panelMeta}>Auto-refresh every 15s</span>
        </div>

        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : visits.length === 0 ? (
          <div className={styles.empty}>No active visitors at the moment.</div>
        ) : (
          <div className={styles.tableWrap}>
<table className={styles.table}>
        <thead>
          <tr>
            <th>Visitor</th>
            <th>Card</th>
            <th>Department</th>
            <th>Floor</th>
            <th>Host</th>
            <th>Checked-In By</th>
            <th>Check-In</th>
            <th>Duration</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visits.map(v => (
            <tr key={v.visit_id} className={v.status === 'overstay' ? styles.overstayRow : ''}>
              <td>
                <strong>{v.visitor_name}</strong>
                <div className={styles.cpr}>{v.cpr_number}</div>
              </td>
              <td><span className="badge badge-blue">{v.card_uid || '—'}</span></td>
              <td style={{ fontSize: 13 }}>{v.department_name || '—'}</td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--blue)' }}>{v.floor || '—'}</td>
              <td className="dim">{v.host_employee || '—'}</td>

              {/* 2. Added Staff Data Cell */}
              <td className="dim" style={{ fontSize: 12 }}>
                {v.checked_in_by_name || '—'}
              </td>

              <td className="mono" style={{ fontSize: 12 }}>
                {new Date(v.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className={`mono ${v.status === 'overstay' ? styles.overstayText : ''}`}
                style={{ fontSize: 12 }}>
                {duration(v.duration_minutes)}
              </td>
              <td>{statusBadge(v.status)}</td>
              <td>
                <button
                  className="btn-ghost-sm"
                  onClick={() => handleCheckout(v.visit_id, v.visitor_name)}
                  disabled={checking === v.visit_id}
                >
                  {checking === v.visit_id ? '…' : 'Check Out'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
          </div>
        )}
      </div>

    </div>
  );
}
