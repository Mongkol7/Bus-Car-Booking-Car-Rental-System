import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => {
    if (typeof window === 'undefined') return 'guest';
    return window.localStorage.getItem('role') || 'guest';
  });
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('token') || '';
  });
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const [redirectToLogin, setRedirectToLogin] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('role', role);
      if (token) {
        window.localStorage.setItem('token', token);
      } else {
        window.localStorage.removeItem('token');
      }
      if (user) {
        window.localStorage.setItem('user', JSON.stringify(user));
      } else {
        window.localStorage.removeItem('user');
      }
    }
  }, [role, token, user]);

  const login = (authValue) => {
    if (typeof authValue === 'string') {
      setRole(authValue);
      setToken('');
      setUser(null);
      return;
    }

    setRole(authValue?.user?.role || 'guest');
    setToken(authValue?.token || '');
    setUser(authValue?.user || null);
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Logout request failed:', error);
      }
    }

    setRole('guest');
    setToken('');
    setUser(null);
    setRedirectToLogin(true);
  };

  const setGuest = () => {
    setRole('guest');
    setToken('');
    setUser(null);
  };

  const finishRedirect = () => {
    setRedirectToLogin(false);
  };

  return (
    <AuthContext.Provider value={{ role, token, user, login, logout, setGuest, redirectToLogin, finishRedirect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
