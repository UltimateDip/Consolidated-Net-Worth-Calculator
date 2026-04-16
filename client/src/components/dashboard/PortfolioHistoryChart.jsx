import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCompact } from '../../utils/formatters';
import { GlassTooltip } from './ChartUtils';

const PortfolioHistoryChart = ({ historyData, baseCurrency }) => {
  return (
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
            <YAxis 
              tickFormatter={formatCompact} 
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
              axisLine={false}
              domain={['auto', 'auto']}
              hide={false}
            />
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
  );
};

export default PortfolioHistoryChart;
