import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { updateStopLoss, calculateStopLoss, getPriceHistory } from '../services/api';

export default function StopLossCard({ trade, visible, onClose, onUpdated }) {
  const isIran = trade?.market === 'IRAN';
  const fmt = v => (v == null ? '' : String(v));

  const [sl, setSl] = useState(fmt(trade?.stopLoss));
  const [tp, setTp] = useState(fmt(trade?.takeProfit));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const unit = isIran ? 'T' : '$';

  const save = async () => {
    setLoading(true); setError('');
    try {
      await updateStopLoss(trade.id, {
        stopLoss:   sl || null,
        takeProfit: tp || null,
      });
      onUpdated?.();
      onClose?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not save');
    } finally { setLoading(false); }
  };

  const calcAtr = async () => {
    setLoading(true); setError('');
    try {
      const histRes = await getPriceHistory(trade.market, 24);
      const prices = (histRes.data ?? []).map(p =>
        isIran ? parseFloat(p.iranPrice18k) : parseFloat(p.globalPriceUsd)
      ).filter(Boolean);

      if (prices.length < 2) { setError('Not enough history'); setLoading(false); return; }

      const res = await calculateStopLoss({
        prices,
        entryPrice: parseFloat(trade.entryPrice),
        isBuy: trade.type === 'BUY',
      });
      setSl(res.data.stopLoss.toFixed(isIran ? 0 : 2));
      setTp(res.data.takeProfit.toFixed(isIran ? 0 : 2));
    } catch {
      setError('ATR calculation failed');
    } finally { setLoading(false); }
  };

  if (!trade) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Stop Loss / Take Profit</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtext}>
            {trade.type} {trade.market}  ·  Entry: {unit}{Number(trade.entryPrice).toLocaleString()}
          </Text>

          <Text style={styles.lbl}>Stop Loss ({unit})</Text>
          <TextInput
            style={styles.inp} keyboardType="numeric" placeholder="e.g. 3200"
            placeholderTextColor="#444" value={sl} onChangeText={setSl}
          />

          <Text style={[styles.lbl, { marginTop: 12 }]}>Take Profit ({unit})</Text>
          <TextInput
            style={styles.inp} keyboardType="numeric" placeholder="e.g. 3600"
            placeholderTextColor="#444" value={tp} onChangeText={setTp}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.atrBtn, loading && styles.btnDisabled]}
              onPress={calcAtr} disabled={loading}
            >
              <Text style={styles.atrBtnText}>Auto (ATR)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.btnDisabled]}
              onPress={save} disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  panel: {
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4e',
    borderRadius: 14, padding: 22, width: 310,
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  panelTitle: { color: '#B8860B', fontSize: 16, fontWeight: 'bold' },
  closeX: { color: '#888', fontSize: 18 },
  subtext: { fontSize: 12, color: '#666', marginBottom: 16 },
  lbl: { fontSize: 12, color: '#888', marginBottom: 6 },
  inp: {
    backgroundColor: '#0f0f1e', borderWidth: 1, borderColor: '#2a2a4e',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: '#fff', fontSize: 14,
  },
  error: { color: '#ef4444', fontSize: 12, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  atrBtn: {
    flex: 1, borderWidth: 1, borderColor: '#B8860B',
    borderRadius: 8, padding: 12, alignItems: 'center',
  },
  atrBtnText: { color: '#B8860B', fontSize: 13 },
  saveBtn: {
    flex: 2, backgroundColor: '#B8860B',
    borderRadius: 8, padding: 12, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
