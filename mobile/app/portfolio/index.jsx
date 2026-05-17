import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, Alert
} from 'react-native';
import { getTrades, closeTrade, deleteTrade } from '../../services/api';
import StopLossCard from '../../components/StopLossCard';

export default function PortfolioScreen() {
  const [trades, setTrades] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [slTrade, setSlTrade] = useState(null);

  useEffect(() => { loadTrades(); }, []);

  const loadTrades = async () => {
    try {
      const res = await getTrades();
      setTrades(res.data);
    } catch (e) { console.log('Portfolio error:', e.message); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTrades();
    setRefreshing(false);
  }, []);

  const handleClose = (id) => {
    Alert.prompt('Close Trade', 'Enter exit price:', async (exitPrice) => {
      if (!exitPrice) return;
      try {
        await closeTrade(id, exitPrice);
        loadTrades();
      } catch { Alert.alert('Error', 'Could not close trade'); }
    });
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Trade', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteTrade(id);
        loadTrades();
      }},
    ]);
  };

  const filtered = trades.filter(t => {
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return t.status === 'OPEN';
    if (filter === 'CLOSED') return t.status === 'CLOSED';
    if (filter === 'PAPER') return t.tradeType === 'PAPER';
    return true;
  });

  const totalPnl = filtered.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = filtered.filter(t => t.pnl > 0).length;
  const winRate = filtered.length ? (wins / filtered.length * 100).toFixed(0) : 0;

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <SummaryItem label="Total P&L"
          value={`${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(0)}`}
          color={totalPnl >= 0 ? '#22c55e' : '#ef4444'} />
        <SummaryItem label="Win Rate" value={`${winRate}%`} color="#B8860B" />
        <SummaryItem label="Trades" value={String(filtered.length)} color="#fff" />
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {['ALL', 'OPEN', 'CLOSED', 'PAPER'].map(f => (
          <TouchableOpacity
            key={f} style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.map(trade => (
          <TradeItem
            key={trade.id} trade={trade}
            onClose={() => handleClose(trade.id)}
            onDelete={() => handleDelete(trade.id)}
            onEditSL={() => setSlTrade(trade)}
          />
        ))}
        {filtered.length === 0 && (
          <Text style={styles.empty}>No trades found</Text>
        )}
      </ScrollView>

      <StopLossCard
        trade={slTrade}
        visible={!!slTrade}
        onClose={() => setSlTrade(null)}
        onUpdated={() => { loadTrades(); setSlTrade(null); }}
      />
    </View>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function TradeItem({ trade, onClose, onDelete, onEditSL }) {
  const isPos = (trade.pnl || 0) >= 0;
  const typeColor = trade.type === 'BUY' ? '#22c55e' : '#ef4444';
  const paperBadge = trade.tradeType === 'PAPER';
  const hasSL = trade.stopLoss || trade.takeProfit;

  const fmtSL = (val, market) => {
    if (!val) return '—';
    return market === 'IRAN'
      ? (Number(val) / 1_000_000).toFixed(1) + 'M'
      : '$' + Number(val).toFixed(0);
  };

  return (
    <View style={styles.tradeItem}>
      <View style={styles.tradeHeader}>
        <View style={styles.tradeLeft}>
          <Text style={[styles.tradeType, { color: typeColor }]}>{trade.type}</Text>
          {paperBadge && <Text style={styles.paperBadge}>PAPER</Text>}
          <Text style={styles.tradeMarket}>{trade.market}</Text>
          <Text style={[
            styles.tradeStatus,
            { color: trade.status === 'OPEN' ? '#EF9F27' : '#666' }
          ]}>{trade.status}</Text>
        </View>
        <Text style={[styles.tradePnl, { color: isPos ? '#22c55e' : '#ef4444' }]}>
          {isPos ? '+' : ''}{(trade.pnl || 0).toFixed(1)} ({(trade.pnlPercent || 0).toFixed(1)}%)
        </Text>
      </View>

      <View style={styles.tradeDetails}>
        <Text style={styles.tradeDetail}>Entry: ${Number(trade.entryPrice).toFixed(2)}</Text>
        {trade.exitPrice && (
          <Text style={styles.tradeDetail}>Exit: ${Number(trade.exitPrice).toFixed(2)}</Text>
        )}
        <Text style={styles.tradeDetail}>{trade.quantity} oz</Text>
        <Text style={styles.tradeDetail}>{trade.timeframe}</Text>
      </View>

      {/* SL / TP row */}
      <TouchableOpacity style={styles.slRow} onPress={onEditSL}>
        <Text style={styles.slLabel}>SL / TP</Text>
        <Text style={styles.slValue}>
          {fmtSL(trade.stopLoss, trade.market)} / {fmtSL(trade.takeProfit, trade.market)}
        </Text>
        <Text style={[styles.slEdit, hasSL && styles.slEditActive]}>Edit</Text>
      </TouchableOpacity>

      {trade.status === 'OPEN' && (
        <View style={styles.tradeActions}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  summary: {
    flexDirection: 'row', padding: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#1e1e3a',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 10, color: '#666', marginBottom: 3 },
  summaryValue: { fontSize: 16, fontWeight: '500' },
  filters: { flexDirection: 'row', gap: 6, padding: 10, paddingBottom: 6 },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    borderWidth: 0.5, borderColor: '#2a2a4e',
  },
  filterActive: { backgroundColor: '#1a1200', borderColor: '#B8860B' },
  filterText: { fontSize: 11, color: '#666' },
  filterTextActive: { color: '#B8860B', fontWeight: 'bold' },
  tradeItem: {
    padding: 12, marginHorizontal: 10, marginVertical: 4,
    backgroundColor: '#1a1a2e', borderRadius: 10,
    borderWidth: 0.5, borderColor: '#2a2a4e',
  },
  tradeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  tradeLeft: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  tradeType: { fontSize: 12, fontWeight: 'bold' },
  paperBadge: {
    fontSize: 9, color: '#185FA5',
    backgroundColor: '#0d1f35', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  tradeMarket: { fontSize: 11, color: '#fff' },
  tradeStatus: { fontSize: 10 },
  tradePnl: { fontSize: 13, fontWeight: '500' },
  tradeDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tradeDetail: { fontSize: 10, color: '#666' },
  slRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0f0f1e', borderRadius: 6, padding: 6,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#2a2a4e',
  },
  slLabel: { fontSize: 10, color: '#666', minWidth: 42 },
  slValue: { flex: 1, fontSize: 11, color: '#aaa', fontFamily: 'monospace' },
  slEdit: { fontSize: 10, color: '#555', borderWidth: 0.5, borderColor: '#333', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  slEditActive: { color: '#B8860B', borderColor: '#B8860B55' },
  tradeActions: { flexDirection: 'row', gap: 8 },
  closeBtn: {
    flex: 1, backgroundColor: '#1D9E75',
    borderRadius: 6, padding: 6, alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  deleteBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 0.5, borderColor: '#E24B4A',
  },
  deleteBtnText: { color: '#E24B4A', fontSize: 11 },
  empty: { textAlign: 'center', color: '#666', padding: 40 },
});
