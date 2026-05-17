import { useState, useEffect } from 'react';
import {
  getJournalAll, getJournalAnalysis,
  addJournalEntry, updateJournalOutcome,
  getPredictionCombined, getSentiment,
} from '../../services/api';
import styles from './Backtest.module.css'; // reuse card styles

const SIGNAL_COLORS = {
  BULLISH: '#22c55e', BEARISH: '#ef4444', NEUTRAL: '#EF9F27',
};

export default function Journal() {
  const [entries, setEntries]   = useState([]);
  const [stats, setStats]       = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [tab, setTab]           = useState('journal');   // journal | analysis | sentiment
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [j, s] = await Promise.all([getJournalAll(), getJournalAnalysis()]);
      setEntries(j.data || []);
      setStats(s.data);
    } catch (e) { console.error(e.message); }
    setLoading(false);
  };

  const loadSentiment = async () => {
    try {
      const res = await getSentiment();
      setSentiment(res.data);
    } catch { setSentiment({ status: 'error' }); }
  };

  useEffect(() => {
    if (tab === 'sentiment' && !sentiment) loadSentiment();
  }, [tab]); // eslint-disable-line

  return (
    <div style={{ padding: '20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: '#fbbf24', fontSize: 22 }}>📓 Trade Journal</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
            Record, analyze and learn from every trade
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{
          background: showForm ? '#333' : '#b8860b', border: 'none', borderRadius: 8,
          padding: '9px 18px', color: '#fff', fontWeight: 700, cursor: 'pointer',
        }}>
          {showForm ? '✕ Cancel' : '+ New Entry'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #222' }}>
        {[['journal', '📋 Entries'], ['analysis', '📊 Analysis'], ['sentiment', '📰 Sentiment']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            background: 'none', border: 'none', padding: '10px 18px',
            color: tab === k ? '#fbbf24' : '#888', fontWeight: tab === k ? 700 : 400,
            borderBottom: tab === k ? '2px solid #f59e0b' : '2px solid transparent',
            cursor: 'pointer', fontSize: 13,
          }}>{label}</button>
        ))}
      </div>

      {showForm && (
        <EntryForm onCreated={() => { setShowForm(false); loadAll(); }} />
      )}

      {tab === 'journal' && (
        loading ? <Spinner /> : entries.length === 0
          ? <Empty text="No journal entries yet. Record your first trade above." />
          : <EntriesList entries={entries} onRefresh={loadAll} />
      )}

      {tab === 'analysis' && (
        stats ? <AnalysisView stats={stats} /> : <Spinner />
      )}

      {tab === 'sentiment' && (
        sentiment
          ? <SentimentView data={sentiment} onRefresh={loadSentiment} />
          : <Spinner />
      )}
    </div>
  );
}

// ── Entry form ────────────────────────────────────────────────────────────────
function EntryForm({ onCreated }) {
  const [form, setForm] = useState({
    trade_id: '', market: 'GLOBAL', trade_type: 'BUY',
    entry_reason: '', signal_score: 0, timeframe: 'MID', entry_price: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.entry_price || !form.entry_reason) { setErr('Fill in price and reason'); return; }
    setLoading(true); setErr('');
    try {
      await addJournalEntry({
        ...form,
        trade_id:    form.trade_id || `manual-${Date.now()}`,
        entry_price: Number(form.entry_price),
        signal_score: Number(form.signal_score),
        indicators:  {},
      });
      onCreated();
    } catch { setErr('Could not save entry'); }
    setLoading(false);
  };

  const inp = { background: '#111', border: '1px solid #333', borderRadius: 6,
                padding: '8px 10px', color: '#e0d5c0', fontSize: 13, width: '100%' };
  const lbl = { fontSize: 11, color: '#888', marginBottom: 4, display: 'block' };

  return (
    <form onSubmit={submit} style={{
      background: '#111', border: '1px solid #333', borderRadius: 12,
      padding: 20, marginBottom: 20,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        <div>
          <label style={lbl}>Market</label>
          <select style={inp} value={form.market} onChange={e => set('market', e.target.value)}>
            <option>GLOBAL</option><option>IRAN</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Type</label>
          <select style={inp} value={form.trade_type} onChange={e => set('trade_type', e.target.value)}>
            <option>BUY</option><option>SELL</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Timeframe</label>
          <select style={inp} value={form.timeframe} onChange={e => set('timeframe', e.target.value)}>
            <option>SHORT</option><option>MID</option><option>LONG</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Entry Price</label>
          <input style={inp} type="number" value={form.entry_price}
            onChange={e => set('entry_price', e.target.value)} placeholder="e.g. 3350" />
        </div>
        <div>
          <label style={lbl}>Signal Score (-10 to +10)</label>
          <input style={inp} type="number" min="-10" max="10" value={form.signal_score}
            onChange={e => set('signal_score', e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl}>Why did you enter? (entry reason)</label>
          <textarea style={{ ...inp, height: 60, resize: 'vertical' }}
            value={form.entry_reason} onChange={e => set('entry_reason', e.target.value)}
            placeholder="e.g. RSI oversold + MACD bullish cross + RANGE regime" />
        </div>
      </div>
      {err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{err}</div>}
      <button type="submit" disabled={loading} style={{
        marginTop: 14, background: '#b8860b', border: 'none', borderRadius: 8,
        padding: '9px 22px', color: '#fff', fontWeight: 700, cursor: 'pointer',
      }}>
        {loading ? 'Saving…' : 'Save Entry'}
      </button>
    </form>
  );
}

// ── Entries list ──────────────────────────────────────────────────────────────
function EntriesList({ entries, onRefresh }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {entries.map(e => <EntryCard key={e.id} entry={e} onRefresh={onRefresh} />)}
    </div>
  );
}

function EntryCard({ entry, onRefresh }) {
  const [showOutcome, setShowOutcome] = useState(false);
  const isClosed = entry.outcome !== undefined && entry.outcome !== null;
  const pnl = entry.pnl;
  const isPos = pnl > 0;

  return (
    <div style={{
      background: '#0d0d1a', border: `1px solid ${isClosed ? (isPos ? '#22c55e33' : '#ef444433') : '#2a2020'}`,
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{
            color: entry.trade_type === 'BUY' ? '#22c55e' : '#ef4444',
            fontWeight: 700, fontSize: 13, marginRight: 10,
          }}>{entry.trade_type}</span>
          <span style={{ color: '#888', fontSize: 12 }}>{entry.market} · {entry.timeframe}</span>
          {entry.signal_score !== undefined && (
            <span style={{
              marginLeft: 8, fontSize: 11,
              color: entry.signal_score > 0 ? '#22c55e' : entry.signal_score < 0 ? '#ef4444' : '#888',
            }}>
              Score: {entry.signal_score > 0 ? '+' : ''}{entry.signal_score}
            </span>
          )}
        </div>
        {isClosed
          ? <span style={{ color: isPos ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: 14 }}>
              {isPos ? '+' : ''}{pnl?.toFixed(2)}
            </span>
          : <button onClick={() => setShowOutcome(v => !v)} style={{
              background: '#1a1000', border: '1px solid #f59e0b55', borderRadius: 6,
              padding: '4px 10px', color: '#f59e0b', fontSize: 11, cursor: 'pointer',
            }}>Record outcome</button>
        }
      </div>

      <div style={{ marginTop: 8, color: '#b0a090', fontSize: 12, lineHeight: 1.6 }}>
        <strong style={{ color: '#d4b483' }}>Entry @ </strong>
        {entry.entry_price} — {entry.entry_reason}
      </div>

      {entry.lesson && (
        <div style={{ marginTop: 6, color: '#888', fontSize: 12, fontStyle: 'italic' }}>
          📝 {entry.lesson}
        </div>
      )}

      {showOutcome && !isClosed && (
        <OutcomeForm tradeId={entry.trade_id} entryPrice={entry.entry_price}
          onSaved={() => { setShowOutcome(false); onRefresh(); }} />
      )}
    </div>
  );
}

function OutcomeForm({ tradeId, entryPrice, onSaved }) {
  const [exitPrice, setExitPrice] = useState('');
  const [lesson, setLesson]       = useState('');
  const [loading, setLoading]     = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!exitPrice) return;
    setLoading(true);
    const pnl = Number(exitPrice) - Number(entryPrice);
    try {
      await updateJournalOutcome({ trade_id: tradeId, exit_price: Number(exitPrice), pnl, lesson });
      onSaved();
    } catch { /* silent */ }
    setLoading(false);
  };

  const inp = { background: '#111', border: '1px solid #333', borderRadius: 6,
                padding: '7px 10px', color: '#e0d5c0', fontSize: 12 };
  return (
    <form onSubmit={save} style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div>
        <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>Exit Price</div>
        <input style={{ ...inp, width: 120 }} type="number" value={exitPrice}
          onChange={e => setExitPrice(e.target.value)} placeholder="e.g. 3380" />
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>Lesson learned</div>
        <input style={{ ...inp, width: '100%' }} value={lesson}
          onChange={e => setLesson(e.target.value)} placeholder="What did you learn?" />
      </div>
      <button type="submit" disabled={loading} style={{
        background: '#1a3a1a', border: '1px solid #22c55e55', borderRadius: 6,
        padding: '7px 14px', color: '#22c55e', cursor: 'pointer', fontSize: 12,
      }}>
        {loading ? '…' : 'Save'}
      </button>
    </form>
  );
}

// ── Analysis view ─────────────────────────────────────────────────────────────
function AnalysisView({ stats }) {
  if (stats.status === 'no_data') return <Empty text="No closed trades yet to analyze." />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
      <StatCard label="Total Trades"  value={stats.total} />
      <StatCard label="Closed"        value={stats.closed} />
      <StatCard label="Win Rate"      value={`${stats.win_rate_pct?.toFixed(1)}%`}
                color={stats.win_rate_pct > 50 ? '#22c55e' : '#ef4444'} />
      <StatCard label="Total PnL"     value={stats.total_pnl?.toFixed(2)}
                color={stats.total_pnl > 0 ? '#22c55e' : '#ef4444'} />
      <StatCard label="Avg Win"       value={stats.avg_win?.toFixed(2)} color="#22c55e" />
      <StatCard label="Avg Loss"      value={stats.avg_loss?.toFixed(2)} color="#ef4444" />

      {stats.score_win_rates && Object.keys(stats.score_win_rates).length > 0 && (
        <div style={{
          gridColumn: '1 / -1', background: '#0d0d1a', border: '1px solid #222',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 10 }}>Win rate by signal score</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(stats.score_win_rates).map(([score, rate]) => (
              <div key={score} style={{
                background: '#111', borderRadius: 6, padding: '6px 12px',
                fontSize: 12, color: rate > 50 ? '#22c55e' : '#ef4444',
              }}>
                Score {score}: <strong>{rate?.toFixed(0)}%</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.recent_lessons?.length > 0 && (
        <div style={{
          gridColumn: '1 / -1', background: '#0d0d1a', border: '1px solid #222',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 10 }}>📝 Recent lessons</div>
          {stats.recent_lessons.map((l, i) => (
            <div key={i} style={{ color: '#b0a090', fontSize: 13, marginBottom: 6 }}>• {l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sentiment view ────────────────────────────────────────────────────────────
function SentimentView({ data, onRefresh }) {
  const color = SIGNAL_COLORS[data.sentiment_label] || '#888';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{
          background: color + '22', border: `1px solid ${color}44`,
          borderRadius: 12, padding: '12px 24px',
        }}>
          <div style={{ color, fontSize: 22, fontWeight: 700 }}>{data.sentiment_label}</div>
          <div style={{ color: '#888', fontSize: 12 }}>
            Score: {data.overall_sentiment?.toFixed(3)} · {data.article_count} articles
          </div>
        </div>
        <div style={{ color: '#b0a090', fontSize: 13, maxWidth: 300 }}>{data.interpretation}</div>
        <button onClick={onRefresh} style={{
          marginLeft: 'auto', background: '#111', border: '1px solid #333',
          borderRadius: 8, padding: '8px 16px', color: '#888', cursor: 'pointer',
        }}>↻ Refresh</button>
      </div>

      {data.articles?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.articles.map((a, i) => {
            const c = a.sentiment > 0.1 ? '#22c55e' : a.sentiment < -0.1 ? '#ef4444' : '#888';
            return (
              <div key={i} style={{
                background: '#0d0d1a', border: '1px solid #1a1a1a',
                borderRadius: 8, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ color: '#c8b898', fontSize: 13 }}>{a.title}</span>
                <span style={{ color: c, fontWeight: 700, fontSize: 12, minWidth: 50, textAlign: 'right' }}>
                  {a.sentiment > 0 ? '+' : ''}{a.sentiment?.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {data.status === 'no_data' && (
        <Empty text="News feeds unreachable. Check internet connection." />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = '#fbbf24' }) {
  return (
    <div style={{
      background: '#0d0d1a', border: '1px solid #1a1a2e',
      borderRadius: 12, padding: '14px 18px',
    }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value ?? '—'}</div>
    </div>
  );
}

function Spinner() {
  return <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Loading…</div>;
}

function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>📓</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}
