import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, Dimensions
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import wsService from '../../services/websocket';
import { getGlobalPrice, getSignal, getPriceHistory, getOpenTrades } from '../../services/api';
import StatusBar from '../../components/common/StatusBar';
import SignalCard from '../../components/signal/SignalCard';
import StopLossCard from '../../components/StopLossCard';

const { width } = Dimensions.get('window');

export default function GlobalScreen() {
  const [price, setPrice]           = useState(null);
  const [signal, setSignal]         = useState(null);
  const [history, setHistory]       = useState([]);
  const [timeframe, setTimeframe]   = useState('MID');
  const [chartTF, setChartTF]       = useState('1D');
  const [refreshing, setRefreshing] = useState(false);
  const [priceChange, setPriceChange] = useState(0);
  const [openTrades, setOpenTrades] = useState([]);
  const [slTrade, setSlTrade]       = useState(null);

  useEffect(() => {
    loadData();
    setupWebSocket();
    return () => wsService.subscribeToGlobalPrice(() => {});
  }, [timeframe]);

  const setupWebSocket = () => {
    wsService.subscribeToGlobalPrice((update) => {
      const newPrice = parseFloat(update.price);
      setPrice(prev => {
        if (prev) setPriceChange(newPrice - prev);
        return newPrice;
      });
    });
    wsService.subscribeToSignal('global', (sig) => {
      if (sig.timeframe === timeframe) setSignal(sig);
    });
  };

  const loadData = async () => {
    try {
      const [priceRes, signalRes, histRes, tradesRes] = await Promise.all([
        getGlobalPrice(),
        getSignal('GLOBAL', timeframe),
        getPriceHistory('GLOBAL', 24),
        getOpenTrades(),
      ]);
      setPrice(priceRes.data?.globalPriceUsd);
      setSignal(signalRes.data);
      const prices = histRes.data
        .filter(p => p.globalPriceUsd)
        .map(p => parseFloat(p.globalPriceUsd));
      setHistory(prices);
      setOpenTrades((tradesRes.data || []).filter(t => t.market === 'GLOBAL'));
    } catch (e) {
      console.log('Load error:', e.message);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const chartData = history.length > 2 ? history : [3280, 3290, 3285];
  const isUp = priceChange >= 0;

  return (
    <View style={styles.container}>
      <StatusBar />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Price */}
        <View style={styles.priceSection}>
          <View>
            <Text style={styles.pairLabel}>XAUUSD · Binance</Text>
            <Text style={styles.price}>
              ${price ? Number(price).toLocaleString('en', { minimumFractionDigits: 2 }) : '---'}
            </Text>
            <Text style={[styles.change, { color: isUp ? '#22c55e' : '#ef4444' }]}>
              {isUp ? '+' : ''}{priceChange.toFixed(2)} ({isUp ? '+' : ''}{(priceChange / (price || 1) * 100).toFixed(2)}%)
            </Text>
          </View>
          <View style={styles.tfPicker}>
            {['SHORT', 'MID', 'LONG'].map(tf => (
              <TouchableOpacity
                key={tf}
                style={[styles.tfBtn, timeframe === tf && styles.tfActive]}
                onPress={() => setTimeframe(tf)}
              >
                <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>
                  {tf === 'SHORT' ? 'Short' : tf === 'MID' ? 'Mid' : 'Long'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chart TF */}
        <View style={styles.chartTFRow}>
          {['1m', '5m', '1h', '4h', '1D', '1W'].map(tf => (
            <TouchableOpacity
              key={tf}
              style={[styles.chartTFBtn, chartTF === tf && styles.chartTFActive]}
              onPress={() => setChartTF(tf)}
            >
              <Text style={[styles.chartTFText, chartTF === tf && styles.chartTFTextActive]}>{tf}</Text>
            </TouchableOpacity>
          ))}
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
              color: () => '#7c3aed', labelColor: () => 'transparent',
            }}
            bezier style={styles.chart}
          />
        )}

        {/* Signal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signal · {timeframe}</Text>
          <SignalCard signal={signal} />
        </View>

        {/* Open Positions */}
        {openTrades.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Open Positions ({openTrades.length})</Text>
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
                      {trade.type}
                    </Text>
                    <Text style={styles.posEntry}>${Number(trade.entryPrice).toFixed(2)}</Text>
                    <Text style={styles.posQty}>{trade.quantity} oz</Text>
                  </View>
                  <Text style={[styles.posPnl, { color: isPos ? '#22c55e' : '#ef4444' }]}>
                    {isPos ? '+' : ''}${livePnl.toFixed(1)}
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
            <Text style={styles.tradeBtnLabel}>Sell</Text>
            <Text style={styles.tradeBtnPrice}>
              {price ? (Number(price) - 0.7).toFixed(2) : '---'}
            </Text>
          </TouchableOpacity>
          <View style={styles.spread}>
            <Text style={styles.spreadVal}>1.4</Text>
            <Text style={styles.spreadLabel}>spread</Text>
          </View>
          <TouchableOpacity style={[styles.tradeBtn, styles.buyBtn]}>
            <Text style={styles.tradeBtnLabel}>Buy</Text>
            <Text style={styles.tradeBtnPrice}>
              {price ? (Number(price) + 0.7).toFixed(2) : '---'}
            </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  priceSection: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', padding: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#1e1e3a',
  },
  pairLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
  price: { fontSize: 28, fontWeight: '500', color: '#fff' },
  change: { fontSize: 12, marginTop: 2 },
  tfPicker: { flexDirection: 'column', gap: 4 },
  tfBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 0.5, borderColor: '#2a2a4e',
  },
  tfActive: { backgroundColor: '#1a1200', borderColor: '#B8860B' },
  tfText: { fontSize: 11, color: '#666' },
  tfTextActive: { color: '#B8860B', fontWeight: 'bold' },
  chartTFRow: { flexDirection: 'row', gap: 4, padding: 10, paddingBottom: 4 },
  chartTFBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  chartTFActive: { backgroundColor: '#3b0764' },
  chartTFText: { fontSize: 11, color: '#555' },
  chartTFTextActive: { color: '#c4b5fd' },
  chart: { marginVertical: 4 },
  section: { padding: 14 },
  sectionTitle: {
    fontSize: 12, color: '#666', marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  positionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a2e', borderRadius: 8, padding: 10,
    marginBottom: 6, borderWidth: 0.5, borderColor: '#2a2a4e',
  },
  posLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  posType: { fontSize: 12, fontWeight: 'bold', minWidth: 30 },
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
  buyBtn: { backgroundColor: '#5b21b6' },
  tradeBtnLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 3 },
  tradeBtnPrice: { fontSize: 15, fontWeight: '500', color: '#fff' },
  spread: { alignItems: 'center' },
  spreadVal: {
    fontSize: 12, color: '#555', backgroundColor: '#1e1e3a',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3,
  },
  spreadLabel: { fontSize: 9, color: '#444', marginTop: 2 },
});
