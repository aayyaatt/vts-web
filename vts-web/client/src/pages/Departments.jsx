import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Departments() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [depts,   setDepts]   = useState([]);
  const [floors,  setFloors]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm,setShowForm]= useState(false);
  const [editing, setEditing] = useState(null);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Floor manager state
  const [showFloorManager, setShowFloorManager] = useState(false);
  const [newFloor,          setNewFloor]         = useState('');
  const [floorSaving,       setFloorSaving]      = useState(false);
  const [floorError,        setFloorError]       = useState('');

  useEffect(() => { if (user?.role !== 'admin') navigate('/dashboard'); }, [user]);
  useEffect(() => { fetchDepts(); fetchFloors(); }, []);

  async function fetchDepts() {
    try {
      const { data } = await api.get('/departments');
      setDepts(data);
    } catch {}
    setLoading(false);
  }

  async function fetchFloors() {
    try {
      const { data } = await api.get('/floors');
      setFloors(data);
    } catch {
      // Fallback defaults
      setFloors(['G','1','2','3','4','5','6','7','8']);
    }
  }

  function flash(msg, type = 'success') {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
    else                    { setError(msg);   setTimeout(() => setError(''), 4000);   }
  }

  async function handleDelete(dept) {
    if (!window.confirm(`Delete "${dept.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/departments/${dept.department_id}`);
      flash(`"${dept.name}" deleted.`);
      fetchDepts();
    } catch (err) { flash(err.response?.data?.error || 'Delete failed.', 'error'); }
  }

  async function handleToggle(dept) {
    try {
      await api.patch(`/departments/${dept.department_id}`, { is_active: !dept.is_active });
      flash(`"${dept.name}" ${dept.is_active ? 'deactivated' : 'activated'}.`);
      fetchDepts();
    } catch (err) { flash(err.response?.data?.error || 'Update failed.', 'error'); }
  }

  async function handleAddFloor() {
    if (!newFloor.trim()) { setFloorError('Floor name cannot be empty.'); return; }
    setFloorSaving(true); setFloorError('');
    try {
      const { data } = await api.post('/floors', { floor: newFloor.trim() });
      setFloors(data);
      setNewFloor('');
      flash(`Floor "${newFloor.trim()}" added.`);
    } catch (err) { setFloorError(err.response?.data?.error || 'Failed to add floor.'); }
    setFloorSaving(false);
  }

  async function handleDeleteFloor(floor) {
    if (!window.confirm(`Remove floor "${floor}"? Departments using this floor won't be affected.`)) return;
    try {
      const { data } = await api.delete(`/floors/${encodeURIComponent(floor)}`);
      setFloors(data);
      flash(`Floor "${floor}" removed.`);
    } catch (err) { flash(err.response?.data?.error || 'Failed to remove floor.', 'error'); }
  }

  const floorList = [...new Set(depts.map(d => d.floor))].sort();

  return (
    <div style={{ padding: 24 }} className="fade-in">

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700 }}>Departments</h1>
          <p style={{ fontSize:13, color:'var(--dim)', marginTop:3 }}>
            Manage company departments and their floor assignments
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => setShowFloorManager(p => !p)}
            style={{ padding:'9px 16px', borderRadius:8, background: showFloorManager?'rgba(139,92,246,.12)':'transparent', border:`1px solid ${showFloorManager?'rgba(139,92,246,.4)':'var(--border2)'}`, color: showFloorManager?'var(--purple)':'var(--dim)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>
            🏢 Manage Floors
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', borderRadius:8, background:'var(--blue)', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>
            ✚ Add Department
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error   && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--red)',   marginBottom:16 }}>✕ {error}</div>}
      {success && <div style={{ background:'rgba(63,185,80,.1)', border:'1px solid rgba(63,185,80,.3)', borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--green)', marginBottom:16 }}>✓ {success}</div>}

      {/* ── Floor Manager Panel ─────────────────────────────── */}
      {showFloorManager && (
        <div style={{ background:'var(--panel)', border:'1px solid rgba(139,92,246,.3)', borderLeftWidth:4, borderRadius:10, padding:20, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--purple)' }}>🏢 Floor Management</div>
              <div style={{ fontSize:12, color:'var(--dim)', marginTop:3 }}>
                These floors appear in department and card dropdowns across the system.
              </div>
            </div>
            <button onClick={() => setShowFloorManager(false)}
              style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:18 }}>✕</button>
          </div>

          {/* Existing floors */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
            {floors.length === 0 ? (
              <span style={{ fontSize:13, color:'var(--dim)' }}>No floors configured yet.</span>
            ) : floors.map(f => (
              <div key={f} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:6, padding:'5px 10px' }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:600, color:'var(--blue)' }}>{f}</span>
                <button onClick={() => handleDeleteFloor(f)}
                  style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:12, padding:0, lineHeight:1, opacity:.7 }}
                  title={`Remove floor ${f}`}>✕</button>
              </div>
            ))}
          </div>

          {/* Add new floor */}
          <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            <div style={{ flex:1 }}>
              <input
                value={newFloor}
                onChange={e => { setNewFloor(e.target.value); setFloorError(''); }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddFloor())}
                placeholder="e.g. 9, Rooftop, Basement…"
                style={{ width:'100%', background:'var(--panel2)', border:`1px solid ${floorError?'rgba(248,81,73,.5)':'var(--border2)'}`, borderRadius:7, padding:'9px 12px', fontSize:13, color:'var(--text)', fontFamily:'var(--sans)', outline:'none' }}
              />
              {floorError && <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>{floorError}</div>}
            </div>
            <button onClick={handleAddFloor} disabled={floorSaving || !newFloor.trim()}
              style={{ padding:'9px 18px', borderRadius:7, background: floorSaving||!newFloor.trim()?'var(--panel2)':'var(--purple)', color: floorSaving||!newFloor.trim()?'var(--dim)':'#fff', border:'none', fontSize:13, fontWeight:600, cursor: floorSaving||!newFloor.trim()?'not-allowed':'pointer', fontFamily:'var(--sans)', whiteSpace:'nowrap' }}>
              {floorSaving ? 'Adding…' : '✚ Add Floor'}
            </button>
          </div>
        </div>
      )}

      {/* Department Form */}
      {showForm && (
        <DeptForm
          dept={editing}
          floors={floors}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchDepts(); flash(editing ? 'Department updated.' : 'Department created.'); }}
          onError={msg => flash(msg, 'error')}
        />
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
        {[
          { label:'Total Departments', value: depts.length,                        color:'var(--blue)'   },
          { label:'Active',            value: depts.filter(d=>d.is_active).length, color:'var(--green)'  },
          { label:'Floors in Use',     value: floorList.length,                    color:'var(--purple)' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 20px' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:32, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Departments grouped by floor */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--dim)' }}>Loading…</div>
      ) : depts.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--dim)' }}>No departments yet. Add one above.</div>
      ) : (
        floorList.map(floor => (
          <div key={floor} style={{ marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:11, fontWeight:600, color:'var(--blue)', letterSpacing:'.1em', textTransform:'uppercase' }}>
                📍 {floor}
              </div>
              <div style={{ flex:1, height:1, background:'var(--border)' }} />
              <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--dim)' }}>
                {depts.filter(d=>d.floor===floor).length} dept{depts.filter(d=>d.floor===floor).length!==1?'s':''}
              </span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
              {depts.filter(d => d.floor === floor).map(dept => (
                <div key={dept.department_id}
                  style={{ background:'var(--panel)', border:`1px solid ${dept.is_active?'var(--border)':'rgba(248,81,73,.2)'}`, borderRadius:10, padding:18, opacity: dept.is_active?1:.65 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>{dept.name}</div>
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, padding:'2px 8px', borderRadius:4, background:'rgba(56,139,253,.1)', color:'var(--blue)', border:'1px solid rgba(56,139,253,.2)' }}>
                        {dept.floor}
                      </span>
                    </div>
                    <span style={{ fontFamily:'var(--mono)', fontSize:10, padding:'3px 8px', borderRadius:4, background: dept.is_active?'rgba(63,185,80,.1)':'rgba(248,81,73,.1)', color: dept.is_active?'var(--green)':'var(--red)', border:`1px solid ${dept.is_active?'rgba(63,185,80,.25)':'rgba(248,81,73,.25)'}` }}>
                      {dept.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {dept.description && (
                    <p style={{ fontSize:12, color:'var(--dim)', marginBottom:12, lineHeight:1.5 }}>{dept.description}</p>
                  )}
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button onClick={() => { setEditing(dept); setShowForm(true); }}
                      style={{ flex:1, padding:'6px 0', borderRadius:6, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background:'transparent', border:'1px solid var(--border2)', color:'var(--text)' }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--blue)'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border2)'}>
                      ✏ Edit
                    </button>
                    <button onClick={() => handleToggle(dept)}
                      style={{ flex:1, padding:'6px 0', borderRadius:6, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background:'transparent', border:`1px solid ${dept.is_active?'rgba(240,160,52,.3)':'rgba(63,185,80,.3)'}`, color: dept.is_active?'var(--amber)':'var(--green)' }}>
                      {dept.is_active ? '⏸ Deactivate' : '▶ Activate'}
                    </button>
                    <button onClick={() => handleDelete(dept)}
                      style={{ padding:'6px 10px', borderRadius:6, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background:'transparent', border:'1px solid rgba(248,81,73,.25)', color:'var(--red)' }}>
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Department Form ───────────────────────────────────────────
function DeptForm({ dept, floors, onClose, onSaved, onError }) {
  const [form, setForm]   = useState({ name: dept?.name||'', floor: dept?.floor||'', description: dept?.description||'' });
  const [submitting, setSub] = useState(false);

  function set(field) { return e => setForm(f => ({...f, [field]: e.target.value})); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.floor) { onError('Please select a floor.'); return; }
    setSub(true);
    try {
      if (dept) await api.patch(`/departments/${dept.department_id}`, form);
      else      await api.post('/departments', form);
      onSaved();
    } catch (err) { onError(err.response?.data?.error || 'Save failed.'); }
    setSub(false);
  }

  const fieldStyle = { background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, padding:'9px 12px', fontSize:13, color:'var(--text)', fontFamily:'var(--sans)', outline:'none', width:'100%' };
  const labelStyle = { fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' };

  return (
    <div style={{ background:'var(--panel)', border:'1px solid var(--border2)', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:14, fontWeight:600 }}>{dept ? 'Edit Department' : 'Add Department'}</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:16 }}>✕</button>
      </div>

      <form onSubmit={handleSubmit} style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

          {/* Department Name */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>DEPARTMENT NAME *</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Human Resources" required style={fieldStyle} />
          </div>

          {/* Floor — dropdown from DB floors */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>FLOOR *</label>
            <select value={form.floor} onChange={set('floor')} required style={fieldStyle}>
              <option value="">— Select Floor —</option>
              {floors.map(f => (
                <option key={f} value={f}>{f === 'G' ? 'Ground Floor (G)' : `Floor ${f}`}</option>
              ))}
            </select>
            {floors.length === 0 && (
              <div style={{ fontSize:11, color:'var(--amber)', marginTop:2 }}>
                No floors configured. Use "Manage Floors" to add some first.
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={labelStyle}>DESCRIPTION <span style={{ color:'var(--dim)', fontSize:9 }}>(OPTIONAL)</span></label>
          <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Optional description…" style={{...fieldStyle, resize:'vertical'}} />
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{ padding:'8px 18px', borderRadius:7, fontSize:13, fontFamily:'var(--sans)', cursor:'pointer', background:'transparent', border:'1px solid var(--border2)', color:'var(--dim)' }}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            style={{ padding:'8px 20px', borderRadius:7, fontSize:13, fontWeight:600, fontFamily:'var(--sans)', cursor:'pointer', background:'var(--blue)', color:'#fff', border:'none', opacity: submitting?.6:1 }}>
            {submitting ? 'Saving…' : dept ? 'Save Changes' : 'Add Department'}
          </button>
        </div>
      </form>
    </div>
  );
}