import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Icon,
  icons,
  setupScrollReveal,
  getTodayISO,
} from "../../utils/sharedUser";
import AuthModal from "./AuthModal";
import PassengerInfoForm from "../../features/checkout/passenger/PassengerInfoForm";
import CheckoutSuccess from "../../features/checkout/confirmation/CheckoutSuccess";
import {
  confirmBusBooking,
  loadCheckoutConfirmation,
  saveCheckoutConfirmation,
} from "../../features/checkout/confirmation/confirmationApi";
import { useAuth } from "../../context/AuthContext";

const BUS_CONFIRMATION_KEY = "checkout-confirmation-bus";

export default function BusSearch({ role, setActive, setBookingsTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const stepByPath = {
    "/booking/search": 1,
    "/booking/seats": 2,
    "/booking/passenger": 3,
    "/booking/payment": 4,
    "/booking/success": 5,
  };
  const pathByStep = {
    1: "/booking/search",
    2: "/booking/seats",
    3: "/booking/passenger",
    4: "/booking/payment",
    5: "/booking/success",
  };
  const step = stepByPath[location.pathname] || 1;
  const goStep = (nextStep) => navigate(pathByStep[nextStep] || pathByStep[1]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [payMethod, setPayMethod] = useState("aba");
  const [done, setDone] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [fromCity, setFromCity] = useState("Phnom Penh");
  const [toCity, setToCity] = useState("Siem Reap");
  const [travelDate, setTravelDate] = useState(getTodayISO());
  const [routes, setRoutes] = useState([]);
  const [_companies, setCompanies] = useState([]);
  const [passengerInfo, setPassengerInfo] = useState(null);
  const [confirmation, setConfirmation] = useState(() => loadCheckoutConfirmation(BUS_CONFIRMATION_KEY));
  const [bookingError, setBookingError] = useState("");
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);

  // Stable mock QR patterns to prevent flickering during re-renders
  const qrPatternDone = useMemo(
    () => Array.from({ length: 81 }, (_, i) => (i % 7) < 3),
    [],
  );

  const qrPatternPayment = useMemo(
    () => Array.from({ length: 100 }, (_, i) => (i % 11) < 5),
    [],
  );

  useEffect(() => {
    fetch("/api/routes")
      .then((res) => res.json())
      .then((data) => {
        const formattedRoutes = data.map((r) => ({
          id: r.id,
          from: new Date(r.departure_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          to: new Date(r.arrival_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          vehicle: r.company_name,
          type: r.vehicle_type,
          layout: r.vehicle_type.includes("Sleeper") ? "sleeper" : "standard",
          avail: 10,
          price: parseFloat(r.price),
          color: r.color || "#60a5fa",
          bg: r.bg || "rgba(96,165,250,0.16)",
        }));
        setRoutes(formattedRoutes);

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
  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const cleanup = setupScrollReveal();
    return cleanup;
  }, [step, routes]);
  useEffect(() => {
    if (step === 5) {
      return;
    }
    if (step >= 2 && !selectedRoute) {
      navigate("/booking/search", { replace: true });
      return;
    }
    if (step >= 3 && !selectedSeats.length) {
      navigate("/booking/seats", { replace: true });
      return;
    }
    if (step >= 4 && !passengerInfo) {
      navigate("/booking/passenger", { replace: true });
    }
  }, [step, selectedRoute, selectedSeats.length, passengerInfo, confirmation, navigate]);
  if (paymentSuccess || step === 5)
    return (
      <CheckoutSuccess
        confirmation={confirmation}
        onMyBookings={() => {
          if (setBookingsTab) setBookingsTab("trips");
          setPaymentSuccess(false);
          setActive("bookings");
        }}
        onHome={() => {
          setPaymentSuccess(false);
          setActive("home");
        }}
      />
    );
  const goBack = () => {
    goStep(Math.max(1, step - 1));
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
  const currentRoute = routes.find((r) => r.id === selectedRoute);
  const bookingTotal = (currentRoute?.price ?? 0) * selectedSeats.length;
  const passengerBookingSummary = {
    route: `${fromCity} to ${toCity}`,
    date: `${travelDate} - ${currentRoute?.from || "Not selected"}`,
    seats: selectedSeats.length ? selectedSeats.join(", ") : "None",
    total: `$${bookingTotal.toFixed(2)}`,
  };
  const takenSeats = ["A1", "A3", "B2", "B4", "C1", "D3", "D4"];
  const seatRows = ["A", "B", "C", "D", "E"];
  const seatCols = [1, 2, 3, 4];
  const toggleSeat = (sid) => {
    if (takenSeats.includes(sid)) return;
    setSelectedSeats((prev) =>
      prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid],
    );
  };
  const handleConfirmBusBooking = async () => {
    if (!currentRoute || !selectedSeats.length || !passengerInfo) {
      setBookingError("Complete route, seats, and passenger information before payment.");
      return;
    }

    setIsBookingSubmitting(true);
    setBookingError("");

    try {
      const responseData = await confirmBusBooking({
        route_id: currentRoute.id,
        seat_number: selectedSeats,
        user_id: user?.id || null,
        total_price: bookingTotal,
        payment_method: payMethod,
        passengerInfo,
        confirmationSummary: {
          route: `${fromCity} to ${toCity}`,
          date: `${travelDate} - ${currentRoute.from}`,
          vehicle: `${currentRoute.vehicle} (${currentRoute.type})`,
        },
      });

      const nextConfirmation = responseData.confirmation;
      setConfirmation(nextConfirmation);
      saveCheckoutConfirmation(BUS_CONFIRMATION_KEY, nextConfirmation);
      setPaymentSuccess(true);
      goStep(5);
    } catch (error) {
      setBookingError(error.message || "Failed to create bus booking.");
    } finally {
      setIsBookingSubmitting(false);
    }
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
            ?
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
              {qrPatternDone.map((isDark, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 1,
                    background: isDark ? "#111" : "transparent",
                    border: "0.5px solid #ddd",
                  }}
                />
              ))}
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
              goStep(1);
              setSelectedSeats([]);
              setSelectedRoute(null);
              setPassengerInfo(null);
              setBookingError("");
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
              <div className="step-num">{i + 1 < step ? "?" : i + 1}</div>
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
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
              />
            </div>
            <button className="btn btn-primary">Search</button>
          </div>
          <div className="sec-title">{routes.length} trips found</div>
          {routes.map((r, i) => (
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
                <div className="route-time">{r.from}</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 2,
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
                  5h 00m
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
                    ?
                  </span>
                </div>
              </div>
              <div>
                <div className="route-time">{r.to}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: r.avail <= 5 ? "var(--amber)" : "var(--text-3)",
                    marginTop: 2,
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
              onClick={() => goStep(2)}
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
                  <span className="steering">??</span>
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
                    {fromCity} to {toCity}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Date</span>
                  <span className="summary-val">
                    {travelDate} • {currentRoute?.from}
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
              onClick={() => goStep(3)}
            >
              Continue <Icon d={icons.arrow} size={15} color="#fff" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <PassengerInfoForm
          initialValues={passengerInfo}
          bookingSummary={passengerBookingSummary}
          onBack={goBack}
          onSubmit={(details) => {
            setPassengerInfo(details);
            goStep(4);
          }}
        />
      )}

      {step === 4 && (
        <div className="card">
          <div className="sec-title">Choose payment method</div>
          {[
            {
              id: "aba",
              icon: "??",
              name: "ABA Bank",
              sub: "Scan QR or transfer",
            },
            {
              id: "khqr",
              icon: "????",
              name: "KHQR",
              sub: "Cambodia QR payment standard",
            },
            {
              id: "cash",
              icon: "??",
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
                  {qrPatternPayment.map((isDark, i) => (
                    <div
                      key={i}
                      className="qr-cell"
                      style={{ background: isDark ? "#111" : "transparent" }}
                    />
                  ))}
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
                {bookingTotal.toFixed(2)}
              </div>
            </div>
          )}

          <div className="divider" />
          <div className="booking-summary-list" style={{ marginBottom: 12 }}>
            <div className="booking-summary-row">
              <span>Passenger</span>
              <strong>
                {passengerInfo ? `${passengerInfo.firstName} ${passengerInfo.lastName}` : "Not set"}
              </strong>
            </div>
            <div className="booking-summary-row">
              <span>Contact</span>
              <strong>{passengerInfo ? passengerInfo.phone : "Not set"}</strong>
            </div>
            <div className="booking-summary-row">
              <span>Email</span>
              <strong>{passengerInfo ? passengerInfo.email : "Not set"}</strong>
            </div>
            <div className="booking-summary-row">
              <span>Route</span>
              <strong>{fromCity} to {toCity}</strong>
            </div>
            <div className="booking-summary-row">
              <span>Travel date</span>
              <strong>{travelDate} - {currentRoute?.from}</strong>
            </div>
            <div className="booking-summary-row">
              <span>Seats</span>
              <strong>{selectedSeats.join(", ")}</strong>
            </div>
            <div className="booking-summary-row">
              <span>Price each</span>
              <strong>${(currentRoute?.price ?? 0).toFixed(2)}</strong>
            </div>
          </div>
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
              ${bookingTotal.toFixed(2)}
            </span>
          </div>
          {bookingError && (
            <div className="rental-search-note rental-search-error" style={{ marginTop: 12 }}>
              {bookingError}
            </div>
          )}

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
              onClick={handleConfirmBusBooking}
              disabled={isBookingSubmitting}
            >
              {isBookingSubmitting ? "Confirming..." : "Confirm & Pay"} <Icon d={icons.check} size={15} color="#fff" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
