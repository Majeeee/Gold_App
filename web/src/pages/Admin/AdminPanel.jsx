import { useState, useEffect } from 'react';
import { getUsers, enableUser, disableUser, setUserRole, deleteUser } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './Admin.module.css';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();
  const nav = useNavigate();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); }
  };

  const handleEnable = async (id, enabled) => {
    await (enabled ? disableUser(id) : enableUser(id));
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    await deleteUser(id);
    load();
  };

  const pending = users.filter(u => !u.enabled);
  const active = users.filter(u => u.enabled);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.logo}>Au</div>
          <span className={styles.title}>Gold App · Admin Panel</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={styles.dashBtn} onClick={() => nav('/dashboard')}>Dashboard</button>
          <button className={styles.logoutBtn} onClick={() => { logout(); nav('/'); }}>Logout</button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="Active" value={active.length} color="#22c55e" />
        <StatCard label="Pending" value={pending.length} color="#EF9F27" />
      </div>

      {/* Charts */}
      <UserCharts users={users} />

      {/* Pending activation */}
      {pending.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>⏳ Pending Activation ({pending.length})</h3>
          <UserTable users={pending} onEnable={handleEnable} onDelete={handleDelete} />
        </div>
      )}

      {/* All users */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>👥 All Users ({users.length})</h3>
        <UserTable users={users} onEnable={handleEnable} onDelete={handleDelete} />
      </div>
    </div>
  );
}

function UserTable({ users, onEnable, onDelete }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Name</th><th>Email</th><th>Country</th>
          <th>Role</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(u => (
          <tr key={u.id}>
            <td>{u.firstName} {u.lastName}</td>
            <td style={{ color: 'var(--text2)' }}>{u.email}</td>
            <td>{u.country === 'IR' ? '🇮🇷 Iran' : '🇸🇪 Sweden'}</td>
            <td><span className={u.role === 'ROLE_ADMIN' ? styles.badgeAdmin : styles.badgeUser}>
              {u.role === 'ROLE_ADMIN' ? 'Admin' : 'User'}
            </span></td>
            <td><span style={{ color: u.enabled ? '#22c55e' : '#EF9F27' }}>
              {u.enabled ? '● Active' : '● Pending'}
            </span></td>
            <td>
              <button
                className={u.enabled ? styles.disableBtn : styles.enableBtn}
                onClick={() => onEnable(u.id, u.enabled)}>
                {u.enabled ? 'Disable' : 'Enable'}
              </button>
              <button className={styles.deleteBtn} onClick={() => onDelete(u.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UserCharts({ users }) {
  if (!users.length) return null;

  const statusData = [
    { name: 'Active',  value: users.filter(u => u.enabled).length,  color: '#22c55e' },
    { name: 'Pending', value: users.filter(u => !u.enabled).length, color: '#EF9F27' },
  ].filter(d => d.value > 0);

  const roleData = [
    { name: 'Users',  value: users.filter(u => u.role !== 'ROLE_ADMIN').length },
    { name: 'Admins', value: users.filter(u => u.role === 'ROLE_ADMIN').length },
  ].filter(d => d.value > 0);

  const countryData = Object.entries(
    users.reduce((acc, u) => {
      const c = u.country || 'Other';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div style={{ display: 'flex', gap: 24, marginBottom: 28, flexWrap: 'wrap' }}>
      <ChartCard title="Status">
        <PieChart width={160} height={140}>
          <Pie data={statusData} dataKey="value" cx={80} cy={65} innerRadius={36} outerRadius={60}>
            {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4e', fontSize: 12 }} />
        </PieChart>
        <ChartLegend items={statusData} />
      </ChartCard>

      <ChartCard title="Roles">
        <PieChart width={160} height={140}>
          <Pie data={roleData} dataKey="value" cx={80} cy={65} innerRadius={36} outerRadius={60}>
            <Cell fill="#B8860B" />
            <Cell fill="#7c3aed" />
          </Pie>
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4e', fontSize: 12 }} />
        </PieChart>
        <ChartLegend items={roleData.map((d, i) => ({ ...d, color: ['#B8860B','#7c3aed'][i] }))} />
      </ChartCard>

      <ChartCard title="Countries" wide>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={countryData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
            <YAxis tick={{ fill: '#888', fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4e', fontSize: 12 }} />
            <Bar dataKey="value" fill="#B8860B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children, wide }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
      minWidth: wide ? 280 : 200, flex: wide ? 2 : 1,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function ChartLegend({ items }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6 }}>
      {items.map((d, i) => (
        <span key={i} style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
          {d.name} ({d.value})
        </span>
      ))}
    </div>
  );
}

function StatCard({ label, value, color = 'var(--text)' }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={{ color }}>{value}</div>
    </div>
  );
}
