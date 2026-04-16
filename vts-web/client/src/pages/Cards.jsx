import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const STATUSES = ['available', 'assigned', 'lost', 'retired'];

export default function Cards() {
  const { user }   = useAuth();
  const isAdmin    = user?.role === 'admin' || user?.role === 'manager';

  const [cards,       setCards]       = useState([]);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [showDamaged, setShowDamaged] = useState(false);
  const [search,      setSearch]      = useState('');
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => { fetchCards(); }, []);

  async function fetchCards() {
    try { 
      const { data } = await api.get('/cards'); 
      setCards(data); 
    } catch (err) {
      flash('Failed to load cards.', 'error');
    }
  }

  function flash(msg, type = 'success') {
    if (type === 'success') { 
      setSuccess(msg); 
      setTimeout(() => setSuccess(''), 3000); 
    } else { 
      setError(msg); 
      setTimeout(() => setError(''), 4000); 
    }
  }

  async function handleDelete(card) {
    if (!window.confirm(`Delete card "${card.card_uid}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/cards/${card.card_id}`);
      flash(`Card ${card.card_uid} deleted.`);
      if (selectedCard?.card_id === card.card_id) setSelectedCard(null);
      fetchCards();
    } catch (err) { 
      flash(err.response?.data?.error || 'Delete failed.', 'error'); 
    }
  }

  const q = search.toLowerCase();
  const filterFn = c => !q || c.card_uid.toLowerCase().includes(q) || (c.visitor_name||'').toLowerCase().includes(q);

  const available = cards.filter(c => c.status === 'available' && filterFn(c));
  const assigned  = cards.filter(c => c.status === 'assigned'  && filterFn(c));
  const damaged   = cards.filter(c => (c.status === 'lost' || c.status === 'retired') && filterFn(c));

  const counts = {
    available: cards.filter(c => c.status === 'available').length,
    assigned:  cards.filter(c => c.status === 'assigned').length,
    damaged:   cards.filter(c => c.status === 'lost' || c.status === 'retired').length,
  };

  return (
    <div style={{ padding: 24 }} className="fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Card Management</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
            <span style={{ color: 'var(--green)' }}>{counts.available} available</span>
            {' · '}
            <span style={{ color: 'var(--blue)' }}>{counts.assigned} assigned</span>
            {counts.damaged > 0 && <>{' · '}<span style={{ color: 'var(--red)' }}>{counts.damaged} damaged/lost</span></>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowDamaged(p => !p)}
            style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontFamily: 'var(--sans)', cursor: 'pointer', background: showDamaged ? 'rgba(248,81,73,.12)' : 'transparent', border: `1px solid ${showDamaged ? 'rgba(248,81,73,.35)' : 'var(--border2)'}`, color: showDamaged ? 'var(--red)' : 'var(--dim)', transition: 'all .15s' }}
          >
            {showDamaged ? '▲ Hide damaged/lost' : `▼ Show damaged/lost${counts.damaged > 0 ? ` (${counts.damaged})` : ''}`}
          </button>
          {isAdmin && (
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
              ✚ Add Card
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error   && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--red)', marginBottom:16 }}>✕ {error}</div>}
      {success && <div style={{ background:'rgba(63,185,80,.1)',  border:'1px solid rgba(63,185,80,.3)',  borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--green)', marginBottom:16 }}>✓ {success}</div>}

      {/* Add/Edit form */}
      {showForm && (
        <CardForm
          card={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchCards(); flash(editing ? 'Card updated.' : 'Card added.'); }}
          onError={msg => flash(msg, 'error')}
        />
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }}>🔍</span>
        <input
          type="text" placeholder="Search by card UID or visitor name…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 14px 9px 36px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none' }}
        />
      </div>

      {/* Note Sidebar / Info Panel */}
      {selectedCard && (
        <div style={{ marginBottom: 20, padding: 16, background: 'var(--panel2)', border: '1px solid var(--blue)', borderRadius: 10, borderLeftWidth: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', fontFamily: 'var(--mono)', marginBottom: 4 }}>SELECTED CARD DETAILS</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{selectedCard.card_uid}</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
              <strong>Last Reported Note:</strong><br />
              <span style={{ color: selectedCard.last_note ? 'var(--text)' : 'var(--dim)' }}>
                {selectedCard.last_note || "No notes recorded for this card."}
              </span>
            </div>
          </div>
          <button onClick={() => setSelectedCard(null)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left — Available */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Available — {available.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {available.map(c => (
              <CardItem key={c.card_id} card={c} isAdmin={isAdmin} isSelected={selectedCard?.card_id === c.card_id}
                onClick={() => setSelectedCard(selectedCard?.card_id === c.card_id ? null : c)}
                onEdit={() => { setEditing(c); setShowForm(true); }}
                onDelete={() => handleDelete(c)} />
            ))}
          </div>
        </div>

        {/* Right — Assigned */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--blue)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Assigned — {assigned.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assigned.map(c => (
              <CardItem key={c.card_id} card={c} isAdmin={isAdmin} isSelected={selectedCard?.card_id === c.card_id}
                onClick={() => setSelectedCard(selectedCard?.card_id === c.card_id ? null : c)}
                onEdit={() => { setEditing(c); setShowForm(true); }}
                onDelete={() => handleDelete(c)} />
            ))}
          </div>
        </div>
      </div>

      {/* Damaged Section */}
      {showDamaged && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--red)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Damaged / Lost / Retired — {damaged.length}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(248,81,73,.2)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
            {damaged.map(c => (
              <CardItem key={c.card_id} card={c} isAdmin={isAdmin} isSelected={selectedCard?.card_id === c.card_id}
                onClick={() => setSelectedCard(selectedCard?.card_id === c.card_id ? null : c)}
                onEdit={() => { setEditing(c); setShowForm(true); }}
                onDelete={() => handleDelete(c)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card Item ─────────────────────────────────────────────────
function CardItem({ card: c, isAdmin, onEdit, onDelete, onClick, isSelected }) {
  const colorMap = {
    available: { text: 'var(--green)', border: 'rgba(63,185,80,.2)',  glow: true  },
    assigned:  { text: 'var(--blue)',  border: 'rgba(56,139,253,.25)', glow: false },
    lost:      { text: 'var(--red)',   border: 'rgba(248,81,73,.2)',   glow: false },
    retired:   { text: 'var(--purple)',border: 'rgba(163,113,247,.2)', glow: false },
  };
  const col = colorMap[c.status] || colorMap.available;

  return (
    <div
      onClick={onClick}
      style={{ 
        background: 'var(--panel)', 
        border: `1px solid ${isSelected ? col.text : col.border}`, 
        borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s', cursor: 'pointer',
        boxShadow: isSelected ? `0 0 8px ${col.text}33` : 'none',
        opacity: c.status === 'retired' ? .65 : 1 
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.text, flexShrink: 0, boxShadow: col.glow ? `0 0 6px ${col.text}` : 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: col.text, marginBottom: 2 }}>{c.card_uid}</div>
        <div style={{ fontSize: 12, color: c.visitor_name ? 'var(--text)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.visitor_name || (c.last_note ? '📝 View Note' : 'Ready to assign')}
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
           <button onClick={onEdit} title="Edit"
            style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--dim)', cursor: 'pointer', fontSize: 12 }}>✏</button>
          {c.status !== 'assigned' && (
            <button onClick={onDelete} title="Delete"
              style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: '1px solid rgba(248,81,73,.25)', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>🗑</button>
          )} 
        </div>
      )}
    </div>
  );
}

// ── Card Form ─────────────────────────────────────────────────
function CardForm({ card, onClose, onSaved, onError }) {
  const [cardUid,    setCardUid]    = useState(card?.card_uid || '');
  const [status,     setStatus]     = useState(card?.status   || 'available');
  const [lastNote,   setLastNote]   = useState(card?.last_note || '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (card) { 
        await api.patch(`/cards/${card.card_id}`, { card_uid: cardUid, status, last_note: lastNote }); 
      } else { 
        await api.post('/cards', { card_uid: cardUid }); 
      }
      onSaved();
    } catch (err) { onError(err.response?.data?.error || 'Save failed.'); }
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
            <input value={cardUid} onChange={e => setCardUid(e.target.value)} required style={fieldStyle} />
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
        {card && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>INTERNAL NOTE</label>
            <textarea value={lastNote} onChange={e => setLastNote(e.target.value)} placeholder="Maintenance notes or lost reason..." style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--dim)' }}>Cancel</button>
          <button type="submit" disabled={submitting} style={{ padding: '8px 20px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--blue)', color: '#fff', border: 'none', opacity: submitting ? .6 : 1 }}>
            {submitting ? 'Saving…' : card ? 'Save Changes' : 'Add Card'}
          </button>
        </div>
      </form>
    </div>
  );
}