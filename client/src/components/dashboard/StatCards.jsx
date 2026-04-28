import React from 'react';
import { Briefcase, RefreshCw, TrendingUp, BarChart3, Coins, PieChart as PieIcon } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import AnimatedCounter from '../common/AnimatedCounter';

const StatCards = ({ 
  totalNetWorth, 
  baseCurrency, 
  isLoading, 
  assets, 
  largest, 
  largestPct, 
  topClass,
  totalAnnualDividend,
  autoRefresh,
  setAutoRefresh
}) => {
  return (
    <>
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
            <AnimatedCounter value={totalNetWorth} currency={baseCurrency} />
          </h1>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Auto-Refresh</span>
             <label className="switch">
                <input 
                  type="checkbox" 
                  checked={autoRefresh} 
                  onChange={(e) => setAutoRefresh(e.target.checked)} 
                />
                <span className="slider"></span>
             </label>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: isLoading ? 'var(--text-secondary)' : (autoRefresh ? 'var(--accent-success)' : 'var(--text-muted)'),
            backgroundColor: isLoading ? 'rgba(255, 255, 255, 0.1)' : (autoRefresh ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)'),
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
          }}>
            {isLoading ? <RefreshCw size={12} className="spin" /> : <TrendingUp size={12} />}
            {isLoading ? 'Syncing...' : (autoRefresh ? 'Monitoring Live' : 'Manual Refresh')}
          </div>
        </div>
      </div>

      {/* ========= STAT CARDS ========= */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalAnnualDividend ? 4 : 3}, 1fr)`, gap: '20px', marginBottom: '30px' }}>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <Coins size={24} style={{ color: 'var(--accent-primary)', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Tracked Assets</p>
          <h2 style={{ fontSize: '2rem', margin: '4px 0 0' }}>
            {assets.length}
          </h2>
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
        {totalAnnualDividend > 0 && (
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <TrendingUp size={24} style={{ color: '#10b981', marginBottom: '8px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Annual Dividend</p>
            <h3 style={{ fontSize: '1.2rem', margin: '4px 0 0', color: '#10b981' }}>
              {formatCurrency(totalAnnualDividend, baseCurrency)}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projected income</span>
          </div>
        )}
      </div>
    </>
  );
};

export default StatCards;
