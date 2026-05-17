import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { getAlerts, createAlert, deleteAlert, toggleAlert } from '../../services/api';

export default function AlertSettingsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await getAlerts();
      setAlerts(res.data);
    } catch (e) { console.log('Alerts error:', e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Alert', 'Remove this price alert?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteAlert(id); load(); }
        catch { Alert.alert('Error', 'Could not delete alert'); }
      }},
    ]);
  };

  const handleToggle = async (id) => {
    try { await toggleAlert(id); load(); }
    catch { Alert.alert('Error', 'Could not toggle alert'); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Price Alerts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ New Alert</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#B8860B" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView>
          {alerts.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>No alerts yet</Text>
              <Text style={styles.emptySubtext}>
                Create an alert to get notified when gold reaches your target price
              </Text>
            </View>
          )}
          {alerts.map(alert => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onDelete={() => handleDelete(alert.id)}
              onToggle={() => handleToggle(alert.id)}
            />
          ))}
        </ScrollView>
      )}

      <CreateAlertModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); }}
      />
    </View>
  );
}

function AlertItem({ alert, onDelete, onToggle }) {
  const condColor = alert.condition === 'ABOVE' ? '#22c55e' : '#ef4444';
  const marketFlag = alert.market === 'IRAN' ? '🇮🇷' : '🌍';
  const price = alert.market === 'IRAN'
    ? (Number(alert.targetPrice) / 1_000_000).toFixed(1) + 'M T'
    : '$' + Number(alert.targetPrice).toLocaleString();

  return (
    <View style={[styles.alertItem, alert.triggered && styles.alertTriggered]}>
      <View style={styles.alertLeft}>
        <Text style={styles.alertFlag}>{marketFlag}</Text>
        <View>
          <View style={styles.alertCondRow}>
            <Text style={[styles.alertCond, { color: condColor }]}>
              {alert.condition}
            </Text>
            <Text style={styles.alertPrice}>{price}</Text>
          </View>
          {!!alert.message && (
            <Text style={styles.alertMsg} numberOfLines={1}>{alert.message}</Text>
          )}
          {alert.triggered && (
            <Text style={styles.triggeredBadge}>Triggered</Text>
          )}
        </View>
      </View>
      <View style={styles.alertRight}>
        <Switch
          value={alert.active && !alert.triggered}
          onValueChange={onToggle}
          disabled={alert.triggered}
          trackColor={{ true: '#B8860B55', false: '#2a2a4e' }}
          thumbColor={alert.active ? '#B8860B' : '#555'}
        />
        <TouchableOpacity onPress={onDelete} style={styles.delBtn}>
          <Text style={styles.delBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CreateAlertModal({ visible, onClose, onCreated }) {
  const [market, setMarket] = useState('GLOBAL');
  const [condition, setCondition] = useState('ABOVE');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setPrice(''); setMessage(''); setError(''); };

  const submit = async () => {
    if (!price) { setError('Enter a target price'); return; }
    setLoading(true); setError('');
    try {
      await createAlert({ market, condition, targetPrice: price, message });
      reset();
      onCreated();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not create alert');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Price Alert</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Market */}
          <Text style={styles.lbl}>Market</Text>
          <View style={styles.row}>
            {['GLOBAL', 'IRAN'].map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.optBtn, market === m && styles.optActive]}
                onPress={() => setMarket(m)}
              >
                <Text style={[styles.optText, market === m && styles.optTextActive]}>
                  {m === 'GLOBAL' ? '🌍 Global' : '🇮🇷 Iran'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Condition */}
          <Text style={[styles.lbl, { marginTop: 14 }]}>Condition</Text>
          <View style={styles.row}>
            {['ABOVE', 'BELOW'].map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.optBtn, condition === c && styles.optActive]}
                onPress={() => setCondition(c)}
              >
                <Text style={[styles.optText, condition === c && {
                  color: c === 'ABOVE' ? '#22c55e' : '#ef4444', fontWeight: 'bold'
                }]}>
                  {c === 'ABOVE' ? '▲ Above' : '▼ Below'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Price */}
          <Text style={[styles.lbl, { marginTop: 14 }]}>
            Target Price ({market === 'IRAN' ? 'Tomans' : 'USD'})
          </Text>
          <TextInput
            style={styles.inp} keyboardType="numeric"
            placeholder={market === 'IRAN' ? 'e.g. 85000000' : 'e.g. 3400'}
            placeholderTextColor="#444" value={price} onChangeText={setPrice}
          />

          {/* Message */}
          <Text style={[styles.lbl, { marginTop: 14 }]}>Note (optional)</Text>
          <TextInput
            style={styles.inp} placeholder="e.g. Buy signal"
            placeholderTextColor="#444" value={message} onChangeText={setMessage}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={submit} disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitBtnText}>Create Alert</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#1e1e3a',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#B8860B' },
  addBtn: {
    backgroundColor: '#B8860B22', borderWidth: 1, borderColor: '#B8860B55',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { color: '#B8860B', fontSize: 12, fontWeight: 'bold' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#888', fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 12, color: '#555', textAlign: 'center', lineHeight: 18 },
  alertItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1a1a2e', marginHorizontal: 10, marginVertical: 4,
    borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#2a2a4e',
  },
  alertTriggered: { opacity: 0.5, borderColor: '#444' },
  alertLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  alertFlag: { fontSize: 24 },
  alertCondRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertCond: { fontSize: 12, fontWeight: 'bold' },
  alertPrice: { fontSize: 14, color: '#fff', fontWeight: '600' },
  alertMsg: { fontSize: 11, color: '#666', marginTop: 2 },
  triggeredBadge: {
    fontSize: 9, color: '#B8860B', backgroundColor: '#1a1200',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
    marginTop: 3, alignSelf: 'flex-start',
  },
  alertRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  delBtn: { padding: 4 },
  delBtnText: { color: '#555', fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalPanel: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 22, borderTopWidth: 1, borderColor: '#2a2a4e',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#B8860B' },
  closeX: { color: '#888', fontSize: 18 },
  lbl: { fontSize: 12, color: '#888', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  optBtn: {
    flex: 1, borderWidth: 0.5, borderColor: '#2a2a4e',
    borderRadius: 8, padding: 10, alignItems: 'center',
  },
  optActive: { backgroundColor: '#1a1200', borderColor: '#B8860B' },
  optText: { fontSize: 12, color: '#666' },
  optTextActive: { color: '#B8860B' },
  inp: {
    backgroundColor: '#0f0f1e', borderWidth: 1, borderColor: '#2a2a4e',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: '#fff', fontSize: 14,
  },
  error: { color: '#ef4444', fontSize: 12, marginTop: 8 },
  submitBtn: {
    backgroundColor: '#B8860B', borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 20,
  },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
