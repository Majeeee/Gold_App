import { useState, useEffect } from 'react';
import ws from '../../services/websocket';
import { getTrades, closeTrade, deleteTrade } from '../../services/api';
import StopLossPanel from '../../components/StopLossPanel';
import styles from './Portfolio.module.css';

function calcLivePnl(trade, globalPrice, iranPrice) {
  if (trade.status !== 'OPEN') {
    return { pnl: trade.pnl || 0, pnlPct: trade.pnlPercent || 0, live: false };
  }
  const current = trade.market === 'IRAN' ? iranPrice : globalPrice;
  if (!current) return { pnl: trade.pnl || 0, pnlPct: trade.pnlPercent || 0, live: false };
  const entry = parseFloat(trade.entryPrice);
  const qty   = parseFloat(trade.quantity);
  const diff  = trade.type === 'BUY' ? (current - entry) : (entry - current);
  return { pnl: diff * qty, pnlPct: (diff / entry) * 100, live: true };
}

function fmtPrice(value, market) {
  if (value == null) return '—';
  return market === 'IRAN'
    ? (Number(value) / 1_000_000).toFixed(2) + 'M'
    : '$' + Number(value).toFixed(2);
}

function fmtPnl(pnl, market) {
  return market === 'IRAN'
    ? (pnl / 1_000_000).toFixed(2) + 'M'
    : '$' + pnl.toFixed(1);
}

export default function Portfolio() {
  const [trades, setTrades]           = useState([]);
  const [filter, setFilter]           = useState('ALL');
  const [globalPrice, setGlobalPrice] = useState(null);
  const [iranPrice, setIranPrice]     = useState(null);
  const [slTrade, setSlTrade]         = useState(null);

  useEffect(() => {
    load();
    ws.onGlobalPrice(d => setGlobalPrice(parseFloat(d.price)));
    ws.onIranPrice(d   => setIranPrice(parseFloat(d.price)));
    ws.subscribe('/topic/trade-closed', () => load());
  }, []);

  const load = async () => {
    try { const res = await getTrades(); setTrades(res.data); }
    catch (e) { console.log(e.message); }
  };

  const handleClose = async (trade) => {
    const price = trade.market === 'IRAN' ? iranPrice : globalPrice;
    if (!price) return;
    await closeTrade(trade.id, String(price));
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this trade?')) return;
    await deleteTrade(id);
    load();
  };

  const filtered = trades.filter(t => {
    if (filter === 'ALL')    return true;
    if (filter === 'OPEN')   return t.status === 'OPEN';
    if (filter === 'CLOSED') return t.status === 'CLOSED';
    if (filter === 'PAPER')  return t.tradeType === 'PAPER';
    return true;
  });

  const globalPnl = filtered
    .filter(t => t.market !== 'IRAN')
    .reduce((s, t) => s + calcLivePnl(t, globalPrice, iranPrice).pnl, 0);

  // Bug fix: was missing Iran P&L entirely
  const iranPnl = filtered
    .filter(t => t.market === 'IRAN')
    .reduce((s, t) => s + calcLivePnl(t, globalPrice, iranPrice).pnl, 0);

  const openCount = filtered.filter(t => t.status === 'OPEN').length;
  const wins      = filtered.filter(t => calcLivePnl(t, globalPrice, iranPrice).pnl > 0).length;
  const winRate   = filtered.length ? (wins / filtered.length * 100).toFixed(0) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Portfolio</h2>
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Global P&L</span>
            <span className={styles.summaryValue} style={{ color: globalPnl >= 0 ? '#22c55e' : '#ef4444' }}>
              {globalPnl >= 0 ? '+' : ''}${globalPnl.toFixed(1)}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Iran P&L</span>
            <span className={styles.summaryValue} style={{ color: iranPnl >= 0 ? '#22c55e' : '#ef4444' }}>
              {iranPnl >= 0 ? '+' : ''}{(iranPnl / 1_000_000).toFixed(2)}M
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Win Rate</span>
            <span className={styles.summaryValue} style={{ color: '#B8860B' }}>{winRate}%</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Open</span>
            <span className={styles.summaryValue} style={{ color: openCount > 0 ? '#EF9F27' : 'var(--text)' }}>
              {openCount}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Trades</span>
            <span className={styles.summaryValue}>{filtered.length}</span>
          </div>
        </div>
      </div>

      <div className={styles.filters}>
        {['ALL', 'OPEN', 'CLOSED', 'PAPER'].map(f => (
          <button key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Type</th><th>Market</th><th>TF</th><th>Entry</th>
            <th>Exit / Live</th><th>SL / TP</th><th>Qty</th><th>P&L</th>
            <th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(t => {
            const { pnl, pnlPct, live } = calcLivePnl(t, globalPrice, iranPrice);
            const currentPrice = t.market === 'IRAN' ? iranPrice : globalPrice;
            const exitDisplay  = t.status === 'OPEN'
              ? fmtPrice(currentPrice, t.market)
              : fmtPrice(t.exitPrice, t.market);
            return (
              <tr key={t.id}>
                <td>
                  <span style={{ color: t.type === 'BUY' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{t.type}</span>
                  {t.tradeType === 'PAPER' && <span className={styles.paper}>PAPER</span>}
                </td>
                <td>{t.market}</td>
                <td><span className={styles.tf} data-tf={t.timeframe}>
                  {t.timeframe === 'SHORT' ? 'Short' : t.timeframe === 'MID' ? 'Mid' : 'Long'}
                </span></td>
                <td>{fmtPrice(t.entryPrice, t.market)}</td>
                <td>
                  {exitDisplay}
                  {live && <span className={styles.liveDot}>●</span>}
                </td>
                <td>
                  <button className={styles.slBtn} onClick={() => setSlTrade(t)}>
                    {t.stopLoss ? fmtPrice(t.stopLoss, t.market) : '—'}
                    {' / '}
                    {t.takeProfit ? fmtPrice(t.takeProfit, t.market) : '—'}
                  </button>
                </td>
                <td>{t.quantity} oz</td>
                <td style={{ color: pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {pnl >= 0 ? '+' : ''}{fmtPnl(pnl, t.market)}
                  {' '}({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                </td>
                <td><span style={{ color: t.status === 'OPEN' ? '#EF9F27' : '#666' }}>{t.status}</span></td>
                <td>
                  {t.status === 'OPEN' && (
                    <button className={styles.closeBtn} onClick={() => handleClose(t)}>Close</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <p className={styles.empty}>No trades found</p>}

      {slTrade && (
        <StopLossPanel
          trade={slTrade}
          onUpdated={load}
          onClose={() => setSlTrade(null)}
        />
      )}
    </div>
  );
}
