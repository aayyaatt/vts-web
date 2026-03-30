import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const NAV_ITEMS = [
    { to: '/dashboard', icon: '⬛', label: 'Dashboard' },
    { to: '/checkin',   icon: '✚',  label: 'Check-In'  },
    { to: '/cards',     icon: '🪪', label: 'Cards'     },
    { to: '/logs',      icon: '📋', label: 'Access Logs'},
    ...(user?.role === 'admin' ? [
    { to: '/users', icon: '👥', label: 'Users' }] : []),
    { to: '/departments', icon: '🏢', label: 'Departments' },
  ];

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '??';

  return (
    <div className={styles.root}>
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

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}