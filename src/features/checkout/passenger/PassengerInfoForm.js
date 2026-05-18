import React, { useState } from "react";
import { Icon, icons } from "../../../utils/sharedUser";

const INITIAL_VALUES = {
  firstName: "",
  lastName: "",
  phone: "",
  nationalId: "",
  email: "",
};

function validatePassenger(values) {
  const errors = {};
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const phone = values.phone.trim();
  const nationalId = values.nationalId.trim();
  const email = values.email.trim();

  if (!firstName) {
    errors.firstName = "First name is required.";
  } else if (!/^[A-Za-z\s]{2,40}$/.test(firstName)) {
    errors.firstName = "Use 2-40 letters for first name.";
  }

  if (!lastName) {
    errors.lastName = "Last name is required.";
  } else if (!/^[A-Za-z\s]{2,40}$/.test(lastName)) {
    errors.lastName = "Use 2-40 letters for last name.";
  }

  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (!/^\+?[0-9\s-]{8,20}$/.test(phone)) {
    errors.phone = "Enter a valid phone number.";
  }

  if (!nationalId) {
    errors.nationalId = "National ID or passport is required.";
  } else if (!/^[A-Za-z0-9-]{5,30}$/.test(nationalId)) {
    errors.nationalId = "Use 5-30 letters, numbers, or hyphens.";
  }

  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

export default function PassengerInfoForm({
  initialValues,
  bookingSummary,
  onSubmit,
  onBack,
}) {
  const [values, setValues] = useState({ ...INITIAL_VALUES, ...initialValues });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});

  const updateField = (field, value) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);

    if (touched[field]) {
      setErrors(validatePassenger(nextValues));
    }
  };

  const markTouched = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors(validatePassenger(values));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextTouched = Object.keys(INITIAL_VALUES).reduce(
      (acc, field) => ({ ...acc, [field]: true }),
      {},
    );
    const nextErrors = validatePassenger(values);

    setTouched(nextTouched);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) return;

    onSubmit({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
      nationalId: values.nationalId.trim(),
      email: values.email.trim(),
    });
  };

  const renderError = (field) => (
    touched[field] && errors[field] ? (
      <div className="form-error">{errors[field]}</div>
    ) : null
  );

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="sec-title">Passenger information</div>
      <div className="form-row">
        <div>
          <div className="label">First name</div>
          <input
            value={values.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
            onBlur={() => markTouched("firstName")}
            className={touched.firstName && errors.firstName ? "input-error" : ""}
            placeholder="Sereymongkol"
          />
          {renderError("firstName")}
        </div>
        <div>
          <div className="label">Last name</div>
          <input
            value={values.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
            onBlur={() => markTouched("lastName")}
            className={touched.lastName && errors.lastName ? "input-error" : ""}
            placeholder="Thoeung"
          />
          {renderError("lastName")}
        </div>
      </div>
      <div className="form-group">
        <div className="label">Phone number</div>
        <input
          value={values.phone}
          onChange={(event) => updateField("phone", event.target.value)}
          onBlur={() => markTouched("phone")}
          className={touched.phone && errors.phone ? "input-error" : ""}
          placeholder="+855 17 420 051"
        />
        {renderError("phone")}
      </div>
      <div className="form-group">
        <div className="label">National ID / Passport</div>
        <input
          value={values.nationalId}
          onChange={(event) => updateField("nationalId", event.target.value)}
          onBlur={() => markTouched("nationalId")}
          className={touched.nationalId && errors.nationalId ? "input-error" : ""}
          placeholder="ID123456789"
        />
        {renderError("nationalId")}
      </div>
      <div className="form-group">
        <div className="label">Email (for ticket)</div>
        <input
          type="email"
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          onBlur={() => markTouched("email")}
          className={touched.email && errors.email ? "input-error" : ""}
          placeholder="name@example.com"
        />
        {renderError("email")}
      </div>

      {bookingSummary && (
        <div className="booking-summary-list" style={{ marginTop: 18 }}>
          <div className="booking-summary-row">
            <span>Route</span>
            <strong>{bookingSummary.route}</strong>
          </div>
          <div className="booking-summary-row">
            <span>Date</span>
            <strong>{bookingSummary.date}</strong>
          </div>
          <div className="booking-summary-row">
            <span>Seats</span>
            <strong>{bookingSummary.seats}</strong>
          </div>
          <div className="booking-summary-row">
            <span>Total</span>
            <strong>{bookingSummary.total}</strong>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button
          type="button"
          className="btn btn-ghost btn-round-back"
          aria-label="Back"
          onClick={onBack}
        >
          <Icon d={icons.back} size={15} />
        </button>
        <button type="submit" className="btn btn-primary btn-lg">
          Continue <Icon d={icons.arrow} size={15} color="#fff" />
        </button>
      </div>
    </form>
  );
}
