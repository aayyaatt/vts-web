import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const ROLES = ['security', 'reception', 'manager', 'admin'];

const roleColor = {
  admin:     'badge-red',
  manager:   'badge-purple',
  security:  'badge-blue',
  reception: 'badge-green',
};

export default function Users() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [toggling,  setToggling]  = useState(null);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  // Redirect non-admins
  useEffect(() => {
    if (user?.role !== 'admin') navigate('/dashboard');
  }, [user]);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch {}
    setLoading(false);
  }

  async function handleToggle(u) {
    setToggling(u.user_id);
    try {
      await api.patch(`/users/${u.user_id}/toggle`);
      setSuccess(`${u.full_name} has been ${u.is_active ? 'deactivated' : 'activated'}.`);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user.');
      setTimeout(() => setError(''), 3000);
    }
    setToggling(null);
  }

  return (
    <div style={{ padding: 24 }} className="fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>User Management</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
            Admin only — create and manage system accounts
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(''); setSuccess(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 8,
            background: 'var(--blue)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--sans)',
          }}
        >
          ✚ Create Account
        </button>
      </div>

      {/* Alerts */}
      {error   && <div style={{ background:'rgba(248,81,73,.1)',  border:'1px solid rgba(248,81,73,.3)',  borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--red)',   marginBottom:16 }}>✕ {error}</div>}
      {success && <div style={{ background:'rgba(63,185,80,.1)',  border:'1px solid rgba(63,185,80,.3)',  borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--green)', marginBottom:16 }}>✓ {success}</div>}

      {/* Create form */}
      {showForm && (
        <CreateUserForm
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); fetchUsers(); setSuccess('Account created successfully.'); setTimeout(()=>setSuccess(''),3000); }}
          onError={msg => { setError(msg); setTimeout(()=>setError(''),4000); }}
        />
      )}

      {/* Users table */}
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Created', ''].map(h => (
                  <th key={h} style={{ fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.08em', color:'var(--dim)', textAlign:'left', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,.02)', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'var(--dim)', fontSize:13 }}>Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'var(--dim)', fontSize:13 }}>No users found.</td></tr>
              ) : users.map(u => (
                <tr key={u.user_id}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(56,139,253,.04)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  {/* Name */}
                  <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#1a3a6e,var(--blue))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {u.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{u.full_name}</div>
                        {u.phone && <div style={{ fontSize:11, color:'var(--dim)' }}>{u.phone}</div>}
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td style={{ padding:'12px 16px', fontSize:13, color:'var(--dim)', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:12 }}>
                    {u.email}
                  </td>

                  {/* Role */}
                  <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    <span className={`badge ${roleColor[u.role] || 'badge-blue'}`}>
                      {u.role}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>

                  {/* Last login */}
                  <td style={{ padding:'12px 16px', fontSize:12, fontFamily:'var(--mono)', color:'var(--dim)', borderBottom:'1px solid var(--border)' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('en-GB') : '—'}
                  </td>

                  {/* Created */}
                  <td style={{ padding:'12px 16px', fontSize:12, fontFamily:'var(--mono)', color:'var(--dim)', borderBottom:'1px solid var(--border)' }}>
                    {new Date(u.created_at).toLocaleDateString('en-GB')}
                  </td>

                  {/* Actions */}
                  <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    {u.user_id !== user.user_id && (
                      <button
                        onClick={() => handleToggle(u)}
                        disabled={toggling === u.user_id}
                        style={{
                          padding:'5px 12px', borderRadius:6, fontSize:12,
                          fontFamily:'var(--sans)', cursor:'pointer',
                          background:'transparent',
                          border:`1px solid ${u.is_active ? 'rgba(248,81,73,.3)' : 'rgba(63,185,80,.3)'}`,
                          color: u.is_active ? 'var(--red)' : 'var(--green)',
                          transition:'all .15s',
                        }}
                      >
                        {toggling === u.user_id ? '…' : u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Create User Form ──────────────────────────────────────────
function CreateUserForm({ onClose, onCreated, onError }) {
  const [form, setForm]       = useState({ email:'', password:'', full_name:'', role:'security', phone:'' });
  const [showPw, setShowPw]   = useState(false);
  const [submitting, setSub]  = useState(false);

  function set(field) { return e => setForm(f => ({...f, [field]: e.target.value})); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSub(true);
    try {
      await api.post('/users', form);
      onCreated();
    } catch (err) {
      onError(err.response?.data?.error || 'Failed to create account.');
    }
    setSub(false);
  }

  const fieldStyle = {
    background:'var(--panel2)', border:'1px solid var(--border2)',
    borderRadius:7, padding:'9px 12px', fontSize:13,
    color:'var(--text)', fontFamily:'var(--sans)', outline:'none', width:'100%',
  };

  const labelStyle = {
    fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)',
  };

  return (
    <div style={{ background:'var(--panel)', border:'1px solid var(--border2)', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:14, fontWeight:600 }}>Create New Account</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:16, fontFamily:'var(--sans)' }}>✕</button>
      </div>

      <form onSubmit={handleSubmit} style={{ padding:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>FULL NAME *</label>
            <input value={form.full_name} onChange={set('full_name')} placeholder="e.g. Ahmed Al-Mansoori" required style={fieldStyle} />
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>EMAIL *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="officer@nfh.bh" required style={fieldStyle} />
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>PASSWORD *</label>
            <div style={{ position:'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password} onChange={set('password')}
                placeholder="Min. 8 characters" required minLength={8}
                style={fieldStyle}
              />
              <button type="button" onClick={() => setShowPw(p=>!p)}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--blue)', fontSize:11, cursor:'pointer', fontFamily:'var(--mono)' }}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>ROLE *</label>
            <select value={form.role} onChange={set('role')} required style={fieldStyle}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>PHONE</label>
            <input value={form.phone} onChange={set('phone')} placeholder="+973 XXXX XXXX" style={fieldStyle} />
          </div>

        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{ padding:'8px 18px', borderRadius:7, fontSize:13, fontFamily:'var(--sans)', cursor:'pointer', background:'transparent', border:'1px solid var(--border2)', color:'var(--dim)' }}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            style={{ padding:'8px 20px', borderRadius:7, fontSize:13, fontWeight:600, fontFamily:'var(--sans)', cursor:'pointer', background:'var(--blue)', color:'#fff', border:'none', opacity: submitting ? .6 : 1 }}>
            {submitting ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  );
}