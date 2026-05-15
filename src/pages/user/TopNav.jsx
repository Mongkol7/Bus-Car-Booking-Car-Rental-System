import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../../components/Footer";
import { Icon, icons, NAV } from "../../utils/sharedUser";

export default function TopNav({ active, setActive, role, userId, onLogout }) {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    if (role === "guest" || !userId) {
      return;
    }

    const fetchUserProfile = async () => {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!data.error) {
          setUserInfo(data);
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    };

    fetchUserProfile();
  }, [role, userId]);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);
  return (
    <>
      <nav className="topnav">
        <div
          className="topnav-logo"
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
          onClick={() => {
            setActive("home");
            navigate("/");
          }}
        >
          Book<span className="logo-dot">.</span>
          <span className="logo-ride">Ride</span>
        </div>
        <div className="topnav-links">
          {NAV.map((n) => (
            <div
              key={n.id}
              className={`topnav-link ${active === n.id ? "active" : ""}`}
              onClick={() => setActive(n.id)}
            >
              <span className="topnav-icon">
                <Icon d={icons[n.icon]} size={14} />
              </span>
              {n.label}
            </div>
          ))}
        </div>
        <div
          className="topnav-right"
          style={{
            position: "relative",
          }}
          ref={menuRef}
        >
          {role === "guest" ? (
            <button className="login-btn" onClick={() => navigate("/login")}>
              Login
            </button>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-2)",
              }}
            >
              Welcome, {userInfo ? `${userInfo.first_name}` : "..."}
            </div>
          )}
          <div
            className="avatar-sm"
            onClick={() => {
              if (role !== "guest") setMenuOpen((prev) => !prev);
            }}
          >
            {role === "guest"
              ? "?"
              : userInfo
                ? `${(userInfo.first_name || "")[0]}${(userInfo.last_name || "")[0]}`.toUpperCase()
                : "?"}
          </div>
          {role !== "guest" && (
            <div className={`user-menu ${menuOpen ? "open" : ""}`}>
              <div className="user-menu-item" onClick={onLogout}>
                <Icon d={icons.logout} size={12} /> Logout
              </div>
            </div>
          )}
        </div>
      </nav>
      <div className="bottomnav">
        {NAV.map((n) => {
          const mobileLabel =
            {
              home: "Home",
              search: "Bus booking",
              cars: "Car rental",
              bookings: "My booking",
              profile: "Profile",
            }[n.id] || n.label;
          return (
            <div
              key={`bottom-${n.id}`}
              className={`bottomnav-link ${active === n.id ? "active" : ""}`}
              onClick={() => setActive(n.id)}
            >
              <span className="bottomnav-icon">
                <Icon d={icons[n.icon]} size={12} />
              </span>
              {mobileLabel}
            </div>
          );
        })}
      </div>
    </>
  );
}
