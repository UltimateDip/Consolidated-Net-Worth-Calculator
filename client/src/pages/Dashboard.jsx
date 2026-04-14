import useStore from '../store/useStore';
import { Briefcase, RefreshCw, TrendingUp, BarChart3, Coins, PieChart as PieIcon } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts';

// --- Theme / Color Constants ---
const CHART_COLORS = [
  '#10b981', // emerald
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
];

const formatCurrency = (amount, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toLocaleString()}`;
  }
};

const formatCompact = (val) => {
  if (val >= 1e7) return `${(val / 1e7).toFixed(2)}Cr`;
  if (val >= 1e5) return `${(val / 1e5).toFixed(2)}L`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toFixed(0);
};

// --- Custom Recharts Tooltip ---
const GlassTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'rgba(20, 22, 28, 0.92)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      padding: '10px 14px',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {label && <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
          {entry.name}: {typeof entry.value === 'number' ? formatCurrency(entry.value, currency) : entry.value}
        </p>
      ))}
    </div>
  );
};

// --- Donut Label Renderer ---
const renderDonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) => {
  if (percent < 0.05) return null; // Don't label tiny slices
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="var(--text-primary)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: '0.75rem' }}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
};

const Dashboard = () => {
  const { totalNetWorth, baseCurrency, assets, isLoading, portfolioHistory } = useStore();

  // --- Derived Data ---

  // Asset Allocation by Type
  const allocationData = Object.values(
    assets.reduce((acc, asset) => {
      const type = asset.type || 'OTHER';
      if (!acc[type]) acc[type] = { name: type, value: 0 };
      acc[type].value += asset.totalValue || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);

  // Currency Exposure
  const currencyData = Object.values(
    assets.reduce((acc, asset) => {
      const cur = asset.currency || 'USD';
      if (!acc[cur]) acc[cur] = { name: cur, value: 0 };
      acc[cur].value += asset.totalValue || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);

  // Top 5 Holdings
  const top5 = [...assets]
    .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
    .slice(0, 5)
    .map(a => ({ name: a.name, value: Math.round(a.totalValue || 0) }));

  // Largest Holding
  const largest = assets.length > 0
    ? [...assets].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))[0]
    : null;
  const largestPct = largest && totalNetWorth > 0
    ? ((largest.totalValue / totalNetWorth) * 100).toFixed(1)
    : 0;

  // Top Asset Class
  const topClass = allocationData.length > 0 ? allocationData[0] : null;

  // History for Area Chart
  const historyData = portfolioHistory.map(s => ({
    date: s.date,
    value: s.total_value,
  }));

  // Initial load screen
  if (isLoading && assets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
        <RefreshCw size={32} className="spin" style={{ marginBottom: '20px', color: 'var(--accent-primary)' }} />
        <h2>Loading Portfolio Data...</h2>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">

      {/* ========= TOP BANNER ========= */}
      <div className="glass-panel" style={{
        marginBottom: '30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(26, 29, 36, 0.8), rgba(40, 44, 52, 0.9))',
      }}>
        <div>
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Briefcase size={20} /> Total Net Worth
          </p>
          <h1 style={{ fontSize: '3rem', margin: '10px 0 0 0', color: 'var(--accent-primary)' }}>
            {formatCurrency(totalNetWorth, baseCurrency)}
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: isLoading ? 'var(--text-secondary)' : 'var(--accent-success)',
            backgroundColor: isLoading ? 'rgba(255, 255, 255, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '0.9rem',
          }}>
            {isLoading ? <RefreshCw size={14} className="spin" /> : <TrendingUp size={14} />}
            {isLoading ? 'Syncing...' : 'Live Sync'}
          </div>
        </div>
      </div>

      {/* ========= STAT CARDS ========= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <Coins size={24} style={{ color: 'var(--accent-primary)', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Tracked Assets</p>
          <h2 style={{ fontSize: '2rem', margin: '4px 0 0' }}>{assets.length}</h2>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <BarChart3 size={24} style={{ color: '#f59e0b', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Largest Holding</p>
          <h3 style={{ fontSize: '1.2rem', margin: '4px 0 0', color: '#f59e0b' }}>{largest?.name || '—'}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{largestPct}% of portfolio</span>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <PieIcon size={24} style={{ color: '#6366f1', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Top Asset Class</p>
          <h3 style={{ fontSize: '1.2rem', margin: '4px 0 0', color: '#6366f1' }}>{topClass?.name || '—'}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {topClass ? formatCurrency(topClass.value, baseCurrency) : '—'}
          </span>
        </div>
      </div>

      {/* ========= CHARTS ROW 1: Allocation + Currency ========= */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>

        {/* Asset Allocation Donut */}
        <div className="glass-panel">
          <h3 style={{ marginBottom: '15px' }}>Asset Allocation</h3>
          {allocationData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={renderDonutLabel}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {allocationData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<GlassTooltip currency={baseCurrency} />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Currency Exposure */}
        <div className="glass-panel">
          <h3 style={{ marginBottom: '15px' }}>Currency Exposure</h3>
          {currencyData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={currencyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={renderDonutLabel}
                  animationBegin={200}
                  animationDuration={800}
                >
                  {currencyData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<GlassTooltip currency={baseCurrency} />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ========= CHARTS ROW 2: Top 5 Holdings ========= */}
      <div className="glass-panel" style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '15px' }}>Top 5 Holdings</h3>
        {top5.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={top5} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tickFormatter={formatCompact} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text-primary)', fontSize: 12 }} axisLine={false} />
              <Tooltip content={<GlassTooltip currency={baseCurrency} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" name="Value" radius={[0, 6, 6, 0]} animationDuration={1000}>
                {top5.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ========= CHARTS ROW 3: Historical Net Worth ========= */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '15px' }}>Portfolio History</h3>
        {historyData.length < 2 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Historical data will appear here as your portfolio is tracked over multiple days.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} />
              <YAxis tickFormatter={formatCompact} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} />
              <Tooltip content={<GlassTooltip currency={baseCurrency} />} />
              <Area
                type="monotone"
                dataKey="value"
                name="Net Worth"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
