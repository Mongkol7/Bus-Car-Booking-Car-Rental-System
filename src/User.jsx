
import React, { useState, useEffect } from 'react';
import { Icon, icons, NAV, setupScrollReveal } from './utils/sharedUser';
import TopNav from './pages/user/TopNav';
import Home from './pages/user/Home';
import BusSearch from './pages/user/BusSearch';
import CarRental from './pages/user/CarRental';
import MyBookings from './pages/user/MyBookings';
import Profile from './pages/user/Profile';
import AuthModal from './pages/user/AuthModal';
import { useNavigate } from 'react-router-dom';
import { carModels } from './data/transportData';
import Footer from './components/Footer';

const PAGES = {
  home: Home,
  search: BusSearch,
  cars: CarRental,
  bookings: MyBookings,
  profile: Profile
};
export default function UserApp({
  role,
  onLogout
}) {
  const [page, setPage] = useState('home');
  const [bookingsTab, setBookingsTab] = useState('trips');
  const PageComp = PAGES[page] || Home;
  useEffect(() => {
    const cleanup = setupScrollReveal();
    return cleanup;
  }, [page]);
  return <div className="app-container" style={{
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh'
  }}>
      
      <TopNav active={page} setActive={setPage} role={role} onLogout={onLogout} />
      <div style={{
      flex: 1
    }}>
        <PageComp role={role} setActive={setPage} onLogout={onLogout} bookingsTab={bookingsTab} setBookingsTab={setBookingsTab} />
      </div>
      <Footer />
    </div>;
}


