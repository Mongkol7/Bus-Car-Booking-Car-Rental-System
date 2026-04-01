import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminApp from './Admin';
import UserApp from './User';
import Login from './Login';

function App() {
  const [role, setRole] = useState('guest'); // default to guest (Unknown User)

  const handleLogin = (userRole) => {
    setRole(userRole);
  };

  const handleLogout = () => {
    setRole('guest');
    window.location.href = '/login';
  };

  const RoleRoute = ({ targetRole }) => {
    useEffect(() => {
      setRole(targetRole);
    }, [targetRole]);

    return <UserApp role={targetRole} onLogout={handleLogout} />;
  };

  return (
    <BrowserRouter>
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

      {/* Guest Banner logic moved into UserApp or kept here */}
      {role === 'guest' && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          zIndex: 1000,
          padding: '10px 20px',
          background: 'rgba(79, 142, 247, 0.1)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(79, 142, 247, 0.2)',
          borderRadius: '12px',
          color: '#4f8ef7',
          fontSize: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          pointerEvents: 'none'
        }}>
          Browsing as <strong>Guest</strong>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
