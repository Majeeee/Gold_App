import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../../services/api';
import styles from './Auth.module.css';

export default function Register() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', country: 'IR' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form);
      setSuccess('Registration successful! Waiting for admin approval.');
      setTimeout(() => nav('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>Au</div>
        <h1 className={styles.title}>Create Account</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <div className={styles.row}>
            <input className={styles.input} placeholder="First Name *"
              value={form.firstName} onChange={e => update('firstName', e.target.value)} required />
            <input className={styles.input} placeholder="Last Name"
              value={form.lastName} onChange={e => update('lastName', e.target.value)} />
          </div>

          <input className={styles.input} type="email" placeholder="Email *"
            value={form.email} onChange={e => update('email', e.target.value)} required />
          <input className={styles.input} type="password" placeholder="Password * (min 6)"
            value={form.password} onChange={e => update('password', e.target.value)} required />

          <div className={styles.countryRow}>
            {[['IR', '🇮🇷 Iran'], ['SE', '🇸🇪 Sweden']].map(([c, l]) => (
              <button key={c} type="button"
                className={`${styles.countryBtn} ${form.country === c ? styles.countryActive : ''}`}
                onClick={() => update('country', c)}>{l}</button>
            ))}
          </div>

          <button className={styles.btnGold} type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className={styles.link}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
