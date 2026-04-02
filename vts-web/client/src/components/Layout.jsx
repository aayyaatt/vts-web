import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOverstay } from '../context/OverstayContext';
import styles from './Layout.module.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const { overstays, count } = useOverstay();
  const navigate = useNavigate();

  const NAV_ITEMS = [
    { to: '/dashboard', icon: '⬛', label: 'Dashboard'  },
    { to: '/checkin',   icon: '✚',  label: 'Check-In'   },
    { to: '/cards',     icon: '🪪', label: 'Cards'      },
    { to: '/visitors',  icon: '👤', label: 'Visitors'   },
    { to: '/logs',      icon: '📋', label: 'Access Logs'},
    ...(user?.role === 'admin' ? [
      { to: '/users',       icon: '👥', label: 'Users'       },
      { to: '/departments', icon: '🏢', label: 'Departments' },
    ] : []),
  ];

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <div className={styles.root}>

      {/* Top Nav */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <span className={styles.navDot} />
          VTS
        </div>

        <div className={styles.navTabs}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navTab} ${isActive ? styles.navTabActive : ''}`
              }
            >
              <span>{item.icon}</span>
              {item.label}
              {/* Overstay badge on Dashboard tab */}
              {item.to === '/dashboard' && count > 0 && (
                <span style={{
                  background: 'var(--red)',
                  color: '#fff',
                  borderRadius: '100px',
                  fontSize: 10,
                  fontFamily: 'var(--mono)',
                  fontWeight: 700,
                  padding: '1px 6px',
                  marginLeft: 2,
                  boxShadow: '0 0 6px var(--red)',
                  animation: 'pulse 2s infinite',
                }}>
                  {count}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        <div className={styles.navRight}>
          <span className={styles.statusBadge}>🟢 Online</span>
          <div className={styles.navUser}>
            <div className={styles.avatar}>{initials}</div>
            <span>{user?.full_name}</span>
            <span className={styles.roleBadge}>{user?.role}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </nav>

      {/* Overstay Banner */}
      {count > 0 && (
        <div style={{
          background: 'rgba(248,81,73,.12)',
          borderBottom: '1px solid rgba(248,81,73,.3)',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>
              {count} overstay alert{count !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 13, color: 'var(--dim)', marginLeft: 8 }}>
              {overstays.map(v => v.visitor_name).join(', ')} {count === 1 ? 'has' : 'have'} exceeded the maximum visit duration.
            </span>
          </div>
          <NavLink to="/dashboard" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--red)', textDecoration: 'none', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, padding: '4px 12px' }}>
            View →
          </NavLink>
        </div>
      )}

      {/* Page content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}