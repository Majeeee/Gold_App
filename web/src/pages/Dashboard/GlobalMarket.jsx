import { useState, useEffect, useRef } from 'react';
import ws from '../../services/websocket';
import { getGlobalPrice, getSignal, getPriceHistory, getHistory, getOpenTrades } from '../../services/api';
import CandlestickChart from '../../components/CandlestickChart';
import TradeModal from '../../components/TradeModal';
import StopLossPanel from '../../components/StopLossPanel';
import styles from './Market.module.css';

const INTERVAL = { SHORT: 60, MID: 300, LONG: 3600 };
const HIST_TF = '5Y';

function toCandles(prices, intervalSec) {
  const buckets = new Map();
  const sorted = [...prices].sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
  sorted.forEach(p => {
    const price = parseFloat(p.globalPriceUsd);
    if (isNaN(price)) return;
    const ts = Math.floor(new Date(p.fetchedAt).getTime() / 1000);
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
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

const SIGNAL_COLORS = {
  STRONG_BUY: '#22c55e', BUY: '#22c55e',
  HOLD: '#EF9F27', SELL: '#ef4444', STRONG_SELL: '#ef4444',
};

function fmt(v, digits = 2) {
  const n = Number(v);
  if (isNaN(n)) return '---';
  return n.toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function GlobalMarket() {
  const [price, setPrice]           = useState(null);
  const [prevPrice, setPrevPrice]   = useState(null);
  const [signal, setSignal]         = useState(null);
  const [history, setHistory]       = useState([]);
  const [volumes, setVolumes]       = useState([]);
  const [timeframe, setTimeframe]   = useState('MID');
  const [tradeModal, setTradeModal] = useState(null);
  const [ohlcBar, setOhlcBar]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [openTrades, setOpenTrades] = useState([]);
  const [slTrade, setSlTrade]       = useState(null);

  const livePrice = useRef(null);

  useEffect(() => {
    loadData();

    const unsubPrice = ws.onGlobalPrice(d => {
      const p = parseFloat(d.price);
      livePrice.current = p;
      setPrice(prev => { setPrevPrice(prev); return p; });
      setOhlcBar(prev => prev ? { ...prev, close: p, high: Math.max(prev.high, p), low: Math.min(prev.low, p) } : null);
    });

    const unsubSignal = ws.onSignal('global', sig => {
      if (sig.timeframe === timeframe) setSignal(sig);
    });

    return () => { unsubPrice(); unsubSignal(); };
  }, [timeframe]); // eslint-disable-line

  const loadData = async () => {
    setHistory([]);
    setVolumes([]);
    setLoading(true);

    try {
      const priceRes = await getGlobalPrice();
      const p = priceRes.data?.globalPriceUsd;
      if (p) { livePrice.current = p; setPrice(p); }
    } catch (e) { console.error('price:', e.message); }

    try {
      const tradesRes = await getOpenTrades();
      setOpenTrades((tradesRes.data || []).filter(t => t.market === 'GLOBAL'));
    } catch { /* user may not be logged in yet */ }

    if (timeframe === HIST_TF) {
      try {
        const histRes = await getHistory('GLOBAL');
        setHistory(histRes.data.map(r => ({ time: r.date, open: r.open, high: r.high, low: r.low, close: r.close })));
        setVolumes(histRes.data.map(r => ({
          time:  r.date,
          value: r.volume || 0,
          color: r.close >= r.open ? '#22c55e33' : '#ef444433',
        })));
      } catch (e) { console.error('history:', e.message); }
      setLoading(false);
      return;
    }

    try {
      const sigRes = await getSignal('GLOBAL', timeframe);
      setSignal(sigRes.data);
    } catch (e) { /* signal may not exist yet */ }

    try {
      const histRes = await getPriceHistory('GLOBAL', 24);
      setHistory(toCandles(histRes.data ?? [], INTERVAL[timeframe]));
      setVolumes([]);
    } catch (e) { console.error('history:', e.message); }

    setLoading(false);

    // If no history yet (backend still seeding), retry after 4 seconds
    setTimeout(async () => {
      if (livePrice.current && timeframe !== HIST_TF) {
        try {
          const r = await getPriceHistory('GLOBAL', 24);
          if (r.data?.length) setHistory(toCandles(r.data, INTERVAL[timeframe]));
        } catch {}
      }
    }, 4000);
  };

  const isUp      = price && prevPrice ? price >= prevPrice : true;
  const changePct = price && prevPrice && prevPrice !== price
    ? Math.abs((price - prevPrice) / prevPrice * 100).toFixed(2)
    : null;
  const sigColor  = signal ? SIGNAL_COLORS[signal.signal] : '#888';
  const sellPrice = price ? (Number(price) - 0.7).toFixed(2) : null;
  const buyPrice  = price ? (Number(price) + 0.7).toFixed(2) : null;

  const bar = ohlcBar ?? (price ? { open: price, high: price, low: price, close: price } : null);

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.marketHeader}>
        <div className={styles.marketHeaderLeft}>
          <div className={styles.pairLabel}>
            🌍 XAUUSD &nbsp;·&nbsp; Binance &nbsp;·&nbsp;
            <span style={{ color: '#22c55e' }}>● Live</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span className={styles.price}>${price ? fmt(price) : '---'}</span>
            {changePct && (
              <span style={{ fontSize: 13, fontWeight: 600, color: isUp ? '#22c55e' : '#ef4444' }}>
                {isUp ? '▲' : '▼'} {isUp ? '+' : '-'}{changePct}%
              </span>
            )}
          </div>

          <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>O <span style={{ color: '#ccc' }}>{bar ? fmt(bar.open) : '---'}</span></span>
            <span>H <span style={{ color: '#22c55e' }}>{bar ? fmt(bar.high) : '---'}</span></span>
            <span>L <span style={{ color: '#ef4444' }}>{bar ? fmt(bar.low) : '---'}</span></span>
            <span>C <span style={{ color: '#ccc' }}>{bar ? fmt(bar.close) : '---'}</span></span>
            {bar && (() => {
              const chg = bar.close - bar.open;
              const pct = bar.open ? (chg / bar.open * 100).toFixed(2) : 0;
              const up  = chg >= 0;
              return (
                <span style={{ color: up ? '#22c55e' : '#ef4444' }}>
                  {up ? '+' : ''}{fmt(chg)} ({up ? '+' : ''}{pct}%)
                </span>
              );
            })()}
          </div>
        </div>

        <div className={styles.tfRow}>
          {['SHORT', 'MID', 'LONG', '5Y'].map(tf => (
            <button key={tf}
              className={`${styles.tfBtn} ${timeframe === tf ? styles.tfActive : ''}`}
              onClick={() => setTimeframe(tf)}>
              {tf === 'SHORT' ? '1m' : tf === 'MID' ? '5m' : tf === 'LONG' ? '1h' : '5Y'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading && (
        <div style={{ height: 2, background: 'linear-gradient(90deg,#b8860b,#22c55e,#b8860b)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      )}
      <CandlestickChart
        data={history}
        volumes={volumes}
        height={460}
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
          <IndCard label="RSI"       value={signal.rsi?.toFixed(1)}   vote={signal.rsiVote} />
          <IndCard label="MACD"      value={signal.macdVote > 0 ? 'Bull' : signal.macdVote < 0 ? 'Bear' : 'Neutral'} vote={signal.macdVote} />
          <IndCard label="Bollinger" value={signal.bollingerPosition}  vote={signal.bollingerVote} />
          <IndCard label="Trend"     value={signal.trendName}          vote={signal.trendVote} />
          <IndCard label="DXY"       value={signal.dxyVote > 0 ? 'High' : signal.dxyVote < 0 ? 'Low' : 'Neutral'} vote={signal.dxyVote} />
          <IndCard label="Fed Rate"  value={signal.fedRateVote > 0 ? 'High' : signal.fedRateVote < 0 ? 'Low' : 'Neutral'} vote={signal.fedRateVote} />
          <IndCard label="CPI"       value={signal.cpiVote > 0 ? 'High' : 'Neutral'} vote={signal.cpiVote} />
          <IndCard label="ETF Flows" value={signal.etfFlowsVote > 0 ? 'Inflow' : signal.etfFlowsVote < 0 ? 'Outflow' : 'Neutral'} vote={signal.etfFlowsVote} />
        </div>
      )}

      {/* Open Positions */}
      {openTrades.length > 0 && (
        <div className={styles.openPositions}>
          <div className={styles.openPosTitle}>Open Positions ({openTrades.length})</div>
          {openTrades.map(t => {
            const livePnl = price
              ? (t.type === 'BUY' ? (price - t.entryPrice) * t.quantity : (t.entryPrice - price) * t.quantity)
              : (t.pnl || 0);
            const isPos = livePnl >= 0;
            return (
              <div key={t.id} className={styles.posRow}>
                <span style={{ color: t.type === 'BUY' ? '#22c55e' : '#ef4444', fontWeight: 700, minWidth: 36 }}>{t.type}</span>
                <span style={{ color: 'var(--text2)', fontSize: 12 }}>${Number(t.entryPrice).toFixed(2)}</span>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>{t.quantity} oz</span>
                <span style={{ color: isPos ? '#22c55e' : '#ef4444', fontWeight: 600, marginLeft: 'auto' }}>
                  {isPos ? '+' : ''}${livePnl.toFixed(1)}
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
          price={tradeModal === 'BUY' ? Number(price) + 0.7 : Number(price) - 0.7}
          market="GLOBAL"
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
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{sellPrice ?? '---'}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>SELL</div>
        </button>
        <div className={styles.fixedSpread}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa' }}>1.4</div>
          <div style={{ fontSize: 9, color: '#666' }}>spread</div>
        </div>
        <button className={styles.fixedBuy} onClick={() => setTradeModal('BUY')}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{buyPrice ?? '---'}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>BUY</div>
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
