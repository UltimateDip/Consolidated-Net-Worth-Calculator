import React from 'react';
import { Briefcase, RefreshCw, TrendingUp, BarChart3, Coins, PieChart as PieIcon } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const StatCards = ({ totalNetWorth, baseCurrency, isLoading, assets, largest, largestPct, topClass }) => {
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
    </>
  );
};

export default StatCards;
