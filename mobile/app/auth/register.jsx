import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { register } from '../../services/api';

export default function RegisterScreen() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', country: 'IR'
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleRegister = async () => {
    if (!form.firstName || !form.email || !form.password) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      Alert.alert(
        'Success',
        'Registration successful!\nWaiting for admin approval.',
        [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Gold App · Smart Trading</Text>

      <TextInput style={styles.input} placeholder="First Name *"
        placeholderTextColor="#666" value={form.firstName}
        onChangeText={v => update('firstName', v)} />

      <TextInput style={styles.input} placeholder="Last Name"
        placeholderTextColor="#666" value={form.lastName}
        onChangeText={v => update('lastName', v)} />

      <TextInput style={styles.input} placeholder="Email *"
        placeholderTextColor="#666" value={form.email}
        onChangeText={v => update('email', v)}
        autoCapitalize="none" keyboardType="email-address" />

      <TextInput style={styles.input} placeholder="Password * (min 6)"
        placeholderTextColor="#666" value={form.password}
        onChangeText={v => update('password', v)} secureTextEntry />

      <Text style={styles.label}>Country</Text>
      <View style={styles.countryRow}>
        {['IR', 'SE'].map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.countryBtn, form.country === c && styles.countryActive]}
            onPress={() => update('country', c)}
          >
            <Text style={[styles.countryText, form.country === c && styles.countryTextActive]}>
              {c === 'IR' ? '🇮🇷 Iran' : '🇸🇪 Sweden'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister} disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Register</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
        <Text style={styles.linkText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  inner: { padding: 24, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#B8860B', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 32 },
  input: {
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4e',
    borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, marginBottom: 12,
  },
  label: { color: '#888', fontSize: 13, marginBottom: 8 },
  countryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  countryBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#2a2a4e', alignItems: 'center',
  },
  countryActive: { borderColor: '#B8860B', backgroundColor: '#1a1200' },
  countryText: { color: '#666', fontSize: 14 },
  countryTextActive: { color: '#B8860B', fontWeight: 'bold' },
  button: {
    backgroundColor: '#B8860B', borderRadius: 10,
    padding: 15, alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#B8860B', fontSize: 14 },
});
