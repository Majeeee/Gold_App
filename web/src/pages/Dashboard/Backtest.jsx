import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { runBacktest } from '../../services/api';
import styles from './Backtest.module.css';

const PERIODS = [
  { label: '1 Week', months: 0.25 },
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
];

export default function Backtest() {
  const [market, setMarket] = useState('GLOBAL');
  const [timeframe, setTimeframe] = useState('MID');
  const [capital, setCapital] = useState(1000);
  const [periodIdx, setPeriodIdx] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await runBacktest(market, PERIODS[periodIdx].months, capital, timeframe);
      setResult(res.data);
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); }
  };

  const isProfit = result && result.totalPnl >= 0;
  const chartData = result?.capitalHistory?.map((v, i) => ({ i, value: v })) || [];

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Backtesting Simulator</h2>

      <div className={styles.controls}>
        {/* Market */}
        <div className={styles.controlGroup}>
          <label className={styles.label}>Market</label>
          <div className={styles.btnGroup}>
            {['GLOBAL', 'IRAN'].map(m => (
              <button key={m}
                className={`${styles.optBtn} ${market === m ? styles.optActive : ''}`}
                onClick={() => setMarket(m)}>
                {m === 'GLOBAL' ? '🌍 Global' : '🇮🇷 Iran'}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy */}
        <div className={styles.controlGroup}>
          <label className={styles.label}>{market === 'IRAN' ? 'استراتژی' : 'Strategy'}</label>
          <div className={styles.btnGroup}>
            {['SHORT', 'MID', 'LONG'].map(tf => (
              <button key={tf}
                className={`${styles.optBtn} ${timeframe === tf ? styles.optActive : ''}`}
                onClick={() => setTimeframe(tf)}
                data-tooltip={
                  market === 'IRAN'
                    ? tf === 'SHORT' ? 'کوتاه‌مدت\nسیگنال ۱ تا ۴ ساعته'
                    : tf === 'MID'   ? 'میان‌مدت\nسیگنال ۱ تا ۷ روزه'
                    :                  'بلندمدت\nسیگنال هفتگی'
                    : tf === 'SHORT' ? 'Short-term\n1–4 hour signals'
                    : tf === 'MID'   ? 'Mid-term\n1–7 day signals'
                    :                  'Long-term\n1–4 week signals'
                }>
                {market === 'IRAN'
                  ? tf === 'SHORT' ? 'کوتاه' : tf === 'MID' ? 'میان' : 'بلند'
                  : tf === 'SHORT' ? 'Short' : tf === 'MID' ? 'Mid'   : 'Long'}
              </button>
            ))}
          </div>
        </div>

        {/* Capital */}
        <div className={styles.controlGroup}>
          <label className={styles.label}>Capital: ${Number(capital).toLocaleString()}</label>
          <input type="range" min={100} max={100000} step={100}
            value={capital} onChange={e => setCapital(Number(e.target.value))}
            className={styles.slider} />
        </div>

        {/* Period */}
        <div className={styles.controlGroup}>
          <label className={styles.label}>Period: {PERIODS[periodIdx].label}</label>
          <input type="range" min={0} max={4} step={1}
            value={periodIdx} onChange={e => setPeriodIdx(Number(e.target.value))}
            className={styles.slider} />
        </div>

        <button className={styles.runBtn} onClick={run} disabled={loading}>
          {loading ? 'Simulating...' : '▶ Run Simulation'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={`${styles.result} ${isProfit ? styles.resultPos : styles.resultNeg}`}>
          <div className={styles.resultHeader}>
            <div>
              <div className={styles.finalCapital} style={{ color: isProfit ? '#22c55e' : '#ef4444' }}>
                ${result.finalCapital?.toFixed(0)}
              </div>
              <div style={{ color: isProfit ? '#22c55e' : '#ef4444', fontSize: 14, marginBottom: 4 }}>
                {isProfit ? '+' : ''}${result.totalPnl?.toFixed(0)} ({isProfit ? '+' : ''}{result.totalPnlPercent?.toFixed(1)}%)
              </div>
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>
                {PERIODS[periodIdx].label} · {result.totalTrades} trades · {result.winRate?.toFixed(0)}% win rate
              </div>
            </div>
            <div className={styles.statsGrid}>
              <StatItem label="Initial" value={`$${capital}`} />
              <StatItem label="Final" value={`$${result.finalCapital?.toFixed(0)}`} color={isProfit ? '#22c55e' : '#ef4444'} />
              <StatItem label="Best Trade" value={`+${result.bestTrade?.toFixed(1)}%`} color="#22c55e" />
              <StatItem label="Worst Trade" value={`${result.worstTrade?.toFixed(1)}%`} color="#ef4444" />
              <StatItem label="Wins" value={String(result.winningTrades)} color="#22c55e" />
              <StatItem label="Losses" value={String(result.losingTrades)} color="#ef4444" />
            </div>
          </div>

          {chartData.length > 2 && (
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isProfit ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={isProfit ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip
                    formatter={v => [`$${Number(v).toFixed(0)}`, 'Capital']}
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 8 }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Area type="monotone" dataKey="value"
                    stroke={isProfit ? '#22c55e' : '#ef4444'} strokeWidth={2}
                    fill="url(#btGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, color = 'var(--text)' }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px', minWidth: 90 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color, marginTop: 3 }}>{value}</div>
    </div>
  );
}
