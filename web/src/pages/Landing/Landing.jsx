import { useNavigate } from 'react-router-dom';
import styles from './Landing.module.css';

export default function Landing() {
  const nav = useNavigate();

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>Au</div>
        <span className={styles.logoText}>Gold App</span>
        <div className={styles.headerBtns}>
          <button className={styles.btnOutline} onClick={() => nav('/login')}>Login</button>
          <button className={styles.btnGold} onClick={() => nav('/register')}>Get Started</button>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Smart Gold Trading<br />
          <span className={styles.heroGold}>Powered by AI</span>
        </h1>
        <p className={styles.heroSub}>
          Real-time prices from Iran & Global markets · 12-indicator algorithm ·
          ML predictions · Backtesting simulator
        </p>
        <div className={styles.heroBtns}>
          <button className={styles.btnGold} onClick={() => nav('/register')}>
            Start Free →
          </button>
          <button className={styles.btnOutline} onClick={() => nav('/login')}>
            Login
          </button>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        {FEATURES.map((f, i) => (
          <div key={i} className={styles.featureCard}>
            <div className={styles.featureIcon}>{f.icon}</div>
            <h3 className={styles.featureTitle}>{f.title}</h3>
            <p className={styles.featureSub}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Markets */}
      <section className={styles.markets}>
        <h2 className={styles.sectionTitle}>Two Markets, One Platform</h2>
        <div className={styles.marketsRow}>
          <div className={styles.marketCard}>
            <div className={styles.marketFlag}>🇮🇷</div>
            <h3>Iran Market</h3>
            <p>Gold 18k · Mithqal · Emami Coin · TGJU · Every 30 seconds</p>
          </div>
          <div className={styles.marketCard}>
            <div className={styles.marketFlag}>🌍</div>
            <h3>Global Market</h3>
            <p>XAUUSD · Binance · Every second · Real-time WebSocket</p>
          </div>
        </div>
      </section>

      {/* Algorithm */}
      <section className={styles.algo}>
        <h2 className={styles.sectionTitle}>12-Indicator Algorithm</h2>
        <div className={styles.algoGrid}>
          {INDICATORS.map((ind, i) => (
            <span key={i} className={styles.indPill}>{ind}</span>
          ))}
        </div>
        <div className={styles.signalRow}>
          {SIGNALS.map((s, i) => (
            <div key={i} className={styles.signalChip} style={{ color: s.color, borderColor: s.color + '44' }}>
              {s.label}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2025 Gold App · Smart Gold Trading · Iran & Sweden</p>
        <p style={{ color: '#444', fontSize: 11, marginTop: 6 }}>
          Disclaimer: Trading involves risk. This app is for analysis only.
        </p>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: '⚡', title: 'Real-time Prices', desc: 'Global prices every second via Binance WebSocket. Iran market every 30 seconds via TGJU.' },
  { icon: '🧠', title: 'AI Predictions', desc: 'LSTM + Linear Regression models trained separately on Iran and global market data.' },
  { icon: '📊', title: 'Backtesting', desc: 'Simulate trading on historical data with custom capital and timeframe.' },
  { icon: '🔔', title: 'Smart Alerts', desc: 'Telegram & Email alerts for strong signals and direction changes.' },
  { icon: '📱', title: 'Mobile + Web', desc: 'iOS, Android and Web — all from one codebase.' },
  { icon: '🔒', title: 'Secure', desc: 'JWT authentication, rate limiting, and admin-activated accounts.' },
];

const INDICATORS = [
  'RSI', 'MACD', 'Bollinger Bands', 'Trend Detector',
  'Volume', 'Support/Resistance', 'MA Cross',
  'DXY', 'Fed Rate', 'CPI', 'ETF Flows', 'Coin Bubble'
];

const SIGNALS = [
  { label: '🟢 STRONG BUY', color: '#22c55e' },
  { label: '🟢 BUY', color: '#22c55e' },
  { label: '🟡 HOLD', color: '#EF9F27' },
  { label: '🔴 SELL', color: '#ef4444' },
  { label: '🔴 STRONG SELL', color: '#ef4444' },
];
