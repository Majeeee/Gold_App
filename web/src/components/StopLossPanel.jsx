import { useState } from 'react';
import api from '../services/api';

export default function StopLossPanel({ trade, onUpdated, onClose }) {
  const isIran = trade.market === 'IRAN';
  const fmt    = v => v == null ? '' : String(v);

  const [sl, setSl] = useState(fmt(trade.stopLoss));
  const [tp, setTp] = useState(fmt(trade.takeProfit));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const save = async () => {
    setLoading(true); setError('');
    try {
      await api.put(`/stoploss/${trade.id}`, {
        stopLoss:   sl || null,
        takeProfit: tp || null,
      });
      onUpdated?.();
      onClose?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not save');
    } finally { setLoading(false); }
  };

  const calcAtr = async () => {
    setLoading(true); setError('');
    try {
      const histRes = await api.get(`/gold/prices/history?market=${trade.market}&hours=24`);
      const prices  = (histRes.data ?? []).map(p =>
        isIran ? parseFloat(p.iranPrice18k) : parseFloat(p.globalPriceUsd)
      ).filter(Boolean);

      if (prices.length < 2) { setError('Not enough history'); setLoading(false); return; }

      const res = await api.post('/stoploss/calculate', {
        prices,
        entryPrice: parseFloat(trade.entryPrice),
        isBuy: trade.type === 'BUY',
      });
      setSl(res.data.stopLoss.toFixed(isIran ? 0 : 2));
      setTp(res.data.takeProfit.toFixed(isIran ? 0 : 2));
    } catch (e) {
      setError('ATR calculation failed');
    } finally { setLoading(false); }
  };

  const unit = isIran ? 'T' : '$';

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#B8860B', margin: 0, fontSize: 16 }}>
            Stop Loss / Take Profit
          </h3>
          <button onClick={onClose} style={closeBtn}>x</button>
        </div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
          {trade.type} {trade.market} &nbsp;·&nbsp; Entry: {unit}{Number(trade.entryPrice).toLocaleString()}
        </div>

        <label style={lbl}>Stop Loss ({unit})</label>
        <input style={inp} type="number" placeholder="e.g. 3200"
          value={sl} onChange={e => setSl(e.target.value)} />

        <label style={{ ...lbl, marginTop: 12 }}>Take Profit ({unit})</label>
        <input style={inp} type="number" placeholder="e.g. 3600"
          value={tp} onChange={e => setTp(e.target.value)} />

        {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button style={atrBtn} onClick={calcAtr} disabled={loading}>
            Auto (ATR)
          </button>
          <button style={saveBtn} onClick={save} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
};
const panel = {
  background: '#1a1a2e', border: '1px solid #2a2a4e',
  borderRadius: 12, padding: 24, width: 320, maxWidth: '90vw',
};
const lbl  = { display: 'block', fontSize: 12, color: '#888', marginBottom: 4 };
const inp  = {
  width: '100%', background: '#0f0f1e', border: '1px solid #2a2a4e',
  borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 14,
  boxSizing: 'border-box',
};
const saveBtn = {
  flex: 2, background: '#B8860B', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 0', fontWeight: 600, cursor: 'pointer',
};
const atrBtn = {
  flex: 1, background: 'transparent', color: '#B8860B',
  border: '1px solid #B8860B', borderRadius: 8, padding: '10px 0',
  cursor: 'pointer', fontSize: 13,
};
const closeBtn = {
  background: 'transparent', border: 'none', color: '#888',
  fontSize: 18, cursor: 'pointer', lineHeight: 1,
};
