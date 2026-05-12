import { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import useCardReader from '../hooks/useCardReader';

const PURPOSES = ['Business Meeting', 'Interview', 'Maintenance / Repair', 'Delivery', 'Government Official', 'Other'];
const NOTES_MAX_LINES = 3;
const NOTES_MAX_CHARS = 300;

// ── Shared helpers ────────────────────────────────────────────
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

// ── Visit Details Form ────────────────────────────────────────
// CHANGED: accepts `employees` prop; replaces host text input with a searchable dropdown
function VisitDetailsForm({ departments, employees = [], onChange, required = {} }) {
  const [host,         setHost]         = useState('');
  const [hostSearch,   setHostSearch]   = useState('');
  const [showHostDrop, setShowHostDrop] = useState(false);
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

  const notesLines = notes.split('\n').length;

  // Filter employees by search term
  const filteredEmployees = employees.filter(e =>
    e.emp_name.toLowerCase().includes(hostSearch.toLowerCase())
  );

  function selectEmployee(emp) {
    setHost(emp.emp_name);
    setHostSearch(emp.emp_name);
    setShowHostDrop(false);
  }

  function handleHostInputChange(e) {
    const val = e.target.value;
    setHostSearch(val);
    setHost(val); // allow free-text fallback if employee not found
    setShowHostDrop(true);
  }

  function handleHostBlur() {
    // Delay to allow click on dropdown item to register
    setTimeout(() => setShowHostDrop(false), 150);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.7fr 1fr 1fr', gap:10 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={l}>DEPARTMENT *</label>
          <select value={deptId} onChange={e => setDeptId(e.target.value)} required style={s}>
            <option value="">— Select —</option>
            {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.name} — {d.floor}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={l}>FLOOR</label>
          <div style={{ ...s, color:dept?'var(--blue)':'var(--faint)', border:'1px solid var(--border)', fontFamily:'var(--mono)', fontWeight:dept?600:400 }}>
            {dept ? dept.floor : '—'}
          </div>
        </div>

        {/* ── HOST EMPLOYEE DROPDOWN ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:5, position:'relative' }}>
          <label style={l}>HOST <span style={{ color:'var(--dim)', fontSize:9 }}>(OPTIONAL)</span></label>
          <input
            value={hostSearch}
            onChange={handleHostInputChange}
            onFocus={() => setShowHostDrop(true)}
            onBlur={handleHostBlur}
            placeholder={employees.length ? 'Search employee…' : 'Loading…'}
            autoComplete="off"
            style={s}
          />
          {showHostDrop && filteredEmployees.length > 0 && (
            <div style={{
              position:'absolute', top:'100%', left:0, right:0, zIndex:99,
              background:'var(--panel)', border:'1px solid var(--border2)',
              borderRadius:7, boxShadow:'0 6px 24px rgba(0,0,0,.35)',
              maxHeight:200, overflowY:'auto', marginTop:2
            }}>
              {filteredEmployees.map(emp => (
                <div
                  key={emp.emp_id}
                  onMouseDown={() => selectEmployee(emp)}
                  style={{
                    padding:'8px 12px', cursor:'pointer', fontSize:13,
                    display:'flex', alignItems:'center', gap:10,
                    borderBottom:'1px solid var(--border)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    width:24, height:24, borderRadius:'50%', flexShrink:0,
                    background:'linear-gradient(135deg,#1a3a6e,var(--blue))',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:9, fontWeight:700, color:'#fff'
                  }}>
                    {emp.emp_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </span>
                  <span style={{ flex:1 }}>{emp.emp_name}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)' }}>#{emp.emp_id}</span>
                </div>
              ))}
            </div>
          )}
          {showHostDrop && hostSearch.length > 0 && filteredEmployees.length === 0 && (
            <div style={{
              position:'absolute', top:'100%', left:0, right:0, zIndex:99,
              background:'var(--panel)', border:'1px solid var(--border2)',
              borderRadius:7, padding:'10px 12px', marginTop:2,
              fontSize:12, color:'var(--dim)', fontStyle:'italic'
            }}>
              No employees found — value will be saved as typed.
            </div>
          )}
        </div>
        {/* ── END HOST EMPLOYEE DROPDOWN ── */}

        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={l}>PURPOSE *</label>
          <select value={purpose} onChange={e => setPurpose(e.target.value)} required={required.purpose} style={s}>
            <option value="">— Select —</option>
            {PURPOSES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {purpose === 'Other' && (
        <textarea value={otherPurpose} onChange={e => setOtherPurpose(e.target.value.slice(0,200))}
          placeholder="Describe the purpose…" maxLength={200} rows={2}
          style={{ ...s, resize:'none' }} />
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <label style={l}>NOTES <span style={{ color:'var(--dim)', fontSize:9 }}>(OPTIONAL)</span></label>
          <span style={{ fontFamily:'var(--mono)', fontSize:10, color:notesLines>=NOTES_MAX_LINES?'var(--amber)':'var(--faint)' }}>
            {notesLines}/{NOTES_MAX_LINES} lines
          </span>
        </div>
        <textarea value={notes} onChange={handleNotes} rows={2}
          placeholder="Special instructions… (3 lines max)"
          style={{ ...s, resize:'none' }} />
      </div>
    </div>
  );
}

// ── Active Visitors Mini-Table ────────────────────────────────
function ActiveVisitorsPanel() {
  const [visits,   setVisits]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [checking, setChecking] = useState(null);
  const [search,   setSearch]   = useState('');

  async function fetchVisits() {
    try {
      const { data } = await api.get('/dashboard/active-visits');
      setVisits(data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchVisits();
    const t = setInterval(fetchVisits, 15000);
    return () => clearInterval(t);
  }, []);

  async function handleCheckout(visitId, name) {
    if (!window.confirm(`Check out ${name}?`)) return;
    setChecking(visitId);
    try {
      await api.patch(`/visits/${visitId}/checkout`);
      fetchVisits();
    } catch (err) { alert(err.response?.data?.error || 'Checkout failed.'); }
    setChecking(null);
  }

  const filtered = visits.filter(v => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (v.visitor_name||'').toLowerCase().includes(q) || (v.cpr_number||'').includes(q) || (v.card_uid||'').includes(q);
  });

  return (
    <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginTop:24 }}>
      <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:13, fontWeight:600 }}>🟢 Active Visitors ({visits.length})</span>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--dim)', pointerEvents:'none' }}>🔍</span>
          <input type="text" placeholder="Search name, CPR or card…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, padding:'5px 10px 5px 26px', fontSize:12, color:'var(--text)', fontFamily:'var(--sans)', outline:'none', width:200 }} />
          {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:7, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:12, padding:0 }}>✕</button>}
        </div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:650 }}>
          <thead>
            <tr>
              {['Visitor','CPR','Card','Dept','Floor','Check-In','Duration','Status',''].map(h => (
                <th key={h} style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.07em', color:'var(--dim)', textAlign:'left', padding:'8px 12px', borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,.02)', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign:'center', padding:'28px 0', color:'var(--dim)', fontSize:13 }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign:'center', padding:'28px 0', color:'var(--dim)', fontSize:13 }}>No active visitors.</td></tr>
            ) : filtered.map(v => {
              const live   = getLiveStatus(v);
              const isOver = live === 'overstay';
              const mins   = Math.round(v.duration_minutes || 0);
              const { warn } = getThresholds(v.purpose);
              const isWarn = mins >= warn && !isOver;
              return (
                <tr key={v.visit_id}
                  style={{ background: isOver ? 'rgba(248,81,73,.03)' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = isOver ? 'rgba(248,81,73,.03)' : 'transparent'}
                >
                  <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600 }}>{v.visitor_name}</td>
                  <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:11, color:'var(--dim)' }}>{v.cpr_number||'—'}</td>
                  <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ background:'rgba(56,139,253,.1)', color:'var(--blue)', borderRadius:5, padding:'2px 7px', fontSize:11, fontFamily:'var(--mono)', fontWeight:600 }}>{v.card_uid||'—'}</span>
                  </td>
                  <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', fontSize:12 }}>{v.department_name||'—'}</td>
                  <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:12, color:'var(--blue)', fontWeight:600 }}>{v.floor||'—'}</td>
                  <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:11, color:'var(--dim)', whiteSpace:'nowrap' }}>
                    {new Date(v.check_in_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                  </td>
                  <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:12, color: isOver?'var(--red)':isWarn?'var(--amber)':'var(--dim)', whiteSpace:'nowrap' }}>
                    {duration(v.duration_minutes)}
                  </td>
                  <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ background: isOver?'rgba(248,81,73,.12)':'rgba(63,185,80,.12)', color: isOver?'var(--red)':'var(--green)', borderRadius:100, padding:'2px 9px', fontSize:11, fontWeight:600, fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>
                      {isOver ? '⚠ Overstay' : '● Active'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
                    <button onClick={() => handleCheckout(v.visit_id, v.visitor_name)} disabled={checking===v.visit_id}
                      style={{ padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:600, fontFamily:'var(--sans)', cursor: checking===v.visit_id?'not-allowed':'pointer', border:'1px solid rgba(248,81,73,.3)', background: checking===v.visit_id?'transparent':'rgba(248,81,73,.08)', color: checking===v.visit_id?'var(--dim)':'var(--red)', whiteSpace:'nowrap' }}>
                      {checking===v.visit_id ? '…' : '↩ Check Out'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
  const [employees,   setEmployees]   = useState([]); // ADDED: SQL Server employees
  const [savedForm,   setSavedForm]   = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/visitors'),
      api.get('/departments'),
      api.get('/employees'),          // ADDED: fetch from SQL Server
    ]).then(([vRes, dRes, eRes]) => {
      setAllVisitors(vRes.data.filter(v => !v.is_active_visit));
      setDepartments(dRes.data.filter(d => d.is_active));
      setEmployees(eRes.data || []);  // ADDED
    }).catch(err => {
      // Still load even if employees fail (non-critical)
      console.warn('[CheckIn] Could not load employees:', err.message);
      Promise.all([api.get('/visitors'), api.get('/departments')]).then(([vRes, dRes]) => {
        setAllVisitors(vRes.data.filter(v => !v.is_active_visit));
        setDepartments(dRes.data.filter(d => d.is_active));
      });
    });
  }, [step]);

  function handleReset() { setVisitor(null); setResult(null); setSavedForm(null); setStep('new-visitor'); }

  if (step === 'new-visitor')
    return <NewVisitorForm
      departments={departments}
      allVisitors={allVisitors}
      employees={employees}           // ADDED: pass down
      initialData={savedForm}
      onDone={(v, formSnapshot) => { setSavedForm(formSnapshot); setVisitor(v); setStep('card-assign'); }}
    />;

  if (step === 'card-assign')
    return <CardAssignment visitor={visitor} departments={departments}
      onBack={() => setStep('new-visitor')}
      onDone={r => { setResult(r); setStep('success'); }} />;

  if (step === 'success')
    return <SuccessScreen result={result} onReset={handleReset} />;
}

// ── New Visitor Form ──────────────────────────────────────────
// CHANGED: accepts `employees` prop and passes it to VisitDetailsForm
function NewVisitorForm({ departments, allVisitors, employees = [], onDone, initialData }) {
  const [form,        setForm]        = useState(initialData?.form || { full_name:'', cpr_number:'', phone:'', email:'', company:'' });
  const [visitData,   setVisitData]   = useState(initialData?.visitData || { host_employee:'', purpose:'', department_id:null, notes:'' });
  const [cardScanned, setCardScanned] = useState(initialData?.cardScanned || false);
  const [returning,   setReturning]   = useState(initialData?.returning   || false);
  const [flagInfo,    setFlagInfo]    = useState(null);
  const [nameUpdated, setNameUpdated] = useState(false); // true when card name differs from stored name
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [showPastList,setShowPastList]= useState(false);
  const [search,      setSearch]      = useState('');

  const handleCardRead = async (data) => {
    const d = data?.SmartcardData || data?.smartcardData || data?.Data || data || {};
    const cprRaw   = d.IdNumber        || d.idNumber        || d.CPR          || d.PersonalNumber || '';
    const nameRaw  = d.EnglishFullName || d.englishFullName || d.FullName      || '';
    const phoneRaw = d.MobileNumber    || d.mobileNumber    || d.Phone         || '';
    const compRaw  = d.EmploymentNameEnglish || d.employmentNameEnglish        || '';
    const cpr      = String(cprRaw).trim();
    if (!cpr) return;

    const existing = allVisitors.find(v => v.cpr_number === cpr);
    if (existing) {
      // If card has a name and it differs from the stored name, use the card's name (more up to date)
      const cardName = String(nameRaw).trim();
      const resolvedName = cardName && cardName !== existing.full_name ? cardName : existing.full_name;
      const hasNameChange = !!(cardName && cardName !== existing.full_name);
      setNameUpdated(hasNameChange);
      setForm({ full_name: resolvedName, cpr_number: cpr, phone: (existing.phone || String(phoneRaw).trim() || '').replace(/^\+?973/, ''), email: existing.email || '', company: existing.company || String(compRaw).trim() || '' });
      setReturning(true);
    } else {
      setNameUpdated(false);
      setForm(p => ({ ...p, cpr_number: cpr, full_name: String(nameRaw).trim() || p.full_name, phone: String(phoneRaw).trim().replace(/^\+?973/, '') || p.phone, company: String(compRaw).trim() || p.company }));
      setReturning(false);
    }
    setCardScanned(true);
    try {
      const { data: flagData } = await api.post('/visitors/check-cpr', { cpr_number: cpr });
      setFlagInfo(flagData.flagged ? flagData.flag : null);
    } catch {}
  };

  const { status: readerStatus, error: readerError, readCard, clearCard } = useCardReader(handleCardRead);

  function handleClearCard() {
    clearCard();
    setForm({ full_name:'', cpr_number:'', phone:'', email:'', company:'' });
    setCardScanned(false); setReturning(false); setFlagInfo(null); setNameUpdated(false);
  }

  useEffect(() => {
    if (cardScanned || form.cpr_number.length < 9) { if (!cardScanned) setFlagInfo(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post('/visitors/check-cpr', { cpr_number: form.cpr_number });
        setFlagInfo(data.flagged ? data.flag : null);
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [form.cpr_number, cardScanned]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (flagInfo)                 { setError('Cannot check in a flagged visitor.'); return; }
    if (!visitData.department_id) { setError('Department is required.'); return; }
    if (!visitData.purpose)       { setError('Purpose is required.'); return; }
    if (!form.phone || form.phone.replace(/\D/g,'').length < 8) { setError('Phone number is required (8 digits).'); return; }
    setError(''); setSubmitting(true);
    try {
      const trimmedCpr = form.cpr_number && form.cpr_number.trim() !== '' ? form.cpr_number.trim() : null;
      const { data } = await api.post('/visitors', {
        full_name:  form.full_name,
        cpr_number: trimmedCpr,
        phone:      form.phone ? `+973${form.phone.replace(/^\+?973/, '')}` : null,
        email:      form.email  || null,
        company:    form.company|| null,
      });
      const dept = departments.find(d => String(d.department_id) === String(visitData.department_id));
      const snapshot = { form, visitData, cardScanned, returning };
      onDone({ ...data, ...visitData, department_name: dept?.name||null, floor: dept?.floor||null }, snapshot);
    } catch (err) { setError(err.response?.data?.error || 'Registration failed.'); }
    setSubmitting(false);
  }

  function fs(locked) {
    return { background: locked?'rgba(63,185,80,.06)':'var(--panel2)', border:`1px solid ${locked?'rgba(63,185,80,.35)':'var(--border2)'}`, borderRadius:7, padding:'9px 12px', fontSize:13, color: locked?'var(--green)':'var(--text)', fontFamily:'var(--sans)', outline:'none', width:'100%', cursor: locked?'not-allowed':'text' };
  }
  const l = { fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' };

  const filteredPast = allVisitors.filter(v => {
    const q = search.toLowerCase();
    return v.full_name.toLowerCase().includes(q) || (v.cpr_number||'').includes(q) || (v.company||'').toLowerCase().includes(q);
  });

  return (
    <div style={{ padding:24, maxWidth:1100, margin:'0 auto' }} className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
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
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--dim)', pointerEvents:'none', fontSize:12 }}>🔍</span>
              <input type="text" placeholder="Search by name, CPR or company…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width:'100%', background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, padding:'7px 12px 7px 32px', fontSize:13, color:'var(--text)', fontFamily:'var(--sans)', outline:'none' }} />
            </div>
          </div>
          {filteredPast.length === 0 ? (
            <div style={{ padding:'16px', textAlign:'center', color:'var(--dim)', fontSize:13 }}>No past visitors found.</div>
          ) : filteredPast.slice(0, 6).map(v => (
            <div key={v.visitor_id}
              style={{ display:'grid', gridTemplateColumns:'2fr 1.2fr 1.2fr 80px', padding:'10px 14px', borderBottom:'1px solid var(--border)', alignItems:'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#1a3a6e,var(--blue))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>
                  {v.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <span style={{ fontSize:13, fontWeight:600 }}>{v.full_name}</span>
              </div>
              <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--dim)' }}>{v.cpr_number||'—'}</span>
              <span style={{ fontSize:13, color:'var(--dim)' }}>{v.company||'—'}</span>
              <button onClick={() => {
                setForm({ full_name:v.full_name, cpr_number:v.cpr_number||'', phone:(v.phone||'').replace(/^\+?973/,''), email:v.email||'', company:v.company||'' });
                setCardScanned(true); setReturning(true); setShowPastList(false);
              }} style={{ padding:'4px 10px', borderRadius:6, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background:'var(--blue)', color:'#fff', border:'none', fontWeight:600 }}>
                Select
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Card Reader */}
      <div style={{ background: readerStatus==='done'?'rgba(63,185,80,.06)':readerStatus==='reading'?'rgba(56,139,253,.08)':readerStatus==='error'?'rgba(248,81,73,.06)':'rgba(56,139,253,.04)', border:`1px solid ${readerStatus==='done'?'rgba(63,185,80,.35)':readerStatus==='error'?'rgba(248,81,73,.3)':'rgba(56,139,253,.25)'}`, borderRadius:10, padding:'12px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:22, flexShrink:0 }}>🪪</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:1 }}>
            {readerStatus==='idle'    && 'Insert visitor ID card then click Scan'}
            {readerStatus==='reading' && '⏳ Reading card…'}
            {readerStatus==='error'   && `❌ ${readerError || 'Read failed'}`}
          </div>
          <div style={{ fontSize:11, color:'var(--dim)', fontFamily:'var(--mono)' }}>
            {readerStatus==='done' && cardScanned
              ? `CPR: ${form.cpr_number}${form.full_name ? '  ·  '+form.full_name : ''}${returning ? '  ·  returning visitor' : ''}`
              : 'Bahrain National ID · HID OMNIKEY 3121'}
          </div>
        </div>
        {readerStatus==='done' ? (
          <button type="button" onClick={handleClearCard} style={{ padding:'6px 12px', borderRadius:7, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background:'rgba(240,160,52,.1)', border:'1px solid rgba(240,160,52,.3)', color:'var(--amber)', flexShrink:0 }}>✏ Clear</button>
        ) : (
          <button type="button" onClick={readCard} disabled={readerStatus==='reading'}
            style={{ padding:'6px 16px', borderRadius:7, fontSize:13, fontWeight:600, fontFamily:'var(--sans)', cursor:readerStatus==='reading'?'wait':'pointer', background:readerStatus==='reading'?'var(--panel2)':'var(--blue)', color:readerStatus==='reading'?'var(--dim)':'#fff', border:'none', flexShrink:0 }}>
            {readerStatus==='reading' ? 'Reading…' : '🔍 Scan Card'}
          </button>
        )}
      </div>

      {flagInfo && (
        <div style={{ background:'rgba(248,81,73,.12)', border:'1px solid rgba(248,81,73,.35)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--red)', marginBottom:12, fontWeight:600 }}>
          ⛔ FLAGGED VISITOR — {flagInfo.flag_type?.toUpperCase()}: {flagInfo.reason}
        </div>
      )}
      {error && (
        <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:6, padding:'9px 12px', fontSize:13, color:'var(--red)', marginBottom:12 }}>✕ {error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:10 }}>
          <div style={{ padding:'11px 16px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ background:'var(--blue)', color:'#fff', width:20, height:20, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>1</span>
            Visitor Information
            {cardScanned && (
              <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:10, color: returning?'var(--blue)':'var(--green)', padding:'2px 8px', borderRadius:4, background: returning?'rgba(56,139,253,.1)':'rgba(63,185,80,.1)', border:`1px solid ${returning?'rgba(56,139,253,.25)':'rgba(63,185,80,.25)'}` }}>
                {returning ? (nameUpdated ? '✏ Name updated from card' : '🔄 Returning ') : '🔒 From ID card'}
              </span>
            )}
          </div>
          <div style={{ padding:'14px 16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1fr 1fr', gap:10 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' }}>FULL NAME *</label>
                <input value={form.full_name} onChange={e => (returning || !cardScanned) && setForm(p=>({...p,full_name:e.target.value}))} placeholder="Full name" required readOnly={cardScanned && !returning} style={fs(cardScanned && !returning)} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' }}>CPR <span style={{ color:'var(--dim)', fontSize:9 }}>(OPTIONAL)</span></label>
                <input value={form.cpr_number} onChange={e => (returning || !cardScanned) && setForm(p=>({...p,cpr_number:e.target.value}))} placeholder="Optional" maxLength={9} readOnly={cardScanned && !returning && !flagInfo} style={fs(cardScanned && !returning && !flagInfo)} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' }}>PHONE *</label>
                <div style={{ display:'flex', alignItems:'center' }}>
                  <span style={{ background:'var(--panel)', border:'1px solid var(--border2)', borderRight:'none', borderRadius:'7px 0 0 7px', padding:'9px 8px', fontSize:12, color:'var(--dim)', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>+973</span>
                  <input value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value.replace(/\D/g,'').slice(0,8)}))} placeholder="XXXX XXXX" maxLength={8} required
                    style={{ ...fs(false), borderRadius:'0 7px 7px 0', borderLeft:'none', minWidth:0 }} />
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' }}>EMAIL <span style={{ color:'var(--dim)', fontSize:9 }}>(OPTIONAL)</span></label>
                <input value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="Optional" type="email" style={fs(false)} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' }}>COMPANY <span style={{ color:'var(--dim)', fontSize:9 }}>(OPTIONAL)</span></label>
                <input value={form.company} onChange={e => setForm(p=>({...p,company:e.target.value.slice(0,35)}))} placeholder="Optional" maxLength={35} style={fs(false)} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
          <div style={{ padding:'11px 16px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ background:'var(--blue)', color:'#fff', width:20, height:20, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>2</span>
            Visit Details
          </div>
          <div style={{ padding:'14px 16px' }}>
            {/* CHANGED: pass employees to VisitDetailsForm */}
            <VisitDetailsForm departments={departments} employees={employees} onChange={setVisitData} required={{ purpose:true, department:true }} />
          </div>
        </div>

        {nameUpdated && (
          <div style={{ background:'rgba(56,139,253,.08)', border:'1px solid rgba(56,139,253,.25)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--blue)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <span>✏</span>
            <span>Visitor name has been updated from the ID card and will be <strong>permanently saved</strong> to their record on check-in.</span>
          </div>
        )}

        <button type="submit" disabled={submitting || !!flagInfo || !form.full_name}
          style={{ width:'100%', padding:12, borderRadius:8, border:'none', fontSize:14, fontWeight:600, cursor: flagInfo||submitting||!form.full_name?'not-allowed':'pointer', fontFamily:'var(--sans)', background: flagInfo||submitting||!form.full_name?'var(--panel2)':'var(--blue)', color: flagInfo||submitting||!form.full_name?'var(--dim)':'#fff' }}>
          {submitting ? 'Saving…' : 'Continue to Card Assignment →'}
        </button>
      </form>

      <ActiveVisitorsPanel />
    </div>
  );
}

// ── Floor-aware card sorter ───────────────────────────────────
function sortCardsByFloor(cards, visitorFloor) {
  if (!visitorFloor) return cards;
  const exact    = cards.filter(c => c.accessible_floors?.length > 0 && c.accessible_floors.includes(visitorFloor));
  const universal= cards.filter(c => !c.accessible_floors || c.accessible_floors.length === 0);
  const other    = cards.filter(c => c.accessible_floors?.length > 0 && !c.accessible_floors.includes(visitorFloor));
  return [...exact, ...universal, ...other];
}

// ── Card Assignment ───────────────────────────────────────────
function CardAssignment({ visitor, departments, onBack, onDone }) {
  const [cards,        setCards]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [search,       setSearch]       = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [visitError,   setVisitError]   = useState('');

  const dept     = departments.find(d => String(d.department_id) === String(visitor.department_id));
  const deptName = visitor.department_name || dept?.name  || null;
  const floor    = visitor.floor           || dept?.floor || null;

  useEffect(() => {
    api.get('/cards').then(({ data }) => {
      const available = data.filter(c => c.status === 'available').sort((a,b) => a.card_id - b.card_id);
      const sorted    = sortCardsByFloor(available, floor);
      setCards(sorted);
      if (sorted.length > 0) setSelectedCard(sorted[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [floor]);

  async function handleConfirm() {
    if (!selectedCard) return;
    setSubmitting(true); setVisitError('');
    try {
      await api.post('/visits', {
        visitor_id:    visitor.visitor_id,
        card_id:       selectedCard.card_id,
        host_employee: visitor.host_employee || null,
        purpose:       visitor.purpose       || null,
        notes:         visitor.notes         || null,
        department_id: visitor.department_id || null,
      });
      onDone({ visitor: { ...visitor, department_name: deptName, floor }, card: selectedCard });
    } catch (err) {
      setVisitError(err.response?.data?.error || 'Check-in failed.');
    }
    setSubmitting(false);
  }

  const filteredCards = cards.filter(c =>
    !search.trim() || c.card_uid.toLowerCase().includes(search.toLowerCase())
  );

  const getCardLabel = (c) => {
    if (!floor) return null;
    if (!c.accessible_floors || c.accessible_floors.length === 0) return { text: 'Universal', color: 'var(--dim)' };
    if (c.accessible_floors.includes(floor)) return { text: `✓ Floor ${floor}`, color: 'var(--green)' };
    return { text: 'Wrong floor', color: 'var(--amber)' };
  };

  return (
    <div style={{ padding:24, maxWidth:700, margin:'0 auto' }} className="fade-in">
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--blue)', fontSize:13, cursor:'pointer', fontFamily:'var(--sans)', marginBottom:20, padding:0 }}>← Back</button>
      <h1 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Card Assignment</h1>
      <p style={{ fontSize:13, color:'var(--dim)', marginBottom:20 }}>Select a card for <strong style={{ color:'var(--text)' }}>{visitor.full_name}</strong></p>

      {visitError && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--red)', marginBottom:16 }}>⛔ {visitError}</div>}

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
          {[['Visitor',visitor.full_name],['CPR',visitor.cpr_number||'—'],['Department',deptName||'—'],['Floor',floor||'—']].map(([label,value])=>(
            <div key={label}>
              <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)', letterSpacing:'.08em' }}>{label.toUpperCase()}</span>
              <div style={{ fontSize:13, marginTop:2, color:label==='Floor'?'var(--blue)':'var(--text)', fontWeight:label==='Floor'?600:400 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {floor && (
        <div style={{ background:'rgba(56,139,253,.06)', border:'1px solid rgba(56,139,253,.2)', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--blue)', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          <span>🏢</span>
          <span>Cards are sorted by floor access — cards with access to <strong>Floor {floor}</strong> appear first.</span>
        </div>
      )}

      {selectedCard && (
        <div style={{ background:'linear-gradient(135deg,#1a2f5c,#0d1a3a)', border:'1px solid rgba(56,139,253,.3)', borderRadius:12, padding:18, marginBottom:16, textAlign:'center' }}>
          <div style={{ fontSize:10, fontFamily:'var(--mono)', color:'rgba(255,255,255,.4)', marginBottom:6, letterSpacing:'.1em' }}>SELECTED CARD</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:32, fontWeight:800, color:'var(--blue)', letterSpacing:'.15em' }}>{selectedCard.card_uid}</div>
          <div style={{ marginTop:8, display:'flex', justifyContent:'center', gap:12, flexWrap:'wrap' }}>
            {selectedCard.accessible_floors?.length > 0 ? (
              <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontFamily:'var(--mono)' }}>
                Floors: {selectedCard.accessible_floors.join(', ')}
                {floor && selectedCard.accessible_floors.includes(floor) && <span style={{ color:'var(--green)', marginLeft:6 }}>✓ Matches visitor floor</span>}
              </span>
            ) : (
              <span style={{ fontSize:11, color:'rgba(255,255,255,.4)', fontFamily:'var(--mono)' }}>Universal access</span>
            )}
          </div>
        </div>
      )}

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--dim)' }}>
            {loading ? 'Loading…' : `${cards.length} available card${cards.length!==1?'s':''}`}
          </span>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--dim)', pointerEvents:'none' }}>🔍</span>
            <input type="text" placeholder="Search card UID…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, padding:'5px 10px 5px 26px', fontSize:12, color:'var(--text)', fontFamily:'var(--sans)', outline:'none', width:180 }} />
            {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:7, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:12, padding:0 }}>✕</button>}
          </div>
        </div>

        {loading ? (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--dim)', fontSize:13 }}>Loading…</div>
        ) : filteredCards.length === 0 ? (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--amber)', fontSize:13 }}>
            {cards.length === 0 ? '⚠ No available cards.' : 'No cards match your search.'}
          </div>
        ) : (
          <div style={{ maxHeight:280, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:6 }}>
            {filteredCards.map(c => {
              const isSelected = selectedCard?.card_id === c.card_id;
              const label      = getCardLabel(c);
              return (
                <div key={c.card_id} onClick={() => setSelectedCard(c)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, cursor:'pointer', border:`1px solid ${isSelected?'rgba(56,139,253,.5)':'var(--border2)'}`, background: isSelected?'rgba(56,139,253,.1)':'var(--panel2)', transition:'all .15s' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: isSelected?'var(--blue)':'var(--green)', flexShrink:0 }} />
                  <span style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:600, color: isSelected?'var(--blue)':'var(--text)', flex:1 }}>{c.card_uid}</span>
                  {label && (
                    <span style={{ fontSize:10, color: label.color, fontFamily:'var(--mono)', fontWeight:600, whiteSpace:'nowrap' }}>
                      {label.text}
                    </span>
                  )}
                  {c.accessible_floors?.length > 0 && (
                    <span style={{ fontSize:10, color:'var(--dim)', fontFamily:'var(--mono)' }}>
                      {c.accessible_floors.join(', ')}
                    </span>
                  )}
                  {c.last_note && (
                    <span style={{ fontSize:11, color:'var(--dim)', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📝</span>
                  )}
                  {isSelected && <span style={{ fontSize:11, color:'var(--blue)', fontWeight:600 }}>✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={handleConfirm} disabled={submitting || !selectedCard}
        style={{ width:'100%', padding:14, borderRadius:10, background: submitting||!selectedCard?'var(--panel2)':'var(--green)', color: submitting||!selectedCard?'var(--dim)':'#000', border:'none', fontSize:15, fontWeight:700, cursor: submitting||!selectedCard?'not-allowed':'pointer', fontFamily:'var(--sans)' }}>
        {submitting ? 'Confirming…' : 'Finalize Check-In'}
      </button>
      <p style={{ textAlign:'center', fontSize:11, color:'var(--dim)', marginTop:10 }}>Visit expires in 8 hours automatically.</p>
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────
function SuccessScreen({ result, onReset }) {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate('/dashboard'), 5000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div style={{ padding:24, maxWidth:480, margin:'60px auto 0', textAlign:'center' }} className="fade-in">
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:'48px 40px' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
        <h2 style={{ fontSize:22, fontWeight:700, color:'var(--green)', marginBottom:8 }}>Check-In Complete</h2>
        <p style={{ fontSize:14, color:'var(--dim)', marginBottom:24 }}>
          Card <strong style={{ color:'var(--blue)' }}>{result.card.card_uid}</strong> handed to <strong>{result.visitor.full_name}</strong>
        </p>
        <div style={{ background:'var(--panel2)', borderRadius:8, padding:16, marginBottom:24, textAlign:'left', display:'flex', flexDirection:'column', gap:10 }}>
          {[['Visitor',result.visitor.full_name],['CPR',result.visitor.cpr_number||'—'],['Host',result.visitor.host_employee||'—'],['Department',result.visitor.department_name||'—'],['Floor',result.visitor.floor||'—'],['Card',result.card.card_uid],['Time',new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})]].map(([label,value])=>(
            <div key={label} style={{ display:'flex', gap:12, fontSize:13 }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)', letterSpacing:'.1em', textTransform:'uppercase', minWidth:80, paddingTop:2 }}>{label}</span>
              <strong style={{ color: label==='Floor'?'var(--blue)':'var(--text)' }}>{value}</strong>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button onClick={onReset} style={{ background:'var(--blue)', color:'#fff', border:'none', borderRadius:8, padding:'11px 24px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>✚ New Check-In</button>
          <button onClick={() => navigate('/dashboard')} style={{ background:'transparent', color:'var(--dim)', border:'none', fontSize:12, cursor:'pointer', textDecoration:'underline' }}>Go to Dashboard</button>
        </div>
        <p style={{ fontSize:11, color:'var(--faint)', marginTop:16 }}>Redirecting to dashboard in 5 seconds…</p>
      </div>
    </div>
  );
}