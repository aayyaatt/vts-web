import { useState, useEffect } from 'react';
import api from '../api';

const PURPOSES = ['Business Meeting', 'Interview', 'Maintenance / Repair', 'Delivery', 'Government Official', 'Other'];

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
    return (
      v.full_name.toLowerCase().includes(q) ||
      v.cpr_number.includes(q) ||
      (v.company || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }} className="fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Check-In</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
            Select a visitor from the list or register a new one manually.
          </p>
        </div>
        <button
          onClick={onManual}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 8,
            background: 'var(--blue)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--sans)',
          }}
        >
          ✚ Manual Check-In
        </button>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--dim)', fontSize: 14, pointerEvents: 'none'
        }}>🔍</span>
        <input
          type="text"
          placeholder="Search by name, CPR number or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', background: 'var(--panel2)',
            border: '1px solid var(--border2)', borderRadius: 8,
            padding: '10px 14px 10px 40px', fontSize: 13,
            color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none',
          }}
        />
      </div>

      {/* Visitor list */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden'
      }}>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr',
          padding: '10px 18px', borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)'
        }}>
          {['Visitor', 'CPR Number', 'Company', 'Last Visit'].map(h => (
            <span key={h} style={{
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.08em',
              color: 'var(--dim)', textTransform: 'uppercase'
            }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            Loading visitors…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            {search ? 'No visitors match your search.' : 'No visitors registered yet.'}
          </div>
        ) : (
          filtered.map(v => (
            <div
              key={v.visitor_id}
              onClick={() => onSelect(v)}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr',
                padding: '13px 18px', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Name + initials */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #1a3a6e, var(--blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff'
                }}>
                  {v.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{v.full_name}</div>
                  {v.phone && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{v.phone}</div>}
                </div>
              </div>

              {/* CPR */}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)', alignSelf: 'center' }}>
                {v.cpr_number}
              </div>

              {/* Company */}
              <div style={{ fontSize: 13, color: 'var(--dim)', alignSelf: 'center' }}>
                {v.company || '—'}
              </div>

              {/* Date */}
              <div style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'var(--mono)', alignSelf: 'center' }}>
                {new Date(v.created_at).toLocaleDateString('en-GB')}
              </div>
            </div>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--dim)', marginTop: 10, textAlign: 'right' }}>
          {filtered.length} visitor{filtered.length !== 1 ? 's' : ''} found — click a row to continue
        </p>
      )}
    </div>
  );
}

// ── Step 2: Manual Registration Form ─────────────────────────
function ManualForm({ onBack, onRegistered }) {
  const [form, setForm]         = useState({ full_name: '', cpr_number: '', phone: '', email: '', company: '', host_employee: '', purpose: '', notes: '' });
  const [cprStatus, setCprStatus] = useState(null);
  const [flagInfo,  setFlagInfo]  = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

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
    setError(''); setSubmitting(true);
    try {
      const { data } = await api.post('/visitors', { ...form });
      onRegistered({ ...data, host_employee: form.host_employee, purpose: form.purpose, notes: form.notes });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    }
    setSubmitting(false);
  }

  const input = (field, placeholder, opts = {}) => (
    <input
      value={form[field]} onChange={set(field)}
      placeholder={placeholder}
      style={{
        background: 'var(--panel2)', border: '1px solid var(--border2)',
        borderRadius: 7, padding: '9px 12px', fontSize: 13,
        color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none', width: '100%',
      }}
      {...opts}
    />
  );

  const fieldLabel = txt => (
    <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', color: 'var(--dim)' }}>{txt}</label>
  );

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }} className="fade-in">

      {/* Back button */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none',
        border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer',
        fontFamily: 'var(--sans)', marginBottom: 20, padding: 0
      }}>
        ← Back to visitor list
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Manual Check-In</h1>
      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 20 }}>Enter visitor details to register and proceed to card assignment.</p>

      {error && (
        <div style={{ background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
          ✕ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Visitor Info */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'var(--blue)', color: '#fff', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>1</span>
            Visitor Information
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fieldLabel('FULL NAME *')}
                {input('full_name', 'e.g. Mohammed Al-Rashid', { required: true })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fieldLabel('CPR NUMBER *')}
                {input('cpr_number', '9 digits', { required: true, maxLength: 9 })}
                {cprStatus === 'ok'      && <p style={{ fontSize: 11, color: 'var(--green)', margin: 0 }}>✓ Verified — not on banned list</p>}
                {cprStatus === 'flagged' && <p style={{ fontSize: 11, color: 'var(--red)',   margin: 0 }}>⛔ FLAGGED: {flagInfo?.reason}</p>}
                {cprStatus === 'checking'&& <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0 }}>● Checking…</p>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fieldLabel('PHONE')}
                {input('phone', '+973 XXXX XXXX')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fieldLabel('COMPANY')}
                {input('company', 'Optional')}
              </div>
            </div>
          </div>
        </div>

        {/* Visit Details */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'var(--blue)', color: '#fff', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</span>
            Visit Details
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fieldLabel('HOST EMPLOYEE *')}
                {input('host_employee', 'Employee name', { required: true })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fieldLabel('PURPOSE *')}
                <select
                  value={form.purpose} onChange={set('purpose')} required
                  style={{ background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none', width: '100%' }}
                >
                  <option value="">— Select —</option>
                  {PURPOSES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fieldLabel('NOTES')}
              <textarea
                value={form.notes} onChange={set('notes')} rows={3}
                placeholder="Any special instructions…"
                style={{ background: 'var(--panel2)', border: '1px solid var(--border2)', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none', width: '100%', resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || cprStatus === 'flagged'}
          style={{
            width: '100%', padding: 13, borderRadius: 8,
            background: submitting || cprStatus === 'flagged' ? 'var(--panel2)' : 'var(--blue)',
            color: submitting || cprStatus === 'flagged' ? 'var(--dim)' : '#fff',
            border: 'none', fontSize: 14, fontWeight: 600,
            cursor: submitting || cprStatus === 'flagged' ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--sans)',
          }}
        >
          {submitting ? 'Saving…' : 'Continue to Card Assignment →'}
        </button>
      </form>
    </div>
  );
}

// ── Step 3: Card Assignment ───────────────────────────────────
function CardAssignment({ visitor, onBack, onDone }) {
  const [cards,      setCards]      = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

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
    // Upsert visitor to get visitor_id
    const vRes = await api.post('/visitors', {
      full_name:  visitor.full_name,
      cpr_number: visitor.cpr_number,
      phone:      visitor.phone,
      email:      visitor.email,
      company:    visitor.company,
    });

    // Create visit with status 'active'
    await api.post('/visits', {
      visitor_id:    vRes.data.visitor_id,
      card_id:       selectedCard.card_id,
      host_employee: visitor.host_employee,
      purpose:       visitor.purpose,
      notes:         visitor.notes,
    });

    onDone({ visitor, card: selectedCard });
  } catch (err) {
    setError(err.response?.data?.error || 'Assignment failed.');
  }
  setSubmitting(false);
}

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }} className="fade-in">

      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none',
        border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer',
        fontFamily: 'var(--sans)', marginBottom: 20, padding: 0
      }}>
        ← Back
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Assign Access Card</h1>
      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 24 }}>
        Select a card to assign to <strong style={{ color: 'var(--text)' }}>{visitor.full_name}</strong> and hand it to them.
      </p>

      {error && (
        <div style={{ background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
          ✕ {error}
        </div>
      )}

      {/* Visitor summary */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>Visitor Summary</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['Name',    visitor.full_name],
            ['CPR',     visitor.cpr_number],
            ['Host',    visitor.host_employee || '—'],
            ['Purpose', visitor.purpose || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.08em' }}>{label.toUpperCase()}</span>
              <div style={{ fontSize: 13, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Card selection */}
      {cards.length === 0 ? (
        <div style={{ background: 'rgba(240,160,52,.08)', border: '1px solid rgba(240,160,52,.25)', borderRadius: 10, padding: 24, textAlign: 'center', color: 'var(--amber)', marginBottom: 20 }}>
          ⚠ No access cards available. Please return a card before checking in a new visitor.
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12 }}>
            {cards.length} card{cards.length !== 1 ? 's' : ''} available — select one:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
            {cards.map(c => (
              <div
                key={c.card_id}
                onClick={() => setSelectedCard(c)}
                style={{
                  background: selectedCard?.card_id === c.card_id ? 'rgba(56,139,253,.15)' : 'var(--panel)',
                  border: `2px solid ${selectedCard?.card_id === c.card_id ? 'var(--blue)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                  transition: 'all .15s', textAlign: 'center',
                }}
              >
                <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>
                  {c.card_uid}
                </div>
                <div style={{ fontSize: 11, color: 'var(--dim)' }}>Available</div>
                {selectedCard?.card_id === c.card_id && (
                  <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 4, fontWeight: 600 }}>✓ Selected</div>
                )}
              </div>
            ))}
          </div>

          {/* Selected card visual */}
          {selectedCard && (
            <div style={{ background: 'linear-gradient(135deg,#1a2f5c,#0d1a3a)', border: '1px solid rgba(56,139,253,.3)', borderRadius: 12, padding: 20, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 20, background: 'linear-gradient(135deg,var(--amber),#c8780a)', borderRadius: 3, opacity: .8 }} />
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.4)', marginBottom: 4 }}>VISITOR CARD</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--blue)', letterSpacing: '.1em', marginBottom: 4 }}>{selectedCard.card_uid}</div>
              <div style={{ fontSize: 12, color: 'var(--dim)' }}>Assigned to: {visitor.full_name}</div>
            </div>
          )}

          <button
            onClick={handleAssign}
            disabled={submitting || !selectedCard}
            style={{
              width: '100%', padding: 13, borderRadius: 8,
              background: !selectedCard || submitting ? 'var(--panel2)' : 'var(--green)',
              color: !selectedCard || submitting ? 'var(--dim)' : '#000',
              border: 'none', fontSize: 14, fontWeight: 700,
              cursor: !selectedCard || submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--sans)',
            }}
          >
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
    <div style={{ padding: 24, maxWidth: 480, margin: '80px auto 0', textAlign: 'center' }} className="fade-in">
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 40px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>Check-In Complete</h2>
        <p style={{ fontSize: 14, color: 'var(--dim)', marginBottom: 24 }}>
          Card <strong style={{ color: 'var(--blue)' }}>{result.card.card_uid}</strong> has been handed to <strong style={{ color: 'var(--text)' }}>{result.visitor.full_name}</strong>.
        </p>
        <div style={{ background: 'var(--panel2)', borderRadius: 8, padding: 16, marginBottom: 24, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Visitor', result.visitor.full_name],
            ['CPR',     result.visitor.cpr_number],
            ['Card',    result.card.card_uid],
            ['Time',    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.1em', textTransform: 'uppercase', minWidth: 55, paddingTop: 2 }}>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <button
          onClick={onReset}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
        >
          ✚ New Check-In
        </button>
      </div>
    </div>
  );
}

// ── Main CheckIn component ────────────────────────────────────
export default function CheckIn() {
  // step: 'list' | 'manual' | 'card' | 'success'
  const [step,    setStep]    = useState('list');
  const [visitor, setVisitor] = useState(null);
  const [result,  setResult]  = useState(null);

  function handleSelectVisitor(v) {
    setVisitor(v);
    setStep('card');
  }

  function handleManualRegistered(v) {
    setVisitor(v);
    setStep('card');
  }

  function handleDone(r) {
    setResult(r);
    setStep('success');
  }

  function handleReset() {
    setVisitor(null);
    setResult(null);
    setStep('list');
  }

  if (step === 'list')    return <VisitorList    onSelect={handleSelectVisitor} onManual={() => setStep('manual')} />;
  if (step === 'manual')  return <ManualForm     onBack={() => setStep('list')} onRegistered={handleManualRegistered} />;
  if (step === 'card')    return <CardAssignment visitor={visitor} onBack={() => setStep(visitor?.visitor_id ? 'list' : 'manual')} onDone={handleDone} />;
  if (step === 'success') return <SuccessScreen  result={result} onReset={handleReset} />;
}