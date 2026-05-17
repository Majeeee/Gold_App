import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, Dimensions
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import wsService from '../../services/websocket';
import { getIranPrice, getSignal, getPriceHistory, getOpenTrades } from '../../services/api';
import StatusBar from '../../components/common/StatusBar';
import SignalCard from '../../components/signal/SignalCard';
import StopLossCard from '../../components/StopLossCard';

const { width } = Dimensions.get('window');

const formatToman = (val) => {
  if (!val) return '---';
  const n = Number(val);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  return n.toLocaleString('fa');
};

const fmtPnlIran = (val) => {
  if (!val) return '---';
  return (val / 1_000_000).toFixed(2) + 'M';
};

export default function IranScreen() {
  const [price, setPrice]           = useState(null);
  const [signal, setSignal]         = useState(null);
  const [history, setHistory]       = useState([]);
  const [timeframe, setTimeframe]   = useState('MID');
  const [refreshing, setRefreshing] = useState(false);
  const [openTrades, setOpenTrades] = useState([]);
  const [slTrade, setSlTrade]       = useState(null);

  useEffect(() => {
    loadData();
    setupWebSocket();
  }, [timeframe]);

  const setupWebSocket = () => {
    wsService.subscribeToIranPrice((update) => {
      setPrice(parseFloat(update.price));
    });
    wsService.subscribeToSignal('iran', (sig) => {
      if (sig.timeframe === timeframe) setSignal(sig);
    });
  };

  const loadData = async () => {
    try {
      const [priceRes, signalRes, histRes, tradesRes] = await Promise.all([
        getIranPrice(),
        getSignal('IRAN', timeframe),
        getPriceHistory('IRAN', 24),
        getOpenTrades(),
      ]);
      setPrice(priceRes.data?.iranPrice18k);
      setSignal(signalRes.data);
      const prices = histRes.data
        .filter(p => p.iranPrice18k)
        .map(p => parseFloat(p.iranPrice18k) / 1_000_000);
      setHistory(prices);
      setOpenTrades((tradesRes.data || []).filter(t => t.market === 'IRAN'));
    } catch (e) {
      console.log('Iran load error:', e.message);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const chartData = history.length > 2 ? history : [20, 20.5, 20.3];

  return (
    <View style={styles.container}>
      <StatusBar />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Price */}
        <View style={styles.priceSection}>
          <View>
            <Text style={styles.pairLabel}>طلا ۱۸ عیار · TGJU</Text>
            <Text style={styles.price}>{formatToman(price)} تومان</Text>
            <Text style={styles.priceLabel}>هر گرم</Text>
          </View>
          <View style={styles.tfPicker}>
            {['SHORT', 'MID', 'LONG'].map(tf => (
              <TouchableOpacity
                key={tf}
                style={[styles.tfBtn, timeframe === tf && styles.tfActive]}
                onPress={() => setTimeframe(tf)}
              >
                <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>
                  {tf === 'SHORT' ? 'کوتاه' : tf === 'MID' ? 'میان' : 'بلند'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chart */}
        {chartData.length > 2 && (
          <LineChart
            data={{ labels: [], datasets: [{ data: chartData.slice(-30) }] }}
            width={width} height={180}
            withDots={false} withInnerLines={false} withOuterLines={false}
            chartConfig={{
              backgroundColor: '#0f0f1e', backgroundGradientFrom: '#0f0f1e',
              backgroundGradientTo: '#0f0f1e',
              color: () => '#d97706', labelColor: () => 'transparent',
            }}
            bezier style={styles.chart}
          />
        )}

        {/* Extra Iran info */}
        <View style={styles.iranInfo}>
          <InfoItem label="طلا ۲۴ عیار" value="---" />
          <InfoItem label="مثقال طلا" value="---" />
          <InfoItem label="سکه امامی" value="---" />
          <InfoItem label="نرخ دلار" value="---" />
        </View>

        {/* Signal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>سیگنال · {timeframe}</Text>
          <SignalCard signal={signal} />
        </View>

        {/* Open Positions */}
        {openTrades.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>پوزیشن‌های باز ({openTrades.length})</Text>
            {openTrades.map(trade => {
              const livePnl = price
                ? (trade.type === 'BUY'
                    ? (price - trade.entryPrice) * trade.quantity
                    : (trade.entryPrice - price) * trade.quantity)
                : (trade.pnl || 0);
              const isPos = livePnl >= 0;
              const hasSL = trade.stopLoss || trade.takeProfit;
              return (
                <View key={trade.id} style={styles.positionRow}>
                  <View style={styles.posLeft}>
                    <Text style={[styles.posType, { color: trade.type === 'BUY' ? '#22c55e' : '#ef4444' }]}>
                      {trade.type === 'BUY' ? 'خرید' : 'فروش'}
                    </Text>
                    <Text style={styles.posEntry}>{formatToman(trade.entryPrice)}</Text>
                    <Text style={styles.posQty}>{trade.quantity} گرم</Text>
                  </View>
                  <Text style={[styles.posPnl, { color: isPos ? '#22c55e' : '#ef4444' }]}>
                    {isPos ? '+' : ''}{fmtPnlIran(livePnl)}T
                  </Text>
                  <TouchableOpacity
                    style={[styles.slChip, hasSL && styles.slChipActive]}
                    onPress={() => setSlTrade(trade)}
                  >
                    <Text style={[styles.slChipText, hasSL && styles.slChipTextActive]}>
                      SL/TP
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Buy/Sell */}
        <View style={styles.tradeRow}>
          <TouchableOpacity style={[styles.tradeBtn, styles.sellBtn]}>
            <Text style={styles.tradeBtnLabel}>فروش</Text>
            <Text style={styles.tradeBtnPrice}>{formatToman(price ? Number(price) - 100000 : null)}</Text>
          </TouchableOpacity>
          <View style={styles.spread}>
            <Text style={styles.spreadVal}>۱۰۰K</Text>
            <Text style={styles.spreadLabel}>اختلاف</Text>
          </View>
          <TouchableOpacity style={[styles.tradeBtn, styles.buyBtn]}>
            <Text style={styles.tradeBtnLabel}>خرید</Text>
            <Text style={styles.tradeBtnPrice}>{formatToman(price ? Number(price) + 100000 : null)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <StopLossCard
        trade={slTrade}
        visible={!!slTrade}
        onClose={() => setSlTrade(null)}
        onUpdated={() => { loadData(); setSlTrade(null); }}
      />
    </View>
  );
}

function InfoItem({ label, value }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  priceSection: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', padding: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#1e1e3a',
  },
  pairLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
  price: { fontSize: 24, fontWeight: '500', color: '#fff' },
  priceLabel: { fontSize: 10, color: '#666', marginTop: 2 },
  tfPicker: { flexDirection: 'column', gap: 4 },
  tfBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 0.5, borderColor: '#2a2a4e',
  },
  tfActive: { backgroundColor: '#1a1200', borderColor: '#B8860B' },
  tfText: { fontSize: 11, color: '#666' },
  tfTextActive: { color: '#B8860B', fontWeight: 'bold' },
  chart: { marginVertical: 4 },
  iranInfo: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 14, gap: 8,
    borderBottomWidth: 0.5, borderBottomColor: '#1e1e3a',
  },
  infoItem: {
    width: '47%', backgroundColor: '#1a1200',
    borderRadius: 8, padding: 8,
    borderWidth: 0.5, borderColor: '#451a03',
  },
  infoLabel: { fontSize: 10, color: '#666' },
  infoValue: { fontSize: 13, fontWeight: '500', color: '#fbbf24', marginTop: 2 },
  section: { padding: 14 },
  sectionTitle: { fontSize: 12, color: '#666', marginBottom: 8 },
  positionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a2e', borderRadius: 8, padding: 10,
    marginBottom: 6, borderWidth: 0.5, borderColor: '#2a2a4e',
  },
  posLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  posType: { fontSize: 12, fontWeight: 'bold', minWidth: 36 },
  posEntry: { fontSize: 11, color: '#aaa' },
  posQty: { fontSize: 10, color: '#555' },
  posPnl: { fontSize: 12, fontWeight: '600', marginRight: 10 },
  slChip: {
    borderWidth: 0.5, borderColor: '#333', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  slChipActive: { borderColor: '#B8860B55', backgroundColor: '#1a1200' },
  slChipText: { fontSize: 10, color: '#555' },
  slChipTextActive: { color: '#B8860B' },
  tradeRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 8,
    borderTopWidth: 0.5, borderTopColor: '#1e1e3a',
  },
  tradeBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  sellBtn: { backgroundColor: '#dc2626' },
  buyBtn: { backgroundColor: '#b8860b' },
  tradeBtnLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 3 },
  tradeBtnPrice: { fontSize: 13, fontWeight: '500', color: '#fff' },
  spread: { alignItems: 'center' },
  spreadVal: {
    fontSize: 11, color: '#555', backgroundColor: '#1e1e3a',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3,
  },
  spreadLabel: { fontSize: 9, color: '#444', marginTop: 2 },
});
