import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import useStore from './store/useStore';
import { LayoutDashboard, Settings as SettingsIcon, List } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import ManageAssets from './pages/ManageAssets';

function App() {
  const { fetchPortfolio, fetchSettings } = useStore();

  useEffect(() => {
    fetchSettings();
    fetchPortfolio();
  }, []);

  return (
    <Router>
      <div className="app-container">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Net Worth</h1>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutDashboard size={20} /> Dashboard
            </Link>
            <Link to="/edit" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <List size={20} /> Holdings
            </Link>
            <Link to="/settings" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SettingsIcon size={20} /> Settings
            </Link>
          </nav>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/edit" element={<ManageAssets />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
