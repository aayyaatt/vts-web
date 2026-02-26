// Cards.jsx
import { useState, useEffect } from 'react';
import api from '../api';

const STATUS_COLOR = { available:'badge-green', assigned:'badge-blue', lost:'badge-red', retired:'badge-purple' };

export function Cards() {
  const [cards,  setCards]  = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { api.get('/cards').then(r => setCards(r.data)); }, []);

  const filtered = cards.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.card_uid.toLowerCase().includes(q) || (c.visitor_name||'').toLowerCase().includes(q);
    }
    return true;
  });

  const counts = { all: cards.length, available: cards.filter(c=>c.status==='available').length, assigned: cards.filter(c=>c.status==='assigned').length, lost: cards.filter(c=>c.status==='lost'||c.status==='retired').length };

  return (
    <div style={{padding:24}} className="fade-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700}}>Card Management</h1>
          <p style={{fontSize:13,color:'var(--dim)',marginTop:3}}>
            {counts.available} available · {counts.assigned} assigned · {counts.lost} lost/retired
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
        <input
          style={{background:'var(--panel2)',border:'1px solid var(--border2)',borderRadius:7,padding:'8px 14px',color:'var(--text)',fontFamily:'var(--sans)',fontSize:13,outline:'none',width:260}}
          placeholder="🔍  Search card or visitor…"
          value={search} onChange={e=>setSearch(e.target.value)}
        />
        {['all','available','assigned','lost'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'6px 16px',borderRadius:100,fontSize:12,fontFamily:'var(--sans)',cursor:'pointer',border:'1px solid var(--border2)',background:filter===f?'rgba(56,139,253,.12)':'transparent',color:filter===f?'var(--blue)':'var(--dim)',transition:'all .15s'}}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:12}}>
        {filtered.map(c=>(
          <div key={c.card_id} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,padding:16,transition:'all .15s',position:'relative'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
            <div style={{position:'absolute',top:14,right:14,width:8,height:8,borderRadius:'50%',
              background:c.status==='available'?'var(--green)':c.status==='assigned'?'var(--blue)':'var(--red)',
              boxShadow:c.status==='available'?'0 0 6px var(--green)':'none'}} />
            <div style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:600,marginBottom:6,
              color:c.status==='available'?'var(--green)':c.status==='assigned'?'var(--blue)':'var(--red)'}}>
              {c.card_uid}
            </div>
            <div style={{fontSize:13,color:c.visitor_name?'var(--text)':'var(--dim)',marginBottom:3}}>
              {c.visitor_name || (c.status==='available'?'Available':'—')}
            </div>
            <span className={`badge ${STATUS_COLOR[c.status]||'badge-blue'}`} style={{marginTop:6,display:'inline-flex'}}>
              {c.status}
            </span>
          </div>
        ))}
        {filtered.length===0 && <div style={{gridColumn:'1/-1',textAlign:'center',padding:'40px 0',color:'var(--dim)'}}>No cards match your filter.</div>}
      </div>
    </div>
  );
}

export default Cards;
