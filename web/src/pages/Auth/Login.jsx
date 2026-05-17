import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login as apiLogin } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import styles from './Auth.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await apiLogin({ email, password });
      login(res.data);
      nav(res.data.role === 'ROLE_ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>Au</div>
        <h1 className={styles.title}>Gold App</h1>
        <p className={styles.sub}>Smart Gold Trading</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <input id="email" name="email" className={styles.input} type="email"
            placeholder="Email" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <input id="password" name="password" className={styles.input} type="password"
            placeholder="Password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} required />
          <button className={styles.btnGold} type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className={styles.link}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
