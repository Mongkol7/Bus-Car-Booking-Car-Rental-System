import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => {
    if (typeof window === 'undefined') return 'guest';
    return window.localStorage.getItem('role') || 'guest';
  });

  const [redirectToLogin, setRedirectToLogin] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('role', role);
    }
  }, [role]);

  const login = (userRole) => {
    setRole(userRole);
  };

  const logout = () => {
    setRole('guest');
    setRedirectToLogin(true);
  };

  const setGuest = () => {
    setRole('guest');
  };

  const finishRedirect = () => {
    setRedirectToLogin(false);
  };

  return (
    <AuthContext.Provider value={{ role, login, logout, setGuest, redirectToLogin, finishRedirect }}>
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
