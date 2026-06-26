import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{
            width: 52, height: 52, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-container))',
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 22, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(44, 42, 188, 0.3)',
          }}>
            K
          </div>
        </div>
        <h1 style={{ textAlign: 'center' }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="subtitle" style={{ textAlign: 'center' }}>
          {mode === 'login' ? 'Sign in to your Kanban AI workspace' : 'Start managing projects with AI'}
        </p>

        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 'var(--radius)',
            background: 'var(--error-container)', color: 'var(--on-error-container)',
            fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input
                className="input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? (
              <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button
          className="btn btn-secondary"
          style={{ width: '100%' }}
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
        >
          {mode === 'login' ? 'Create a new account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
