import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AdminApp from './Admin';
import UserApp from './User';
import Login from './Login';
import { useAuth } from './context/AuthContext';
import Home from './pages/user/Home';
import BusSearch from './pages/user/BusSearch';
import CarRental from './pages/user/CarRental';
import MyBookings from './pages/user/MyBookings';
import Profile from './pages/user/Profile';
import Dashboard from './pages/admin/Dashboard';
import Vehicles from './pages/admin/Vehicles';
import AdminRoutesPage from './pages/admin/Routes';
import Bookings from './pages/admin/Bookings';
import Rentals from './pages/admin/Rentals';
import Customers from './pages/admin/Customers';
import Reports from './pages/admin/Reports';

const USER_ROUTES = {
  home: '/',
  search: '/booking/search',
  cars: '/cars',
  bookings: '/bookings',
  profile: '/profile'
};

const ADMIN_ROUTES = {
  dashboard: '/admin/dashboard',
  vehicles: '/admin/vehicles/buses',
  routes: '/admin/routes',
  bookings: '/admin/bookings',
  rentals: '/admin/rentals',
  customers: '/admin/customers',
  reports: '/admin/reports'
};

function App() {
  const { role, login, logout, setGuest, redirectToLogin, finishRedirect } = useAuth();

  return (
    <BrowserRouter>
      <LogoutListener shouldRedirect={redirectToLogin} onDone={finishRedirect} />
      <Routes>
        <Route path="/guest" element={<RoleRoute targetRole="guest" />} />
        <Route path="/user" element={<RoleRoute targetRole="user" />} />
        <Route path="/login" element={<LoginRoute role={role} onLogin={login} onGuest={setGuest} />} />
        <Route path="/register" element={<Login onLogin={login} onGuest={setGuest} initialView="register" />} />
        <Route path="/admin/*" element={<AdminRoute role={role} onLogout={logout} />} />
        <Route path="/*" element={<UserRoute role={role} onLogout={logout} />} />
      </Routes>
    </BrowserRouter>
  );
}

function RoleRoute({ targetRole }) {
  const { login } = useAuth();
  useEffect(() => {
    login(targetRole);
  }, [targetRole, login]);
  return <Navigate to="/" replace />;
}

function LoginRoute({ role, onLogin, onGuest }) {
  if (role !== 'guest') {
    return <Navigate to={role === 'admin' ? '/admin/dashboard' : '/'} replace />;
  }
  return <Login onLogin={onLogin} onGuest={onGuest} initialView="login" />;
}

function UserRoute({ role, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [bookingsTab, setBookingsTab] = useState('trips');
  const knownUserPaths = ['/', '/booking/search', '/booking/seats', '/booking/passenger', '/booking/payment', '/booking/success', '/cars', '/cars/details', '/cars/payment', '/cars/success', '/bookings', '/profile'];

  if (!knownUserPaths.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  const active =
    location.pathname.startsWith('/booking/')
      ? 'search'
      : location.pathname.startsWith('/cars')
        ? 'cars'
        : location.pathname === '/bookings'
          ? 'bookings'
          : location.pathname === '/profile'
            ? 'profile'
            : 'home';

  const goUserPage = (id) => {
    const target = USER_ROUTES[id] || USER_ROUTES.home;
    if (id === 'profile' && role === 'guest') {
      navigate('/login', { replace: true });
      return;
    }
    navigate(target);
  };

  let pageContent = <Home role={role} setActive={goUserPage} onLogout={onLogout} />;
  if (active === 'search') {
    pageContent = (
      <BusSearch
        role={role}
        setActive={goUserPage}
        onLogout={onLogout}
        setBookingsTab={setBookingsTab}
      />
    );
  } else if (active === 'cars') {
    pageContent = (
      <CarRental
        role={role}
        setActive={goUserPage}
        onLogout={onLogout}
        setBookingsTab={setBookingsTab}
      />
    );
  } else if (active === 'bookings') {
    pageContent = (
      <MyBookings
        role={role}
        setActive={goUserPage}
        onLogout={onLogout}
        bookingsTab={bookingsTab}
        setBookingsTab={setBookingsTab}
      />
    );
  } else if (active === 'profile') {
    if (role === 'guest') {
      return <Navigate to="/login" replace />;
    }
    pageContent = <Profile role={role} setActive={goUserPage} onLogout={onLogout} />;
  }

  return (
    <UserApp
      role={role}
      onLogout={onLogout}
      active={active}
      onNavigate={goUserPage}
      pageContent={pageContent}
    />
  );
}

function AdminRoute({ role, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (location.pathname === '/admin/vehicles' || location.pathname === '/admin/vehicles/') {
    return <Navigate to="/admin/vehicles/buses" replace />;
  }

  if (
    location.pathname.startsWith('/admin/vehicles/') &&
    !['/admin/vehicles/buses', '/admin/vehicles/rental-cars'].includes(location.pathname)
  ) {
    return <Navigate to="/admin/vehicles/buses" replace />;
  }

  const active =
    location.pathname.startsWith('/admin/vehicles')
      ? 'vehicles'
      : location.pathname === '/admin/routes'
        ? 'routes'
        : location.pathname === '/admin/bookings'
          ? 'bookings'
          : location.pathname === '/admin/rentals'
            ? 'rentals'
            : location.pathname === '/admin/customers'
              ? 'customers'
              : location.pathname === '/admin/reports'
                ? 'reports'
                : 'dashboard';

  const goAdminPage = (id) => {
    const target = ADMIN_ROUTES[id] || ADMIN_ROUTES.dashboard;
    navigate(target);
  };

  let pageContent = <Dashboard />;
  if (active === 'vehicles') pageContent = <Vehicles />;
  else if (active === 'routes') pageContent = <AdminRoutesPage />;
  else if (active === 'bookings') pageContent = <Bookings />;
  else if (active === 'rentals') pageContent = <Rentals />;
  else if (active === 'customers') pageContent = <Customers />;
  else if (active === 'reports') pageContent = <Reports />;

  return (
    <AdminApp
      onLogout={onLogout}
      active={active}
      onNavigate={goAdminPage}
      pageContent={pageContent}
    />
  );
}

export default App;

function LogoutListener({ shouldRedirect, onDone }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!shouldRedirect) return;
    navigate('/login', { replace: true });
    onDone();
  }, [shouldRedirect, navigate, onDone]);

  return null;
}
