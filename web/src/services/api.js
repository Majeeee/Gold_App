import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000,
});

// Skicka JWT som Bearer-header om den finns i localStorage (cookie kan blockeras av proxy)
api.interceptors.request.use(config => {
  const stored = localStorage.getItem('gold_user');
  if (stored) {
    try {
      const { token } = JSON.parse(stored);
      if (token) config.headers['Authorization'] = `Bearer ${token}`;
    } catch { /* ignore */ }
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const login = data => api.post('/auth/login', data);
export const register = data => api.post('/auth/register', data);
export const logout = () => api.post('/auth/logout');

// ── Gold ──────────────────────────────────────────────────────
export const getGlobalPrice = () => api.get('/gold/price/global');
export const getIranPrice = () => api.get('/gold/price/iran');
export const getPriceHistory = (market, hours = 24) =>
  api.get(`/gold/prices/history?market=${market}&hours=${hours}`);
export const getHistory = (market) =>
  api.get(`/history?market=${market}`);
export const getSignal = (market, timeframe = 'MID') =>
  api.get(`/gold/signal?market=${market}&timeframe=${timeframe}`);
export const analyzeNow = (market, tf) =>
  api.get(`/gold/signal/analyze?market=${market}&timeframe=${tf}`);
export const runBacktest = (market, months, capital, tf = 'MID') =>
  api.get(`/gold/backtest?market=${market}&months=${months}&capital=${capital}&timeframe=${tf}`);

// ── Trades ────────────────────────────────────────────────────
export const getTrades = () => api.get('/trades');
export const getOpenTrades = () => api.get('/trades/open');
export const addManualTrade = data => api.post('/trades/manual', data);
export const addPaperTrade = data => api.post('/trades/paper', data);
export const closeTrade = (id, exitPrice) =>
  api.put(`/trades/${id}/close`, { exitPrice: String(exitPrice) });
export const deleteTrade = id => api.delete(`/trades/${id}`);

// ── Stop Loss ─────────────────────────────────────────────────
export const getStopLoss = (tradeId) => api.get(`/stoploss/${tradeId}`);
export const updateStopLoss = (tradeId, data) => api.put(`/stoploss/${tradeId}`, data);
export const calculateStopLoss = data => api.post('/stoploss/calculate', data);

// ── Alerts ────────────────────────────────────────────────────
export const getAlerts = () => api.get('/alerts');
export const createAlert = data => api.post('/alerts', data);
export const deleteAlert = id => api.delete(`/alerts/${id}`);
export const toggleAlert = id => api.patch(`/alerts/${id}/toggle`);

// ── Preferences ───────────────────────────────────────────────
export const getPreferences = () => api.get('/preferences');
export const updatePreferences = data => api.put('/preferences', data);

// ── Liquidity ─────────────────────────────────────────────────
export const getLiquidity = () => api.get('/liquidity');

// ── Admin ─────────────────────────────────────────────────────
export const getUsers = () => api.get('/admin/users');
export const enableUser = id => api.put(`/admin/users/${id}/enable`);
export const disableUser = id => api.put(`/admin/users/${id}/disable`);
export const setUserRole = (id, role) => api.put(`/admin/users/${id}/role`, { role });
export const deleteUser = id => api.delete(`/admin/users/${id}`);

// ── Health ────────────────────────────────────────────────────
export const getHealth = () => api.get('/health');

export default api;
