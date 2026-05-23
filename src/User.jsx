import React, { useState, useEffect } from "react";
import { Icon, NAV, setupScrollReveal } from "./utils/sharedUser";
import TopNav from "./pages/user/TopNav";
import Home from "./pages/user/Home";
import BusSearch from "./pages/user/BusSearch";
import CarRental from "./pages/user/CarRental";
import MyBookings from "./pages/user/MyBookings";
import Profile from "./pages/user/Profile";
import AuthModal from "./pages/user/AuthModal";
import Footer from "./components/Footer";

const PAGES = {
  home: Home,
  search: BusSearch,
  cars: CarRental,
  bookings: MyBookings,
  profile: Profile,
};
export default function UserApp({ role, userId, onLogout }) {
  const [page, setPage] = useState("home");
  const [bookingsTab, setBookingsTab] = useState("trips");
  const [bookingsRefresh, setBookingsRefresh] = useState(0);
  const PageComp = PAGES[page] || Home;
  useEffect(() => {
    const cleanup = setupScrollReveal();
    return cleanup;
  }, [page]);
  return (
    <div
      className="app-container"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <TopNav
        active={page}
        setActive={setPage}
        role={role}
        userId={userId}
        onLogout={onLogout}
      />
      <div
        style={{
          flex: 1,
        }}
      >
        <PageComp
          role={role}
          userId={userId}
          isActive={page === "bookings"}
          setActive={setPage}
          onLogout={onLogout}
          bookingsTab={bookingsTab}
          setBookingsTab={setBookingsTab}
          bookingsRefresh={bookingsRefresh}
          setBookingsRefresh={setBookingsRefresh}
        />
      </div>
      <Footer />
    </div>
  );
}
