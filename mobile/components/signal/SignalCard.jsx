import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SIGNAL_CONFIG = {
  STRONG_BUY:  { color: '#22c55e', bg: '#0d2a0d', border: '#1D9E75', label: '🟢 STRONG BUY' },
  BUY:         { color: '#22c55e', bg: '#0d2a0d', border: '#1D9E75', label: '🟢 BUY' },
  HOLD:        { color: '#EF9F27', bg: '#2a1a00', border: '#B8860B', label: '🟡 HOLD' },
  SELL:        { color: '#ef4444', bg: '#2a0d0d', border: '#E24B4A', label: '🔴 SELL' },
  STRONG_SELL: { color: '#ef4444', bg: '#2a0d0d', border: '#E24B4A', label: '🔴 STRONG SELL' },
};

export default function SignalCard({ signal }) {
  if (!signal) return null;

  const config = SIGNAL_CONFIG[signal.signal] || SIGNAL_CONFIG.HOLD;

  return (
    <View style={[styles.card, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={styles.header}>
        <Text style={[styles.signalLabel, { color: config.color }]}>{config.label}</Text>
        <Text style={[styles.score, { color: config.color }]}>
          {signal.score > 0 ? '+' : ''}{signal.score}/10
        </Text>
      </View>

      <Text style={styles.reason} numberOfLines={2}>{signal.reason}</Text>

      <View style={styles.indicators}>
        <IndicatorPill label="RSI" value={signal.rsi?.toFixed(1)} vote={signal.rsiVote} />
        <IndicatorPill label="MACD" value={signal.macdVote > 0 ? '↑' : signal.macdVote < 0 ? '↓' : '→'} vote={signal.macdVote} />
        <IndicatorPill label="BB" value={signal.bollingerPosition} vote={signal.bollingerVote} />
        <IndicatorPill label="Trend" value={signal.trend} vote={signal.trendVote} />
        <IndicatorPill label="DXY" value={signal.dxyVote > 0 ? '↑' : signal.dxyVote < 0 ? '↓' : '→'} vote={signal.dxyVote} />
        <IndicatorPill label="CPI" value={signal.cpiVote > 0 ? '↑' : '→'} vote={signal.cpiVote} />
      </View>

      {signal.combinedPrediction && (
        <Text style={styles.prediction}>
          Prediction: {Number(signal.combinedPrediction).toLocaleString()}
        </Text>
      )}
    </View>
  );
}

function IndicatorPill({ label, value, vote }) {
  const color = vote > 0 ? '#22c55e' : vote < 0 ? '#ef4444' : '#888';
  return (
    <View style={[styles.pill, { borderColor: color + '40' }]}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderRadius: 12,
    padding: 12, marginBottom: 12,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  signalLabel: { fontSize: 15, fontWeight: 'bold' },
  score: { fontSize: 20, fontWeight: 'bold' },
  reason: { fontSize: 11, color: '#888', marginBottom: 10 },
  indicators: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
    alignItems: 'center',
  },
  pillLabel: { fontSize: 9, color: '#666' },
  pillValue: { fontSize: 10, fontWeight: 'bold' },
  prediction: { fontSize: 11, color: '#B8860B', marginTop: 8 },
});
