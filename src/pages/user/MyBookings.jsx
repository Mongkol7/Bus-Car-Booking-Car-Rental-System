import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Icon,
  icons,
  setupScrollReveal,
  getCompanyMeta,
} from "../../utils/sharedUser";
import { useAuth } from "../../context/AuthContext";

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function getRentalDays(pickupDate, returnDate) {
  if (!pickupDate || !returnDate) return 1;
  const start = new Date(pickupDate);
  const end = new Date(returnDate);
  const diffDays = Math.floor((end - start) / 86400000);
  return Number.isFinite(diffDays) ? Math.max(1, diffDays) : 1;
}

function normalizeRental(rental) {
  const days = getRentalDays(rental.pickup_date, rental.return_date);
  const bookingStatus = `${rental.status || "pending"}`;
  const statusByBookingStatus = {
    pending: "Pending",
    confirmed: "Rented",
    completed: "Completed",
    cancelled: "Cancelled",
    returned: "Returned",
  };
  const status = statusByBookingStatus[bookingStatus] || "Pending";

  return {
    rawId: rental.id,
    id: `#R-${rental.id}`,
    type: "rental",
    route: rental.car?.name || "Rental car",
    price: formatMoney(rental.total_price),
    status,
    date: `${formatDate(rental.pickup_date)} - ${formatDate(rental.return_date)}`,
    time: `${days} day${days > 1 ? "s" : ""}`,
    seat: rental.car?.plate_number || "N/A",
    payment: `${rental.payment_method || "aba"}`.toUpperCase(),
    rentalMode: rental.rental_mode === "with_driver" ? "With driver" : "Self-drive",
    canCancel: bookingStatus === "pending",
  };
}

function getCancelErrorMessage(response, responseData) {
  if (responseData?.error) {
    return responseData.error;
  }

  if (response.status === 404) {
    return "Cancel service was not found. Please restart the backend server and try again.";
  }

  if (response.status >= 500) {
    return "Cancel failed on the server. Please check that PostgreSQL is running, then try again.";
  }

  return "Failed to cancel rental booking.";
}

export default function MyBookings({ role, bookingsTab, setBookingsTab }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tab = bookingsTab || "trips";
  const [qrOpen, setQrOpen] = useState(null);
  const [rentalFilter, setRentalFilter] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");
  const [rentals, setRentals] = useState([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);
  const [rentalsError, setRentalsError] = useState("");
  const [cancelingRentalId, setCancelingRentalId] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState("");
  const [pendingCancelBooking, setPendingCancelBooking] = useState(null);

  useEffect(() => {
    const cleanup = setupScrollReveal();
    return cleanup;
  }, [tab, rentalFilter, tripFilter, rentals]);

  useEffect(() => {
    if (role === "guest" || !user?.id) {
      return;
    }

    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) return;
      setRentalsLoading(true);
      setRentalsError("");
    });

    fetch(`/api/cars/bookings?userId=${user.id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load rental bookings.");
        }
        return response.json();
      })
      .then((data) => {
        if (!isActive) return;
        setRentals(Array.isArray(data) ? data.map(normalizeRental) : []);
      })
      .catch((error) => {
        if (!isActive) return;
        setRentalsError(error.message || "Failed to load rental bookings.");
      })
      .finally(() => {
        if (!isActive) return;
        setRentalsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [role, user?.id]);

  if (role === "guest") {
    return (
      <div className="page scroll-animate" style={{ textAlign: "center" }}>
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
          }}
        >
          <Icon d={icons.ticket} size={24} />
        </div>
        <div className="page-title">Sign in to see bookings</div>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate("/login")}>
          Sign in now
        </button>
      </div>
    );
  }

  const trips = [
    {
      id: "#B-4811",
      type: "ticket",
      route: "Phnom Penh to Siem Reap",
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
      route: "Phnom Penh to Kampot",
      company: "Sorya Bus",
      price: "$8.00",
      status: "Completed",
      date: "Mar 12, 2026",
      time: "09:00",
      seat: "A5",
    },
  ];

  const rentalBookings = role === "guest" || !user?.id
    ? []
    : rentals.filter((booking) => booking.status !== "Cancelled");
  const filteredRentals = rentalBookings.filter((booking) => {
    if (rentalFilter === "all") return true;
    return booking.status.toLowerCase() === rentalFilter;
  });
  const filteredTrips = trips.filter((booking) => {
    if (tripFilter === "all") return true;
    const isPast = booking.status.toLowerCase() === "completed";
    return tripFilter === "past" ? isPast : !isPast;
  });
  const currentBookings = tab === "rentals" ? filteredRentals : filteredTrips;
  const openCancelRental = (booking) => {
    setCancelError("");
    setCancelSuccess("");
    setPendingCancelBooking(booking);
  };
  const closeCancelRental = () => {
    if (cancelingRentalId) return;
    setPendingCancelBooking(null);
  };
  const handleCancelRental = async () => {
    const booking = pendingCancelBooking;
    if (!user?.id || !booking?.rawId) return;

    setCancelingRentalId(booking.rawId);
    setCancelError("");
    setCancelSuccess("");

    try {
      const response = await fetch(`/api/cars/bookings/${booking.rawId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getCancelErrorMessage(response, responseData));
      }

      const updatedRental = normalizeRental(responseData);
      setRentals((previousRentals) => previousRentals
        .map((rental) => (rental.rawId === updatedRental.rawId ? updatedRental : rental))
        .filter((rental) => rental.status !== "Cancelled"));
      setCancelSuccess(`${booking.route} was cancelled. The car is available again.`);
      setPendingCancelBooking(null);
    } catch (error) {
      setCancelError(
        error.message ||
          "Could not cancel this rental. Please make sure the backend server is running, then try again.",
      );
    } finally {
      setCancelingRentalId(null);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-title">My bookings</div>
      <div className="page-sub">Track all your travel activity</div>

      <div className="pill-nav" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "trips", label: "Trips" },
            { id: "rentals", label: "Rentals" },
          ].map((item) => (
            <div
              key={item.id}
              className={`pill-tab ${tab === item.id ? "active" : ""}`}
              onClick={() => {
                if (setBookingsTab) setBookingsTab(item.id);
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {tab === "rentals" && (
        <div className="pill-nav" style={{ marginTop: -6, marginBottom: 20 }}>
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "rented", label: "Rented" },
            { id: "returned", label: "Returned" },
          ].map((item) => (
            <div
              key={item.id}
              className={`pill-tab ${rentalFilter === item.id ? "active" : ""}`}
              onClick={() => setRentalFilter(item.id)}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}

      {tab === "trips" && (
        <div className="pill-nav" style={{ marginTop: -6, marginBottom: 20 }}>
          {[
            { id: "all", label: "All" },
            { id: "upcoming", label: "Upcoming" },
            { id: "past", label: "Past" },
          ].map((item) => (
            <div
              key={item.id}
              className={`pill-tab ${tripFilter === item.id ? "active" : ""}`}
              onClick={() => setTripFilter(item.id)}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}

      {tab === "rentals" && rentalsLoading && (
        <div className="booking-item ticket-card">Loading rental bookings...</div>
      )}
      {tab === "rentals" && rentalsError && (
        <div className="rental-search-note rental-search-error">{rentalsError}</div>
      )}
      {tab === "rentals" && cancelError && (
        <div className="rental-search-note rental-search-error" style={{ marginBottom: 12 }}>
          {cancelError}
        </div>
      )}
      {tab === "rentals" && cancelSuccess && (
        <div className="rental-search-note" style={{ color: "var(--green)", marginBottom: 12 }}>
          {cancelSuccess}
        </div>
      )}
      {tab === "rentals" && !rentalsLoading && !rentalsError && currentBookings.length === 0 && (
        <div className="booking-item ticket-card">
          <div className="booking-route">No rental bookings yet</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            Your rented cars will appear here after payment confirmation.
          </div>
        </div>
      )}

      {currentBookings.map((booking, index) => (
        <div
          key={booking.id}
          className="booking-item ticket-card scroll-animate"
          style={{ "--delay": `${index * 40}ms` }}
        >
          <div className="booking-header">
            <div>
              <span
                className={`badge ${booking.type === "ticket" ? "badge-blue" : "badge-purple"}`}
                style={{ marginBottom: 6, fontSize: 9 }}
              >
                {booking.type === "ticket" ? "BUS TICKET" : "MY RENTED CAR"}
              </span>
              <div className="booking-route">{booking.route}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                {booking.id} - {booking.date}
              </div>
              {booking.type === "ticket" && (
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
                      background: getCompanyMeta(booking.company).color,
                    }}
                  />
                  <span style={{ color: getCompanyMeta(booking.company).color }}>
                    {booking.company}
                  </span>
                </div>
              )}
              {booking.type === "rental" && (
                <div style={{ fontSize: 11, color: "var(--text-2)", display: "flex", gap: 8, marginTop: 4 }}>
                  <span>{booking.rentalMode}</span>
                  <span>{booking.payment}</span>
                </div>
              )}
            </div>
            <span
              className={`badge ${
                booking.status === "Confirmed"
                  ? "badge-green"
                  : booking.status === "Completed" || booking.status === "Returned"
                    ? "badge-purple"
                    : booking.status === "Rented"
                      ? "badge-blue"
                      : booking.status === "Cancelled"
                        ? "badge-red"
                        : "badge-amber"
              }`}
            >
              {booking.status}
            </span>
          </div>

          <div className="booking-meta">
            <div className="booking-meta-item">
              {booking.type === "ticket" ? "Departure" : "Duration"}
              <span>{booking.time}</span>
            </div>
            <div className="booking-meta-item">
              {booking.type === "ticket" ? "Seat" : "Plate"}
              <span>{booking.seat}</span>
            </div>
            {booking.type === "ticket" && (
              <div className="booking-meta-item">
                Bus
                <span style={{ color: getCompanyMeta(booking.company).color }}>
                  {booking.company}
                </span>
              </div>
            )}
            <div className="booking-meta-item">
              {booking.type === "ticket" ? "Paid" : "Total"}<span>{booking.price}</span>
            </div>
          </div>

          {booking.type === "rental" && booking.canCancel && (
            <div className="rental-booking-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm rental-cancel-btn"
                onClick={() => openCancelRental(booking)}
                disabled={cancelingRentalId === booking.rawId}
              >
                {cancelingRentalId === booking.rawId ? "Cancelling..." : "Cancel"}
              </button>
            </div>
          )}

          {(booking.status === "Confirmed" || booking.status === "Completed") &&
            booking.type === "ticket" && (
              <div style={{ marginTop: 12, borderTop: "0.5px solid var(--glass-border)", paddingTop: 12 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQrOpen(qrOpen === booking.id ? null : booking.id)}
                >
                  <Icon d={icons.qr} size={13} /> {qrOpen === booking.id ? "Hide Ticket" : "Show Ticket"}
                </button>

                {qrOpen === booking.id && (
                  <div className="qr-reveal">
                    <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                      Scan at boarding gate
                    </div>
                    <div className="qr-mini">
                      <div className="qr-mini-grid">
                        {Array.from({ length: 64 }, (_, qrIndex) => {
                          const isDark =
                            (booking.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + qrIndex) % 2 === 0;
                          return (
                            <div
                              key={qrIndex}
                              style={{ borderRadius: 1, background: isDark ? "#111" : "transparent" }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {booking.id} - {booking.route}
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      ))}
      {pendingCancelBooking && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-rental-title">
          <div className="modal-card">
            <div className="modal-icon" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
              !
            </div>
            <div id="cancel-rental-title" className="modal-title">
              Cancel rental?
            </div>
            <div className="modal-text">
              Do you want to cancel your rental for <strong>{pendingCancelBooking.route}</strong>? This booking will
              change to Cancelled and the car will become available again.
            </div>
            {cancelError && (
              <div className="rental-search-note rental-search-error" style={{ marginBottom: 14 }}>
                {cancelError}
              </div>
            )}
            <div className="modal-btns">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeCancelRental}
                disabled={Boolean(cancelingRentalId)}
              >
                Keep rental
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCancelRental}
                disabled={Boolean(cancelingRentalId)}
              >
                {cancelingRentalId ? "Cancelling..." : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
