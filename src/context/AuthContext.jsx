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
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      window.localStorage.removeItem('user');
      return null;
    }
  });

  const [redirectToLogin, setRedirectToLogin] = useState(false);

  useEffect(() => {
    if (!token) return undefined;

    const controller = new AbortController();

    async function hydrateUserFromToken() {
      try {
        const response = await fetch('/api/my/profile', {
          headers: {
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });

        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) {
            setRole('guest');
            setToken('');
            setUser(null);
          }
          return;
        }

        const data = await response.json();
        if (data?.user) {
          setUser(data.user);
          setRole(data.user.role || 'user');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to restore user session:', error);
        }
      }
    }

    hydrateUserFromToken();

    return () => controller.abort();
  }, [token]);

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

  const updateUser = (patch) => {
    setUser((current) => current ? { ...current, ...patch } : patch);
    if (patch?.role) setRole(patch.role);
  };

  const finishRedirect = () => {
    setRedirectToLogin(false);
  };

  return (
    <AuthContext.Provider value={{ role, token, user, login, logout, setGuest, updateUser, redirectToLogin, finishRedirect }}>
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
