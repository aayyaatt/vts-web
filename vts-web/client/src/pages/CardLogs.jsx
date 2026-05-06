import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

// ── PDF Export (Card Specific) ───────────────────────────────
async function exportCardLogsToPDF(filtered, dateFrom, dateTo) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(13, 26, 58);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('National Finance House — Card Activity Report', 14, 10);
  doc.setFontSize(10);
  doc.text('Detailed Card Tracking & Assignment History', 14, 17);

  doc.setTextColor(100, 110, 130);
  doc.setFontSize(9);
  const now = new Date().toLocaleString('en-GB');
  doc.text(`Exported: ${now}  ·  ${filtered.length} entries`, 14, 29);

  const rows = filtered.map(l => [
    new Date(l.created_at).toLocaleString('en-GB'),
    l.card_uid || '—',
    l.action.toUpperCase(),
    l.staff_name || '—',
    l.visitor_name || '—',
    l.notes || 'No notes provided'
  ]);

  doc.autoTable({
    head: [['Date & Time', 'Card ID', 'Action', 'Handled By', 'Visitor', 'Notes']],
    body: rows,
    startY: 33,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 58, 110], textColor: 255 },
    columnStyles: { 5: { cellWidth: 'auto' } }
  });

  doc.save(`Card_Activity_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Expandable Note Cell ─────────────────────────────────────
function NoteCell({ note }) {
  const [expanded, setExpanded] = useState(false);

  if (!note || note === '—') {
    return (
      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--dim)' }}>—</td>
    );
  }

  return (
    <td
      onClick={() => setExpanded(p => !p)}
      title={expanded ? 'Click to collapse' : 'Click to read full note'}
      style={{
        padding: '12px 16px',
        fontSize: 12,
        color: expanded ? 'var(--text)' : 'var(--dim)',
        maxWidth: 220,
        cursor: 'pointer',
        whiteSpace: expanded ? 'normal' : 'nowrap',
        overflow: expanded ? 'visible' : 'hidden',
        textOverflow: expanded ? 'unset' : 'ellipsis',
        wordBreak: expanded ? 'break-word' : 'normal',
        transition: 'color .15s',
        userSelect: 'none',
        verticalAlign: 'top',
      }}
    >
      <span style={{ marginRight: 4, fontSize: 10, opacity: 0.5 }}>
        {expanded ? '▲' : '▼'}
      </span>
      {note}
    </td>
  );
}

// ── Badge helper ─────────────────────────────────────────────
function ActionBadge({ action }) {
  const map = {
    CHECKIN:        'badge-green',
    CHECKOUT:       'badge-blue',
    NOTE_ADDED:     'badge-blue',
    NOTE_CLEARED:   'badge-gray',
    STATUS_CHANGED: 'badge-purple',
    skipped:        'badge-amber',
    CARD_SKIP_FAST: 'badge-amber',
  };
  const cls = map[action] || 'badge-blue';
  const label = action.replace(/_/g, ' ');
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ── Component ────────────────────────────────────────────────
export default function CardLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/cards/logs').then(r => {
      setLogs(r.data);
      setFiltered(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = [...logs];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        (l.card_uid    || '').toLowerCase().includes(q) ||
        (l.staff_name  || '').toLowerCase().includes(q) ||
        (l.visitor_name|| '').toLowerCase().includes(q) ||
        (l.notes       || '').toLowerCase().includes(q)
      );
    }
    if (dateFrom) result = result.filter(l => new Date(l.created_at) >= new Date(dateFrom));
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
      result = result.filter(l => new Date(l.created_at) <= end);
    }
    setFiltered(result);
  }, [logs, search, dateFrom, dateTo]);

  const inputStyle = {
    background: 'var(--panel2)',
    border: '1px solid var(--border2)',
    borderRadius: 7,
    padding: '7px 12px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
  };

  return (
    <div style={{ padding: 24 }} className="fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Card Activity Logs</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
            Track card assignments, skips, notes, and floor-access history
          </p>
        </div>
        <button
          onClick={async () => {
            setExporting(true);
            await exportCardLogsToPDF(filtered, dateFrom, dateTo);
            setExporting(false);
          }}
          disabled={exporting || filtered.length === 0}
          style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            background: 'rgba(56,139,253,.12)', border: '1px solid rgba(56,139,253,.3)',
            color: 'var(--blue)', fontWeight: 600,
            opacity: (exporting || filtered.length === 0) ? 0.5 : 1,
          }}
        >
          {exporting ? 'Exporting...' : '📄 Export Report'}
        </button>
      </div>

      {/* Filters */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 16, marginBottom: 16,
        display: 'flex', gap: 12, flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search Card UID, Visitor, Staff or Note..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
        <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={inputStyle} />
        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
            style={{ ...inputStyle, cursor: 'pointer', color: 'var(--dim)', background: 'transparent' }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 10 }}>
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          {(search || dateFrom || dateTo) ? ' matched' : ' total'}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,.02)' }}>
              {['Time', 'Card UID', 'Action', 'Handled By', 'Visitor', 'Floor Access', 'Notes'].map(h => (
                <th key={h} style={{
                  fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--dim)',
                  textAlign: 'left', padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--dim)' }}>
                  Loading logs...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--dim)' }}>
                  No card activity found.
                </td>
              </tr>
            ) : filtered.map((l, i) => (
              <tr
                key={l.log_id ?? i}
                style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}
              >
                {/* Time */}
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--dim)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                  {new Date(l.created_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </td>

                {/* Card UID */}
                <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                  {l.card_uid || '—'}
                </td>

                {/* Action badge */}
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <ActionBadge action={l.action} />
                </td>

                {/* Handled by */}
                <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {l.staff_name || '—'}
                </td>

                {/* Visitor */}
                <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {l.visitor_name || '—'}
                </td>

                {/* Floor Access */}
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                  {l.accessible_floors || 'General'}
                </td>

                {/* Notes — expandable */}
                <NoteCell note={l.notes} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}