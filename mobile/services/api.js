import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'http://localhost:8080';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// attach JWT token from SecureStore
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// handle 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('jwt_token');
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const login = async (email, password) => {
  const res = await api.post('/api/auth/login', { email, password });
  await SecureStore.setItemAsync('jwt_token', res.data.token);
  await SecureStore.setItemAsync('user_data', JSON.stringify(res.data));
  return res.data;
};

export const register = async (data) => {
  return api.post('/api/auth/register', data);
};

export const logout = async () => {
  await SecureStore.deleteItemAsync('jwt_token');
  await SecureStore.deleteItemAsync('user_data');
};

export const getUser = async () => {
  const data = await SecureStore.getItemAsync('user_data');
  return data ? JSON.parse(data) : null;
};

// ── Gold prices ───────────────────────────────────────────────
export const getGlobalPrice = () => api.get('/api/gold/price/global');
export const getIranPrice = () => api.get('/api/gold/price/iran');
export const getPriceHistory = (market, hours = 24) =>
  api.get(`/api/gold/prices/history?market=${market}&hours=${hours}`);

// ── Signals ───────────────────────────────────────────────────
export const getSignal = (market, timeframe = 'MID') =>
  api.get(`/api/gold/signal?market=${market}&timeframe=${timeframe}`);

export const analyzeNow = (market, timeframe = 'MID') =>
  api.get(`/api/gold/signal/analyze?market=${market}&timeframe=${timeframe}`);

// ── Backtesting ───────────────────────────────────────────────
export const runBacktest = (market, months, capital, timeframe = 'MID') =>
  api.get(`/api/gold/backtest?market=${market}&months=${months}&capital=${capital}&timeframe=${timeframe}`);

// ── Trades ────────────────────────────────────────────────────
export const getTrades = () => api.get('/api/trades');
export const getOpenTrades = () => api.get('/api/trades/open');
export const addManualTrade = (data) => api.post('/api/trades/manual', data);
export const addPaperTrade = (data) => api.post('/api/trades/paper', data);
export const closeTrade = (id, exitPrice) =>
  api.put(`/api/trades/${id}/close`, { exitPrice: String(exitPrice) });
export const deleteTrade = (id) => api.delete(`/api/trades/${id}`);

// ── Stop Loss ─────────────────────────────────────────────────
export const updateStopLoss = (tradeId, data) => api.put(`/api/stoploss/${tradeId}`, data);
export const calculateStopLoss = (data) => api.post('/api/stoploss/calculate', data);

// ── Alerts ────────────────────────────────────────────────────
export const getAlerts = () => api.get('/api/alerts');
export const createAlert = (data) => api.post('/api/alerts', data);
export const deleteAlert = (id) => api.delete(`/api/alerts/${id}`);
export const toggleAlert = (id) => api.patch(`/api/alerts/${id}/toggle`);

// ── Health ────────────────────────────────────────────────────
export const getHealth = () => api.get('/api/health');

export default api;
