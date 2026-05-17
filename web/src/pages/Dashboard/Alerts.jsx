import { useState, useEffect } from 'react';
import { getAlerts, createAlert, deleteAlert, toggleAlert } from '../../services/api';
import styles from './Alerts.module.css';

export default function Alerts() {
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await getAlerts();
      setAlerts(res.data);
    } catch (e) { console.error(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this alert?')) return;
    await deleteAlert(id);
    load();
  };

  const handleToggle = async (id) => {
    await toggleAlert(id);
    load();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Price Alerts</h2>
          <p className={styles.subtitle}>Get notified when gold reaches your target price</p>
        </div>
        <button className={styles.newBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ New Alert'}
        </button>
      </div>

      {showForm && (
        <CreateAlertForm
          onCreated={() => { setShowForm(false); load(); }}
        />
      )}

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : alerts.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
          <div>No alerts yet. Create one to get notified on price moves.</div>
        </div>
      ) : (
        <div className={styles.list}>
          {alerts.map(a => (
            <AlertRow
              key={a.id}
              alert={a}
              onDelete={() => handleDelete(a.id)}
              onToggle={() => handleToggle(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert, onDelete, onToggle }) {
  const condColor = alert.condition === 'ABOVE' ? '#22c55e' : '#ef4444';
  const price = alert.market === 'IRAN'
    ? (Number(alert.targetPrice) / 1_000_000).toFixed(1) + 'M T'
    : '$' + Number(alert.targetPrice).toLocaleString('en');

  return (
    <div className={`${styles.row} ${alert.triggered ? styles.rowTriggered : ''}`}>
      <span className={styles.flag}>{alert.market === 'IRAN' ? '🇮🇷' : '🌍'}</span>

      <div className={styles.rowInfo}>
        <div className={styles.rowMain}>
          <span className={styles.cond} style={{ color: condColor }}>
            {alert.condition === 'ABOVE' ? '▲' : '▼'} {alert.condition}
          </span>
          <span className={styles.targetPrice}>{price}</span>
          {alert.triggered && <span className={styles.triggeredBadge}>Triggered</span>}
        </div>
        {alert.message && <div className={styles.msg}>{alert.message}</div>}
      </div>

      <div className={styles.rowActions}>
        <button
          className={`${styles.toggleBtn} ${alert.active && !alert.triggered ? styles.toggleOn : styles.toggleOff}`}
          onClick={onToggle}
          disabled={alert.triggered}
          title={alert.active ? 'Disable' : 'Enable'}
        >
          {alert.active && !alert.triggered ? 'ON' : 'OFF'}
        </button>
        <button className={styles.deleteBtn} onClick={onDelete}>✕</button>
      </div>
    </div>
  );
}

function CreateAlertForm({ onCreated }) {
  const [market, setMarket]       = useState('GLOBAL');
  const [condition, setCondition] = useState('ABOVE');
  const [price, setPrice]         = useState('');
  const [message, setMessage]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!price) { setError('Enter a target price'); return; }
    setLoading(true); setError('');
    try {
      await createAlert({ market, condition, targetPrice: price, message });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create alert');
    } finally { setLoading(false); }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formRow}>
        {/* Market */}
        <div className={styles.formGroup}>
          <label className={styles.lbl}>Market</label>
          <div className={styles.segmented}>
            {['GLOBAL', 'IRAN'].map(m => (
              <button key={m} type="button"
                className={`${styles.segBtn} ${market === m ? styles.segActive : ''}`}
                onClick={() => setMarket(m)}>
                {m === 'GLOBAL' ? '🌍 Global' : '🇮🇷 Iran'}
              </button>
            ))}
          </div>
        </div>

        {/* Condition */}
        <div className={styles.formGroup}>
          <label className={styles.lbl}>Condition</label>
          <div className={styles.segmented}>
            {['ABOVE', 'BELOW'].map(c => (
              <button key={c} type="button"
                className={`${styles.segBtn} ${condition === c ? styles.segActive : ''}`}
                style={condition === c ? { color: c === 'ABOVE' ? '#22c55e' : '#ef4444', borderColor: c === 'ABOVE' ? '#22c55e44' : '#ef444444' } : {}}
                onClick={() => setCondition(c)}>
                {c === 'ABOVE' ? '▲ Above' : '▼ Below'}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        <div className={styles.formGroup}>
          <label className={styles.lbl}>
            Target Price ({market === 'IRAN' ? 'Tomans' : 'USD'})
          </label>
          <input
            className={styles.inp}
            type="number"
            placeholder={market === 'IRAN' ? 'e.g. 85000000' : 'e.g. 3400'}
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
        </div>

        {/* Message */}
        <div className={styles.formGroup}>
          <label className={styles.lbl}>Note (optional)</label>
          <input
            className={styles.inp}
            type="text"
            placeholder="e.g. Buy signal level"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Creating…' : 'Create Alert'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
    </form>
  );
}
