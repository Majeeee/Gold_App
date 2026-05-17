import { useState } from 'react';
import { addPaperTrade, addManualTrade } from '../services/api';
import styles from './TradeModal.module.css';

export default function TradeModal({ type, price, market, timeframe, onClose, onDone }) {
  const [qty, setQty]         = useState('0.1');
  const [sl, setSl]           = useState('');
  const [tp, setTp]           = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const isBuy  = type === 'BUY';
  const color  = isBuy ? '#22c55e' : '#ef4444';
  const total  = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  const submit = async (isPaper) => {
    const qtyNum = parseFloat(qty);
    if (!qty || isNaN(qtyNum) || qtyNum < 0.001) {
      setError('Enter a valid quantity (min 0.001)'); return;
    }
    setLoading(true); setError('');
    try {
      const body = {
        market,
        type,
        status: 'OPEN',
        timeframe,
        entryPrice: String(price),
        quantity:   qty,
        stopLoss:   sl  || null,
        takeProfit: tp  || null,
        exitPrice:  null,
      };
      await (isPaper ? addPaperTrade(body) : addManualTrade(body));
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to place trade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header} style={{ borderColor: color + '44' }}>
          <span className={styles.typeLabel} style={{ color }}>{type}</span>
          <span className={styles.pair}>{market === 'IRAN' ? 'طلا ۱۸ عیار' : 'XAUUSD'}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.priceRow}>
          <span className={styles.priceLabel}>Entry price</span>
          <span className={styles.priceVal} style={{ color }}>
            {market === 'IRAN'
              ? (Number(price) / 1_000_000).toFixed(2) + 'M ت'
              : '$' + Number(price).toLocaleString('en', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className={styles.fields}>
          <label className={styles.fieldLabel}>Quantity (oz)</label>
          <input className={styles.input} type="number" min="0.01" step="0.01"
            value={qty} onChange={e => setQty(e.target.value)} />

          <label className={styles.fieldLabel}>Stop Loss <span className={styles.opt}>(optional)</span></label>
          <input className={styles.input} type="number"
            placeholder={isBuy ? (price * 0.98).toFixed(0) : (price * 1.02).toFixed(0)}
            value={sl} onChange={e => setSl(e.target.value)} />

          <label className={styles.fieldLabel}>Take Profit <span className={styles.opt}>(optional)</span></label>
          <input className={styles.input} type="number"
            placeholder={isBuy ? (price * 1.03).toFixed(0) : (price * 0.97).toFixed(0)}
            value={tp} onChange={e => setTp(e.target.value)} />
        </div>

        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Total exposure</span>
          <span className={styles.totalVal}>
            ${total.toLocaleString('en', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.paperBtn} onClick={() => submit(true)} disabled={loading}>
            📋 Paper Trade
          </button>
          <button className={styles.realBtn} style={{ background: color }} onClick={() => submit(false)} disabled={loading}>
            {loading ? '...' : `${type} Real`}
          </button>
        </div>
      </div>
    </div>
  );
}
