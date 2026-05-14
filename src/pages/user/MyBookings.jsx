import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../../components/Footer";
import {
  Icon,
  icons,
  setupScrollReveal,
  NAV,
  getCompanyMeta,
} from "../../utils/sharedUser";

export default function MyBookings({ role, bookingsTab, setBookingsTab }) {
  const navigate = useNavigate();
  const tab = bookingsTab || "trips";
  const [qrOpen, setQrOpen] = useState(null);
  const [rentalFilter, setRentalFilter] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");
  useEffect(() => {
    const cleanup = setupScrollReveal();
    return cleanup;
  }, [tab, rentalFilter, tripFilter]);
  if (role === "guest")
    return (
      <div
        className="page scroll-animate"
        style={{
          textAlign: "center",
        }}
      >
        <div
          className="confirm-icon"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
            width: 60,
            height: 60,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 24,
          }}
        >
          🎫
        </div>
        <div className="page-title">Sign in to see bookings</div>
        <button
          className="btn btn-primary"
          style={{
            marginTop: 20,
          }}
          onClick={() => navigate("/login")}
        >
          Sign in now
        </button>
      </div>
    );
  const bookings = {
    trips: [
      {
        id: "#B-4811",
        type: "ticket",
        route: "Phnom Penh → Siem Reap",
        company: "Mekong Express",
        price: "$12.00",
        status: "Confirmed",
        date: "Apr 5, 2026",
        time: "06:00",
        seat: "A2",
      },
      {
        id: "#B-4795",
        type: "ticket",
        route: "Phnom Penh → Kampot",
        company: "Sorya Bus",
        price: "$8.00",
        status: "Completed",
        date: "Mar 12, 2026",
        time: "09:00",
        seat: "A5",
      },
    ],
    rentals: [
      {
        id: "#R-205",
        type: "rental",
        route: "Toyota Camry",
        price: "$135.00",
        status: "Returned",
        date: "Mar 28 – Apr 3",
        time: "3 days",
        seat: "PP-1122",
      },
      {
        id: "#R-202",
        type: "rental",
        route: "Honda CRV",
        price: "$130.00",
        status: "Pending",
        date: "Apr 5 – Apr 7",
        time: "2 days",
        seat: "PP-3344",
      },
    ],
  };
  const filteredRentals = (bookings.rentals || []).filter((b) => {
    if (rentalFilter === "all") return true;
    return b.status.toLowerCase() === rentalFilter;
  });
  const filteredTrips = (bookings.trips || []).filter((b) => {
    if (tripFilter === "all") return true;
    const isPast = (b.status || "").toLowerCase() === "completed";
    return tripFilter === "past" ? isPast : !isPast;
  });
  const tripBookings = filteredTrips;
  const currentBookings =
    tab === "rentals" ? filteredRentals : tab === "trips" ? tripBookings : [];
  return (
    <div
      className="page"
      style={{
        maxWidth: 640,
      }}
    >
      <div className="page-title">My bookings</div>
      <div className="page-sub">Track all your travel activity</div>

      <div
        className="pill-nav"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          {[
            {
              id: "trips",
              label: "Trips",
            },
            {
              id: "rentals",
              label: "Rentals",
            },
          ].map((t) => (
            <div
              key={t.id}
              className={`pill-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => {
                if (setBookingsTab) setBookingsTab(t.id);
              }}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>
      {tab === "rentals" && (
        <div
          className="pill-nav"
          style={{
            marginTop: -6,
            marginBottom: 20,
          }}
        >
          {[
            {
              id: "all",
              label: "All",
            },
            {
              id: "pending",
              label: "Pending",
            },
            {
              id: "returned",
              label: "Returned",
            },
          ].map((f) => (
            <div
              key={f.id}
              className={`pill-tab ${rentalFilter === f.id ? "active" : ""}`}
              onClick={() => setRentalFilter(f.id)}
            >
              {f.label}
            </div>
          ))}
        </div>
      )}
      {tab === "trips" && (
        <div
          className="pill-nav"
          style={{
            marginTop: -6,
            marginBottom: 20,
          }}
        >
          {[
            {
              id: "all",
              label: "All",
            },
            {
              id: "upcoming",
              label: "Upcoming",
            },
            {
              id: "past",
              label: "Past",
            },
          ].map((f) => (
            <div
              key={f.id}
              className={`pill-tab ${tripFilter === f.id ? "active" : ""}`}
              onClick={() => setTripFilter(f.id)}
            >
              {f.label}
            </div>
          ))}
        </div>
      )}

      {currentBookings.map((b, i) => (
        <div
          key={b.id}
          className="booking-item ticket-card scroll-animate"
          style={{
            "--delay": `${i * 40}ms`,
          }}
        >
          <div className="booking-header">
            <div>
              <span
                className={`badge ${b.type === "ticket" ? "badge-blue" : "badge-purple"}`}
                style={{
                  marginBottom: 6,
                  fontSize: 9,
                }}
              >
                {b.type === "ticket" ? "BUS TICKET" : "CAR RENTAL"}
              </span>
              <div className="booking-route">{b.route}</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                }}
              >
                {b.id} · {b.date}
              </div>
              {b.type === "ticket" && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: getCompanyMeta(b.company).color,
                    }}
                  />
                  <span
                    style={{
                      color: getCompanyMeta(b.company).color,
                    }}
                  >
                    {b.company}
                  </span>
                </div>
              )}
            </div>
            <span
              className={`badge ${b.status === "Confirmed" ? "badge-green" : b.status === "Completed" || b.status === "Returned" ? "badge-purple" : "badge-amber"}`}
            >
              {b.status}
            </span>
          </div>
          <div className="booking-meta">
            <div className="booking-meta-item">
              {b.type === "ticket" ? "Departure" : "Duration"}
              <span>{b.time}</span>
            </div>
            <div className="booking-meta-item">
              {b.type === "ticket" ? "Seat" : "Plate"}
              <span>{b.seat}</span>
            </div>
            {b.type === "ticket" && (
              <div className="booking-meta-item">
                Bus
                <span
                  style={{
                    color: getCompanyMeta(b.company).color,
                  }}
                >
                  {b.company}
                </span>
              </div>
            )}
            <div className="booking-meta-item">
              Paid<span>{b.price}</span>
            </div>
          </div>

          {(b.status === "Confirmed" || b.status === "Completed") &&
            b.type === "ticket" && (
              <div
                style={{
                  marginTop: 12,
                  borderTop: "0.5px solid var(--glass-border)",
                  paddingTop: 12,
                }}
              >
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQrOpen(qrOpen === b.id ? null : b.id)}
                >
                  <Icon d={icons.qr} size={13} />{" "}
                  {qrOpen === b.id ? "Hide Ticket" : "Show Ticket"}
                </button>

                {qrOpen === b.id && (
                  <div className="qr-reveal">
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-2)",
                      }}
                    >
                      Scan at boarding gate
                    </div>
                    <div className="qr-mini">
                      <div className="qr-mini-grid">
                        {Array.from({ length: 64 }, (_, i) => {
                          // Deterministic pattern based on booking ID to keep it stable across renders
                          const isDark =
                            (b.id
                              .split("")
                              .reduce(
                                (acc, char) => acc + char.charCodeAt(0),
                                0,
                              ) +
                              i) %
                              2 ===
                            0;
                          return (
                            <div
                              key={i}
                              style={{
                                borderRadius: 1,
                                background: isDark ? "#111" : "transparent",
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-3)",
                      }}
                    >
                      {b.id} · {b.route}
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      ))}
    </div>
  );
}
