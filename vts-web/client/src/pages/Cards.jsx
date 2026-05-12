import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const STATUSES = ['available', 'assigned', 'lost', 'retired'];

function floorsDisplay(floors) {
  if (!floors || floors.length === 0) return 'General';
  return floors.map(f => f === 'G' ? 'Ground (G)' : `Floor ${f}`).join(', ');
}

export default function Cards() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [cards,        setCards]        = useState([]);
  const [floors,       setFloors]       = useState([]);
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [showDamaged,  setShowDamaged]  = useState(false);
  const [search,       setSearch]       = useState('');
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [noteEditing,  setNoteEditing]  = useState(null);
  const [noteText,     setNoteText]     = useState('');

  useEffect(() => { fetchCards(); fetchFloors(); }, []);

  async function fetchCards() {
    try {
      const { data } = await api.get('/cards');
      setCards(data);
    } catch { flash('Failed to load cards.', 'error'); }
  }

  async function fetchFloors() {
    try {
      const { data } = await api.get('/floors');
      setFloors(data);
    } catch {
      setFloors(['G','1','2','3','4','5','6','7','8']);
    }
  }

  function flash(msg, type = 'success') {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
    else                    { setError(msg);   setTimeout(() => setError(''), 4000);   }
  }

  function openNoteEditor(card) { setNoteEditing(card); setNoteText(''); }

  async function saveNoteOnly() {
    try {
      await api.patch(`/cards/${noteEditing.card_id}`, { last_note: noteText });
      flash('Note updated.');
      setNoteEditing(null);
      fetchCards();
    } catch { flash('Failed to update note.', 'error'); }
  }

  async function handleDelete(card) {
    if (!window.confirm(`Delete card "${card.card_uid}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/cards/${card.card_id}`);
      flash(`Card ${card.card_uid} deleted.`);
      fetchCards();
    } catch (err) { flash(err.response?.data?.error || 'Delete failed.', 'error'); }
  }

  const q        = search.toLowerCase();
  const filterFn = c => !q || c.card_uid.toLowerCase().includes(q) || (c.visitor_name||'').toLowerCase().includes(q);
  const available= cards.filter(c => c.status === 'available' && filterFn(c));
  const assigned = cards.filter(c => c.status === 'assigned'  && filterFn(c));
  const damaged  = cards.filter(c => (c.status === 'lost' || c.status === 'retired') && filterFn(c));
  const counts   = {
    available: cards.filter(c => c.status === 'available').length,
    assigned:  cards.filter(c => c.status === 'assigned').length,
    damaged:   cards.filter(c => c.status === 'lost' || c.status === 'retired').length,
  };

  return (
    <div style={{ padding:24 }} className="fade-in">

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700 }}>Card Management</h1>
          <p style={{ fontSize:13, color:'var(--dim)', marginTop:3 }}>
            <span style={{ color:'var(--green)' }}>{counts.available} available</span>
            {' · '}
            <span style={{ color:'var(--blue)' }}>{counts.assigned} assigned</span>
            {counts.damaged > 0 && <>{' · '}<span style={{ color:'var(--red)' }}>{counts.damaged} damaged/lost</span></>}
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => setShowDamaged(p => !p)}
            style={{ padding:'7px 14px', borderRadius:7, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background: showDamaged?'rgba(248,81,73,.12)':'transparent', border:`1px solid ${showDamaged?'rgba(248,81,73,.35)':'var(--border2)'}`, color: showDamaged?'var(--red)':'var(--dim)', transition:'all .15s' }}>
            {showDamaged ? '▲ Hide damaged/lost' : `▼ Show damaged/lost${counts.damaged > 0 ? ` (${counts.damaged})` : ''}`}
          </button>
          {isAdmin && (
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              style={{ padding:'9px 18px', borderRadius:8, background:'var(--blue)', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>
              ✚ Add Card
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error   && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--red)',   marginBottom:16 }}>✕ {error}</div>}
      {success && <div style={{ background:'rgba(63,185,80,.1)', border:'1px solid rgba(63,185,80,.3)', borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--green)', marginBottom:16 }}>✓ {success}</div>}

      {/* Add/Edit Form */}
      {showForm && (
        <CardForm
          card={editing}
          floors={floors}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchCards(); flash(editing ? 'Card updated.' : 'Card added.'); }}
          onError={msg => flash(msg, 'error')}
        />
      )}

      {/* Note editor */}
      {noteEditing && (
        <div style={{ background:'var(--panel)', border:'1px solid var(--blue)', borderLeftWidth:4, borderRadius:10, padding:20, marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--blue)', fontFamily:'var(--mono)' }}>📝 ADD NOTE FOR: {noteEditing.card_uid}</span>
            <button onClick={() => setNoteEditing(null)} style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:18 }}>✕</button>
          </div>
          {noteEditing.last_note && (
            <div style={{ background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, padding:'8px 12px', marginBottom:12 }}>
              <span style={{ fontSize:10, color:'var(--dim)', display:'block', marginBottom:4 }}>CURRENT NOTE (read-only)</span>
              <span style={{ fontSize:13, color:'var(--dim)' }}>{noteEditing.last_note}</span>
            </div>
          )}
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write a new note..." autoFocus
            style={{ width:'100%', minHeight:80, background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, color:'var(--text)', padding:10, outline:'none', fontSize:13, boxSizing:'border-box' }} />
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:12 }}>
            <button onClick={() => setNoteEditing(null)} style={{ background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:13 }}>Cancel</button>
            <button onClick={saveNoteOnly} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'7px 16px', borderRadius:6, fontWeight:600, cursor:'pointer' }}>Save Note</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position:'relative', marginBottom:20 }}>
        <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--dim)', pointerEvents:'none' }}>🔍</span>
        <input type="text" placeholder="Search by card UID..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:8, padding:'9px 14px 9px 36px', fontSize:13, color:'var(--text)', fontFamily:'var(--sans)', outline:'none' }} />
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <section>
          <div style={{ marginBottom:12, color:'var(--green)', fontSize:11, fontWeight:600 }}>AVAILABLE — {available.length}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {available.map(c => <CardItem key={c.card_id} card={c} isAdmin={isAdmin} onEditNote={() => openNoteEditor(c)} onEdit={() => { setEditing(c); setShowForm(true); }} onDelete={() => handleDelete(c)} />)}
          </div>
        </section>
        <section>
          <div style={{ marginBottom:12, color:'var(--blue)', fontSize:11, fontWeight:600 }}>ASSIGNED — {assigned.length}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {assigned.map(c => <CardItem key={c.card_id} card={c} isAdmin={isAdmin} onEditNote={() => openNoteEditor(c)} onEdit={() => { setEditing(c); setShowForm(true); }} onDelete={() => handleDelete(c)} />)}
          </div>
        </section>
      </div>

      {showDamaged && (
        <div style={{ marginTop:28 }}>
          <div style={{ color:'var(--red)', fontSize:11, fontWeight:600, marginBottom:14 }}>DAMAGED / LOST — {damaged.length}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:10 }}>
            {damaged.map(c => <CardItem key={c.card_id} card={c} isAdmin={isAdmin} onEditNote={() => openNoteEditor(c)} onEdit={() => { setEditing(c); setShowForm(true); }} onDelete={() => handleDelete(c)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card Item ─────────────────────────────────────────────────
function CardItem({ card: c, isAdmin, onEdit, onDelete, onEditNote }) {
  const colorMap = {
    available: { text:'var(--green)',  border:'rgba(63,185,80,.2)'   },
    assigned:  { text:'var(--blue)',   border:'rgba(56,139,253,.25)' },
    lost:      { text:'var(--red)',    border:'rgba(248,81,73,.2)'   },
    retired:   { text:'var(--purple)', border:'rgba(163,113,247,.2)' },
  };
  const getSubtext = () => {
    if (c.visitor_name) return c.visitor_name;
    if (c.status === 'lost' || c.status === 'retired') return 'Unavailable';
    return 'Ready to assign';
  };
  const col = colorMap[c.status] || colorMap.available;

  return (
    <div style={{ background:'var(--panel)', border:`1px solid ${col.border}`, borderRadius:10, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:col.text, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:600, color:col.text }}>{c.card_uid}</div>
        <div style={{ fontSize:12, color: c.visitor_name?'var(--text)':'var(--dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {getSubtext()}
        </div>
        <div style={{ fontSize:11, color:'var(--dim)', marginTop:2 }}>
          🏢 {floorsDisplay(c.accessible_floors)}
        </div>
        {c.last_note && (
          <div style={{ fontSize:11, color:'var(--blue)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            📝 {c.last_note}
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        {!isAdmin ? (
          <button onClick={onEditNote} title="Add Note"
            style={{ width:26, height:26, borderRadius:6, background:'transparent', border:'1px solid var(--border2)', cursor:'pointer', fontSize:12 }}>📝</button>
        ) : (
          <>
            <button onClick={onEdit} title="Edit"
              style={{ width:26, height:26, borderRadius:6, background:'transparent', border:'1px solid var(--border2)', cursor:'pointer', fontSize:12 }}>✏</button>
            {c.status !== 'assigned' && (
              <button onClick={onDelete} title="Delete"
                style={{ width:26, height:26, borderRadius:6, background:'transparent', border:'1px solid rgba(248,81,73,.25)', color:'var(--red)', cursor:'pointer', fontSize:12 }}>🗑</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Card Form ─────────────────────────────────────────────────
function CardForm({ card, floors, onClose, onSaved, onError }) {
  const [cardUid,     setCardUid]     = useState(card?.card_uid  || '');
  const [status,      setStatus]      = useState(card?.status    || 'available');
  const [lastNote,    setLastNote]    = useState(card?.last_note || '');
  const [floorAccess, setFloorAccess] = useState(() => {
    if (!card?.accessible_floors || card.accessible_floors.length === 0) return 'general';
    return card.accessible_floors[0] || 'general';
  });
  const [submitting, setSubmitting] = useState(false);

  const wasUnavailable   = card?.status === 'lost' || card?.status === 'retired';
  const restoringToAvail = wasUnavailable && status === 'available';
  const willClearNote    = restoringToAvail && card?.last_note;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const accessibleFloors = floorAccess === 'general' ? [] : [floorAccess];
      if (card) {
        await api.patch(`/cards/${card.card_id}`, {
          card_uid:          cardUid,
          status,
          last_note:         restoringToAvail ? '' : lastNote,
          accessible_floors: accessibleFloors,
        });
      } else {
        await api.post('/cards', {
          card_uid:          cardUid.trim(),
          accessible_floors: accessibleFloors,
        });
      }
      onSaved();
    } catch (err) { onError(err.response?.data?.error || 'Save failed.'); }
    setSubmitting(false);
  }

  const s = { background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, padding:'9px 12px', fontSize:13, color:'var(--text)', width:'100%', outline:'none' };
  const l = { fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)', marginBottom:4, display:'block' };

  return (
    <div style={{ background:'var(--panel)', border:'1px solid var(--border2)', borderRadius:10, marginBottom:20 }}>
      <form onSubmit={handleSubmit} style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>

        {/* Card UID */}
        <div>
          <label style={l}>CARD UID</label>
          <input value={cardUid} onChange={e => setCardUid(e.target.value)} placeholder="Enter UID..." required style={s} />
        </div>

        {/* Floor Access — uses floors from DB */}
        <div>
          <label style={l}>FLOOR ACCESS</label>
          <select value={floorAccess} onChange={e => setFloorAccess(e.target.value)} style={s}>
            <option value="general">General (All Floors)</option>
            {floors.map(f => (
              <option key={f} value={f}>{f === 'G' ? 'Ground Floor (G)' : `Floor ${f}`}</option>
            ))}
          </select>
          <div style={{ fontSize:11, color:'var(--dim)', marginTop:5 }}>
            {floorAccess === 'general'
              ? '🌐 This card will be accepted on all floors.'
              : `🏢 This card will only be accepted on Floor ${floorAccess}.`}
          </div>
          {floors.length === 0 && (
            <div style={{ fontSize:11, color:'var(--amber)', marginTop:4 }}>
              No floors configured. Go to Departments → Manage Floors to add floors.
            </div>
          )}
        </div>

        {/* Status — edit only */}
        {card && (
          <div>
            <label style={l}>STATUS</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={s}>
              {STATUSES.map(st => (
                <option key={st} value={st} disabled={st === 'assigned' && status !== 'assigned'}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                  {st === 'assigned' ? ' (auto-managed)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Note-clearing warning */}
        {willClearNote && (
          <div style={{ background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.25)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'var(--red)' }}>
            ⚠ Setting status to available will automatically clear the existing note.
          </div>
        )}

        {/* Internal note */}
        {!restoringToAvail && (
          <div>
            <label style={l}>INTERNAL NOTE</label>
            <textarea value={lastNote} onChange={e => setLastNote(e.target.value)} placeholder="Maintenance notes..."
              style={{ ...s, minHeight:60, resize:'vertical' }} />
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
          <button type="button" onClick={onClose} style={{ cursor:'pointer', background:'none', border:'none', color:'var(--dim)', fontSize:13 }}>Cancel</button>
          <button type="submit" disabled={submitting}
            style={{ cursor:'pointer', background:'var(--blue)', color:'#fff', border:'none', padding:'8px 20px', borderRadius:7, fontWeight:600, fontSize:13, opacity: submitting ? .6 : 1 }}>
            {submitting ? 'Saving...' : card ? 'Save Changes' : 'Add Card'}
          </button>
        </div>
      </form>
    </div>
  );
}