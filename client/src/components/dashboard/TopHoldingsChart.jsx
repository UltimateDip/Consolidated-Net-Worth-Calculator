import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CHART_COLORS, formatCompact } from '../../utils/formatters';
import { GlassTooltip } from './ChartUtils';

const TopHoldingsChart = ({ top5, baseCurrency }) => {
  return (
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
  );
};

export default TopHoldingsChart;
