import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const ROLES = ['admin', 'manager', 'security', 'reception'];

const roleColor = {
  admin:     'badge-red',
  manager:   'badge-purple',
  security:  'badge-blue',
  reception: 'badge-green',
};

// ── Password validation ───────────────────────────────────────
function validatePassword(pw) {
  const checks = {
    length:  pw.length >= 10,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    number:  /[0-9]/.test(pw),
    symbol:  /[^A-Za-z0-9]/.test(pw),
  };
  return { checks, valid: Object.values(checks).every(Boolean) };
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const { checks } = validatePassword(password);
  const rules = [
    { key:'length', label:'At least 10 characters'          },
    { key:'upper',  label:'At least one uppercase (A-Z)'    },
    { key:'lower',  label:'At least one lowercase (a-z)'    },
    { key:'number', label:'At least one number (0-9)'       },
    { key:'symbol', label:'At least one symbol (!@#$...)'   },
  ];
  return (
    <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:3 }}>
      {rules.map(r => (
        <div key={r.key} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
          <span style={{ color: checks[r.key]?'var(--green)':'var(--red)', fontSize:12 }}>{checks[r.key]?'✓':'✕'}</span>
          <span style={{ color: checks[r.key]?'var(--green)':'var(--dim)' }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Users() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null); // user object being edited
  const [toggling, setToggling] = useState(null);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  useEffect(() => { if (user?.role !== 'admin') navigate('/dashboard'); }, [user]);
  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try { const { data } = await api.get('/users'); setUsers(data); }
    catch {}
    setLoading(false);
  }

  function flash(msg, type = 'success') {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3500); }
    else                    { setError(msg);   setTimeout(() => setError(''), 4000);   }
  }

  async function handleToggle(u) {
    setToggling(u.user_id);
    try {
      await api.patch(`/users/${u.user_id}/toggle`);
      flash(`${u.full_name} has been ${u.is_active ? 'deactivated' : 'activated'}.`);
      fetchUsers();
    } catch (err) { flash(err.response?.data?.error || 'Failed to update user.', 'error'); }
    setToggling(null);
  }

  function openCreate() { setEditing(null); setShowForm(true); setError(''); setSuccess(''); }
  function openEdit(u)  { setEditing(u);    setShowForm(true); setError(''); setSuccess(''); }
  function closeForm()  { setShowForm(false); setEditing(null); }

  return (
    <div style={{ padding:24 }} className="fade-in">

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700 }}>User Management</h1>
          <p style={{ fontSize:13, color:'var(--dim)', marginTop:3 }}>Admin only — create and manage system accounts</p>
        </div>
        <button onClick={openCreate}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', borderRadius:8, background:'var(--blue)', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>
          ✚ Create Account
        </button>
      </div>

      {error   && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--red)',   marginBottom:16 }}>✕ {error}</div>}
      {success && <div style={{ background:'rgba(63,185,80,.1)', border:'1px solid rgba(63,185,80,.3)', borderRadius:6, padding:'10px 14px', fontSize:13, color:'var(--green)', marginBottom:16 }}>✓ {success}</div>}

      {showForm && (
        <UserForm
          user={editing}
          onClose={closeForm}
          onSaved={() => { closeForm(); fetchUsers(); flash(editing ? `${editing.full_name} updated.` : 'Account created successfully.'); }}
          onError={msg => flash(msg, 'error')}
        />
      )}

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Name','Email','Role','Status','Last Login','Created',''].map(h => (
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
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,253,.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                  {/* Name + avatar */}
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

                  <td style={{ padding:'12px 16px', fontSize:12, fontFamily:'var(--mono)', color:'var(--dim)', borderBottom:'1px solid var(--border)' }}>{u.email}</td>

                  <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    <span className={`badge ${roleColor[u.role] || 'badge-blue'}`}>{u.role}</span>
                  </td>

                  <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>

                  <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    {u.last_login ? (
                      <div>
                        <div style={{ fontSize:12, color:'var(--text)' }}>
                          {new Date(u.last_login).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                        </div>
                        <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--dim)', marginTop:2 }}>
                          {new Date(u.last_login).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color:'var(--faint)', fontSize:12 }}>Never</span>
                    )}
                  </td>

                  <td style={{ padding:'12px 16px', fontSize:12, fontFamily:'var(--mono)', color:'var(--dim)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                    {new Date(u.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                  </td>

                  {/* Actions */}
                  <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', gap:8 }}>
                      {/* Edit button — always shown except for yourself */}
                      <button onClick={() => openEdit(u)}
                        style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background:'transparent', border:'1px solid var(--border2)', color:'var(--text)', transition:'all .15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}>
                        ✏ Edit
                      </button>
                      {/* Activate/Deactivate — not for yourself */}
                      {u.user_id !== user.user_id && (
                        <button onClick={() => handleToggle(u)} disabled={toggling === u.user_id}
                          style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontFamily:'var(--sans)', cursor:'pointer', background:'transparent', border:`1px solid ${u.is_active?'rgba(248,81,73,.3)':'rgba(63,185,80,.3)'}`, color: u.is_active?'var(--red)':'var(--green)', transition:'all .15s' }}>
                          {toggling === u.user_id ? '…' : u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
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

// ── Unified Create / Edit Form ────────────────────────────────
function UserForm({ user: editingUser, onClose, onSaved, onError }) {
  const isEdit = !!editingUser;

  const [form, setForm] = useState({
    full_name: editingUser?.full_name || '',
    email:     editingUser?.email     || '',
    phone:     editingUser?.phone     || '',
    role:      editingUser?.role      || 'security',
    password:  '',
  });
  const [showPw,     setShowPw]     = useState(false);
  const [changePw,   setChangePw]   = useState(!isEdit); // auto-show on create, toggle on edit
  const [submitting, setSubmitting] = useState(false);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  const pwResult  = validatePassword(form.password);
  const pwValid   = !changePw || form.password === '' ? true : pwResult.valid;
  const pwBorder  = form.password
    ? pwResult.valid ? 'rgba(63,185,80,.5)' : 'rgba(248,81,73,.4)'
    : 'var(--border2)';

  async function handleSubmit(e) {
    e.preventDefault();

    // On create, password is required
    if (!isEdit && !form.password) { onError('Password is required.'); return; }
    if (changePw && form.password && !pwResult.valid) { onError('Password does not meet complexity requirements.'); return; }

    setSubmitting(true);
    try {
      const payload = {
        full_name: form.full_name,
        email:     form.email,
        phone:     form.phone || null,
        role:      form.role,
      };

      // Only include password if it was set
      if (form.password) payload.password = form.password;

      if (isEdit) {
        await api.patch(`/users/${editingUser.user_id}`, payload);
      } else {
        await api.post('/users', { ...payload, password: form.password });
      }
      onSaved();
    } catch (err) {
      onError(err.response?.data?.error || (isEdit ? 'Failed to update account.' : 'Failed to create account.'));
    }
    setSubmitting(false);
  }

  const fieldStyle = { background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:7, padding:'9px 12px', fontSize:13, color:'var(--text)', fontFamily:'var(--sans)', outline:'none', width:'100%' };
  const labelStyle = { fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--dim)' };

  return (
    <div style={{ background:'var(--panel)', border:'1px solid var(--border2)', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{isEdit ? `Edit — ${editingUser.full_name}` : 'Create New Account'}</span>
          {isEdit && <span className={`badge ${roleColor[editingUser.role] || 'badge-blue'}`}>{editingUser.role}</span>}
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:16 }}>✕</button>
      </div>

      <form onSubmit={handleSubmit} style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>

        {/* Row 1: Name + Email */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>FULL NAME *</label>
            <input value={form.full_name} onChange={set('full_name')} placeholder="e.g. Ahmed Al-Mansoori" required style={fieldStyle} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>EMAIL *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="officer@nfh.bh" required style={fieldStyle} autoComplete="off" />
          </div>
        </div>

        {/* Row 2: Role + Phone */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>ROLE *</label>
            <select value={form.role} onChange={set('role')} required style={fieldStyle}>
              {ROLES.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={labelStyle}>PHONE</label>
            <input value={form.phone} onChange={set('phone')} placeholder="+973 XXXX XXXX" style={fieldStyle} />
          </div>
        </div>

        {/* Password section */}
        <div style={{ background:'var(--panel2)', border:'1px solid var(--border2)', borderRadius:8, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: changePw ? 12 : 0 }}>
            <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--dim)', letterSpacing:'.08em' }}>
              {isEdit ? 'PASSWORD' : 'PASSWORD *'}
            </span>
            {isEdit && (
              <button type="button" onClick={() => { setChangePw(p => !p); setForm(f => ({ ...f, password:'' })); }}
                style={{ fontSize:11, color:'var(--blue)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--mono)', textDecoration:'underline' }}>
                {changePw ? 'Cancel password change' : '🔑 Change password'}
              </button>
            )}
          </div>

          {(!isEdit || changePw) && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {isEdit && (
                <div style={{ fontSize:11, color:'var(--dim)', marginBottom:4 }}>
                  Leave blank to keep the existing password.
                </div>
              )}
              <div style={{ position:'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder={isEdit ? 'Enter new password…' : 'Min. 10 chars with uppercase, number & symbol'}
                  required={!isEdit}
                  style={{ ...fieldStyle, borderColor: pwBorder, paddingRight:52 }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--blue)', fontSize:11, cursor:'pointer', fontFamily:'var(--mono)' }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {form.password && <PasswordStrength password={form.password} />}
            </div>
          )}

          {isEdit && !changePw && (
            <div style={{ fontSize:12, color:'var(--faint)', fontStyle:'italic' }}>
              Password unchanged — click "Change password" to update it.
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
          <button type="button" onClick={onClose}
            style={{ padding:'8px 18px', borderRadius:7, fontSize:13, fontFamily:'var(--sans)', cursor:'pointer', background:'transparent', border:'1px solid var(--border2)', color:'var(--dim)' }}>
            Cancel
          </button>
          <button type="submit"
            disabled={submitting || (!isEdit && !pwResult.valid)}
            style={{ padding:'8px 20px', borderRadius:7, fontSize:13, fontWeight:600, fontFamily:'var(--sans)', cursor: submitting?'not-allowed':'pointer', background:'var(--blue)', color:'#fff', border:'none', opacity: submitting?.6:1 }}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Account')}
          </button>
        </div>
      </form>
    </div>
  );
}