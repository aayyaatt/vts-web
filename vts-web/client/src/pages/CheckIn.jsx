import { useState, useEffect } from 'react';
import api from '../api';
import styles from './CheckIn.module.css';

const PURPOSES = ['Business Meeting','Interview','Maintenance / Repair','Delivery','Government Official','Other'];

export default function CheckIn() {
  const [form, setForm] = useState({ full_name:'', cpr_number:'', phone:'', email:'', company:'', host_employee:'', purpose:'', notes:'' });
  const [cards,     setCards]     = useState([]);
  const [nextCard,  setNextCard]  = useState(null);
  const [cprStatus, setCprStatus] = useState(null); // null | 'ok' | 'flagged' | 'checking'
  const [flagInfo,  setFlagInfo]  = useState(null);
  const [submitting,setSubmitting]= useState(false);
  const [success,   setSuccess]   = useState(null);
  const [error,     setError]     = useState('');

  useEffect(() => {
    api.get('/cards').then(r => {
      setCards(r.data);
      const next = r.data.find(c => c.status === 'available');
      setNextCard(next || null);
    });
  }, [success]);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  // CPR check with debounce
  useEffect(() => {
    if (form.cpr_number.length < 5) { setCprStatus(null); setFlagInfo(null); return; }
    setCprStatus('checking');
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post('/visitors/check-cpr', { cpr_number: form.cpr_number });
        if (data.flagged) {
          setCprStatus('flagged');
          setFlagInfo(data.flag);
        } else {
          setCprStatus('ok');
          setFlagInfo(null);
        }
      } catch { setCprStatus(null); }
    }, 600);
    return () => clearTimeout(t);
  }, [form.cpr_number]);

  const checks = [
    { label: 'Visitor name entered',   done: form.full_name.trim().length > 2 },
    { label: 'CPR verified',           done: cprStatus === 'ok' },
    { label: 'Host employee selected', done: form.host_employee.trim().length > 0 },
    { label: 'Purpose set',            done: form.purpose.length > 0 },
    { label: 'Not on banned list',     done: cprStatus === 'ok' },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (cprStatus === 'flagged') { setError('Cannot check in a flagged visitor.'); return; }
    setError(''); setSubmitting(true);

    try {
      // Upsert visitor
      let visitorId;
      try {
        const vRes = await api.post('/visitors', { ...form });
        visitorId = vRes.data.visitor_id;
      } catch {
        // visitor may already exist — fetch by CPR not implemented yet, use returned id
        setError('Visitor creation failed. Check CPR number.'); setSubmitting(false); return;
      }

      // Create visit
      await api.post('/visits', {
        visitor_id:    visitorId,
        card_id:       nextCard?.card_id || null,
        host_employee: form.host_employee,
        purpose:       form.purpose,
        notes:         form.notes,
      });

      setSuccess({ name: form.full_name, card: nextCard?.card_uid || 'No card', host: form.host_employee });
      setForm({ full_name:'', cpr_number:'', phone:'', email:'', company:'', host_employee:'', purpose:'', notes:'' });
      setCprStatus(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Check-in failed.');
    }
    setSubmitting(false);
  }

  if (success) return (
    <div className={`${styles.page} fade-in`}>
      <div className={styles.successCard}>
        <div className={styles.successIcon}>✅</div>
        <h2 className={styles.successTitle}>Visitor Checked In</h2>
        <p className={styles.successSub}>Card <strong>{success.card}</strong> assigned to <strong>{success.name}</strong></p>
        <div className={styles.successMeta}>
          <div><span>HOST</span>{success.host}</div>
          <div><span>TIME</span>{new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
          <div><span>CARD</span>{success.card}</div>
        </div>
        <div style={{display:'flex',gap:12,justifyContent:'center',marginTop:24}}>
          <button className="btn-primary" onClick={() => setSuccess(null)}>✚ New Check-In</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${styles.page} fade-in`}>
      <div className={styles.formPanel}>
        <h1 className={styles.title}>New Visitor Check-In</h1>
        <p className={styles.sub}>Complete all required fields then confirm with security.</p>

        {error && <div className={styles.errorBar}>✕  {error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1 */}
          <div className={styles.section}>
            <div className={styles.sectionHead}><span className={styles.step}>1</span> Visitor Information</div>
            <div className={styles.sectionBody}>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>FULL NAME *</label>
                  <input value={form.full_name} onChange={set('full_name')} placeholder="e.g. Mohammed Al-Rashid" required />
                </div>
                <div className={styles.field}>
                  <label>CPR NUMBER *</label>
                  <div style={{position:'relative'}}>
                    <input value={form.cpr_number} onChange={set('cpr_number')} placeholder="9 digits" maxLength={9} required />
                    {cprStatus === 'checking' && <span className={styles.cprSpinner}>●</span>}
                  </div>
                  {cprStatus === 'ok'      && <p className={styles.cprOk}>✓ Verified — not on banned list</p>}
                  {cprStatus === 'flagged' && <p className={styles.cprBad}>⛔ FLAGGED: {flagInfo?.reason}</p>}
                </div>
              </div>
              <div className={styles.row2}>
                <div className={styles.field}><label>PHONE</label><input value={form.phone} onChange={set('phone')} placeholder="+973 XXXX XXXX" /></div>
                <div className={styles.field}><label>COMPANY</label><input value={form.company} onChange={set('company')} placeholder="Optional" /></div>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className={styles.section}>
            <div className={styles.sectionHead}><span className={styles.step}>2</span> Visit Details</div>
            <div className={styles.sectionBody}>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>HOST EMPLOYEE *</label>
                  <input value={form.host_employee} onChange={set('host_employee')} placeholder="Employee name" required />
                </div>
                <div className={styles.field}>
                  <label>PURPOSE *</label>
                  <select value={form.purpose} onChange={set('purpose')} required>
                    <option value="">— Select —</option>
                    {PURPOSES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label>NOTES</label>
                <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Any special instructions…" />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{width:'100%',justifyContent:'center',padding:'13px'}} disabled={submitting || cprStatus==='flagged'}>
            {submitting ? 'Checking in…' : '✅ Confirm Check-In & Assign Card'}
          </button>
        </form>
      </div>

      {/* Side panel */}
      <div className={styles.side}>

        {/* Next card */}
        <div className={styles.cardBox}>
          <p className={styles.cardBoxLabel}>NEXT AVAILABLE CARD</p>
          {nextCard ? (
            <div className={styles.cardVisual}>
              <div className={styles.cardChip} />
              <div className={styles.cardSub}>VISITOR CARD</div>
              <div className={styles.cardNum}>{nextCard.card_uid}</div>
              <div className={styles.cardMeta}>Status: available · Ready to assign</div>
            </div>
          ) : (
            <div className={styles.noCard}>⚠ No cards available</div>
          )}
        </div>

        {/* Checklist */}
        <div className={styles.checklist}>
          <p className={styles.checklistTitle}>Verification Checklist</p>
          {checks.map((c, i) => (
            <div key={i} className={`${styles.checkItem} ${c.done ? styles.done : ''}`}>
              <div className={styles.checkCircle}>{c.done ? '✓' : ''}</div>
              <span>{c.label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
