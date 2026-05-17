import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Dimensions
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LineChart } from 'react-native-chart-kit';
import { runBacktest } from '../../services/api';

const { width } = Dimensions.get('window');
const PERIODS = ['1 week', '1 month', '3 months', '6 months', '1 year'];

export default function BacktestScreen() {
  const [capital, setCapital] = useState(1000);
  const [periodIdx, setPeriodIdx] = useState(1);
  const [market, setMarket] = useState('GLOBAL');
  const [timeframe, setTimeframe] = useState('MID');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const months = [0.25, 1, 3, 6, 12][periodIdx];

  const runTest = async () => {
    setLoading(true);
    try {
      const res = await runBacktest(market, months, capital, timeframe);
      setResult(res.data);
    } catch (e) {
      console.log('Backtest error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const isProfit = result && result.totalPnl >= 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Backtesting Simulator</Text>

      {/* Market */}
      <Text style={styles.label}>Market</Text>
      <View style={styles.row}>
        {['GLOBAL', 'IRAN'].map(m => (
          <TouchableOpacity
            key={m} style={[styles.optBtn, market === m && styles.optActive]}
            onPress={() => setMarket(m)}
          >
            <Text style={[styles.optText, market === m && styles.optTextActive]}>
              {m === 'GLOBAL' ? '🌍 Global' : '🇮🇷 Iran'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timeframe */}
      <Text style={styles.label}>Strategy</Text>
      <View style={styles.row}>
        {['SHORT', 'MID', 'LONG'].map(tf => (
          <TouchableOpacity
            key={tf} style={[styles.optBtn, timeframe === tf && styles.optActive]}
            onPress={() => setTimeframe(tf)}
          >
            <Text style={[styles.optText, timeframe === tf && styles.optTextActive]}>
              {tf === 'SHORT' ? 'Short' : tf === 'MID' ? 'Mid' : 'Long'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Capital */}
      <Text style={styles.label}>Initial Capital: ${capital.toLocaleString()}</Text>
      <Slider
        style={styles.slider}
        minimumValue={100} maximumValue={100000}
        step={100} value={capital}
        onValueChange={setCapital}
        minimumTrackTintColor="#B8860B"
        maximumTrackTintColor="#2a2a4e"
        thumbTintColor="#B8860B"
      />

      {/* Period */}
      <Text style={styles.label}>Period: {PERIODS[periodIdx]}</Text>
      <Slider
        style={styles.slider}
        minimumValue={0} maximumValue={4}
        step={1} value={periodIdx}
        onValueChange={setPeriodIdx}
        minimumTrackTintColor="#B8860B"
        maximumTrackTintColor="#2a2a4e"
        thumbTintColor="#B8860B"
      />

      <TouchableOpacity
        style={[styles.runBtn, loading && styles.runBtnDisabled]}
        onPress={runTest} disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.runBtnText}>▶ Run Simulation</Text>
        }
      </TouchableOpacity>

      {/* Result */}
      {result && (
        <View style={[styles.result, isProfit ? styles.resultPos : styles.resultNeg]}>
          <Text style={[styles.finalCapital, { color: isProfit ? '#22c55e' : '#ef4444' }]}>
            ${result.finalCapital?.toFixed(0)}
          </Text>
          <Text style={[styles.pnlText, { color: isProfit ? '#22c55e' : '#ef4444' }]}>
            {isProfit ? '+' : ''}{result.totalPnl?.toFixed(0)} ({isProfit ? '+' : ''}{result.totalPnlPercent?.toFixed(1)}%)
          </Text>
          <Text style={styles.resultSub}>
            {PERIODS[periodIdx]} · {result.totalTrades} trades · {result.winRate?.toFixed(0)}% win rate
          </Text>

          <View style={styles.statsGrid}>
            <StatItem label="Initial" value={`$${capital.toFixed(0)}`} />
            <StatItem label="Best Trade" value={`+${result.bestTrade?.toFixed(1)}%`} color="#22c55e" />
            <StatItem label="Worst Trade" value={`${result.worstTrade?.toFixed(1)}%`} color="#ef4444" />
            <StatItem label="Win Rate" value={`${result.winRate?.toFixed(0)}%`} color="#B8860B" />
          </View>

          {result.capitalHistory?.length > 2 && (
            <LineChart
              data={{
                labels: [],
                datasets: [{ data: result.capitalHistory.slice(0, 30) }],
              }}
              width={width - 56}
              height={120}
              withDots={false}
              withInnerLines={false}
              withOuterLines={false}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: '#0d2a0d',
                backgroundGradientTo: '#0d2a0d',
                color: () => isProfit ? '#22c55e' : '#ef4444',
                labelColor: () => 'transparent',
              }}
              bezier
              style={styles.resultChart}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

function StatItem({ label, value, color = '#fff' }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e', padding: 14 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#B8860B', marginBottom: 16 },
  label: { fontSize: 12, color: '#888', marginBottom: 8, marginTop: 12 },
  row: { flexDirection: 'row', gap: 8 },
  optBtn: {
    flex: 1, padding: 10, borderRadius: 8, alignItems: 'center',
    borderWidth: 0.5, borderColor: '#2a2a4e',
  },
  optActive: { backgroundColor: '#1a1200', borderColor: '#B8860B' },
  optText: { fontSize: 12, color: '#666' },
  optTextActive: { color: '#B8860B', fontWeight: 'bold' },
  slider: { height: 30, marginBottom: 8 },
  runBtn: {
    backgroundColor: '#B8860B', borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 16,
  },
  runBtnDisabled: { opacity: 0.6 },
  runBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  result: { borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1 },
  resultPos: { backgroundColor: '#0d2a0d', borderColor: '#1D9E75' },
  resultNeg: { backgroundColor: '#2a0d0d', borderColor: '#E24B4A' },
  finalCapital: { fontSize: 28, fontWeight: 'bold', marginBottom: 2 },
  pnlText: { fontSize: 14, marginBottom: 4 },
  resultSub: { fontSize: 11, color: '#888', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statItem: {
    width: '47%', backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8, padding: 8,
  },
  statLabel: { fontSize: 10, color: '#888' },
  statValue: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  resultChart: { borderRadius: 8, marginTop: 4 },
});
