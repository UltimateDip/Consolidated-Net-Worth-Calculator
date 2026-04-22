import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '../../utils/formatters';
import { GlassTooltip, renderDonutLabel } from './ChartUtils';

const AllocationCharts = ({ allocationData, currencyData, baseCurrency }) => {
  return (
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
  );
};

export default AllocationCharts;
