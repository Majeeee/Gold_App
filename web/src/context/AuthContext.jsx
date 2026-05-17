import { createContext, useContext, useState, useEffect } from 'react';
import { logout as apiLogout } from '../services/api';
import ws from '../services/websocket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState({ overallStatus: 'ONLINE', message: 'Connecting...' });

  useEffect(() => {
    const stored = localStorage.getItem('gold_user');
    if (stored) {
      setUser(JSON.parse(stored));
      connectWs();
    }
    setLoading(false);
  }, []);

  const connectWs = () => {
    ws.connect(
      () => ws.onHealth(h => setHealth(h)),
      () => setHealth({ overallStatus: 'OFFLINE', message: 'Disconnected from server' })
    );
  };

  const login = userData => {
    localStorage.setItem('gold_user', JSON.stringify(userData));
    setUser(userData);
    connectWs();
  };

  const logout = async () => {
    await apiLogout();
    localStorage.removeItem('gold_user');
    ws.disconnect();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, health }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
