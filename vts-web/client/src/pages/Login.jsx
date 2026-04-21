import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import styles from './Login.module.css';

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [dbStatus, setDbStatus] = useState('checking'); // checking | ok | error

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user]);

  // Check DB health
  useEffect(() => {
    api.get('/health')
      .then(() => setDbStatus('ok'))
      .catch(() => setDbStatus('error'));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
      setPassword('');
    }
  }

  return (
    <div className={styles.page}>
      {/* Background grid */}
      <div className={styles.grid} />

      <div className={styles.card}>

        {/* Top bar */}
        <div className={styles.topBar}>
          <div className={`${styles.dbDot} ${styles[dbStatus]}`}>●</div>
          <span className={styles.dbLabel}>
            {/* //Database status
            {dbStatus === 'checking' && 'Connecting to database…'}
            {dbStatus === 'ok'       && 'Database connected'}
            {dbStatus === 'error'    && 'Database unreachable'} */}
          </span>
        </div>

        {/* Logo */}
        <div className={styles.logoRow}>
          <span className={styles.logoIcon}>⬛</span>
          <span className={styles.logoText}>VTS</span>
        </div>
        <p className={styles.subtitle}>Visitor Tracking System</p>

        <div className={styles.divider} />

        {/* Error */}
        {error && (
          <div className={styles.errorBar}>
            <span>✕</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>EMAIL</label>
            <input
              type="email"
              className={styles.input}
              placeholder="admin@vts.local"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>PASSWORD</label>
              <button
                type="button"
                className={styles.showBtn}
                onClick={() => setShowPw(p => !p)}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPw ? 'text' : 'password'}
              className={styles.input}
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || dbStatus === 'error'}
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              'Sign In  →'
            )}
          </button>
        </form>

        <p className={styles.footer}>VTS v5.0  ·  Internal Use Only</p>
      </div>
    </div>
  );
}
