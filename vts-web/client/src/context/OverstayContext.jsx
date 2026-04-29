import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api';

const OverstayContext = createContext({ overstays: [], count: 0 });

export function OverstayProvider({ children }) {
  const [overstays, setOverstays] = useState([]);
  const { user } = (() => {
    try { return JSON.parse(localStorage.getItem('vts_user')) ? { user: JSON.parse(localStorage.getItem('vts_user')) } : { user: null }; }
    catch { return { user: null }; }
  })();

  async function check() {
    if (!localStorage.getItem('vts_token')) return;
    try {
      const { data } = await api.get('/dashboard/active-visits');
      const over = data.filter(v => v.status === 'overstay');
      setOverstays(over);
    } catch {}
  }

  useEffect(() => {
    check();
  const interval = setInterval(check, 15 * 1000); // every 15s — matches dashboard
    return () => clearInterval(interval);
  }, []);

  return (
    <OverstayContext.Provider value={{ overstays, count: overstays.length }}>
      {children}
    </OverstayContext.Provider>
  );
}

export const useOverstay = () => useContext(OverstayContext);  