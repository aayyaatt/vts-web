import { useState, useEffect } from 'react';
import api from '../api';

const PURPOSES = ['Business Meeting', 'Interview', 'Maintenance / Repair', 'Delivery', 'Government Official', 'Other'];

function VisitDetailsForm({ departments, onChange, initial = {} }) {
  const [host,    setHost]    = useState(initial.host_employee || '');
  const [purpose, setPurpose] = useState(initial.purpose       || '');
  const [deptId,  setDeptId]  = useState(initial.department_id ? String(initial.department_id) : '');
  const [notes,   setNotes]   = useState(initial.notes         || '');

  useEffect(() => {
    onChange({ host_employee: host, purpose, department_id: deptId || null, notes });
  }, [host, purpose, deptId, notes]);

  const s = { background:'var(--panel2)',border:'1px solid var(--border2)',borderRadius:7,padding:'9px 12px',fontSize:13,color:'var(--text)',fontFamily:'var(--sans)',outline:'none',width:'100%' };
  const l = { fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.1em',color:'var(--dim)' };
  const dept = departments.find(d => String(d.department_id) === String(deptId));

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          <label style={l}>HOST EMPLOYEE *</label>
          <input value={host} onChange={e=>setHost(e.target.value)} placeholder="Employee name" style={s} />
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          <label style={l}>PURPOSE *</label>
          <select value={purpose} onChange={e=>setPurpose(e.target.value)} style={s}>
            <option value="">— Select —</option>
            {PURPOSES.map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          <label style={l}>DEPARTMENT</label>
          <select value={deptId} onChange={e=>setDeptId(e.target.value)} style={s}>
            <option value="">— Select Department —</option>
            {departments.map(d=><option key={d.department_id} value={d.department_id}>{d.name} — {d.floor}</option>)}
          </select>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          <label style={l}>FLOOR (AUTO-FILLED)</label>
          <div style={{ ...s,color:dept?'var(--blue)':'var(--faint)',border:'1px solid var(--border)',fontFamily:'var(--mono)',fontWeight:dept?600:400 }}>
            {dept ? dept.floor : '— Select a department —'}
          </div>
        </div>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
        <label style={l}>NOTES</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Any special instructions…" style={{ ...s,resize:'vertical' }} />
      </div>
    </div>
  );
}

export default function CheckIn() {
  const [step,        setStep]        = useState('main');
  const [visitor,     setVisitor]     = useState(null);
  const [result,      setResult]      = useState(null);
  const [preVisitors, setPreVisitors] = useState([]);
  const [allVisitors, setAllVisitors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([api.get('/visitors'), api.get('/departments')]).then(([vRes,dRes]) => {
      const all = vRes.data;
      setAllVisitors(all);
      setPreVisitors(all.filter(v => v.pre_status === 'pending'));
      setDepartments(dRes.data.filter(d => d.is_active));
      setLoading(false);
    });
  }, [step]);

  function handleReset() { setVisitor(null); setResult(null); setStep('main'); }

  if (step==='main')           return <MainPage preVisitors={preVisitors} allVisitors={allVisitors} departments={departments} loading={loading} onSelectPre={v=>{ setVisitor({...v,host_employee:v.pre_host||'',purpose:v.pre_purpose||'',department_id:v.pre_department_id||null,department_name:v.pre_department_name||null,floor:v.pre_floor||null}); setStep('card'); }} onSelectWalkin={v=>{ setVisitor({...v,host_employee:'',purpose:'',department_id:null}); setStep('walkin-details'); }} onNewVisitor={()=>setStep('new-visitor')} />;
  if (step==='new-visitor')    return <NewVisitorForm departments={departments} onBack={()=>setStep('main')} onDone={v=>{ setVisitor(v); setStep('card'); }} />;
  if (step==='walkin-details') return <WalkInDetailsForm visitor={visitor} departments={departments} onBack={()=>setStep('main')} onDone={v=>{ setVisitor(v); setStep('card'); }} />;
  if (step==='card')           return <CardAssignment visitor={visitor} departments={departments} onBack={()=>setStep('main')} onDone={r=>{ setResult(r); setStep('success'); }} />;
  if (step==='success')        return <SuccessScreen result={result} onReset={handleReset} />;
}

function MainPage({ preVisitors, allVisitors, departments, loading, onSelectPre, onSelectWalkin, onNewVisitor }) {
  const [walkinSearch, setWalkinSearch] = useState('');
  const [showWalkin,   setShowWalkin]   = useState(false);
  const walkIns = allVisitors.filter(v => v.pre_status !== 'pending');
  const filtered = walkIns.filter(v => {
    const q = walkinSearch.toLowerCase();
    return v.full_name.toLowerCase().includes(q) || v.cpr_number.includes(q) || (v.company||'').toLowerCase().includes(q);
  });

  return (
    <div style={{ padding:24,maxWidth:960,margin:'0 auto' }} className="fade-in">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:20,fontWeight:700 }}>Check-In</h1>
        <p style={{ fontSize:13,color:'var(--dim)',marginTop:3 }}>Select a pre-registered visitor or check in a walk-in.</p>
      </div>

      {/* Pre-registered section */}
    

      {/* Walk-in section */}
      <div>
        <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:14 }}>
          <span style={{ fontFamily:'var(--mono)',fontSize:11,fontWeight:600,color:'var(--dim)',letterSpacing:'.1em',textTransform:'uppercase' }}>🚶 Walk-In</span>
          <div style={{ flex:1,height:1,background:'var(--border)' }} />
          <button onClick={onNewVisitor} style={{ padding:'7px 16px',borderRadius:7,background:'var(--blue)',color:'#fff',border:'none',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--sans)' }}>✚ New Visitor</button>
          <button onClick={()=>setShowWalkin(p=>!p)} style={{ padding:'7px 16px',borderRadius:7,background:'transparent',color:'var(--dim)',border:'1px solid var(--border2)',fontSize:12,cursor:'pointer',fontFamily:'var(--sans)' }}>
            {showWalkin?'▲ Hide past visitors':'▼ Check in past visitor'}
          </button>
        </div>

        {showWalkin && (
          <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden' }}>
            <div style={{ padding:'12px 16px',borderBottom:'1px solid var(--border)' }}>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--dim)',pointerEvents:'none' }}>🔍</span>
                <input type="text" placeholder="Search by name, CPR or company…" value={walkinSearch} onChange={e=>setWalkinSearch(e.target.value)}
                  style={{ width:'100%',background:'var(--panel2)',border:'1px solid var(--border2)',borderRadius:7,padding:'8px 14px 8px 36px',fontSize:13,color:'var(--text)',fontFamily:'var(--sans)',outline:'none' }} />
              </div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'2fr 1.2fr 1.2fr 1fr 80px',padding:'9px 16px',borderBottom:'1px solid var(--border)',background:'rgba(255,255,255,.02)' }}>
              {['Visitor','CPR','Company','Registered',''].map(h=><span key={h} style={{ fontFamily:'var(--mono)',fontSize:11,letterSpacing:'.08em',color:'var(--dim)',textTransform:'uppercase' }}>{h}</span>)}
            </div>
            {filtered.length===0 ? (
              <div style={{ padding:'24px 0',textAlign:'center',color:'var(--dim)',fontSize:13 }}>No past visitors found.</div>
            ) : filtered.map(v=>(
              <div key={v.visitor_id}
                style={{ display:'grid',gridTemplateColumns:'2fr 1.2fr 1.2fr 1fr 80px',padding:'12px 16px',borderBottom:'1px solid var(--border)',alignItems:'center',transition:'background .15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(56,139,253,.04)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <div style={{ width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#1a3a6e,var(--blue))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0 }}>
                    {v.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:13,fontWeight:600 }}>{v.full_name}</div>
                    {v.phone&&<div style={{ fontSize:11,color:'var(--dim)' }}>{v.phone}</div>}
                  </div>
                </div>
                <div style={{ fontFamily:'var(--mono)',fontSize:12,color:'var(--dim)' }}>{v.cpr_number}</div>
                <div style={{ fontSize:13,color:'var(--dim)' }}>{v.company||'—'}</div>
                <div style={{ fontSize:12,fontFamily:'var(--mono)',color:'var(--dim)' }}>{new Date(v.created_at).toLocaleDateString('en-GB')}</div>
                <div><button onClick={()=>onSelectWalkin(v)} style={{ padding:'5px 12px',borderRadius:6,fontSize:12,fontFamily:'var(--sans)',cursor:'pointer',background:'var(--blue)',color:'#fff',border:'none',fontWeight:600 }}>Check In</button></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewVisitorForm({ departments, onBack, onDone }) {
  const [form,       setForm]       = useState({ full_name:'',cpr_number:'',phone:'',email:'',company:'' });
  const [visitData,  setVisitData]  = useState({ host_employee:'',purpose:'',department_id:null,notes:'' });
  const [cprStatus,  setCprStatus]  = useState(null);
  const [flagInfo,   setFlagInfo]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  function set(f) { return e => setForm(p=>({...p,[f]:e.target.value})); }

  useEffect(() => {
    if (form.cpr_number.length<5) { setCprStatus(null); setFlagInfo(null); return; }
    setCprStatus('checking');
    const t = setTimeout(async()=>{
      try {
        const { data } = await api.post('/visitors/check-cpr',{ cpr_number:form.cpr_number });
        if(data.flagged){ setCprStatus('flagged'); setFlagInfo(data.flag); }
        else { setCprStatus('ok'); setFlagInfo(null); }
      } catch { setCprStatus(null); }
    },600);
    return ()=>clearTimeout(t);
  },[form.cpr_number]);

  async function handleSubmit(e) {
    e.preventDefault();
    if(cprStatus==='flagged'){ setError('Cannot check in a flagged visitor.'); return; }
    if(!visitData.host_employee||!visitData.purpose){ setError('Host employee and purpose are required.'); return; }
    setError(''); setSubmitting(true);
    try {
      const { data } = await api.post('/visitors',{...form});
      const dept = departments.find(d=>String(d.department_id)===String(visitData.department_id));
      onDone({ ...data,...visitData,department_name:dept?.name||null,floor:dept?.floor||null });
    } catch(err){ setError(err.response?.data?.error||'Registration failed.'); }
    setSubmitting(false);
  }

  const s = { background:'var(--panel2)',border:'1px solid var(--border2)',borderRadius:7,padding:'9px 12px',fontSize:13,color:'var(--text)',fontFamily:'var(--sans)',outline:'none',width:'100%' };
  const l = { fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.1em',color:'var(--dim)' };

  return (
    <div style={{ padding:24,maxWidth:700,margin:'0 auto' }} className="fade-in">
      <button onClick={onBack} style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--blue)',fontSize:13,cursor:'pointer',fontFamily:'var(--sans)',marginBottom:20,padding:0 }}>← Back</button>
      <h1 style={{ fontSize:20,fontWeight:700,marginBottom:4 }}>New Walk-In Visitor</h1>
      <p style={{ fontSize:13,color:'var(--dim)',marginBottom:20 }}>Fill in details to proceed to card assignment.</p>
      {error&&<div style={{ background:'rgba(248,81,73,.1)',border:'1px solid rgba(248,81,73,.3)',borderRadius:6,padding:'10px 14px',fontSize:13,color:'var(--red)',marginBottom:16 }}>✕ {error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',marginBottom:14 }}>
          <div style={{ padding:'13px 18px',borderBottom:'1px solid var(--border)',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:10 }}>
            <span style={{ background:'var(--blue)',color:'#fff',width:22,height:22,borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700 }}>1</span>
            Visitor Information
          </div>
          <div style={{ padding:18,display:'flex',flexDirection:'column',gap:14 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}><label style={l}>FULL NAME *</label><input value={form.full_name} onChange={set('full_name')} placeholder="e.g. Mohammed Al-Rashid" required style={s} /></div>
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                <label style={l}>CPR NUMBER *</label>
                <input value={form.cpr_number} onChange={set('cpr_number')} placeholder="9 digits" maxLength={9} required style={s} />
                {cprStatus === 'flagged'  && <p style={{ fontSize:11, color:'var(--red)',   margin:0 }}>⛔ FLAGGED: {flagInfo?.reason}</p>}
                {cprStatus === 'checking' && <p style={{ fontSize:11, color:'var(--amber)', margin:0 }}>● Checking…</p>} 
              </div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}><label style={l}>PHONE</label><input value={form.phone} onChange={set('phone')} placeholder="+973 XXXX XXXX" style={s} /></div>
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}><label style={l}>COMPANY</label><input value={form.company} onChange={set('company')} placeholder="Optional" style={s} /></div>
            </div>
          </div>
        </div>
        <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',marginBottom:20 }}>
          <div style={{ padding:'13px 18px',borderBottom:'1px solid var(--border)',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:10 }}>
            <span style={{ background:'var(--blue)',color:'#fff',width:22,height:22,borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700 }}>2</span>
            Visit Details
          </div>
          <div style={{ padding:18 }}><VisitDetailsForm departments={departments} onChange={setVisitData} /></div>
        </div>
        <button type="submit" disabled={submitting||cprStatus==='flagged'} style={{ width:'100%',padding:13,borderRadius:8,background:cprStatus==='flagged'||submitting?'var(--panel2)':'var(--blue)',color:cprStatus==='flagged'||submitting?'var(--dim)':'#fff',border:'none',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--sans)' }}>
          {submitting?'Saving…':'Continue to Card Assignment →'}
        </button>
      </form>
    </div>
  );
}

function WalkInDetailsForm({ visitor, departments, onBack, onDone }) {
  const [visitData,setVisitData]=useState({ host_employee:'',purpose:'',department_id:null,notes:'' });
  const [error,setError]=useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if(!visitData.host_employee||!visitData.purpose){ setError('Host employee and purpose are required.'); return; }
    const dept = departments.find(d=>String(d.department_id)===String(visitData.department_id));
    onDone({ ...visitor,...visitData,department_name:dept?.name||null,floor:dept?.floor||null });
  }

  return (
    <div style={{ padding:24,maxWidth:700,margin:'0 auto' }} className="fade-in">
      <button onClick={onBack} style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--blue)',fontSize:13,cursor:'pointer',fontFamily:'var(--sans)',marginBottom:20,padding:0 }}>← Back</button>
      <h1 style={{ fontSize:20,fontWeight:700,marginBottom:4 }}>Walk-In Check-In</h1>
      <p style={{ fontSize:13,color:'var(--dim)',marginBottom:20 }}>Enter visit details for <strong style={{ color:'var(--text)' }}>{visitor.full_name}</strong></p>
      <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,padding:16,marginBottom:16,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14 }}>
        {[['Name',visitor.full_name],['CPR',visitor.cpr_number],['Company',visitor.company||'—']].map(([label,value])=>(
          <div key={label}><div style={{ fontFamily:'var(--mono)',fontSize:10,color:'var(--dim)',letterSpacing:'.08em',marginBottom:4 }}>{label.toUpperCase()}</div><div style={{ fontSize:13,fontWeight:600 }}>{value}</div></div>
        ))}
      </div>
      {error&&<div style={{ background:'rgba(248,81,73,.1)',border:'1px solid rgba(248,81,73,.3)',borderRadius:6,padding:'10px 14px',fontSize:13,color:'var(--red)',marginBottom:16 }}>✕ {error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',marginBottom:20 }}>
          <div style={{ padding:'13px 18px',borderBottom:'1px solid var(--border)',fontSize:13,fontWeight:600 }}>Visit Details</div>
          <div style={{ padding:18 }}><VisitDetailsForm departments={departments} onChange={setVisitData} /></div>
        </div>
        <button type="submit" style={{ width:'100%',padding:13,borderRadius:8,background:'var(--blue)',color:'#fff',border:'none',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--sans)' }}>Continue to Card Assignment →</button>
      </form>
    </div>
  );
}

function CardAssignment({ visitor, departments, onBack, onDone }) {
  const [cards,        setCards]        = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');

  const dept     = departments.find(d=>String(d.department_id)===String(visitor.department_id));
  const deptName = visitor.department_name || dept?.name || null;
  const floor    = visitor.floor           || dept?.floor || null;

  useEffect(() => {
    api.get('/cards').then(r=>{
      const available = r.data.filter(c=>c.status==='available');
      setCards(available);
      if(available.length>0) setSelectedCard(available[0]);
    });
  },[]);

  async function handleAssign() {
    if(!selectedCard){ setError('Please select a card.'); return; }
    setError(''); setSubmitting(true);
    try {
      const vRes = await api.post('/visitors',{ full_name:visitor.full_name,cpr_number:visitor.cpr_number,phone:visitor.phone||null,email:visitor.email||null,company:visitor.company||null });
      await api.post('/visits',{ visitor_id:vRes.data.visitor_id,card_id:selectedCard.card_id,host_employee:visitor.host_employee||null,purpose:visitor.purpose||null,notes:visitor.notes||null,department_id:visitor.department_id||null });
      onDone({ visitor:{ ...visitor,department_name:deptName,floor },card:selectedCard });
    } catch(err){ setError(err.response?.data?.error||'Assignment failed.'); }
    setSubmitting(false);
  }

  return (
    <div style={{ padding:24,maxWidth:700,margin:'0 auto' }} className="fade-in">
      <button onClick={onBack} style={{ display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--blue)',fontSize:13,cursor:'pointer',fontFamily:'var(--sans)',marginBottom:20,padding:0 }}>← Back</button>
      <h1 style={{ fontSize:20,fontWeight:700,marginBottom:4 }}>Assign Access Card</h1>
      <p style={{ fontSize:13,color:'var(--dim)',marginBottom:24 }}>Assign a card to <strong style={{ color:'var(--text)' }}>{visitor.full_name}</strong> and hand it to them.</p>

      {error&&<div style={{ background:'rgba(248,81,73,.1)',border:'1px solid rgba(248,81,73,.3)',borderRadius:8,padding:'12px 16px',fontSize:13,color:'var(--red)',marginBottom:20,lineHeight:1.6 }}>⛔ {error}</div>}

      <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,padding:18,marginBottom:20 }}>
        <p style={{ fontFamily:'var(--mono)',fontSize:10,color:'var(--dim)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:12 }}>Visit Summary</p>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
          {[['Visitor',visitor.full_name],['CPR',visitor.cpr_number],['Host',visitor.host_employee||'—'],['Purpose',visitor.purpose||'—'],['Department',deptName||'—'],['Floor',floor||'—']].map(([label,value])=>(
            <div key={label}>
              <span style={{ fontFamily:'var(--mono)',fontSize:10,color:'var(--dim)',letterSpacing:'.08em' }}>{label.toUpperCase()}</span>
              <div style={{ fontSize:13,marginTop:2,color:label==='Floor'?'var(--blue)':'var(--text)',fontWeight:label==='Floor'?600:400 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {cards.length===0 ? (
        <div style={{ background:'rgba(240,160,52,.08)',border:'1px solid rgba(240,160,52,.25)',borderRadius:10,padding:24,textAlign:'center',color:'var(--amber)',marginBottom:20 }}>⚠ No access cards available.</div>
      ) : (
        <>
          <p style={{ fontSize:13,color:'var(--dim)',marginBottom:12 }}>{cards.length} card{cards.length!==1?'s':''} available — select one:</p>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10,marginBottom:20 }}>
            {cards.map(c=>(
              <div key={c.card_id} onClick={()=>setSelectedCard(c)}
                style={{ background:selectedCard?.card_id===c.card_id?'rgba(56,139,253,.15)':'var(--panel)',border:`2px solid ${selectedCard?.card_id===c.card_id?'var(--blue)':'var(--border)'}`,borderRadius:10,padding:'14px 16px',cursor:'pointer',transition:'all .15s',textAlign:'center' }}>
                <div style={{ fontFamily:'var(--mono)',fontSize:14,fontWeight:600,color:'var(--green)',marginBottom:4 }}>{c.card_uid}</div>
                {selectedCard?.card_id===c.card_id&&<div style={{ fontSize:11,color:'var(--blue)',fontWeight:600 }}>✓ Selected</div>}
              </div>
            ))}
          </div>
          {selectedCard&&(
            <div style={{ background:'linear-gradient(135deg,#1a2f5c,#0d1a3a)',border:'1px solid rgba(56,139,253,.3)',borderRadius:12,padding:20,marginBottom:20,position:'relative',overflow:'hidden' }}>
              <div style={{ position:'absolute',top:14,right:14,width:28,height:20,background:'linear-gradient(135deg,var(--amber),#c8780a)',borderRadius:3,opacity:.8 }} />
              <div style={{ fontSize:10,fontFamily:'var(--mono)',color:'rgba(255,255,255,.4)',marginBottom:4 }}>VISITOR CARD</div>
              <div style={{ fontFamily:'var(--mono)',fontSize:22,fontWeight:600,color:'var(--blue)',letterSpacing:'.1em',marginBottom:4 }}>{selectedCard.card_uid}</div>
              <div style={{ fontSize:12,color:'var(--dim)' }}>Assigned to: {visitor.full_name}</div>
            </div>
          )}
          <button onClick={handleAssign} disabled={submitting||!selectedCard}
            style={{ width:'100%',padding:13,borderRadius:8,background:!selectedCard||submitting?'var(--panel2)':'var(--green)',color:!selectedCard||submitting?'var(--dim)':'#000',border:'none',fontSize:14,fontWeight:700,cursor:!selectedCard||submitting?'not-allowed':'pointer',fontFamily:'var(--sans)' }}>
            {submitting?'Assigning…':`✅ Confirm & Hand Card ${selectedCard?.card_uid||''} to Visitor`}
          </button>
        </>
      )}
    </div>
  );
}

function SuccessScreen({ result, onReset }) {
  return (
    <div style={{ padding:24,maxWidth:480,margin:'60px auto 0',textAlign:'center' }} className="fade-in">
      <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:14,padding:'48px 40px' }}>
        <div style={{ fontSize:56,marginBottom:16 }}>✅</div>
        <h2 style={{ fontSize:22,fontWeight:700,color:'var(--green)',marginBottom:8 }}>Check-In Complete</h2>
        <p style={{ fontSize:14,color:'var(--dim)',marginBottom:24 }}>Card <strong style={{ color:'var(--blue)' }}>{result.card.card_uid}</strong> handed to <strong>{result.visitor.full_name}</strong></p>
        <div style={{ background:'var(--panel2)',borderRadius:8,padding:16,marginBottom:24,textAlign:'left',display:'flex',flexDirection:'column',gap:10 }}>
          {[['Visitor',result.visitor.full_name],['CPR',result.visitor.cpr_number],['Host',result.visitor.host_employee||'—'],['Department',result.visitor.department_name||'—'],['Floor',result.visitor.floor||'—'],['Card',result.card.card_uid],['Time',new Date().toLocaleTimeString('en-GB',{ hour:'2-digit',minute:'2-digit' })]].map(([label,value])=>(
            <div key={label} style={{ display:'flex',gap:12,fontSize:13 }}>
              <span style={{ fontFamily:'var(--mono)',fontSize:10,color:'var(--dim)',letterSpacing:'.1em',textTransform:'uppercase',minWidth:80,paddingTop:2 }}>{label}</span>
              <strong style={{ color:label==='Floor'?'var(--blue)':'var(--text)' }}>{value}</strong>
            </div>
          ))}
        </div>
        <button onClick={onReset} style={{ background:'var(--blue)',color:'#fff',border:'none',borderRadius:8,padding:'10px 28px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--sans)' }}>✚ New Check-In</button>
      </div>
    </div>
  );
}