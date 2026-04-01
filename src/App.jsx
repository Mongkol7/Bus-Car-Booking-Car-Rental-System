import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AdminApp from './Admin';
import UserApp from './User';
import Login from './Login';

function App() {
  const [role, setRole] = useState(() => {
    if (typeof window === 'undefined') return 'guest';
    return window.localStorage.getItem('role') || 'guest';
  });
  const [redirectToLogin, setRedirectToLogin] = useState(false);

  const handleLogin = (userRole) => {
    setRole(userRole);
  };

  const handleLogout = () => {
    setRole('guest');
    setRedirectToLogin(true);
  };

  const RoleRoute = ({ targetRole }) => {
    useEffect(() => {
      setRole(targetRole);
    }, [targetRole]);

    return <UserApp role={targetRole} onLogout={handleLogout} />;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('role', role);
    }
  }, [role]);

  return (
    <BrowserRouter>
      <LogoutListener shouldRedirect={redirectToLogin} onDone={() => setRedirectToLogin(false)} />
      <Routes>
        {/* User / Guest Landing Route */}
        <Route 
          path="/" 
          element={<UserApp role={role} onLogout={handleLogout} />} 
        />

        {/* Explicit Role Routes */}
        <Route path="/guest" element={<RoleRoute targetRole="guest" />} />
        <Route path="/user" element={<RoleRoute targetRole="user" />} />

        {/* Login Route */}
        <Route 
          path="/login" 
          element={
            role !== 'guest' ? 
            <Navigate to={role === 'admin' ? '/admin' : '/'} /> : 
            <Login onLogin={handleLogin} onGuest={() => setRole('guest')} initialView="login" />
          } 
        />

        {/* Register Route */}
        <Route 
          path="/register" 
          element={
            <Login onLogin={handleLogin} onGuest={() => setRole('guest')} initialView="register" />
          } 
        />

        {/* Admin Route Protection */}
        <Route 
          path="/admin" 
          element={
            role === 'admin' ? 
            <AdminApp onLogout={handleLogout} /> : 
            <Navigate to="/login" />
          } 
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {/* Guest Banner removed per request */}
    </BrowserRouter>
  );
}

export default App;

function LogoutListener({ shouldRedirect, onDone }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (shouldRedirect) {
      navigate('/login', { replace: true });
      onDone();
    }
  }, [shouldRedirect, navigate, onDone]);
  return null;
}
