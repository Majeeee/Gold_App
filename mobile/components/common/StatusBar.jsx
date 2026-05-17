import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS = {
  ONLINE:  { bg: '#0d2a0d', border: '#1D9E75', text: '#22c55e' },
  PARTIAL: { bg: '#2a1a00', border: '#B8860B', text: '#EF9F27' },
  OFFLINE: { bg: '#2a0d0d', border: '#E24B4A', text: '#ef4444' },
};

const STATUS_ICONS = { ONLINE: '🟢', PARTIAL: '🟡', OFFLINE: '🔴' };

export default function StatusBar() {
  const { health } = useAuth();
  const status = health?.overallStatus || 'OFFLINE';
  const colors = STATUS_COLORS[status] || STATUS_COLORS.OFFLINE;

  return (
    <View style={[styles.bar, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {STATUS_ICONS[status]} {health?.message || 'Connecting...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderBottomWidth: 1,
  },
  text: { fontSize: 11, textAlign: 'center' },
});
