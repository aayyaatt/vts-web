import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const STATUS_COLORS = {
  available: { badge: 'badge-green',  dot: 'var(--green)'  },
  assigned:  { badge: 'badge-blue',   dot: 'var(--blue)'   },
  lost:      { badge: 'badge-red',    dot: 'var(--red)'    },
  retired:   { badge: 'badge-purple', dot: 'var(--purple)' },
};

const STATUSES = ['available', 'assigned', 'lost', 'retired'];

export default function Cards() {
  const { user }   = useAuth();
  const isAdmin    = user?.role === 'admin' || user?.role === 'manager';

  const [cards,    setCards]    = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  useEffect(() => { fetchCards(); }, []);

  async function fetchCards() {
    try {
      const { data } = await api.get('/cards');
      setCards(data);
    } catch {}
  }

  function flash(msg, type = 'success') {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
    else                    { setError(msg);   setTimeout(() => setError(''), 4000);   }
  }

  async function handleDelete(card) {
    if (!window.confirm(`Delete card "${card.card_uid}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/cards/${card.card_id}`);
      flash(`Card ${card.card_uid} deleted.`);
      fetchCards();
    } catch (err) {
      flash(err.response?.data?.error || 'Delete failed.', 'error');
    }
  }

  const filtered = cards.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.card_uid.toLowerCase().includes(q) || (c.visitor_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all:       cards.length,
    available: cards.filter(c => c.status === 'available').length,
    assigned:  cards.filter(c => c.status === 'assigned').length,
    lost:      cards.filter(c => c.status === 'lost').length,
    retired:   cards.filter(c => c.status === 'retired').length,
  };

  return (
    <div style={{ padding: 24 }} className="fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Card Management</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
            {counts.available} available · {counts.assigned} assigned · {counts.lost} lost · {counts.retired} retired
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
          >
            ✚ Add Card
          </button>
        )}
      </div>

      {/* Alerts */}
      {error   && <div style={{ background:'rgba(248,81,73,.1)',border:'1px solid rgba(248,81,73,.3)',borderRadius:6,padding:'10px 14px',fontSize:13,color:'var(--red)',marginBottom:16 }}>✕ {error}</div>}
      {success && <div style={{ background:'rgba(63,185,80,.1)',border:'1px solid rgba(63,185,80,.3)',borderRadius:6,padding:'10px 14px',fontSize:13,color:'var(--green)',marginBottom:16 }}>✓ {success}</div>}

      {/* Add/Edit form */}
      {showForm && (
        <CardForm
          card={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchCards(); flash(editing ? 'Card updated.' : 'Card added.'); }}
          onError={msg => flash(msg, 'error')}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text" placeholder="Search by card UID or visitor name…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 14px 8px 36px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none' }}
          />
        </div>
        {['all', 'available', 'assigned', 'lost', 'retired'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 16px', borderRadius: 100, fontSize: 12, fontFamily: 'var(--sans)', cursor: 'pointer', border: '1px solid var(--border2)', background: filter === f ? 'rgba(56,139,253,.12)' : 'transparent', color: filter === f ? 'var(--blue)' : 'var(--dim)', transition: 'all .15s' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {filter === f && `(${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--dim)', fontSize: 13 }}>
            No cards match your filter.
          </div>
        ) : filtered.map(c => (
          <div key={c.card_id}
            style={{ background: 'var(--panel)', border: `1px solid ${c.status === 'assigned' ? 'rgba(56,139,253,.25)' : c.status === 'lost' ? 'rgba(248,81,73,.2)' : 'var(--border)'}`, borderRadius: 10, padding: 16, position: 'relative', transition: 'all .15s', opacity: c.status === 'retired' ? .6 : 1 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = c.status === 'assigned' ? 'rgba(56,139,253,.25)' : c.status === 'lost' ? 'rgba(248,81,73,.2)' : 'var(--border)'}
          >
            {/* Status dot */}
            <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[c.status]?.dot, boxShadow: c.status === 'available' ? `0 0 6px ${STATUS_COLORS[c.status]?.dot}` : 'none' }} />

            {/* Card UID */}
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[c.status]?.dot, paddingRight: 20 }}>
              {c.card_uid}
            </div>

            {/* Visitor or status */}
            <div style={{ fontSize: 12, color: c.visitor_name ? 'var(--text)' : 'var(--dim)', marginBottom: 8 }}>
              {c.visitor_name || (c.status === 'available' ? 'Available' : c.status === 'lost' ? 'Reported Lost' : c.status === 'retired' ? 'Retired' : '—')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className={`badge ${STATUS_COLORS[c.status]?.badge || 'badge-blue'}`}>{c.status}</span>

              {/* Admin actions */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { setEditing(c); setShowForm(true); }}
                    title="Edit"
                    style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--dim)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--dim)'; }}
                  >
                    ✏
                  </button>
                  {c.status !== 'assigned' && (
                    <button
                      onClick={() => handleDelete(c)}
                      title="Delete"
                      style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: '1px solid rgba(248,81,73,.25)', color: 'var(--red)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,81,73,.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      🗑
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card Form ─────────────────────────────────────────────────
function CardForm({ card, onClose, onSaved, onError }) {
  const [cardUid,    setCardUid]    = useState(card?.card_uid || '');
  const [status,     setStatus]     = useState(card?.status  || 'available');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (card) {
        await api.patch(`/cards/${card.card_id}`, { card_uid: cardUid, status });
      } else {
        await api.post('/cards', { card_uid: cardUid });
      }
      onSaved();
    } catch (err) {
      onError(err.response?.data?.error || 'Save failed.');
    }
    setSubmitting(false);
  }

  const fieldStyle = { background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none', width: '100%' };
  const labelStyle = { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', color: 'var(--dim)' };

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{card ? 'Edit Card' : 'Add New Card'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>CARD UID *</label>
            <input
              value={cardUid} onChange={e => setCardUid(e.target.value)}
              placeholder="e.g. VIS-001 or RFID UID"
              required style={fieldStyle}
            />
          </div>
          {card && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>STATUS</label>
              <select value={status} onChange={e => setStatus(e.target.value)} style={fieldStyle}>
                {STATUSES.map(s => (
                  <option key={s} value={s} disabled={s === 'assigned'}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}{s === 'assigned' ? ' (auto-managed)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {!card && (
          <p style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>
            New cards are created with status <span style={{ color: 'var(--green)' }}>available</span> automatically.
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, fontSize: 13, fontFamily: 'var(--sans)', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--dim)' }}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} style={{ padding: '8px 20px', borderRadius: 7, fontSize: 13, fontWeight: 600, fontFamily: 'var(--sans)', cursor: 'pointer', background: 'var(--blue)', color: '#fff', border: 'none', opacity: submitting ? .6 : 1 }}>
            {submitting ? 'Saving…' : card ? 'Save Changes' : 'Add Card'}
          </button>
        </div>
      </form>
    </div>
  );
}