import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../../components/Footer";
import {
  Icon,
  icons,
  setupScrollReveal,
  getCompanyMeta,
} from "../../utils/sharedUser";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeStatus(value) {
  if (!value) return "";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function generateQrMatrix(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const matrix = [];
  for (let y = 0; y < 8; y += 1) {
    const row = [];
    for (let x = 0; x < 8; x += 1) {
      const value = ((hash >>> ((x + y) % 32)) + x * 31 + y * 17) % 2;
      row.push(Boolean(value));
    }
    matrix.push(row);
  }
  return matrix;
}

export default function MyBookings({
  role,
  userId,
  bookingsTab,
  setBookingsTab,
  bookingsRefresh,
}) {
  const navigate = useNavigate();
  const tab = bookingsTab || "trips";
  const [qrOpen, setQrOpen] = useState(null);
  const [rentalFilter, setRentalFilter] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");
  const [bookings, setBookings] = useState({ trips: [], rentals: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cleanup = setupScrollReveal();
    return cleanup;
  }, [tab, rentalFilter, tripFilter]);

  useEffect(() => {
    if (role === "guest" || !userId) return;
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/bookings/user?user_id=${encodeURIComponent(userId)}`,
        );
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          setBookings({ trips: [], rentals: [] });
        } else {
          setBookings({
            trips: data.trips.map((item) => ({
              id: `#B-${item.id}`,
              type: "ticket",
              route: `${item.origin} → ${item.destination}`,
              company: item.company_name || item.bus_name || "Bus",
              price: `$${parseFloat(item.total_price).toFixed(2)}`,
              status: normalizeStatus(item.status),
              date: formatDate(item.departure_time),
              time: formatTime(item.departure_time),
              seat: item.seat_number,
              rawId: item.id,
            })),
            rentals: data.rentals.map((item) => {
              const start = formatDate(item.pickup_date);
              const end = formatDate(item.return_date);
              const days = Math.max(
                1,
                Math.round(
                  (new Date(item.return_date) - new Date(item.pickup_date)) /
                    (1000 * 60 * 60 * 24),
                ),
              );
              return {
                id: `#R-${item.id}`,
                type: "rental",
                route: item.car_name,
                price: `$${parseFloat(item.total_price).toFixed(2)}`,
                status: normalizeStatus(item.status),
                date: `${start} – ${end}`,
                time: `${days} day${days === 1 ? "" : "s"}`,
                seat: item.plate_number || "N/A",
                rawId: item.id,
              };
            }),
          });
          setError(null);
        }
      } catch (err) {
        setError(err.message || "Unable to load bookings");
        setBookings({ trips: [], rentals: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [role, userId, bookingsRefresh]);

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

      {currentBookings.length === 0 && !loading && !error && (
        <div
          className="card scroll-animate"
          style={{
            marginTop: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>
            No bookings found yet. Book a trip or rental and it will appear
            here.
          </p>
        </div>
      )}

      <div
        className="page-notice"
        style={{
          marginTop: 12,
          marginBottom: 16,
          color: "var(--text-3)",
          fontSize: 13,
        }}
      >
        {loading
          ? "Loading your bookings..."
          : error
            ? `Error: ${error}`
            : "Pull your latest trip and rental history from the database."}
      </div>

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
                        {generateQrMatrix(b.id).flatMap((row, y) =>
                          row.map((filled, x) => (
                            <div
                              key={`${y}-${x}`}
                              style={{
                                borderRadius: 1,
                                background: filled ? "#111" : "transparent",
                              }}
                            />
                          )),
                        )}
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
