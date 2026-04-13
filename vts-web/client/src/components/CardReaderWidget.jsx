import useCardReader from '../hooks/useCardReader';

export default function CardReaderWidget({ onCardRead, onClear }) {
const { cardData, status, error, readCard, clearCard } = useCardReader(onCardRead);
  function handleClear() {
    clearCard();
    if (onClear) onClear();
  }

  const configs = {
    disconnected: {
      border: 'rgba(139,148,158,.2)', bg: 'rgba(139,148,158,.04)',
      dotColor: 'var(--amber)', dot: '●', animate: false,
      label: 'Starting card reader…',
      sub:   'eRevealer.Gcc is launching — please wait',
    },
    connecting: {
      border: 'rgba(56,139,253,.2)', bg: 'rgba(56,139,253,.04)',
      dotColor: 'var(--amber)', dot: '●', animate: false,
      label: 'Connecting to card reader…',
      sub:   'ws://localhost:5060/SCardRead',
    },
    idle: {
      border: 'rgba(56,139,253,.3)', bg: 'rgba(56,139,253,.05)',
      dotColor: 'var(--green)', dot: '●', animate: false,
      label: '⏳ Waiting — Insert Visitor ID Card',
      sub:   'Insert Bahrain national ID into the card reader',
    },
    reading: {
      border: 'rgba(56,139,253,.5)', bg: 'rgba(56,139,253,.08)',
      dotColor: 'var(--blue)', dot: '◉', animate: true,
      label: 'Reading card…',
      sub:   'Please hold the card still',
    },
    done: {
      border: 'rgba(63,185,80,.4)', bg: 'rgba(63,185,80,.06)',
      dotColor: 'var(--green)', dot: '✓', animate: false,
      label: 'Card read successfully',
      sub:   cardData
        ? `CPR: ${cardData.cpr}${cardData.full_name ? '  ·  ' + cardData.full_name : ''}`
        : 'Fields filled automatically',
    },
    error: {
      border: 'rgba(248,81,73,.3)', bg: 'rgba(248,81,73,.06)',
      dotColor: 'var(--red)', dot: '✕', animate: false,
      label: error || 'Card read error',
      sub:   'Try again or enter details manually below',
    },
  };

  const cfg = configs[status] || configs.disconnected;

  return (
    <div style={{
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      borderRadius: 10,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      transition: 'all .3s',
      marginBottom: 20,
    }}>
      {/* Card icon with scan animation */}
      <div style={{
        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg,#1a2f5c,#0d1a3a)',
        border: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, position: 'relative', overflow: 'hidden',
      }}>
        🪪
        {cfg.animate && (
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg,transparent,var(--cyan),transparent)',
            animation: 'scanLine 1.2s linear infinite',
          }} />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{
            color: cfg.dotColor, fontSize: 11,
            animation: cfg.animate ? 'pulse 1s infinite' : 'none',
          }}>
            {cfg.dot}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {cfg.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>
          {cfg.sub}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
        {status === 'done' && (
          <button onClick={handleClear} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12,
            fontFamily: 'var(--sans)', cursor: 'pointer',
            background: 'rgba(240,160,52,.1)',
            border: '1px solid rgba(240,160,52,.3)',
            color: 'var(--amber)',
          }}>
            ✏ Edit manually
          </button>
        )}
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          padding: '3px 10px', borderRadius: 100,
          border: `1px solid ${cfg.border}`,
          color: cfg.dotColor, background: cfg.bg,
          textTransform: 'uppercase', letterSpacing: '.08em',
        }}>
          {status}
        </div>
      </div>

      <style>{`
        @keyframes scanLine { 0% { top: 0; } 100% { top: 100%; } }
      `}</style>
      <button onClick={readCard} style={{
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer'
}}>
   Scan Card
</button>
    </div>
    
  );
}