import { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import useCardReader from '../hooks/useCardReader';

const PURPOSES = ['Business Meeting', 'Interview', 'Maintenance / Repair', 'Delivery', 'Government Official', 'Other'];
const NOTES_MAX_LINES = 3;
const NOTES_MAX_CHARS = 300;

// ── Visit Details Form ────────────────────────────────────────
function VisitDetailsForm({ departments, onChange, required = {} }) {
  const [host,         setHost]         = useState('');
  const [purpose,      setPurpose]      = useState('');
  const [otherPurpose, setOtherPurpose] = useState('');
  const [deptId,       setDeptId]       = useState('');
  const [notes,        setNotes]        = useState('');

  useEffect(() => {
    const finalPurpose = purpose === 'Other' ? otherPurpose : purpose;
    onChange({ host_employee: host, purpose: finalPurpose, department_id: deptId || null, notes });
  }, [host, purpose, otherPurpose, deptId, notes]);

  const s = { background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, padding:'9px 12px', fontSize:13, color:'var(--text)', fontFamily:'var(--sans)', outline:'none', width:'100%' };
  const l = { fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' };
  const dept = departments.find(d => String(d.department_id) === String(deptId));

  function handleNotes(e) {
    const val = e.target.value;
    if (val.split('\n').length > NOTES_MAX_LINES) return;
    if (val.length > NOTES_MAX_CHARS) return;
    setNotes(val);
  }

  function handleOtherPurpose(e) {
    const val = e.target.value;
    if (val.split('\n').length > 2) return;
    setOtherPurpose(val);
  }

  const notesLines = notes.split('\n').length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={l}>DEPARTMENT *</label>
          <select value={deptId} onChange={e => setDeptId(e.target.value)} required style={{ ...s, borderColor: !deptId ? 'var(--border)' : 'var(--border2)' }}>
            <option value="">— Select Department —</option>
            {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.name} — {d.floor}</option>)}
          </select>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={l}>FLOOR (AUTO-FILLED)</label>
          <div style={{ ...s, color:dept?'var(--blue)':'var(--faint)', border:'1px solid var(--border)', fontFamily:'var(--mono)', fontWeight:dept?600:400 }}>
            {dept ? dept.floor : '— Select a department —'}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={l}>HOST EMPLOYEE <span style={{ color:'var(--dim)', fontSize:9 }}>(OPTIONAL)</span></label>
          <input value={host} onChange={e => setHost(e.target.value)} placeholder="Employee name" style={s} />
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={l}>PURPOSE *</label>
          <select value={purpose} onChange={e => setPurpose(e.target.value)} required={required.purpose} style={s}>
            <option value="">— Select —</option>
            {PURPOSES.map(p => <option key={p}>{p}</option>)}
          </select>
          {purpose === 'Other' && (
            <textarea value={otherPurpose} onChange={handleOtherPurpose} placeholder="Please describe the purpose…" maxLength={200} rows={2} required style={{ ...s, resize:'none', marginTop:4 }} />
          )}
        </div>

      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <label style={l}>NOTES</label>
          <span style={{ fontFamily:'var(--mono)', fontSize:10, color:notesLines >= NOTES_MAX_LINES?'var(--amber)':'var(--faint)' }}>
            {notesLines}/{NOTES_MAX_LINES} lines
          </span>
        </div>
        <textarea value={notes} onChange={handleNotes} rows={3} placeholder="Any special instructions… (3 lines max)" style={{ ...s, resize:'none' }} />
      </div>
    </div>
  );
}

// ── Main Check-In Page ────────────────────────────────────────
export default function CheckIn() {
  const [step,        setStep]        = useState('new-visitor');
  const [visitor,     setVisitor]     = useState(null);
  const [result,      setResult]      = useState(null);
  const [allVisitors, setAllVisitors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [savedForm,   setSavedForm]   = useState(null); // ← saves form when going to card assign

  useEffect(() => {
    Promise.all([api.get('/visitors'), api.get('/departments')]).then(([vRes, dRes]) => {
      setAllVisitors(vRes.data.filter(v => !v.is_active_visit));
      setDepartments(dRes.data.filter(d => d.is_active));
    });
  }, [step]);

  function handleReset() { setVisitor(null); setResult(null); setSavedForm(null); setStep('new-visitor'); }

  if (step === 'new-visitor')
    return <NewVisitorForm
      departments={departments}
      allVisitors={allVisitors}
      initialData={savedForm}         
      onDone={(v, formSnapshot) => {
        setSavedForm(formSnapshot);   
        setVisitor(v);
        setStep('card-assign');
      }}
    />;

  if (step === 'walkin-details')
    return <WalkInDetailsForm visitor={visitor} departments={departments}
      onBack={() => setStep('new-visitor')}
      onDone={v => { setVisitor(v); setStep('card-assign'); }} />;

  if (step === 'card-assign')
    return <CardAssignment visitor={visitor} departments={departments}
      onBack={() => setStep('new-visitor')}   // savedForm is already set, so form restores
      onDone={r => { setResult(r); setStep('success'); }} />;

  if (step === 'success')
    return <SuccessScreen result={result} onReset={handleReset} />;
}

// ── New Visitor Form ──────────────────────────────────────────
function NewVisitorForm({ departments, allVisitors, onDone, initialData }) {
  const [form, setForm] = useState(initialData?.form || { full_name:'', cpr_number:'', phone:'', email:'', company:'' });
  const [visitData, setVisitData] = useState(initialData?.visitData || { host_employee:'', purpose:'', department_id:null, notes:'' });
  const [cardScanned, setCardScanned] = useState(initialData?.cardScanned || false);
  const [returning,   setReturning]   = useState(initialData?.returning   || false);

//  const [visitData,   setVisitData]   = useState({ host_employee:'', purpose:'', department_id:null, notes:'' });
  const [flagInfo,    setFlagInfo]    = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
 // const [cardScanned, setCardScanned] = useState(false);
 // const [returning,   setReturning]   = useState(false); // true when matched a past visitor
  const [showPastList,setShowPastList]= useState(false);
  const [search,      setSearch]      = useState('');

  // ── Card reader callback ──────────────────────────────────────
  const handleCardRead = async (data) => {
    const d = data?.SmartcardData || data?.smartcardData || data?.Data || data || {};
    const cprRaw   = d.IdNumber        || d.idNumber        || d.CPR          || d.PersonalNumber || '';
    const nameRaw  = d.EnglishFullName || d.englishFullName || d.FullName      || '';
    const phoneRaw = d.MobileNumber    || d.mobileNumber    || d.Phone         || '';
    const compRaw  = d.EmploymentNameEnglish || d.employmentNameEnglish        || '';
    const cpr      = String(cprRaw).trim();

    if (!cpr) return;

    // Try to find this CPR in the existing visitors list first
    const existing = allVisitors.find(v => v.cpr_number === cpr);

    if (existing) {
      // Returning visitor — use stored database values, fall back to card data
      setForm({
        full_name:  existing.full_name  || String(nameRaw).trim()  || '',
        cpr_number: cpr,
        phone: (existing.phone || String(phoneRaw).trim() || '').replace(/^\+?973/, ''),
        email:      existing.email      || '',
        company:    existing.company    || String(compRaw).trim()  || '',
      });
      setReturning(true);
    } else {
      // New visitor — use card data
      setForm(p => ({
        ...p,
        cpr_number: cpr,
        full_name:  String(nameRaw).trim()  || p.full_name,
        phone: String(phoneRaw).trim().replace(/^\+?973/, '') || p.phone,
        company:    String(compRaw).trim()  || p.company,
      }));
      setReturning(false);
    }

    setCardScanned(true);

    // Check flagged list
    try {
      const { data: flagData } = await api.post('/visitors/check-cpr', { cpr_number: cpr });
      if (flagData.flagged) setFlagInfo(flagData.flag);
      else setFlagInfo(null);
    } catch {}
  };

  const { status: readerStatus, error: readerError, readCard, clearCard } = useCardReader(handleCardRead);

  function handleClearCard() {
    clearCard();
    setForm({ full_name:'', cpr_number:'', phone:'', email:'', company:'' });
    setCardScanned(false);
    setReturning(false);
    setFlagInfo(null);
  }

  // Manual CPR check (only when typing, not after card scan)
  useEffect(() => {
    if (cardScanned || form.cpr_number.length < 9) { if (!cardScanned) setFlagInfo(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post('/visitors/check-cpr', { cpr_number: form.cpr_number });
        if (data.flagged) setFlagInfo(data.flag);
        else setFlagInfo(null);
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [form.cpr_number, cardScanned]);

async function handleSubmit(e) {
  e.preventDefault();
  if (flagInfo)                 { setError('Cannot check in a flagged visitor.'); return; }
  if (!visitData.department_id) { setError('Department is required.'); return; }
  if (!visitData.purpose)       { setError('Purpose is required.'); return; }
  setError(''); setSubmitting(true);
  try {
    const { data } = await api.post('/visitors', {
      ...form,
      phone: form.phone ? `+973${form.phone.replace(/^\+?973/, '')}` : null,
    });
    const dept = departments.find(d => String(d.department_id) === String(visitData.department_id));

    // Save a snapshot so going back restores everything
    const snapshot = { form, visitData, cardScanned, returning };

    onDone(
      { ...data, ...visitData, department_name: dept?.name||null, floor: dept?.floor||null },
      snapshot   // ← second argument
    );
  } catch (err) { setError(err.response?.data?.error || 'Registration failed.'); }
  setSubmitting(false);
}

  function fs(locked) {
    return {
      background:   locked ? 'rgba(63,185,80,.06)' : 'var(--panel2)',
      border:       `1px solid ${locked ? 'rgba(63,185,80,.35)' : 'var(--border2)'}`,
      borderRadius: 7, padding:'9px 12px', fontSize:13,
      color:        locked ? 'var(--green)' : 'var(--text)',
      fontFamily:   'var(--sans)', outline:'none', width:'100%',
      cursor:       locked ? 'not-allowed' : 'text',
    };
  }
  const l = { fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' };

  const filteredPast = allVisitors.filter(v => {
    const q = search.toLowerCase();
    return v.full_name.toLowerCase().includes(q) || v.cpr_number.includes(q) || (v.company||'').toLowerCase().includes(q);
  });

  return (
    <div style={{ padding:24, maxWidth:700, margin:'0 auto' }} className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700 }}>Check-In</h1>
          <p style={{ fontSize:13, color:'var(--dim)', marginTop:3 }}>Scan visitor ID card or fill in details manually.</p>
        </div>
        <button type="button" onClick={() => setShowPastList(p => !p)}
          style={{ padding:'7px 16px', borderRadius:7, background:'transparent', color:'var(--dim)', border:'1px solid var(--border2)', fontSize:12, cursor:'pointer', fontFamily:'var(--sans)' }}>
          {showPastList ? '▲ Hide past visitors' : '▼ Past visitors'}
        </button>
      </div>

      {/* Past Visitors */}
      {showPastList && (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--dim)', pointerEvents:'none' }}>🔍</span>
              <input type="text" placeholder="Search by name, CPR or company…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width:'100%', background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, padding:'8px 14px 8px 36px', fontSize:13, color:'var(--text)', fontFamily:'var(--sans)', outline:'none' }} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1.2fr 1.2fr 80px', padding:'9px 16px', borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,.02)' }}>
            {['Visitor','CPR','Company',''].map(h => <span key={h} style={{ fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.08em', color:'var(--dim)', textTransform:'uppercase' }}>{h}</span>)}
          </div>
          {filteredPast.length === 0 ? (
            <div style={{ padding:'20px 0', textAlign:'center', color:'var(--dim)', fontSize:13 }}>No past visitors found.</div>
          ) : filteredPast.slice(0, 8).map(v => (
            <div key={v.visitor_id}
              style={{ display:'grid', gridTemplateColumns:'2fr 1.2fr 1.2fr 80px', padding:'11px 16px', borderBottom:'1px solid var(--border)', alignItems:'center', transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#1a3a6e,var(--blue))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
                  {v.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ fontSize:13, fontWeight:600 }}>{v.full_name}</div>
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--dim)' }}>{v.cpr_number}</div>
              <div style={{ fontSize:13, color:'var(--dim)' }}>{v.company||'—'}</div>
              <button onClick={() => {
                  setForm({ 
  full_name: v.full_name, 
  cpr_number: v.cpr_number, 
  phone: (v.phone || '').replace(/^\+?973/, ''), 
  email: v.email || '', 
  company: v.company || '' 
});
                  setCardScanned(true);
                  setReturning(true);
                  setShowPastList(false);
                }}
                style={{ padding:'5px 10px', borderRadius:6, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background:'var(--blue)', color:'#fff', border:'none', fontWeight:600 }}>
                Select
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Card Reader Widget */}
      <div style={{
        background: readerStatus==='done' ? 'rgba(63,185,80,.06)' : readerStatus==='reading' ? 'rgba(56,139,253,.08)' : readerStatus==='error' ? 'rgba(248,81,73,.06)' : 'rgba(56,139,253,.04)',
        border: `1px solid ${readerStatus==='done' ? 'rgba(63,185,80,.35)' : readerStatus==='error' ? 'rgba(248,81,73,.3)' : 'rgba(56,139,253,.25)'}`,
        borderRadius:10, padding:'14px 18px', marginBottom:20,
        display:'flex', alignItems:'center', gap:14,
      }}>
        <div style={{ fontSize:26, flexShrink:0 }}>🪪</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:2 }}>
            {readerStatus==='idle'    && '⏳ Insert visitor ID card then click Scan'}
            {readerStatus==='reading' && '⏳ Reading card…'}
            {/* {readerStatus==='done'    && (returning ? '✅ Returning visitor — details loaded from database' : '✅ New visitor — card details filled')} */}
            {readerStatus==='error'   && `❌ ${readerError || 'Read failed'}`}
          </div>
          <div style={{ fontSize:11, color:'var(--dim)', fontFamily:'var(--mono)' }}>
            {readerStatus==='done' && cardScanned
              ? `CPR: ${form.cpr_number}${form.full_name ? '  ·  ' + form.full_name : ''}${returning ? '  ·  returning visitor' : ''}`
              : 'Bahrain National ID · HID OMNIKEY 3121'}
          </div>
        </div>
        {readerStatus==='done' ? (
          <button type="button" onClick={handleClearCard} style={{ padding:'7px 14px', borderRadius:7, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background:'rgba(240,160,52,.1)', border:'1px solid rgba(240,160,52,.3)', color:'var(--amber)', flexShrink:0 }}>
            ✏ Clear & re-scan
          </button>
        ) : (
          <button type="button" onClick={readCard} disabled={readerStatus==='reading'}
            style={{ padding:'7px 18px', borderRadius:7, fontSize:13, fontWeight:600, fontFamily:'var(--sans)', cursor:readerStatus==='reading'?'wait':'pointer', background:readerStatus==='reading'?'var(--panel2)':'var(--blue)', color:readerStatus==='reading'?'var(--dim)':'#fff', border:'none', flexShrink:0 }}>
            {readerStatus==='reading' ? 'Reading…' : '🔍 Scan Card'}
          </button>
        )}
      </div>

      {/* Returning visitor badge */}
      {/* {returning && cardScanned && !flagInfo && (
        <div style={{ background:'rgba(56,139,253,.08)', border:'1px solid rgba(56,139,253,.25)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--blue)', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          🔄 <strong>Returning visitor</strong> — phone and company details loaded from previous visit record.
        </div>
      )} */}

      {/* Flagged */}
      {flagInfo && (
        <div style={{ background:'rgba(248,81,73,.12)', border:'1px solid rgba(248,81,73,.35)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--red)', marginBottom:16, fontWeight:600 }}>
          ⛔ FLAGGED VISITOR — {flagInfo.flag_type?.toUpperCase()}: {flagInfo.reason}
        </div>
      )}

      {error && (
        <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--red)', marginBottom:16 }}>
          ✕ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Visitor Info */}
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
          <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ background:'var(--blue)', color:'#fff', width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>1</span>
            Visitor Information
            {cardScanned && (
              <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:10, color: returning ? 'var(--blue)' : 'var(--green)', padding:'2px 8px', borderRadius:4, background: returning ? 'rgba(56,139,253,.1)' : 'rgba(63,185,80,.1)', border: `1px solid ${returning ? 'rgba(56,139,253,.25)' : 'rgba(63,185,80,.25)'}` }}>
                {returning ? '🔄 Returning visitor' : '🔒 From ID card'}
              </span>
            )}
          </div>
          <div style={{ padding:18, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={l}>FULL NAME *</label>
                <input value={form.full_name} onChange={e => !cardScanned && setForm(p=>({...p,full_name:e.target.value}))} placeholder="e.g. Mohammed Al-Rashid" required readOnly={cardScanned} style={fs(cardScanned)} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={l}>CPR NUMBER *</label>
                <input value={form.cpr_number} onChange={e => !cardScanned && setForm(p=>({...p,cpr_number:e.target.value}))} placeholder="Scan card or enter manually" maxLength={9} required readOnly={cardScanned} style={fs(cardScanned && !flagInfo)} />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
               <label style={l}>PHONE</label>
              <div style={{ display:'flex', alignItems:'center', gap:0 }}>
               <span style={{ background:'var(--panel)', border:'1px solid var(--border2)', borderRight:'none', borderRadius:'7px 0 0 7px', padding:'9px 10px', fontSize:13, color:'var(--dim)', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>+973</span>
               <input
                value={form.phone}
                onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                setForm(p => ({ ...p, phone: digits }));
                 }}
                 placeholder="XXXX XXXX"
                 maxLength={8}
                 style={{ ...fs(false), borderRadius:'0 7px 7px 0', borderLeft:'none' }}
                 />
                 </div>
                {/* <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--faint)' }}>{form.phone.length}/8 digits</span> */}
              </div> 
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={l}>COMPANY</label>
              <input
              value={form.company}
              onChange={e => setForm(p => ({ ...p, company: e.target.value.slice(0, 35) }))}
              placeholder="Optional"
              maxLength={35}
              style={fs(false)}/>
            <span style={{ fontFamily:'var(--mono)', fontSize:10, color: form.company.length >= 30 ? 'var(--amber)' : 'var(--faint)', textAlign:'right' }}>
              {form.company.length}/35
            </span>
          </div>
            </div>
          </div>
        </div>

        {/* Visit Details */}
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ background:'var(--blue)', color:'#fff', width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>2</span>
            Visit Details
          </div>
          <div style={{ padding:18 }}>
            <VisitDetailsForm departments={departments} onChange={setVisitData} required={{ purpose:true, department:true }} />
          </div>
        </div>

        <button type="submit" disabled={submitting || !!flagInfo || !form.cpr_number}
          style={{ width:'100%', padding:13, borderRadius:8, border:'none', fontSize:14, fontWeight:600, cursor:flagInfo||submitting||!form.cpr_number?'not-allowed':'pointer', fontFamily:'var(--sans)', background:flagInfo||submitting||!form.cpr_number?'var(--panel2)':'var(--blue)', color:flagInfo||submitting||!form.cpr_number?'var(--dim)':'#fff' }}>
          {submitting ? 'Saving…' : 'Continue to Card Assignment →'}
        </button>
      </form>
    </div>
  );
}

// ── Walk-In Details ───────────────────────────────────────────
function WalkInDetailsForm({ visitor, departments, onBack, onDone }) {
  const [visitData, setVisitData] = useState({ host_employee:'', purpose:'', department_id:null, notes:'' });
  const [error,     setError]     = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!visitData.department_id) { setError('Department is required.'); return; }
    if (!visitData.purpose)       { setError('Purpose is required.'); return; }
    const dept = departments.find(d => String(d.department_id) === String(visitData.department_id));
    onDone({ ...visitor, ...visitData, department_name:dept?.name||null, floor:dept?.floor||null });
  }

  return (
    <div style={{ padding:24, maxWidth:700, margin:'0 auto' }} className="fade-in">
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--blue)', fontSize:13, cursor:'pointer', fontFamily:'var(--sans)', marginBottom:20, padding:0 }}>← Back</button>
      <h1 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Walk-In Check-In</h1>
      <p style={{ fontSize:13, color:'var(--dim)', marginBottom:20 }}>Enter visit details for <strong style={{ color:'var(--text)' }}>{visitor.full_name}</strong></p>
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, padding:16, marginBottom:16, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
        {[['Name',visitor.full_name],['CPR',visitor.cpr_number],['Company',visitor.company||'—']].map(([label,value])=>(
          <div key={label}>
            <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)', letterSpacing:'.08em', marginBottom:4 }}>{label.toUpperCase()}</div>
            <div style={{ fontSize:13, fontWeight:600 }}>{value}</div>
          </div>
        ))}
      </div>
      {error && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--red)', marginBottom:16 }}>✕ {error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600 }}>Visit Details</div>
          <div style={{ padding:18 }}><VisitDetailsForm departments={departments} onChange={setVisitData} required={{ purpose:true, department:true }} /></div>
        </div>
        <button type="submit" style={{ width:'100%', padding:13, borderRadius:8, background:'var(--blue)', color:'#fff', border:'none', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>
          Continue to Card Assignment →
        </button>
      </form>
    </div>
  );
}

// ── Card Assignment ───────────────────────────────────────────
function CardAssignment({ visitor, departments, onBack, onDone }) {
  const [assignedCard, setAssignedCard] = useState(null);
  const [assigning,    setAssigning]    = useState(true);
  const [assignError,  setAssignError]  = useState(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [visitError,   setVisitError]   = useState('');
  const [skipping,     setSkipping]     = useState(false);

  const getNowStr   = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const getPlus8hStr= () => new Date(Date.now() + 8 * 3600000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const dept     = departments.find(d => String(d.department_id) === String(visitor.department_id));
  const deptName = visitor.department_name || dept?.name  || null;
  const floor    = visitor.floor           || dept?.floor || null;

  useEffect(() => { assignRoundRobin(); }, []);

  async function assignRoundRobin(excludeId = null) {
    setAssigning(true); setAssignError(null);
    try {
      const { data: cards } = await api.get('/cards');
      const available = cards
        .filter(c => c.status === 'available' && (!excludeId || c.card_id !== excludeId))
        .sort((a, b) => a.card_id - b.card_id); 
      if (available.length === 0) { setAssignError('no_cards'); setAssigning(false); return; }
      setAssignedCard(available[0]);
      setAssigning(false);
    } catch { setAssignError('failed'); setAssigning(false); }
  }

  async function handleConfirm() {
    if (!assignedCard) return;
    setSubmitting(true); setVisitError('');
    try {
      const vRes = await api.post('/visitors', { full_name:visitor.full_name, cpr_number:visitor.cpr_number, phone:visitor.phone||null, email:visitor.email||null, company:visitor.company||null });
      await api.post('/visits', { visitor_id:vRes.data.visitor_id, card_id:assignedCard.card_id, host_employee:visitor.host_employee||null, purpose:visitor.purpose||null, notes:visitor.notes||null, department_id:visitor.department_id||null, valid_from:getNowStr(), valid_until:getPlus8hStr() });
      onDone({ visitor:{ ...visitor, department_name:deptName, floor }, card:assignedCard });
    } catch (err) { setVisitError(err.response?.data?.error || 'Check-in failed.'); }
    setSubmitting(false);
  }

  async function handleFastSkip() {
    if (!assignedCard || skipping) return;
    setSkipping(true);
    try {
      const { data } = await api.post('/cards/skip', { card_id:assignedCard.card_id, reason:'other' });
      if (data.next_card) setAssignedCard(data.next_card);
      else assignRoundRobin(assignedCard.card_id);
    } catch { setVisitError('Failed to skip card.'); }
    setSkipping(false);
  }

  return (
    <div style={{ padding:24, maxWidth:700, margin:'0 auto' }} className="fade-in">
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--blue)', fontSize:13, cursor:'pointer', fontFamily:'var(--sans)', marginBottom:20, padding:0 }}>← Back</button>
      <h1 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Card Assignment</h1>
      <p style={{ fontSize:13, color:'var(--dim)', marginBottom:24 }}>Assigning card for <strong style={{ color:'var(--text)' }}>{visitor.full_name}</strong></p>

      {visitError && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--red)', marginBottom:20 }}>⛔ {visitError}</div>}

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, padding:18, marginBottom:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[['Visitor',visitor.full_name],['CPR',visitor.cpr_number],['Department',deptName||'—'],['Floor',floor||'—']].map(([label,value])=>(
            <div key={label}>
              <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)', letterSpacing:'.08em' }}>{label.toUpperCase()}</span>
              <div style={{ fontSize:13, marginTop:2, color:label==='Floor'?'var(--blue)':'var(--text)', fontWeight:label==='Floor'?600:400 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {assigning ? (
        <div style={{ textAlign:'center', padding:32, color:'var(--dim)' }}>⏳ Selecting card…</div>
      ) : assignError === 'no_cards' ? (
        <div style={{ textAlign:'center', padding:24, color:'var(--amber)' }}>⚠ No access cards available.</div>
      ) : assignError === 'failed' ? (
        <div style={{ textAlign:'center', padding:24, color:'var(--red)' }}>❌ Failed to fetch cards. <button onClick={() => assignRoundRobin()} style={{ marginLeft:8, padding:'4px 12px', borderRadius:6, background:'var(--blue)', color:'#fff', border:'none', cursor:'pointer', fontSize:12 }}>Retry</button></div>
      ) : assignedCard ? (
        <>
          <div style={{ background:'linear-gradient(135deg,#1a2f5c,#0d1a3a)', border:'1px solid rgba(56,139,253,.3)', borderRadius:12, padding:22, marginBottom:24, textAlign:'center' }}>
            <div style={{ fontSize:10, fontFamily:'var(--mono)', color:'rgba(255,255,255,.4)', marginBottom:8, letterSpacing:'.1em' }}>ASSIGNED CARD UID</div>
            <div style={{ fontFamily:'var(--mono)', fontSize:36, fontWeight:800, color:'var(--blue)', letterSpacing:'.15em' }}>{assignedCard.card_uid}</div>
          </div>

          <div style={{ display:'flex', gap:12 }}>
            <button onClick={handleConfirm} disabled={submitting}
              style={{ flex:1, padding:16, borderRadius:10, background:submitting?'var(--panel2)':'var(--green)', color:'#000', border:'none', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'var(--sans)' }}>
              {submitting ? 'Confirming…' : 'Finalize Check-In'}
            </button>
            <button onClick={handleFastSkip} disabled={skipping}
              style={{ padding:'0 24px', borderRadius:10, background:'rgba(240,160,52,.1)', color:'var(--amber)', border:'1px solid rgba(240,160,52,.3)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>
              {skipping ? '…' : 'Skip'}
            </button>
          </div>
          <p style={{ textAlign:'center', fontSize:11, color:'var(--dim)', marginTop:12 }}>Visit expires in 8 hours automatically.</p>
        </>
      ) : null}
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────
function SuccessScreen({ result, onReset }) {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

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
            ['Visitor', result.visitor.full_name],
            ['CPR', result.visitor.cpr_number],
            ['Host', result.visitor.host_employee || '—'],
            ['Department', result.visitor.department_name || '—'],
            ['Floor', result.visitor.floor || '—'],
            ['Card', result.card.card_uid],
            ['Time', new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })]
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: '.1em', textTransform: 'uppercase', minWidth: 80, paddingTop: 2 }}>{label}</span>
              <strong style={{ color: label === 'Floor' ? 'var(--blue)' : 'var(--text)' }}>{value}</strong>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button 
            onClick={onReset} 
            style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
          >
            ✚ New Check-In
          </button>
          
          <button 
            onClick={() => navigate('/dashboard')} 
            style={{ background: 'transparent', color: 'var(--dim)', border: 'none', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Go to Dashboard now
          </button>
        </div>
        
        <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 20 }}>
          Redirecting to dashboard in 5 seconds...
        </p>
      </div>
    </div>
  );
}