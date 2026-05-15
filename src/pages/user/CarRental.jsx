import React, { useEffect, useRef, useState } from "react";
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
} from "../../utils/sharedUser";
import AuthModal from "./AuthModal";

export default function CarRental({
  role,
  setActive,
  setBookingsTab,
  setBookingsRefresh,
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);
  const [payMethod, setPayMethod] = useState("aba");
  const [done, setDone] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [shaking, setShaking] = useState(null);
  const [pickupDate, setPickupDate] = useState("2026-04-05");
  const [returnDate, setReturnDate] = useState("2026-04-08");
  const [showSpecs, setShowSpecs] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const goBack = () => {
    setStep((prev) => {
      const next = Math.max(1, prev - 1);
      if (next === 1) setSelected(null);
      return next;
    });
  };
  const [cars, setCars] = useState([]);
  useEffect(() => {
    if (step === 1) {
      document.querySelectorAll(".car-grid .scroll-animate").forEach((el) => {
        delete el.dataset.revealed;
      });
      const cleanup = setupScrollReveal();
      const timer = setTimeout(() => {
        document.querySelectorAll(".car-grid .scroll-animate").forEach((el) => {
          el.dataset.revealed = "true";
        });
      }, 160);
      return () => {
        cleanup();
        clearTimeout(timer);
      };
    }
  }, [step, cars]);

  useEffect(() => {
    fetch("/api/cars")
      .then((res) => res.json())
      .then((data) => {
        const formatted = data.map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          seats: v.total_seats,
          trans: v.transmission || "Auto",
          price: parseFloat(v.daily_rate),
          emoji: v.type.includes("SUV") ? "🚙" : "🚗",
          status: v.status.charAt(0).toUpperCase() + v.status.slice(1),
          specs: ["A/C", "Bluetooth", "Cruise Control"],
          specDetails: [
            {
              label: "Engine",
              value: v.type.includes("SUV") ? "2.5L Turbo" : "1.8L Hybrid",
            },
            { label: "Transmission", value: v.transmission || "Auto" },
            { label: "Seats", value: v.total_seats },
            { label: "Fuel", value: "Petrol" },
            {
              label: "Luggage",
              value: v.type.includes("SUV") ? "4 large bags" : "2 large bags",
            },
          ],
          photos: v.photos || [],
        }));
        setCars(formatted);
      })
      .catch((err) => console.error("Error fetching vehicles:", err));
  }, []);
  const car = cars.find((c) => c.id === selected);
  const startDate = new Date(pickupDate);
  const endDate = new Date(returnDate);
  const diffDays = Math.floor((endDate - startDate) / 86400000);
  const days = Number.isFinite(diffDays) ? Math.max(1, diffDays) : 1;
  useEffect(() => {
    setShowSpecs(false);
    setShowPhotos(false);
  }, [selected, step]);
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
                if (setBookingsTab) setBookingsTab("rentals");
                if (setBookingsRefresh) setBookingsRefresh((prev) => prev + 1);
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
          <div className="page-title">Rental Request Sent!</div>
          <div className="page-sub">Your rental is being processed.</div>
          <button
            className="btn btn-primary btn-full"
            onClick={() => setActive("bookings")}
          >
            Go to My Bookings
          </button>
        </div>
      </div>
    );
  return (
    <div className="page-wide">
      {showAuthModal && (
        <AuthModal
          onConfirm={() => navigate("/login")}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      <div className="page-title">Car rental</div>
      <div className="page-sub">Premium vehicles for your personal use</div>

      {step > 1 && (
        <div
          className="steps"
          style={{
            maxWidth: 640,
            margin: "0 auto 32px",
          }}
        >
          {["Details", "Payment"].map((s, i) => (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                flex: i === 1 ? "initial" : 1,
              }}
            >
              <div
                className={`step ${i + 2 === step ? "active" : i + 2 < step ? "done" : "idle"}`}
              >
                <div className="step-num">{i + 2 < step ? "✓" : i + 1}</div>
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
              {i < 1 && <div className="step-line" />}
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="car-grid">
          {cars.map((c, i) => (
            <div
              key={c.id}
              className={`car-card ticket-card scroll-animate ${shaking === c.id ? "shake-anim" : ""}`}
              style={{
                "--delay": `${i * 40}ms`,
              }}
              onClick={() => {
                if (c.status !== "Available") {
                  setShaking(c.id);
                  if (window.navigator.vibrate) window.navigator.vibrate(50); // Haptic feedback
                  setTimeout(() => setShaking(null), 400);
                } else if (role === "guest") {
                  setShowAuthModal(true);
                } else {
                  setSelected(c.id);
                  setStep(2);
                }
              }}
            >
              <div className="car-img-wrap">{c.emoji}</div>
              <div className="car-body">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <div className="car-name">{c.name}</div>
                  <span
                    className={`badge ${c.status === "Available" ? "badge-green" : "badge-red"}`}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="car-price">
                  ${c.price}
                  <span>/day</span>
                </div>
                <button
                  className={`btn btn-full btn-sm ${c.status === "Available" ? "btn-primary" : "btn-ghost"}`}
                  style={{
                    marginTop: 12,
                  }}
                >
                  {c.status !== "Available"
                    ? "Not Available"
                    : role === "guest"
                      ? "Sign in to rent"
                      : "Rent now"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && car && (
        <div
          className="page"
          style={{
            maxWidth: 560,
            padding: 0,
          }}
        >
          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 32,
                }}
              >
                {car.emoji}
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  {car.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-2)",
                  }}
                >
                  {car.type} · {car.seats} seats · {car.trans}
                </div>
                <div className="toggle-row">
                  <button
                    className={`toggle-btn ${showSpecs ? "active" : ""}`}
                    type="button"
                    onClick={() => setShowSpecs((prev) => !prev)}
                    aria-expanded={showSpecs}
                  >
                    Specs{" "}
                    <Icon d={icons.chevron} size={12} className="toggle-icon" />
                  </button>
                  <button
                    className={`toggle-btn ${showPhotos ? "active" : ""}`}
                    type="button"
                    onClick={() => setShowPhotos((prev) => !prev)}
                    aria-expanded={showPhotos}
                  >
                    Photos{" "}
                    <Icon d={icons.chevron} size={12} className="toggle-icon" />
                  </button>
                </div>
                <div
                  className={`dropdown-panel ${showSpecs ? "open" : ""}`}
                  aria-hidden={!showSpecs}
                >
                  {car.specDetails.map((row) => (
                    <div key={row.label} className="spec-row">
                      <span className="spec-key">{row.label}</span>
                      <span>{row.value}</span>
                    </div>
                  ))}
                  {!car.specDetails.length && (
                    <div className="spec-row">
                      <span className="spec-key">No specs available</span>
                    </div>
                  )}
                </div>
                <div
                  className={`dropdown-panel ${showPhotos ? "open" : ""}`}
                  aria-hidden={!showPhotos}
                >
                  <div className="photo-grid">
                    {car.photos.map((src, idx) => (
                      <img
                        key={`${car.id}-${idx}`}
                        src={src}
                        alt={`${car.name} ${idx + 1}`}
                      />
                    ))}
                  </div>
                  {!car.photos.length && (
                    <div className="spec-row">
                      <span className="spec-key">No photos available</span>
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  fontSize: 17,
                  fontWeight: 600,
                  color: "var(--accent)",
                }}
              >
                ${car.price}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: "var(--text-2)",
                  }}
                >
                  /day
                </span>
              </div>
            </div>
            <div className="divider" />
            <div className="date-range">
              <div>
                <div className="label">Pickup</div>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                />
              </div>
              <div>
                <div className="label">Return</div>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <div className="label">Driver full name</div>
              <input placeholder="Sereymongkol Thoeung" />
            </div>
            <div className="form-group">
              <div className="label">Driver license number</div>
              <input placeholder="DL-12345678" />
            </div>
            <div className="form-group">
              <div className="label">Phone number</div>
              <input placeholder="+855 17 420 0051" />
            </div>
            <div className="total-box">
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--accent)",
                  }}
                >
                  Total ({days} days × ${car.price})
                </div>
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                ${car.price * days}
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
                className="btn btn-primary btn-lg"
                onClick={() => setStep(3)}
              >
                Continue to Payment{" "}
                <Icon d={icons.arrow} size={15} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && car && (
        <div
          className="page"
          style={{
            maxWidth: 560,
            padding: 0,
          }}
        >
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
                Scan to pay deposit
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
                Deposit: ${(car.price * days * 0.2).toFixed(2)}
              </div>
            </div>

            <div className="divider" />
            <div className="total-box">
              <span
                style={{
                  fontSize: 13,
                  color: "var(--accent)",
                }}
              >
                Remaining to pay on pickup
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                ${(car.price * days * 0.8).toFixed(2)}
              </span>
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
                className="btn btn-primary btn-lg"
                onClick={() => {
                  setPaymentSuccess(true);
                }}
              >
                Confirm Rental <Icon d={icons.check} size={15} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
