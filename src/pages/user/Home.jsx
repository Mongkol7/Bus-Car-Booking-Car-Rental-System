import React, { useEffect, useState } from "react";
import { Icon, icons, getCompanyMeta } from "../../utils/sharedUser";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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

export default function Home({ setActive }) {
  const [latestRoutes, setLatestRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routesError, setRoutesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadRoutes = async () => {
      setLoadingRoutes(true);
      setRoutesError("");

      try {
        const res = await fetch("/api/routes");
        const data = await res.json();

        if (!Array.isArray(data)) {
          throw new Error(data?.error || "Unable to load newest routes");
        }

        const newest = [...data]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            route: `${item.origin} → ${item.destination}`,
            company: item.company_name || item.vehicle || "Bus",
            vehicleType: item.vehicle_type || "Bus",
            departureTime: item.departure_time,
            arrivalTime: item.arrival_time,
            price: `$${parseFloat(item.price).toFixed(2)}`,
            companyMeta: getCompanyMeta(item.company_name),
          }));

        if (!cancelled) {
          setLatestRoutes(newest);
        }
      } catch (err) {
        if (!cancelled) {
          setLatestRoutes([]);
          setRoutesError(err.message || "Unable to load newest routes");
        }
      } finally {
        if (!cancelled) {
          setLoadingRoutes(false);
        }
      }
    };

    loadRoutes();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="hero">
        <div className="page hero-content">
          <div className="hero-title">
            Travel smarter
            <br />
            across <span>Cambodia</span>
          </div>
          <div className="hero-sub">
            Book bus seats or rent a car - fast, simple, and on the go.
          </div>

          <div
            className="earth-wrap"
            style={{
              marginTop: 36,
            }}
          >
            <svg
              viewBox="0 0 1440 140"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <radialGradient id="earthGlow" cx="50%" cy="0%" r="70%">
                  <stop offset="0%" stopColor="rgba(79,142,247,0.22)" />
                  <stop offset="55%" stopColor="rgba(79,142,247,0.08)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <filter
                  id="lineGlow"
                  x="-20%"
                  y="-100%"
                  width="140%"
                  height="300%"
                >
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path d="M0,140 Q720,-60 1440,140 Z" fill="url(#earthGlow)" />
              <path
                d="M0,140 Q720,-60 1440,140"
                fill="none"
                stroke="rgba(79,142,247,0.3)"
                strokeWidth="2"
                filter="url(#lineGlow)"
              />
              <path
                d="M0,140 Q720,-60 1440,140"
                fill="none"
                stroke="rgba(79,142,247,0.65)"
                strokeWidth="1"
              />
            </svg>

            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            >
              <svg
                viewBox="0 0 1440 140"
                preserveAspectRatio="none"
                style={{
                  width: "100%",
                  height: "100%",
                }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <path id="carPath" d="M0,140 Q720,-60 1440,140" />
                </defs>
                <g>
                  <animateMotion
                    dur="10s"
                    repeatCount="indefinite"
                    rotate="auto"
                  >
                    <mpath href="#carPath" />
                  </animateMotion>
                  <ellipse
                    cx="18"
                    cy="-3"
                    rx="28"
                    ry="7"
                    fill="rgba(255,230,100,0.13)"
                  />
                  <ellipse
                    cx="0"
                    cy="10"
                    rx="18"
                    ry="3"
                    fill="rgba(0,0,0,0.25)"
                  />
                  <rect
                    x="-14"
                    y="-8"
                    width="28"
                    height="10"
                    rx="3"
                    fill="#1e3a5f"
                    stroke="rgba(79,142,247,0.6)"
                    strokeWidth="0.8"
                  />
                  <rect
                    x="-8"
                    y="-15"
                    width="16"
                    height="8"
                    rx="2"
                    fill="#152d4a"
                    stroke="rgba(79,142,247,0.4)"
                    strokeWidth="0.6"
                  />
                  <rect
                    x="-6"
                    y="-14"
                    width="6"
                    height="6"
                    rx="1"
                    fill="rgba(120,180,255,0.5)"
                  />
                  <rect
                    x="2"
                    y="-14"
                    width="5"
                    height="6"
                    rx="1"
                    fill="rgba(120,180,255,0.3)"
                  />
                  <rect
                    x="13"
                    y="-5"
                    width="3"
                    height="2"
                    rx="0.5"
                    fill="rgba(255,230,100,0.95)"
                  />
                  <rect
                    x="-16"
                    y="-5"
                    width="3"
                    height="2"
                    rx="0.5"
                    fill="rgba(255,80,80,0.8)"
                  />
                  <circle
                    cx="-8"
                    cy="3"
                    r="4"
                    fill="#0a0a0f"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="0.8"
                  />
                  <circle cx="-8" cy="3" r="2" fill="#1a1a2e" />
                  <circle
                    cx="8"
                    cy="3"
                    r="4"
                    fill="#0a0a0f"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="0.8"
                  />
                  <circle cx="8" cy="3" r="2" fill="#1a1a2e" />
                  <rect
                    x="-14"
                    y="-3"
                    width="28"
                    height="1"
                    rx="0.5"
                    fill="rgba(79,142,247,0.5)"
                  />
                </g>
              </svg>
            </div>
          </div>

          <div className="service-grid">
            <div className="service-card" onClick={() => setActive("search")}>
              <div className="hero-emoji">🚌</div>
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Bus seat booking
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                }}
              >
                Search routes, pick seats and pay.
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{
                  marginTop: 16,
                }}
              >
                Book now
              </button>
            </div>
            <div className="service-card" onClick={() => setActive("cars")}>
              <div className="hero-emoji">🚗</div>
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Car rental
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                }}
              >
                Browse sedans and SUVs for rent.
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{
                  marginTop: 16,
                }}
              >
                Browse cars
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page">
        <div className="sec-title">Newest routes</div>
        {loadingRoutes ? (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "28px",
            }}
          >
            <p style={{ color: "var(--text-3)", fontSize: "13px" }}>
              Loading newest routes...
            </p>
          </div>
        ) : routesError ? (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "28px",
            }}
          >
            <p style={{ color: "var(--text-3)", fontSize: "13px" }}>
              {routesError}
            </p>
          </div>
        ) : latestRoutes.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "28px",
            }}
          >
            <p style={{ color: "var(--text-3)", fontSize: "13px" }}>
              No routes found yet.
            </p>
          </div>
        ) : (
          latestRoutes.map((route, i) => (
            <div
              key={route.id}
              className="booking-item ticket-card"
              style={{
                "--delay": `${i * 40}ms`,
              }}
            >
              <div className="booking-header">
                <div>
                  <span
                    className="badge badge-blue"
                    style={{
                      marginBottom: 6,
                      fontSize: 9,
                    }}
                  >
                    NEW ROUTE
                  </span>
                  <div className="booking-route">{route.route}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: route.companyMeta.color,
                      marginTop: 2,
                    }}
                  >
                    {route.company} · {route.vehicleType}
                  </div>
                </div>
                <span className="badge badge-green">Available</span>
              </div>
              <div className="booking-meta">
                <div className="booking-meta-item">
                  Departure
                  <span>
                    {formatDate(route.departureTime)}{" "}
                    {formatTime(route.departureTime)}
                  </span>
                </div>
                <div className="booking-meta-item">
                  Arrival
                  <span>
                    {formatDate(route.arrivalTime)}{" "}
                    {formatTime(route.arrivalTime)}
                  </span>
                </div>
                <div className="booking-meta-item">
                  Price<span>{route.price}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
