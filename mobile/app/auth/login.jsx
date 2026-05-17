import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { login as apiLogin } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      login(data);
      router.replace('/(tabs)');
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Au</Text>
        <Text style={styles.title}>Gold App</Text>
        <Text style={styles.subtitle}>Smart Gold Trading</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Login</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.push('/auth/register')}
          >
            <Text style={styles.linkText}>Don't have an account? Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logo: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#B8860B',
    textAlign: 'center', lineHeight: 72,
    fontSize: 24, fontWeight: 'bold', color: '#fff',
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#B8860B', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 40 },
  form: { width: '100%', maxWidth: 360 },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1, borderColor: '#2a2a4e',
    borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, marginBottom: 12,
  },
  button: {
    backgroundColor: '#B8860B',
    borderRadius: 10, padding: 15,
    alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#B8860B', fontSize: 14 },
});
