import { useState, useEffect } from 'react';
import api from '../api';

export default function Visitors() {
  const [visitors,  setVisitors]  = useState([]);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(null);
  const [visits,    setVisits]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadingV,  setLoadingV]  = useState(false);

  useEffect(() => {
    api.get('/visitors').then(r => { setVisitors(r.data); setLoading(false); });
  }, []);

  async function handleSelect(v) {
    setSelected(v);
    setLoadingV(true);
    try {
      const { data } = await api.get(`/visits/by-visitor/${v.visitor_id}`);
      setVisits(data);
    } catch { setVisits([]); }
    setLoadingV(false);
  }

  const filtered = visitors.filter(v => {
    const q = search.toLowerCase();
    return (
      v.full_name.toLowerCase().includes(q) ||
      v.cpr_number.includes(q) ||
      (v.company || '').toLowerCase().includes(q)
    );
  });

  function statusBadge(s) {
    const map = { active:'badge-green', completed:'badge-purple', overstay:'badge-amber', flagged:'badge-red' };
    return <span className={`badge ${map[s] || 'badge-blue'}`}>{s}</span>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left: Visitor List ── */}
      <div style={{ width: selected ? 380 : '100%', flexShrink: 0, borderRight: selected ? '1px solid var(--border)' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width .2s' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 12px', flexShrink: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Visitors</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 14 }}>
            {filtered.length} visitor{filtered.length !== 1 ? 's' : ''} registered
          </p>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text" placeholder="Search by name, CPR or company…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 14px 9px 36px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none' }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No visitors found.</div>
          ) : filtered.map(v => (
            <div key={v.visitor_id}
              onClick={() => handleSelect(v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 10px', borderRadius: 9, cursor: 'pointer',
                background: selected?.visitor_id === v.visitor_id ? 'rgba(56,139,253,.1)' : 'transparent',
                border: selected?.visitor_id === v.visitor_id ? '1px solid rgba(56,139,253,.3)' : '1px solid transparent',
                marginBottom: 4, transition: 'all .15s',
              }}
              onMouseEnter={e => { if (selected?.visitor_id !== v.visitor_id) e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
              onMouseLeave={e => { if (selected?.visitor_id !== v.visitor_id) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Avatar */}
              <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#1a3a6e,var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {v.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>{v.cpr_number}</div>
              </div>

              {v.pre_status === 'pending' && (
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(56,139,253,.12)', color: 'var(--blue)', border: '1px solid rgba(56,139,253,.2)', flexShrink: 0 }}>
                  Pre-reg
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Visitor Detail ── */}
      {selected && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="fade-in">

          {/* Close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{selected.full_name}</h2>
            <button onClick={() => { setSelected(null); setVisits([]); }}
              style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
              ✕ Close
            </button>
          </div>

          {/* Visitor info card */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>Visitor Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['Full Name',   selected.full_name],
                ['CPR Number',  selected.cpr_number],
                ['Phone',       selected.phone    || '—'],
                ['Email',       selected.email    || '—'],
                ['Company',     selected.company  || '—'],
                ['Registered',  new Date(selected.created_at).toLocaleDateString('en-GB')],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.08em', marginBottom: 4 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pre-registration notice */}
          {selected.pre_status === 'pending' && (
            <div style={{ background: 'rgba(56,139,253,.08)', border: '1px solid rgba(56,139,253,.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--blue)' }}>
              ℹ️ This visitor has a pending pre-registration — Host: <strong>{selected.pre_host || '—'}</strong> · Department: <strong>{selected.pre_department_name || '—'}</strong> · Floor: <strong>{selected.pre_floor || '—'}</strong>
            </div>
          )}

          {/* Visit history */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
              Visit History
            </div>

            {loadingV ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>Loading visits…</div>
            ) : visits.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No visits recorded yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Department', 'Floor', 'Host', 'Card', 'Duration', 'Status'].map(h => (
                      <th key={h} style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.08em', color: 'var(--dim)', textAlign: 'left', padding: '9px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,.02)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v, i) => (
                    <tr key={i}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 16px', fontFamily: 'var(--mono)', fontSize: 12, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {new Date(v.check_in_time).toLocaleDateString('en-GB')}
                        <div style={{ fontSize: 10, color: 'var(--dim)' }}>
                          {new Date(v.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{v.department_name || '—'}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--blue)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{v.floor || '—'}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--dim)', borderBottom: '1px solid var(--border)' }}>{v.host_employee || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                        <span className="badge badge-blue">{v.card_uid || '—'}</span>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--dim)', borderBottom: '1px solid var(--border)' }}>
                        {v.duration_minutes ? `${Math.round(v.duration_minutes)}m` : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                        {statusBadge(v.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}