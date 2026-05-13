import React, { useEffect } from 'react';
import { setupScrollReveal } from './utils/sharedUser';
import TopNav from './pages/user/TopNav';
import Footer from './components/Footer';

export default function UserApp({ role, onLogout, active, onNavigate, pageContent }) {
  useEffect(() => {
    const cleanup = setupScrollReveal();
    return cleanup;
  }, [active]);

  return (
    <div
      className="app-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh'
      }}
    >
      <TopNav active={active} setActive={onNavigate} role={role} onLogout={onLogout} />
      <div style={{ flex: 1 }}>{pageContent}</div>
      <Footer />
    </div>
  );
}
