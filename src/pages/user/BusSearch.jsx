import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { carModels } from "../../data/transportData";
import Footer from "../../components/Footer";
import {
  Icon,
  icons,
  setupScrollReveal,
  NAV,
  companyMeta,
  getCompanyMeta,
  getTodayISO,
} from "../../utils/sharedUser";
import AuthModal from "./AuthModal";

function formatApiRouteRows(data) {
  return data.map((r) => {
    const dep = new Date(r.departure_time);
    const arr = new Date(r.arrival_time);
    const durationMs = Math.max(0, arr.getTime() - dep.getTime());
    const hours = Math.floor(durationMs / 3600000);
    const mins = Math.round((durationMs % 3600000) / 60000);
    const durationLabel =
      hours > 0 ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins}m`;
    return {
      id: r.id,
      origin: r.origin,
      destination: r.destination,
      departure_time: r.departure_time,
      arrival_time: r.arrival_time,
      depTime: dep.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      arrTime: arr.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      durationLabel,
      vehicle: r.company_name,
      type: r.vehicle_type,
      layout: (r.vehicle_type || "").includes("Sleeper")
        ? "sleeper"
        : "standard",
      avail: 10,
      price: parseFloat(r.price),
      color: r.color || "#60a5fa",
      bg: r.bg || "rgba(96,165,250,0.16)",
    };
  });
}

export default function BusSearch({ role, userId, setActive, setBookingsTab }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [payMethod, setPayMethod] = useState("aba");
  const [done, setDone] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [allRoutes, setAllRoutes] = useState([]);
  const [searchedRoutes, setSearchedRoutes] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [lastSearch, setLastSearch] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [seatsFetchError, setSeatsFetchError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const searchResultsRef = useRef(null);

  useEffect(() => {
    fetch("/api/routes")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          console.error("Error fetching routes:", data?.error || data);
          return;
        }
        const formattedRoutes = formatApiRouteRows(data);
        setAllRoutes(formattedRoutes);

        const uniqueCompanies = Array.from(
          new Map(
            formattedRoutes.map((r) => [
              r.vehicle,
              {
                name: r.vehicle,
                color: r.color,
                bg: r.bg,
              },
            ]),
          ).values(),
        );
        setCompanies(uniqueCompanies);
      })
      .catch((err) => console.error("Error fetching routes:", err));
  }, []);

  const displayRoutes = useMemo(
    () => (lastSearch ? searchedRoutes : allRoutes),
    [lastSearch, searchedRoutes, allRoutes],
  );

  const handleSearch = async () => {
    const next = {
      from: fromCity,
      to: toCity,
      date: travelDate,
    };
    const params = new URLSearchParams({
      origin: next.from,
      destination: next.to,
      date: next.date,
    });
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/routes?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || res.statusText);
      }
      const formatted = formatApiRouteRows(Array.isArray(data) ? data : []);
      setSearchedRoutes(formatted);
      setLastSearch(next);
      setSelectedRoute((prev) => {
        if (prev == null) return null;
        return formatted.some((r) => r.id === prev) ? prev : null;
      });
    } catch (err) {
      console.error("Error searching routes:", err);
      setSearchedRoutes([]);
      setLastSearch(next);
      setSelectedRoute(null);
    } finally {
      setSearchLoading(false);
      searchResultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const cleanup = setupScrollReveal();
    return cleanup;
  }, [step, displayRoutes]);
  if (paymentSuccess)
    return (
      <div
        className="page"
        style={{
          maxWidth: 480,
        }}
      >
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "40px",
          }}
        >
          <div
            className="confirm-icon"
            style={{
              background: "var(--green-soft)",
              color: "var(--green)",
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
            ✓
          </div>
          <div className="page-title">Payment successful!</div>
          <div className="page-sub">Choose where to go next</div>
          <div className="success-actions">
            <button
              className="btn btn-primary btn-full"
              onClick={() => {
                if (setBookingsTab) setBookingsTab("trips");
                setPaymentSuccess(false);
                setActive("bookings");
              }}
            >
              My Bookings
            </button>
            <button
              className="btn btn-ghost btn-full"
              onClick={() => {
                setPaymentSuccess(false);
                setActive("home");
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  const goBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleConfirmPayment = async () => {
    if (!userId) {
      setBookingError("Please sign in to complete the booking.");
      setShowAuthModal(true);
      return;
    }

    if (!selectedRoute || !selectedSeats.length) {
      setBookingError("Please choose a route and at least one seat.");
      return;
    }

    setBookingError("");
    setBookingSubmitting(true);

    try {
      const res = await fetch("/api/bookings/bus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: Number(userId),
          route_id: selectedRoute,
          seat_numbers: selectedSeats,
          payment_method: payMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error || "Booking failed. Please try again.");
        if (res.status === 409 && selectedRoute) {
          loadBookedSeats(selectedRoute);
          setStep(2);
        }
        return;
      }

      setPaymentSuccess(true);
    } catch (err) {
      console.error("Booking request failed:", err);
      setBookingError("Booking failed. Please try again.");
    } finally {
      setBookingSubmitting(false);
    }
  };

  const destinations = [
    "Phnom Penh",
    "Siem Reap",
    "Battambang",
    "Sihanoukville",
    "Kampot",
    "Kep",
    "Kratie",
    "Kampong Cham",
    "Pursat",
    "Banteay Meanchey",
  ];
  const currentRoute =
    allRoutes.find((r) => r.id === selectedRoute) ??
    searchedRoutes.find((r) => r.id === selectedRoute);
  const takenSeats = bookedSeats;
  const seatRows = ["A", "B", "C", "D", "E"];
  const seatCols = [1, 2, 3, 4];
  const toggleSeat = (sid) => {
    if (seatsLoading || takenSeats.includes(sid)) return;
    setSelectedSeats((prev) =>
      prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid],
    );
  };
  if (done)
    return (
      <div
        className="page"
        style={{
          maxWidth: 480,
        }}
      >
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "40px",
          }}
        >
          <div
            className="confirm-icon"
            style={{
              background: "var(--green-soft)",
              color: "var(--green)",
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
            ✓
          </div>
          <div className="page-title">Booking confirmed!</div>
          <div className="page-sub">Seat preserved. Show QR at boarding.</div>
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 16,
              width: 110,
              height: 110,
              margin: "0 auto 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(9,1fr)",
                gap: "1.5px",
                width: 82,
                height: 82,
              }}
            >
              {Array.from(
                {
                  length: 81,
                },
                (_, i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: 1,
                      background: Math.random() > 0.5 ? "#111" : "transparent",
                      border: "0.5px solid #ddd",
                    }}
                  />
                ),
              )}
            </div>
          </div>
          <button
            className="btn btn-primary btn-full"
            onClick={() => setActive("bookings")}
          >
            Go to My Bookings
          </button>
          <button
            className="btn btn-ghost btn-full"
            style={{
              marginTop: 8,
            }}
            onClick={() => {
              setDone(false);
              setStep(1);
              setSelectedSeats([]);
              setSelectedRoute(null);
              setLastSearch(null);
              setSearchedRoutes([]);
            }}
          >
            Book another
          </button>
        </div>
      </div>
    );
  return (
    <div
      className="page"
      style={{
        maxWidth: 720,
      }}
    >
      {showAuthModal && (
        <AuthModal
          onConfirm={() => navigate("/login")}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      <div className="page-title">Bus booking</div>
      <div className="page-sub">Search across Cambodia's top routes</div>
      <div className="company-row">
        {currentRoute ? (
          <span
            className="company-chip"
            style={{
              color: currentRoute.color,
              borderColor: currentRoute.color,
              background: currentRoute.bg,
            }}
          >
            {currentRoute.vehicle}
          </span>
        ) : (
          <span
            className="company-chip"
            style={{
              color: "var(--text-2)",
              borderColor: "var(--glass-border)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            Select a route to see bus company
          </span>
        )}
      </div>
      <div className="steps">
        {["Search", "Seats", "Info", "Pay"].map((s, i) => (
          <div
            key={s}
            style={{
              display: "flex",
              alignItems: "center",
              flex: i === 3 ? "initial" : 1,
            }}
          >
            <div
              className={`step ${i + 1 === step ? "active" : i + 1 < step ? "done" : "idle"}`}
            >
              <div className="step-num">{i + 1 < step ? "✓" : i + 1}</div>
              <div
                className="step-label"
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                }}
              >
                {s}
              </div>
            </div>
            {i < 3 && <div className="step-line" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          <div className="search-bar">
            <div>
              <div className="label">From</div>
              <select
                value={fromCity}
                onChange={(e) => setFromCity(e.target.value)}
              >
                <option value="" disabled>
                  Choose departure
                </option>
                {destinations.map((city) => (
                  <option key={`from-${city}`} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label">To</div>
              <select
                value={toCity}
                onChange={(e) => setToCity(e.target.value)}
              >
                <option value="" disabled>
                  Choose destination
                </option>
                {destinations.map((city) => (
                  <option key={`to-${city}`} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label">Date</div>
              <input
                type="date"
                placeholder="Choose date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={searchLoading}
            >
              {searchLoading ? "Searching…" : "Search"}
            </button>
          </div>
          <div ref={searchResultsRef}>
            <div className="sec-title">
              {displayRoutes.length} trips found
              {!lastSearch && allRoutes.length > 0 && (
                <span
                  style={{
                    fontWeight: 400,
                    color: "var(--text-3)",
                    marginLeft: 8,
                  }}
                >
                  (all routes — use Search to filter)
                </span>
              )}
            </div>
            {lastSearch && displayRoutes.length === 0 && (
              <div className="page-sub" style={{ marginBottom: 12 }}>
                No trips for this route and date. Try another combination.
              </div>
            )}
            {displayRoutes.map((r, i) => (
              <div
                key={r.id}
                className={`route-card ticket-card scroll-animate ${selectedRoute === r.id ? "selected" : ""}`}
                style={{
                  "--delay": `${i * 40}ms`,
                }}
                onClick={() => {
                  if (role === "guest") {
                    setShowAuthModal(true);
                  } else setSelectedRoute(r.id);
                }}
              >
                <div>
                  <div className="route-time">{r.origin}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-3)",
                      marginTop: 2,
                    }}
                  >
                    {r.depTime}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: r.color,
                        boxShadow: `0 0 0 3px ${r.bg}`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: r.color,
                      }}
                    >
                      {r.vehicle}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-3)",
                      marginTop: 2,
                    }}
                  >
                    {r.type}
                  </div>
                </div>
                <div className="route-arrow">
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      marginBottom: 2,
                    }}
                  >
                    {r.durationLabel}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: "0.5px",
                        background: "var(--glass-border)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--text-3)",
                      }}
                    >
                      →
                    </span>
                  </div>
                </div>
                <div>
                  <div className="route-time">{r.destination}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-3)",
                      marginTop: 2,
                    }}
                  >
                    {r.arrTime}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: r.avail <= 5 ? "var(--amber)" : "var(--text-3)",
                      marginTop: 6,
                    }}
                  >
                    {r.avail} seats left
                  </div>
                </div>
                <div className="route-price">${r.price}</div>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    border: "1.5px solid",
                    borderColor:
                      selectedRoute === r.id
                        ? "var(--accent)"
                        : "var(--glass-border)",
                    background:
                      selectedRoute === r.id ? "var(--accent)" : "transparent",
                    flexShrink: 0,
                  }}
                />
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="btn btn-primary btn-lg"
              disabled={!selectedRoute}
              onClick={() => setStep(2)}
            >
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <div className="seat-map-wrap">
          <div className="seat-legend">
            <div className="seat-legend-item">
              <div className="seat-dot seat-dot-avail" />
              <span>Available</span>
            </div>
            <div className="seat-legend-item">
              <div className="seat-dot seat-dot-taken" />
              <span>Taken</span>
            </div>
            <div className="seat-legend-item">
              <div className="seat-dot seat-dot-sel" />
              <span>Selected</span>
            </div>
          </div>
          <div className="seat-layout">
            <div>
              <div className="bus-shell">
                <div className="bus-pattern" />
                <div className="bus-roof" />
                <div className="bus-front">
                  <span className="steering">🚌</span>
                </div>
                <div className="seat-grid">
                  {seatRows.map((row, ri) => (
                    <div
                      key={row}
                      style={{
                        display: "contents",
                      }}
                    >
                      {seatCols.map((col) => {
                        const sid = `${row}${col}`;
                        const taken = takenSeats.includes(sid);
                        const sel = selectedSeats.includes(sid);
                        return (
                          <div
                            key={sid}
                            className={`seat ${taken ? "seat-taken" : sel ? "seat-sel" : "seat-avail"}`}
                            style={
                              col === 3
                                ? {
                                    marginLeft: 8,
                                  }
                                : {}
                            }
                            onClick={() => toggleSeat(sid)}
                          >
                            {sid}
                          </div>
                        );
                      })}
                      {ri < seatRows.length - 1 && (
                        <div className="seat-col-gap" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div
              style={{
                flex: 1,
              }}
            >
              <div className="sec-title">Booking summary</div>
              <div className="card card-sm">
                <div className="summary-row">
                  <span className="summary-key">Route</span>
                  <span className="summary-val">
                    {currentRoute?.origin ?? fromCity} →{" "}
                    {currentRoute?.destination ?? toCity}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Date</span>
                  <span className="summary-val">
                    {travelDate} • {currentRoute?.depTime}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Vehicle</span>
                  <span
                    className="summary-val"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: currentRoute?.color || "var(--text)",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: currentRoute?.color || "var(--text-3)",
                        boxShadow: `0 0 0 3px ${currentRoute?.bg || "transparent"}`,
                      }}
                    />
                    {currentRoute?.vehicle}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Bus type</span>
                  <span className="summary-val">{currentRoute?.type}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Seats</span>
                  <span
                    className="summary-val"
                    style={{
                      color: "var(--accent)",
                    }}
                  >
                    {selectedSeats.length ? selectedSeats.join(", ") : "None"}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Price each</span>
                  <span className="summary-val">
                    ${currentRoute?.price ?? 0}
                  </span>
                </div>
                <div
                  className="divider"
                  style={{
                    margin: "10px 0",
                  }}
                />
                <div className="summary-row">
                  <span
                    className="summary-key"
                    style={{
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    Total
                  </span>
                  <span
                    className="summary-val"
                    style={{
                      color: "var(--green)",
                      fontSize: 16,
                    }}
                  >
                    $
                    {(
                      (currentRoute?.price ?? 0) * selectedSeats.length
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 24,
            }}
          >
            <button
              className="btn btn-ghost btn-round-back"
              aria-label="Back"
              onClick={goBack}
            >
              <Icon d={icons.back} size={15} />
            </button>
            <button
              className="btn btn-primary"
              disabled={!selectedSeats.length}
              onClick={() => setStep(3)}
            >
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="sec-title">Passenger information</div>
          <div className="form-row">
            <div>
              <div className="label">First name</div>
              <input placeholder="Sereymongkol" />
            </div>
            <div>
              <div className="label">Last name</div>
              <input placeholder="Thoeung" />
            </div>
          </div>
          <div className="form-group">
            <div className="label">Phone number</div>
            <input placeholder="+855 17 420 051" />
          </div>
          <div className="form-group">
            <div className="label">National ID / Passport</div>
            <input placeholder="ID123456789" />
          </div>
          <div className="form-group">
            <div className="label">Email (for ticket)</div>
            <input type="email" placeholder="thoeungsereymongkol@gmail.com" />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 20,
            }}
          >
            <button
              className="btn btn-ghost btn-round-back"
              aria-label="Back"
              onClick={goBack}
            >
              <Icon d={icons.back} size={15} />
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setStep(4)}
            >
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <div className="sec-title">Choose payment method</div>
          {[
            {
              id: "aba",
              icon: "🏦",
              name: "ABA Bank",
              sub: "Scan QR or transfer",
            },
            {
              id: "khqr",
              icon: "🇰🇭",
              name: "KHQR",
              sub: "Cambodia QR payment standard",
            },
            {
              id: "cash",
              icon: "💵",
              name: "Cash on boarding",
              sub: "Pay when you board",
            },
          ].map((m) => (
            <div
              key={m.id}
              className={`pay-method ${payMethod === m.id ? "selected" : ""}`}
              onClick={() => setPayMethod(m.id)}
            >
              <div className="pay-method-icon">{m.icon}</div>
              <div>
                <div className="pay-method-name">{m.name}</div>
                <div className="pay-method-sub">{m.sub}</div>
              </div>
              <div
                className={`pay-radio ${payMethod === m.id ? "checked" : ""}`}
              />
            </div>
          ))}

          {payMethod !== "cash" && (
            <div
              style={{
                textAlign: "center",
                marginTop: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  marginBottom: 12,
                }}
              >
                Scan with your banking app
              </div>
              <div className="qr-box">
                <div className="qr-pattern">
                  {Array.from(
                    {
                      length: 100,
                    },
                    (_, i) => (
                      <div
                        key={i}
                        className="qr-cell"
                        style={{
                          background:
                            Math.random() > 0.45 ? "#111" : "transparent",
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  marginTop: 10,
                }}
              >
                Amount: $
                {((currentRoute?.price ?? 0) * selectedSeats.length).toFixed(2)}
              </div>
            </div>
          )}

          <div className="divider" />
          <div className="total-box">
            <span
              style={{
                fontSize: 13,
                color: "var(--accent)",
              }}
            >
              Total to pay
            </span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--accent)",
              }}
            >
              ${((currentRoute?.price ?? 0) * selectedSeats.length).toFixed(2)}
            </span>
          </div>

          {bookingError ? (
            <div
              className="page-sub"
              style={{ color: "#f87171", marginBottom: 12 }}
            >
              {bookingError}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 24,
            }}
          >
            <button
              className="btn btn-ghost btn-round-back"
              aria-label="Back"
              onClick={goBack}
            >
              <Icon d={icons.back} size={15} />
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={bookingSubmitting}
              onClick={handleConfirmPayment}
            >
              Confirm & Pay <Icon d={icons.check} size={15} color="#fff" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
