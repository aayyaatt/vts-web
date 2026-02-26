import { useState, useEffect } from 'react';
import api from '../api';

export default function Logs() {
  const [logs,   setLogs]   = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/dashboard/activity').then(r => setLogs(r.data));
  }, []);

  const filtered = logs.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'checkin')  return l.action === 'CHECKIN';
    if (filter === 'checkout') return l.action === 'CHECKOUT';
    if (filter === 'login')    return l.action === 'LOGIN';
    return true;
  });

  const actionColor = { LOGIN:'badge-blue', LOGOUT:'badge-purple', CHECKIN:'badge-green', CHECKOUT:'badge-amber', ACCESS_DENIED:'badge-red' };

  return (
    <div style={{padding:24}} className="fade-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700}}>Audit & Access Logs</h1>
          <p style={{fontSize:13,color:'var(--dim)',marginTop:3}}>All system actions · sorted newest first</p>
        </div>
        <button className="btn-ghost" style={{fontSize:12}} onClick={()=>alert('Export coming soon')}>📥 Export</button>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {[['all','All Events'],['checkin','✅ Check-In'],['checkout','🔙 Check-Out'],['login','🔑 Login']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'5px 14px',borderRadius:100,fontSize:12,fontFamily:'var(--sans)',cursor:'pointer',
              border:'1px solid var(--border2)',background:filter===f?'rgba(56,139,253,.12)':'transparent',
              color:filter===f?'var(--blue)':'var(--dim)',transition:'all .15s'}}>
            {label}
          </button>
        ))}
      </div>

      <div style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                {['Time','User','Action','Table','Details'].map(h=>(
                  <th key={h} style={{fontFamily:'var(--mono)',fontSize:11,letterSpacing:'.08em',color:'var(--dim)',textAlign:'left',padding:'10px 16px',borderBottom:'1px solid var(--border)',background:'rgba(255,255,255,.02)',textTransform:'uppercase'}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{textAlign:'center',padding:'40px 0',color:'var(--dim)',fontSize:13}}>No log entries.</td></tr>
              ) : filtered.map((l,i)=>(
                <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='rgba(56,139,253,.04)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{padding:'11px 16px',fontFamily:'var(--mono)',fontSize:12,borderBottom:'1px solid var(--border)',color:'var(--dim)',whiteSpace:'nowrap'}}>
                    {new Date(l.performed_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                    <div style={{fontSize:10,color:'var(--faint)'}}>
                      {new Date(l.performed_at).toLocaleDateString('en-GB')}
                    </div>
                  </td>
                  <td style={{padding:'11px 16px',fontSize:13,borderBottom:'1px solid var(--border)'}}>{l.full_name}</td>
                  <td style={{padding:'11px 16px',borderBottom:'1px solid var(--border)'}}>
                    <span className={`badge ${actionColor[l.action]||'badge-blue'}`}>{l.action}</span>
                  </td>
                  <td style={{padding:'11px 16px',fontSize:12,fontFamily:'var(--mono)',color:'var(--dim)',borderBottom:'1px solid var(--border)'}}>{l.target_table || '—'}</td>
                  <td style={{padding:'11px 16px',fontSize:12,color:'var(--dim)',borderBottom:'1px solid var(--border)',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {l.new_values ? JSON.stringify(l.new_values) : '—'}
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
