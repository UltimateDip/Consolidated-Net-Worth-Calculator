import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, Home } from 'lucide-react';

const PUNCHLINES = [
  "This page is like a bad investment: it yielded exactly nothing.",
  "404: Asset not found. Did you forget to diversify?",
  "Looks like this URL went bankrupt.",
  "We searched the ledger, but this page has a zero balance.",
  "Market crash! Just kidding, it's just a 404 page.",
  "This page was depreciated to zero.",
  "404 Error: Your navigation strategy needs rebalancing.",
  "We couldn't find this page. Maybe it's hidden in an offshore account?"
];

const NotFound = () => {
  const [punchline, setPunchline] = useState('');

  useEffect(() => {
    // Pick a random punchline on mount
    const randomIndex = Math.floor(Math.random() * PUNCHLINES.length);
    setPunchline(PUNCHLINES[randomIndex]);
  }, []);

  return (
    <div className="glass-panel animate-fade-in" style={{ 
      maxWidth: '600px', 
      margin: '40px auto', 
      textAlign: 'center',
      padding: '40px' 
    }}>
      <TrendingDown size={64} color="var(--accent-primary)" style={{ marginBottom: '20px' }} />
      <h2 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>404</h2>
      <h3 style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Page Not Found</h3>
      
      <p style={{ 
        fontSize: '1.1rem', 
        lineHeight: '1.6', 
        marginBottom: '40px',
        fontStyle: 'italic',
        color: 'var(--text-primary)'
      }}>
        "{punchline}"
      </p>

      <Link to="/" className="btn-primary" style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '8px', 
        textDecoration: 'none' 
      }}>
        <Home size={18} />
        Return to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
