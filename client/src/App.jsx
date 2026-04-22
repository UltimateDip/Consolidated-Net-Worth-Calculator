import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import useStore from './store/useStore';
import { LayoutDashboard, Settings as SettingsIcon, List, LogOut } from 'lucide-react';
import Login from './pages/Login';

import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import ManageAssets from './pages/ManageAssets';
import NotFound from './pages/NotFound';

function App() {
  const { isAuthenticated, fetchPortfolio, fetchSettings, logout, user } = useStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
      fetchPortfolio();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
    };
    window.addEventListener('auth_expired', handleAuthExpired);
    return () => window.removeEventListener('auth_expired', handleAuthExpired);
  }, [logout]);

  return (
    <Router>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <div className="app-container">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h1 style={{ margin: 0 }}>AssetAura</h1>
            </Link>
            <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LayoutDashboard size={20} /> Dashboard
              </Link>
              <Link to="/edit" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <List size={20} /> Holdings
              </Link>
              <Link to="/settings" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SettingsIcon size={20} /> Settings
              </Link>
              <button 
                onClick={logout}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '1rem', padding: '0.5rem', borderRadius: '4px' }}
                className="text-btn"
                title={`Logged in as ${user?.username}`}
              >
                <LogOut size={20} /> Logout
              </button>
            </nav>
          </header>

          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/edit" element={<ManageAssets />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      )}
    </Router>
  );
}

export default App;
