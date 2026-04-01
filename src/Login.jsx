import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --glass: rgba(255,255,255,0.07);
    --glass-border: rgba(255,255,255,0.12);
    --glass-strong: rgba(255,255,255,0.15);
    --text: #f0f0f5;
    --text-2: rgba(240,240,245,0.55);
    --accent: #4f8ef7;
    --accent-soft: rgba(79,142,247,0.15);
    --radius: 16px;
    --radius-xs: 7px;
    --blur: blur(24px) saturate(180%);
    --font: 'DM Sans', sans-serif;
  }

  .auth-wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,142,247,0.12) 0%, transparent 70%);
    background-color: var(--bg);
    color: var(--text);
    font-family: var(--font);
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
    transform: translateY(0);
    transition: transform 0.3s ease;
  }

  .auth-logo {
    text-align: center;
    margin-bottom: 32px;
  }

  .auth-logo-mark {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text);
  }

  .auth-logo-mark .logo-dot {
    color: var(--accent);
    display: inline-block;
    text-shadow: 0 0 10px rgba(79,142,247,1), 0 0 24px rgba(79,142,247,0.9), 0 0 40px rgba(79,142,247,0.7);
    animation: logoPulse 1.2s ease-in-out infinite;
  }
  .auth-logo-mark .logo-ride { color: var(--accent); }

  .card {
    background: var(--glass);
    backdrop-filter: var(--blur);
    border: 0.5px solid var(--glass-border);
    border-radius: var(--radius);
    padding: 32px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
  }

  .auth-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
    text-align: center;
  }

  .auth-sub {
    font-size: 14px;
    color: var(--text-2);
    margin-bottom: 28px;
    text-align: center;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
    margin-bottom: 8px;
    display: block;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255,255,255,0.03);
    border: 0.5px solid var(--glass-border);
    border-radius: var(--radius-xs);
    color: var(--text);
    font-size: 14px;
    font-family: var(--font);
    outline: none;
    transition: all 0.2s;
  }

  input:focus {
    border-color: var(--accent);
    background: rgba(255,255,255,0.07);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 14px;
    border-radius: var(--radius-xs);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    font-family: var(--font);
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

  .btn-ghost {
    background: transparent;
    color: var(--text-2);
    border: 0.5px solid var(--glass-border);
    margin-top: 12px;
  }

  .btn-ghost:hover { background: var(--glass); color: var(--text); }

  .auth-link {
    display: block;
    text-align: center;
    margin-top: 24px;
    font-size: 13px;
    color: var(--text-2);
  }

  .auth-link span {
    color: var(--accent);
    cursor: pointer;
    font-weight: 600;
    margin-left: 6px;
    text-decoration: underline;
  }

  .back-btn {
    position: absolute;
    top: 24px;
    left: 24px;
    background: var(--glass);
    border: 0.5px solid var(--glass-border);
    color: var(--text-2);
    width: 38px;
    height: 38px;
    padding: 0;
    border-radius: 50%;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    z-index: 100;
    justify-content: center;
  }
  .back-btn:hover { background: var(--glass-strong); color: var(--text); }

  .divider-or {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 24px 0;
  }

  .divider-or::before, .divider-or::after {
    content: '';
    flex: 1;
    height: 0.5px;
    background: var(--glass-border);
  }

  .divider-or span {
    font-size: 11px;
    color: var(--text-2);
    text-transform: uppercase;
  }

  .error-msg {
    color: #f87171;
    font-size: 12px;
    margin-top: 12px;
    text-align: center;
  }

  @keyframes logoPulse {
    0%, 100% { opacity: 0.6; transform: scale(0.96); text-shadow: 0 0 8px rgba(79,142,247,0.8), 0 0 18px rgba(79,142,247,0.7); }
    40% { opacity: 1; transform: scale(1.08); text-shadow: 0 0 16px rgba(79,142,247,1), 0 0 36px rgba(79,142,247,0.95), 0 0 54px rgba(79,142,247,0.8); }
    70% { opacity: 0.85; transform: scale(1.02); text-shadow: 0 0 12px rgba(79,142,247,0.95), 0 0 28px rgba(79,142,247,0.85); }
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 700px) {
    .auth-wrap { padding: 16px; }
    .auth-logo-mark { font-size: 26px; }
    .card { padding: 24px; }
    .auth-sub { font-size: 13px; }
  }

  @media (max-width: 520px) {
    .auth-card { max-width: 100%; }
    .card { padding: 20px; }
    .btn { padding: 12px; font-size: 13px; }
    .label { font-size: 11px; }
    .back-btn { top: 16px; left: 16px; font-size: 12px; width: 34px; height: 34px; }
  }
`;

export default function AuthPage({ onLogin, onGuest, initialView = 'login' }) {
  const navigate = useNavigate();
  const [view, setView] = useState(initialView); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      const storedRole = window.localStorage.getItem('role');
      if (storedRole === 'admin') {
        navigate('/admin');
        return;
      }
    }
    navigate('/');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'Admin' && password === '123') {
      onLogin('admin');
      navigate('/admin');
    } else if (username === 'User' && password === '123') {
      onLogin('user');
      navigate('/');
    } else {
      setError('Invalid username or password');
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    alert('Congratulations! Account created. Please login.');
    setView('login');
  };

  const handleGuest = () => {
    onGuest();
    navigate('/');
  };

  return (
    <div className="auth-wrap">
      <style>{css}</style>
      
      <div className="back-btn" onClick={handleBack} aria-label="Back" title="Back">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">Book<span className="logo-dot">.</span><span className="logo-ride">Ride</span></div>
          <div className="auth-logo-sub" style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Bus & Car Booking + Car Rental</div>
        </div>
        
        {view === 'login' ? (
          <div className="card">
            <div className="auth-title">Welcome back</div>
            <div className="auth-sub">Sign in to manage your travels</div>
            
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="label">Username</label>
                <input 
                  type="text" 
                  placeholder="Admin or User" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="label">Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <button type="submit" className="btn btn-primary">Sign in</button>
              
              {error && <div className="error-msg">{error}</div>}
            </form>
            
            <div className="divider-or"><span>or</span></div>
            <button className="btn btn-ghost" onClick={handleGuest}>Continue as Guest</button>
            
            <div className="auth-link">
              No account? <span onClick={() => setView('register')}>Register now</span>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="auth-title">Create Account</div>
            <div className="auth-sub">Join thousands of travelers</div>
            
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="label">Full Name</label>
                <input type="text" placeholder="John Doe" required />
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input type="email" placeholder="john@example.com" required />
              </div>
              <div className="form-group">
                <label className="label">Password</label>
                <input type="password" placeholder="••••••••" required />
              </div>
              
              <button type="submit" className="btn btn-primary">Sign up</button>
            </form>
            
            <div className="auth-link">
              Already have an account? <span onClick={() => setView('login')}>Sign in</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
