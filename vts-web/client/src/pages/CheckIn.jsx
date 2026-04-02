import { useState, useEffect } from 'react';
import api from '../api';

const PURPOSES = ['Business Meeting', 'Interview', 'Maintenance / Repair', 'Delivery', 'Government Official', 'Other'];

// ── Shared Visit Details Form ─────────────────────────────────
function VisitDetailsForm({ departments, onChange, initial = {} }) {
  const [host,    setHost]    = useState(initial.host_employee || '');
  const [purpose, setPurpose] = useState(initial.purpose       || '');
  const [deptId,  setDeptId]  = useState(initial.department_id ? String(initial.department_id) : '');
  const [notes,   setNotes]   = useState(initial.notes         || '');
  useEffect(() => {
    onChange({ host_employee: host, purpose, department_id: deptId || null, notes });
  }, [host, purpose, deptId, notes]);

  const inputStyle = { background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none', width: '100%' };
  const labelStyle = { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', color: 'var(--dim)' };
  const selectedDept = departments.find(d => String(d.department_id) === String(deptId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>HOST EMPLOYEE *</label>
          <input value={host} onChange={e => setHost(e.target.value)} placeholder="Employee name" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>PURPOSE *</label>
          <select value={purpose} onChange={e => setPurpose(e.target.value)} style={inputStyle}>
            <option value="">— Select —</option>
            {PURPOSES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>DEPARTMENT</label>
          <select value={deptId} onChange={e => setDeptId(e.target.value)} style={inputStyle}>
            <option value="">— Select Department —</option>
            {departments.map(d => (
              <option key={d.department_id} value={d.department_id}>{d.name} — {d.floor}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>FLOOR (AUTO-FILLED)</label>
          <div style={{ ...inputStyle, color: selectedDept ? 'var(--blue)' : 'var(--faint)', border: '1px solid var(--border)', fontFamily: 'var(--mono)', fontWeight: selectedDept ? 600 : 400 }}>
            {selectedDept ? selectedDept.floor : '— Select a department —'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={labelStyle}>NOTES</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any special instructions…" style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
    </div>
  );
}

// ── Step 1: Visitor List ──────────────────────────────────────
function VisitorList({ onSelect, onManual }) {
  const [visitors, setVisitors] = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get('/visitors').then(r => { setVisitors(r.data); setLoading(false); });
  }, []);

  const filtered = visitors.filter(v => {
    const q = search.toLowerCase();
    return v.full_name.toLowerCase().includes(q) || v.cpr_number.includes(q) || (v.company || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Check-In</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>Select a returning visitor or register a new one manually.</p>
        </div>
        <button onClick={onManual} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
          ✚ New Visitor
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
        <input type="text" placeholder="Search by name, CPR or company…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px 10px 40px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none' }} />
      </div>

      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr', padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          {['Visitor', 'CPR Number', 'Company', 'Registered'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.08em', color: 'var(--dim)', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>Loading visitors…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>{search ? 'No visitors match your search.' : 'No visitors registered yet.'}</div>
        ) : filtered.map(v => (
          <div key={v.visitor_id} onClick={() => onSelect(v)}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr', padding: '13px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#1a3a6e,var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                {v.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{v.full_name}</div>
                {v.phone && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{v.phone}</div>}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)', alignSelf: 'center' }}>{v.cpr_number}</div>
            <div style={{ fontSize: 13, color: 'var(--dim)', alignSelf: 'center' }}>{v.company || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'var(--mono)', alignSelf: 'center' }}>{new Date(v.created_at).toLocaleDateString('en-GB')}</div>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--dim)', marginTop: 10, textAlign: 'right' }}>
          {filtered.length} visitor{filtered.length !== 1 ? 's' : ''} — click a row to continue
        </p>
      )}
    </div>
  );
}

// ── Step 2a: New Visitor Manual Form ─────────────────────────
function ManualForm({ onBack, onRegistered }) {
  const [form,        setForm]        = useState({ full_name: '', cpr_number: '', phone: '', email: '', company: '' });
  const [visitData,   setVisitData]   = useState({ host_employee: '', purpose: '', department_id: null, notes: '' });
  const [departments, setDepartments] = useState([]);
  const [cprStatus,   setCprStatus]   = useState(null);
  const [flagInfo,    setFlagInfo]    = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => { api.get('/departments').then(r => setDepartments(r.data.filter(d => d.is_active))); }, []);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  useEffect(() => {
    if (form.cpr_number.length < 5) { setCprStatus(null); setFlagInfo(null); return; }
    setCprStatus('checking');
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post('/visitors/check-cpr', { cpr_number: form.cpr_number });
        if (data.flagged) { setCprStatus('flagged'); setFlagInfo(data.flag); }
        else { setCprStatus('ok'); setFlagInfo(null); }
      } catch { setCprStatus(null); }
    }, 600);
    return () => clearTimeout(t);
  }, [form.cpr_number]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (cprStatus === 'flagged') { setError('Cannot check in a flagged visitor.'); return; }
    if (!visitData.host_employee || !visitData.purpose) { setError('Host employee and purpose are required.'); return; }
    setError(''); setSubmitting(true);
    try {
      const { data } = await api.post('/visitors', { ...form });
      // Enrich with department info
      const dept = departments.find(d => String(d.department_id) === String(visitData.department_id));
      onRegistered({ ...data, ...visitData, department_name: dept?.name || null, floor: dept?.floor || null });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    }
    setSubmitting(false);
  }

  const inputStyle = { background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none', width: '100%' };
  const labelStyle = { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', color: 'var(--dim)' };

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }} className="fade-in">
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)', marginBottom: 20, padding: 0 }}>
        ← Back to visitor list
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>New Visitor Check-In</h1>
      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 20 }}>Fill in visitor and visit details to proceed to card assignment.</p>

      {error && <div style={{ background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>✕ {error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Section 1 - Visitor Info */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'var(--blue)', color: '#fff', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>1</span>
            Visitor Information
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>FULL NAME *</label>
                <input value={form.full_name} onChange={set('full_name')} placeholder="e.g. Mohammed Al-Rashid" required style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>CPR NUMBER *</label>
                <input value={form.cpr_number} onChange={set('cpr_number')} placeholder="9 digits" maxLength={9} required style={inputStyle} />
                {cprStatus === 'ok'       && <p style={{ fontSize: 11, color: 'var(--green)', margin: 0 }}>✓ Verified</p>}
                {cprStatus === 'flagged'  && <p style={{ fontSize: 11, color: 'var(--red)',   margin: 0 }}>⛔ FLAGGED: {flagInfo?.reason}</p>}
                {cprStatus === 'checking' && <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0 }}>● Checking…</p>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>PHONE</label>
                <input value={form.phone} onChange={set('phone')} placeholder="+973 XXXX XXXX" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>COMPANY</label>
                <input value={form.company} onChange={set('company')} placeholder="Optional" style={inputStyle} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 - Visit Details */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'var(--blue)', color: '#fff', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</span>
            Visit Details
          </div>
          <div style={{ padding: 18 }}>
            <VisitDetailsForm departments={departments} onChange={setVisitData} />
          </div>
        </div>

        <button type="submit" disabled={submitting || cprStatus === 'flagged'}
          style={{ width: '100%', padding: 13, borderRadius: 8, background: submitting || cprStatus === 'flagged' ? 'var(--panel2)' : 'var(--blue)', color: submitting || cprStatus === 'flagged' ? 'var(--dim)' : '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
          {submitting ? 'Saving…' : 'Continue to Card Assignment →'}
        </button>
      </form>
    </div>
  );
}

// ── Step 2b: Returning Visitor — fill visit details ───────────
function ReturningVisitorForm({ visitor, onBack, onContinue }) {
  const [visitData,   setVisitData]   = useState({ host_employee: '', purpose: '', department_id: null, notes: '' });
  const [departments, setDepartments] = useState([]);
  const [error,       setError]       = useState('');

  useEffect(() => { api.get('/departments').then(r => setDepartments(r.data.filter(d => d.is_active))); }, []);
 
  <VisitDetailsForm
  departments={departments}
  onChange={setVisitData}
  initial={{
    host_employee: visitor.pre_host        || '',
    purpose:       visitor.pre_purpose     || '',
    department_id: visitor.pre_department_id || '',
    notes:         '',
  }}
/>
{visitor.pre_status === 'pending' && (
  <div style={{ background:'rgba(56,139,253,.08)', border:'1px solid rgba(56,139,253,.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--blue)', marginBottom:16 }}>
    ℹ️ This visitor pre-registered via Google Forms. Details have been auto-filled — review and confirm.
  </div>
)}
  function handleSubmit(e) {
    e.preventDefault();
    if (!visitData.host_employee || !visitData.purpose) { setError('Host employee and purpose are required.'); return; }
    const dept = departments.find(d => String(d.department_id) === String(visitData.department_id));
    onContinue({ ...visitor, ...visitData, department_name: dept?.name || null, floor: dept?.floor || null });
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }} className="fade-in">
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)', marginBottom: 20, padding: 0 }}>
        ← Back to visitor list
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Returning Visitor</h1>
      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 20 }}>
        Enter visit details for <strong style={{ color: 'var(--text)' }}>{visitor.full_name}</strong>
      </p>

      {/* Visitor summary */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {[['Name', visitor.full_name], ['CPR', visitor.cpr_number], ['Company', visitor.company || '—']].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.08em', marginBottom: 4 }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>✕ {error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>Visit Details</div>
          <div style={{ padding: 18 }}>
            <VisitDetailsForm departments={departments} onChange={setVisitData} />
          </div>
        </div>
        <button type="submit" style={{ width: '100%', padding: 13, borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
          Continue to Card Assignment →
        </button>
      </form>
    </div>
  );
}

// ── Step 3: Card Assignment ───────────────────────────────────
function CardAssignment({ visitor, onBack, onDone }) {
  const [cards,        setCards]        = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    api.get('/cards').then(r => {
      const available = r.data.filter(c => c.status === 'available');
      setCards(available);
      if (available.length > 0) setSelectedCard(available[0]);
    });
  }, []);

  async function handleAssign() {
    if (!selectedCard) { setError('No card selected.'); return; }
    setError(''); setSubmitting(true);
    try {
      const vRes = await api.post('/visitors', {
        full_name:  visitor.full_name,
        cpr_number: visitor.cpr_number,
        phone:      visitor.phone  || null,
        email:      visitor.email  || null,
        company:    visitor.company|| null,
      });

      await api.post('/visits', {
        visitor_id:    vRes.data.visitor_id,
        card_id:       selectedCard.card_id,
        host_employee: visitor.host_employee || null,
        purpose:       visitor.purpose       || null,
        notes:         visitor.notes         || null,
        department_id: visitor.department_id || null,
      });

      onDone({ visitor, card: selectedCard });
    } catch (err) {
      setError(err.response?.data?.error || 'Assignment failed.');
    }
    setSubmitting(false);
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }} className="fade-in">
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)', marginBottom: 20, padding: 0 }}>
        ← Back
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Assign Access Card</h1>
      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 24 }}>
        Assign a card to <strong style={{ color: 'var(--text)' }}>{visitor.full_name}</strong> and hand it to them.
      </p>

      {error && <div style={{ background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>✕ {error}</div>}

      {/* Visit summary */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>Visit Summary</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Visitor',    visitor.full_name],
            ['CPR',        visitor.cpr_number],
            ['Host',       visitor.host_employee  || '—'],
            ['Purpose',    visitor.purpose        || '—'],
            ['Department', visitor.department_name|| '—'],
            ['Floor',      visitor.floor          || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.08em' }}>{label.toUpperCase()}</span>
              <div style={{ fontSize: 13, marginTop: 2, color: label === 'Floor' ? 'var(--blue)' : 'var(--text)', fontWeight: label === 'Floor' ? 600 : 400 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <div style={{ background: 'rgba(240,160,52,.08)', border: '1px solid rgba(240,160,52,.25)', borderRadius: 10, padding: 24, textAlign: 'center', color: 'var(--amber)', marginBottom: 20 }}>
          ⚠ No access cards available.
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12 }}>{cards.length} card{cards.length !== 1 ? 's' : ''} available — select one:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
            {cards.map(c => (
              <div key={c.card_id} onClick={() => setSelectedCard(c)}
                style={{ background: selectedCard?.card_id === c.card_id ? 'rgba(56,139,253,.15)' : 'var(--panel)', border: `2px solid ${selectedCard?.card_id === c.card_id ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>{c.card_uid}</div>
                {selectedCard?.card_id === c.card_id && <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600 }}>✓ Selected</div>}
              </div>
            ))}
          </div>

          {selectedCard && (
            <div style={{ background: 'linear-gradient(135deg,#1a2f5c,#0d1a3a)', border: '1px solid rgba(56,139,253,.3)', borderRadius: 12, padding: 20, marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 20, background: 'linear-gradient(135deg,var(--amber),#c8780a)', borderRadius: 3, opacity: .8 }} />
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.4)', marginBottom: 4 }}>VISITOR CARD</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--blue)', letterSpacing: '.1em', marginBottom: 4 }}>{selectedCard.card_uid}</div>
              <div style={{ fontSize: 12, color: 'var(--dim)' }}>Assigned to: {visitor.full_name}</div>
            </div>
          )}

          <button onClick={handleAssign} disabled={submitting || !selectedCard}
            style={{ width: '100%', padding: 13, borderRadius: 8, background: !selectedCard || submitting ? 'var(--panel2)' : 'var(--green)', color: !selectedCard || submitting ? 'var(--dim)' : '#000', border: 'none', fontSize: 14, fontWeight: 700, cursor: !selectedCard || submitting ? 'not-allowed' : 'pointer', fontFamily: 'var(--sans)' }}>
            {submitting ? 'Assigning…' : `✅ Confirm & Hand Card ${selectedCard?.card_uid || ''} to Visitor`}
          </button>
        </>
      )}
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────
function SuccessScreen({ result, onReset }) {
  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '60px auto 0', textAlign: 'center' }} className="fade-in">
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 40px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>Check-In Complete</h2>
        <p style={{ fontSize: 14, color: 'var(--dim)', marginBottom: 24 }}>
          Card <strong style={{ color: 'var(--blue)' }}>{result.card.card_uid}</strong> handed to <strong>{result.visitor.full_name}</strong>
        </p>
        <div style={{ background: 'var(--panel2)', borderRadius: 8, padding: 16, marginBottom: 24, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Visitor',    result.visitor.full_name],
            ['CPR',        result.visitor.cpr_number],
            ['Host',       result.visitor.host_employee  || '—'],
            ['Department', result.visitor.department_name|| '—'],
            ['Floor',      result.visitor.floor          || '—'],
            ['Card',       result.card.card_uid],
            ['Time',       new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.1em', textTransform: 'uppercase', minWidth: 80, paddingTop: 2 }}>{label}</span>
              <strong style={{ color: label === 'Floor' ? 'var(--blue)' : 'var(--text)' }}>{value}</strong>
            </div>
          ))}
        </div>
        <button onClick={onReset} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
          ✚ New Check-In
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CheckIn() {
  const [step,    setStep]    = useState('list');
  const [visitor, setVisitor] = useState(null);
  const [result,  setResult]  = useState(null);

  function handleReset() { setVisitor(null); setResult(null); setStep('list'); }

  if (step === 'list')      return <VisitorList         onSelect={v => { setVisitor(v); setStep('returning'); }} onManual={() => setStep('manual')} />;
  if (step === 'manual')    return <ManualForm           onBack={() => setStep('list')} onRegistered={v => { setVisitor(v); setStep('card'); }} />;
  if (step === 'returning') return <ReturningVisitorForm visitor={visitor} onBack={() => setStep('list')} onContinue={v => { setVisitor(v); setStep('card'); }} />;
  if (step === 'card')      return <CardAssignment       visitor={visitor} onBack={() => setStep(visitor?.visitor_id ? 'returning' : 'manual')} onDone={r => { setResult(r); setStep('success'); }} />;
  if (step === 'success')   return <SuccessScreen        result={result} onReset={handleReset} />;
}