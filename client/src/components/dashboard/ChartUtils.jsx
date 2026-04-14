import React from 'react';
import { formatCurrency } from '../../utils/formatters';

/**
 * Custom Recharts Tooltip with glassmorphism styling
 */
export const GlassTooltip = ({ active, payload, label, currency }) => {
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

/**
 * Custom Donut Label renderer for Recharts Pie charts
 */
export const renderDonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) => {
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
