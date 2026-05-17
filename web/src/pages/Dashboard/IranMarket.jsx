import { useState, useEffect } from 'react';
import ws from '../../services/websocket';
import { getIranPrice, getSignal, getPriceHistory, getHistory, getOpenTrades } from '../../services/api';
import CandlestickChart from '../../components/CandlestickChart';
import TradeModal from '../../components/TradeModal';
import StopLossPanel from '../../components/StopLossPanel';
import styles from './Market.module.css';

const INTERVAL = { SHORT: 60, MID: 300, LONG: 3600 };
const HIST_TF = '5Y';

function utcMs(s) {
  if (!s) return NaN;
  return new Date(String(s).endsWith('Z') ? s : s + 'Z').getTime();
}

function toCandles(prices, field, intervalSec) {
  const buckets = new Map();
  const sorted = [...prices].sort((a, b) => utcMs(a.fetchedAt) - utcMs(b.fetchedAt));
  sorted.forEach(p => {
    const price = parseFloat(p[field]);
    if (isNaN(price)) return;
    const ms = utcMs(p.fetchedAt);
    if (!isFinite(ms)) return;
    const ts = Math.floor(ms / 1000);
    const t  = Math.floor(ts / intervalSec) * intervalSec;
    if (!buckets.has(t)) {
      buckets.set(t, { time: t, open: price, high: price, low: price, close: price });
    } else {
      const c = buckets.get(t);
      c.high  = Math.max(c.high, price);
      c.low   = Math.min(c.low,  price);
      c.close = price;
    }
  });
  return Array.from(buckets.values())
    .filter(c => isFinite(c.time) && c.time > 0)
    .sort((a, b) => a.time - b.time);
}

const SIGNAL_COLORS = {
  STRONG_BUY: '#22c55e', BUY: '#22c55e',
  HOLD: '#EF9F27', SELL: '#ef4444', STRONG_SELL: '#ef4444',
};

const FIELDS = [
  { key: 'iranPrice18k',     label: '۱۸ عیار',    fmt: v => v ? (Number(v)/1_000_000).toFixed(2)+'M' : '---' },
  { key: 'iranPrice24k',     label: '۲۴ عیار',    fmt: v => v ? (Number(v)/1_000_000).toFixed(2)+'M' : '---' },
  { key: 'iranPriceMithqal', label: 'مثقال',      fmt: v => v ? (Number(v)/1_000_000).toFixed(1)+'M' : '---' },
  { key: 'iranCoinEmami',    label: 'سکه امامی',  fmt: v => v ? (Number(v)/1_000_000).toFixed(0)+'M' : '---' },
  { key: 'usdIrr',           label: 'دلار',       fmt: v => v ? Number(v).toLocaleString('en')+' ت' : '---' },
];

function fmtOhlc(v, key) {
  if (v == null) return '---';
  if (key === 'usdIrr') return Number(v).toLocaleString('en');
  return (Number(v) / 1_000_000).toFixed(2) + 'M';
}

export default function IranMarket() {
  const [price, setPrice]           = useState(null);
  const [extras, setExtras]         = useState({});
  const [signal, setSignal]         = useState(null);
  const [rawHistory, setRawHistory] = useState([]);
  const [ohlcHistory, setOhlcHistory] = useState([]);
  const [timeframe, setTimeframe]   = useState('MID');
  const [tradeModal, setTradeModal] = useState(null);
  const [chartField, setChartField] = useState('iranPrice18k');
  const [ohlcBar, setOhlcBar]       = useState(null);
  const [openTrades, setOpenTrades] = useState([]);
  const [slTrade, setSlTrade]       = useState(null);

  const history = timeframe === HIST_TF
    ? ohlcHistory
    : toCandles(rawHistory, chartField, INTERVAL[timeframe]);

  useEffect(() => {
    loadData();

    const unsubPrice  = ws.onIranPrice(d => {
      setPrice(parseFloat(d.price));
      setExtras({ iranPrice18k: d.price, iranPrice24k: d.price24k, iranPriceMithqal: d.mithqal, iranCoinEmami: d.sekke, usdIrr: d.dollar });
    });
    const unsubSignal = ws.onSignal('iran', sig => {
      if (sig.timeframe === timeframe) setSignal(sig);
    });

    return () => { unsubPrice(); unsubSignal(); };
  }, [timeframe]); // eslint-disable-line

  const loadData = async () => {
    setExtras({});
    setRawHistory([]);
    setOhlcHistory([]);

    try {
      const priceRes = await getIranPrice();
      const d = priceRes.data;
      setPrice(d?.iranPrice18k);
      setExtras({ iranPrice18k: d?.iranPrice18k, iranPrice24k: d?.iranPrice24k, iranPriceMithqal: d?.iranPriceMithqal, iranCoinEmami: d?.iranCoinEmami, usdIrr: d?.usdIrr });
    } catch (e) { console.error('iran price:', e.message); }

    try {
      const tradesRes = await getOpenTrades();
      setOpenTrades((tradesRes.data || []).filter(t => t.market === 'IRAN'));
    } catch { /* user may not be logged in yet */ }

    if (timeframe === HIST_TF) {
      try {
        const histRes = await getHistory('IRAN');
        setOhlcHistory(histRes.data.map(r => ({ time: r.date, open: r.open, high: r.high, low: r.low, close: r.close })));
      } catch (e) { console.error('iran history:', e.message); }
      return;
    }

    try {
      const sigRes = await getSignal('IRAN', timeframe);
      setSignal(sigRes.data);
    } catch (e) { console.error('iran signal:', e.message); }

    try {
      const histRes = await getPriceHistory('IRAN', 24);
      setRawHistory(histRes.data ?? []);
    } catch (e) { console.error('iran history:', e.message); }

    // If no history yet (backend still seeding), retry after 4 seconds
    setTimeout(async () => {
      try {
        const r = await getPriceHistory('IRAN', 24);
        if (r.data?.length) setRawHistory(r.data);
      } catch {}
    }, 4000);
  };

  const activeField  = FIELDS.find(f => f.key === chartField);
  const sigColor     = signal ? SIGNAL_COLORS[signal.signal] : '#888';
  const bar          = ohlcBar;
  const currentVal   = extras[chartField] ?? price;
  const sellVal      = currentVal ? ((Number(currentVal) - 100000) / 1_000_000).toFixed(2) + 'M' : null;
  const buyVal       = currentVal ? ((Number(currentVal) + 100000) / 1_000_000).toFixed(2) + 'M' : null;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.marketHeader}>
        <div className={styles.marketHeaderLeft}>
          <div className={styles.pairLabel}>
            🇮🇷 {activeField?.label} &nbsp;·&nbsp; TGJU &nbsp;·&nbsp; هر ۳۰ ثانیه
          </div>

          <div style={{ marginTop: 6 }}>
            <span className={styles.price}>{activeField?.fmt(currentVal)} تومان</span>
          </div>

          {bar && (
            <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', marginTop: 5, display: 'flex', gap: 10 }}>
              <span>O <span style={{ color: '#ccc' }}>{fmtOhlc(bar.open, chartField)}</span></span>
              <span>H <span style={{ color: '#22c55e' }}>{fmtOhlc(bar.high, chartField)}</span></span>
              <span>L <span style={{ color: '#ef4444' }}>{fmtOhlc(bar.low, chartField)}</span></span>
              <span>C <span style={{ color: '#ccc' }}>{fmtOhlc(bar.close, chartField)}</span></span>
              {(() => {
                const chg = bar.close - bar.open;
                const pct = bar.open ? (chg / bar.open * 100).toFixed(2) : 0;
                const up  = chg >= 0;
                return (
                  <span style={{ color: up ? '#22c55e' : '#ef4444' }}>
                    {up ? '+' : ''}{fmtOhlc(chg, chartField)} ({up ? '+' : ''}{pct}%)
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        {/* Timeframe buttons */}
        <div className={styles.tfRow}>
          {['SHORT', 'MID', 'LONG', '5Y'].map(tf => (
            <button key={tf}
              className={`${styles.tfBtn} ${timeframe === tf ? styles.tfActive : ''}`}
              onClick={() => setTimeframe(tf)}>
              {tf === 'SHORT' ? 'کوتاه' : tf === 'MID' ? 'میان' : tf === 'LONG' ? 'بلند' : '5Y'}
            </button>
          ))}
        </div>
      </div>

      {/* Price field cards */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 20px',
        background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
      }}>
        {FIELDS.map(f => {
          const active = chartField === f.key;
          return (
            <button key={f.key} onClick={() => setChartField(f.key)} style={{
              flex: '0 0 auto',
              background: active ? 'rgba(45,31,0,0.9)' : 'rgba(26,18,0,0.6)',
              border: `1px solid ${active ? '#f59e0b' : '#451a0388'}`,
              borderRadius: 8, padding: '7px 12px', textAlign: 'right',
              cursor: 'pointer', transition: 'all .15s', minWidth: 90,
            }}>
              <div style={{ fontSize: 9, color: active ? '#f59e0b' : '#888', marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#fbbf24' : '#d97706' }}>
                {f.fmt(extras[f.key])}
              </div>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <CandlestickChart
        data={history}
        height={420}
        onOhlcChange={setOhlcBar}
      />

      {/* Signal */}
      {signal && (
        <div className={styles.signalBox} style={{ borderColor: sigColor + '44', background: sigColor + '11' }}>
          <div className={styles.signalLeft}>
            <span className={styles.signalLabel} style={{ color: sigColor }}>{signal.signal?.replace('_', ' ')}</span>
            <span className={styles.signalReason}>{signal.reason}</span>
          </div>
          <span className={styles.signalScore} style={{ color: sigColor }}>
            {signal.score > 0 ? '+' : ''}{signal.score}/10
          </span>
        </div>
      )}

      {/* Indicators */}
      {signal && (
        <div className={styles.indGrid}>
          <IndCard label="RSI"       value={signal.rsi?.toFixed(1)} vote={signal.rsiVote} />
          <IndCard label="MACD"      value={signal.macdVote > 0 ? '↑' : signal.macdVote < 0 ? '↓' : '→'} vote={signal.macdVote} />
          <IndCard label="Trend"     value={signal.trendName} vote={signal.trendVote} />
          <IndCard label="حباب سکه" value={signal.coinBubbleVote > 0 ? 'بالا' : 'عادی'} vote={signal.coinBubbleVote} />
        </div>
      )}

      {/* Open Positions */}
      {openTrades.length > 0 && (
        <div className={styles.openPositions}>
          <div className={styles.openPosTitle}>پوزیشن‌های باز ({openTrades.length})</div>
          {openTrades.map(t => {
            const livePnl = price
              ? (t.type === 'BUY' ? (price - t.entryPrice) * t.quantity : (t.entryPrice - price) * t.quantity)
              : (t.pnl || 0);
            const isPos = livePnl >= 0;
            const pnlFmt = (livePnl / 1_000_000).toFixed(2) + 'M';
            const entryFmt = (Number(t.entryPrice) / 1_000_000).toFixed(2) + 'M';
            return (
              <div key={t.id} className={styles.posRow}>
                <span style={{ color: t.type === 'BUY' ? '#22c55e' : '#ef4444', fontWeight: 700, minWidth: 42 }}>
                  {t.type === 'BUY' ? 'خرید' : 'فروش'}
                </span>
                <span style={{ color: 'var(--text2)', fontSize: 12 }}>{entryFmt}</span>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>{t.quantity} گرم</span>
                <span style={{ color: isPos ? '#22c55e' : '#ef4444', fontWeight: 600, marginLeft: 'auto' }}>
                  {isPos ? '+' : ''}{pnlFmt}
                </span>
                <button className={`${styles.slBtn} ${(t.stopLoss || t.takeProfit) ? styles.slBtnActive : ''}`}
                  onClick={() => setSlTrade(t)}>SL/TP</button>
              </div>
            );
          })}
        </div>
      )}

      {tradeModal && (
        <TradeModal
          type={tradeModal}
          price={tradeModal === 'BUY' ? Number(price) + 100000 : Number(price) - 100000}
          market="IRAN"
          timeframe={timeframe}
          onClose={() => setTradeModal(null)}
          onDone={() => setTradeModal(null)}
        />
      )}

      {slTrade && (
        <StopLossPanel
          trade={slTrade}
          onUpdated={() => { loadData(); setSlTrade(null); }}
          onClose={() => setSlTrade(null)}
        />
      )}

      {/* Fixed SELL / BUY bar */}
      <div className={styles.fixedTradeBar}>
        <button className={styles.fixedSell} onClick={() => setTradeModal('SELL')}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{sellVal ?? '---'}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>فروش</div>
        </button>
        <div className={styles.fixedSpread}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa' }}>۱۰۰K</div>
          <div style={{ fontSize: 9, color: '#666' }}>اختلاف</div>
        </div>
        <button className={styles.fixedBuy} onClick={() => setTradeModal('BUY')} style={{ background: '#b8860b' }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{buyVal ?? '---'}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>خرید</div>
        </button>
      </div>
    </div>
  );
}

function IndCard({ label, value, vote }) {
  const color = vote > 0 ? '#22c55e' : vote < 0 ? '#ef4444' : '#888';
  return (
    <div className={styles.indCard} style={{ borderColor: color + '33' }}>
      <span className={styles.indLabel}>{label}</span>
      <span className={styles.indValue} style={{ color }}>{value}</span>
    </div>
  );
}
