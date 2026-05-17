import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUser, logout as apiLogout } from '../services/api';
import wsService from '../services/websocket';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState({ overallStatus: 'ONLINE', message: 'Connecting...' });

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const userData = await getUser();
      if (userData) {
        setUser(userData);
        connectWebSocket(userData.token);
      }
    } catch (e) {
      console.log('Not logged in');
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (token) => {
    wsService.connect(
      token,
      () => {
        wsService.subscribeToHealth((h) => setHealth(h));
      },
      () => {
        setHealth({ overallStatus: 'OFFLINE', message: 'Disconnected from server' });
      }
    );
  };

  const login = (userData) => {
    setUser(userData);
    connectWebSocket(userData.token);
  };

  const logout = async () => {
    await apiLogout();
    wsService.disconnect();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, health }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
