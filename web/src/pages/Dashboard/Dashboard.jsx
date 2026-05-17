import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ws from '../../services/websocket';
import GlobalMarket from './GlobalMarket';
import IranMarket from './IranMarket';
import Portfolio from './Portfolio';
import Backtest from './Backtest';
import Alerts from './Alerts';
import Journal from './Journal';
import styles from './Dashboard.module.css';

const STATUS_COLORS = {
  ONLINE: '#22c55e', PARTIAL: '#EF9F27', OFFLINE: '#ef4444'
};

export default function Dashboard() {
  const { user, logout, health } = useAuth();
  const [globalPrice, setGlobalPrice] = useState(null);
  const [iranPrice, setIranPrice] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    ws.onGlobalPrice(d => setGlobalPrice(parseFloat(d.price)));
    ws.onIranPrice(d => setIranPrice(parseFloat(d.price)));
  }, []);

  const handleLogout = async () => {
    await logout();
    nav('/');
  };

  const statusColor = STATUS_COLORS[health?.overallStatus] || '#666';

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <div className={styles.logoCircle}>Au</div>
          <span className={styles.logoText}>Gold App</span>
        </div>

        <nav className={styles.nav}>
          <NavLink to="/dashboard/global" className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
            🌍 Global Market
          </NavLink>
          <NavLink to="/dashboard/iran" className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
            🇮🇷 Iran Market
          </NavLink>
          <NavLink to="/dashboard/portfolio" className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
            📋 Portfolio
          </NavLink>
          <NavLink to="/dashboard/backtest" className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
            📊 Backtesting
          </NavLink>
          <NavLink to="/dashboard/alerts" className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
            🔔 Alerts
          </NavLink>
          <NavLink to="/dashboard/journal" className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
            📓 Journal
          </NavLink>
          {user?.role === 'ROLE_ADMIN' && (
            <NavLink to="/admin" className={styles.navItem}>
              ⚙️ Admin Panel
            </NavLink>
          )}
        </nav>

        {/* Live prices mini */}
        <div className={styles.livePrices}>
          <div className={styles.liveItem}>
            <span className={styles.liveLabel}>XAUUSD</span>
            <span className={styles.livePrice}>
              ${globalPrice?.toFixed(2) ?? '---'}
            </span>
          </div>
          <div className={styles.liveItem}>
            <span className={styles.liveLabel}>Iran 18k</span>
            <span className={styles.livePrice}>
              {iranPrice ? (iranPrice / 1_000_000).toFixed(2) + 'M' : '---'}
            </span>
          </div>
        </div>

        {/* Health */}
        <div className={styles.healthBar} style={{ borderColor: statusColor + '44' }}>
          <span style={{ color: statusColor, fontSize: 8 }}>●</span>
          <span className={styles.healthMsg}>{health?.message}</span>
        </div>

        {/* User */}
        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.firstName}</span>
            <span className={styles.userEmail}>{user?.email}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <Routes>
          <Route path="global" element={<GlobalMarket />} />
          <Route path="iran" element={<IranMarket />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="backtest" element={<Backtest />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="journal" element={<Journal />} />
          <Route path="*" element={<GlobalMarket />} />
        </Routes>
      </main>
    </div>
  );
}
