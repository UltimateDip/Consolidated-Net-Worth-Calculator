import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CHART_COLORS, formatCompact, cleanAssetName, truncateLabel } from '../../utils/formatters';
import { GlassTooltip } from './ChartUtils';

const TopHoldingsChart = ({ top5, baseCurrency }) => {
  // Clean names for the chart labels
  const chartData = top5.map(item => ({
    ...item,
    chartLabel: item.display_name || cleanAssetName(item.name)
  }));

  return (
    <div className="glass-panel" style={{ marginBottom: '30px' }}>
      <h3 style={{ marginBottom: '15px' }}>{top5.length >= 5 ? 'Top 5 Holdings' : 'Top Holdings'}</h3>
      {chartData.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" tickFormatter={formatCompact} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} />
            <YAxis 
              type="category" 
              dataKey="chartLabel" 
              width={130} 
              tickFormatter={(name) => truncateLabel(name, 15)}
              tick={{ fill: 'var(--text-primary)', fontSize: 11 }} 
              axisLine={false} 
            />
            <Tooltip 
              content={<GlassTooltip currency={baseCurrency} />} 
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              labelFormatter={(value, payload) => {
                if (payload && payload.length > 0) return payload[0].payload.name;
                return value;
              }}
            />
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
