import React, { useState } from 'react';
import useStore from '../store/useStore';
import { LogIn, UserPlus } from 'lucide-react';
import './Login.css';

const Login = () => {
  const { login, register } = useStore();
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorStr, setErrorStr] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorStr('');
    setIsLoading(true);

    try {
      if (isLoginView) {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      setErrorStr(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="glass-card login-card">
        <div className="login-header">
          <div className="logo-icon aura-glow">✧</div>
          <h2>AssetAura</h2>
          <p>{isLoginView ? 'Welcome back to your private wealth.' : 'Start tracking your financial future.'}</p>
        </div>

        {errorStr && <div className="error-message">{errorStr}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              placeholder="admin"
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Authenticating...' : (isLoginView ? <><LogIn size={18}/> Login</> : <><UserPlus size={18}/> Register Account</>)}
          </button>
        </form>

        <div className="login-footer">
          <button 
            type="button" 
            className="text-btn toggle-view-btn" 
            onClick={() => setIsLoginView(!isLoginView)}
          >
            {isLoginView ? "Don't have an account? Register." : "Already have an account? Login."}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
