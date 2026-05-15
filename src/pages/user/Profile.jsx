import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, icons, setupScrollReveal } from "../../utils/sharedUser";

export default function Profile({ role, userId, onLogout }) {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    national_id: "",
  });
  const [status, setStatus] = useState({
    loading: false,
    error: null,
    success: null,
  });
  const [passwordStatus, setPasswordStatus] = useState({
    loading: false,
    error: null,
    success: null,
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    if (role === "guest" || !userId) return;

    const fetchUserProfile = async () => {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (data.error) {
          setStatus({ loading: false, error: data.error, success: null });
          return;
        }
        setUserInfo(data);
        setForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          phone: data.phone || "",
          national_id: data.national_id || "",
        });
      } catch (err) {
        setStatus({
          loading: false,
          error: err.message || "Unable to load profile",
          success: null,
        });
      }
    };

    fetchUserProfile();
  }, [role, userId]);

  useEffect(() => {
    if (userInfo) {
      const cleanup = setupScrollReveal();
      return cleanup;
    }
  }, [userInfo]);

  const handleInputChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus({ loading: false, error: null, success: null });
  };

  const handleSaveProfile = async () => {
    setStatus({ loading: true, error: null, success: null });

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({
          loading: false,
          error: data.error || "Unable to save profile",
          success: null,
        });
        return;
      }
      setUserInfo(data);
      setStatus({
        loading: false,
        error: null,
        success: "Profile updated successfully.",
      });
    } catch (err) {
      setStatus({
        loading: false,
        error: err.message || "Unable to save profile",
        success: null,
      });
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordStatus({
        loading: false,
        error: "Passwords do not match.",
        success: null,
      });
      return;
    }

    setPasswordStatus({ loading: true, error: null, success: null });

    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(userId)}/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_password: passwordForm.current_password,
            new_password: passwordForm.new_password,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setPasswordStatus({
          loading: false,
          error: data.error || "Unable to change password",
          success: null,
        });
        return;
      }
      setPasswordStatus({
        loading: false,
        error: null,
        success: data.message || "Password updated.",
      });
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      setPasswordStatus({
        loading: false,
        error: err.message || "Unable to change password",
        success: null,
      });
    }
  };

  if (role === "guest")
    return (
      <div className="page" style={{ textAlign: "center" }}>
        <div className="profile-avatar" style={{ opacity: 0.3 }}>
          ?
        </div>
        <div className="page-title">Private Profile</div>
        <button
          className="btn btn-primary"
          style={{ marginTop: 20 }}
          onClick={() => navigate("/login")}
        >
          Sign in now
        </button>
      </div>
    );

  if (!userInfo)
    return (
      <div className="page" style={{ textAlign: "center" }}>
        <div className="page-title">Loading profile…</div>
      </div>
    );

  const initials =
    `${(userInfo.first_name || "")[0] || ""}${(userInfo.last_name || "")[0] || ""}`.toUpperCase();
  const memberSince = userInfo.created_at
    ? new Date(userInfo.created_at).getFullYear()
    : "-";
  const stats = userInfo.stats || {
    total_trips: 0,
    total_rentals: 0,
    favorite_route: "N/A",
  };

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="page-title scroll-animate">My profile</div>
      <div className="page-sub scroll-animate">Manage your account details</div>

      <div
        className="card scroll-animate"
        style={{ textAlign: "center", marginBottom: 16, padding: "28px" }}
      >
        <div className="profile-avatar">{initials || "U"}</div>
        <div
          style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}
        >{`${userInfo.first_name} ${userInfo.last_name}`}</div>
        <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
          {userInfo.email}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
          <span className="badge badge-green">Verified</span>
          <span className="badge badge-blue">Member since {memberSince}</span>
        </div>
      </div>

      <div className="card scroll-animate" style={{ marginBottom: 16 }}>
        <div className="sec-title">Personal information</div>
        <div className="form-row">
          <div>
            <div className="label">First name</div>
            <input
              value={form.first_name}
              onChange={(e) => handleInputChange("first_name", e.target.value)}
            />
          </div>
          <div>
            <div className="label">Last name</div>
            <input
              value={form.last_name}
              onChange={(e) => handleInputChange("last_name", e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <div className="label">Email</div>
          <input
            value={form.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
          />
        </div>
        <div className="form-group">
          <div className="label">Phone</div>
          <input
            value={form.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
          />
        </div>
        <div className="form-group">
          <div className="label">National ID</div>
          <input
            value={form.national_id}
            onChange={(e) => handleInputChange("national_id", e.target.value)}
          />
        </div>
        {status.error && <div className="form-error">{status.error}</div>}
        {status.success && <div className="form-success">{status.success}</div>}
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSaveProfile}
          disabled={status.loading}
        >
          <Icon d={icons.edit} size={13} color="#fff" /> Save changes
        </button>
      </div>

      <div className="card scroll-animate" style={{ marginBottom: 16 }}>
        <div className="sec-title">Change password</div>
        <div className="form-group">
          <div className="label">Current password</div>
          <input
            type="password"
            value={passwordForm.current_password}
            onChange={(e) =>
              setPasswordForm((prev) => ({
                ...prev,
                current_password: e.target.value,
              }))
            }
            placeholder="••••••••"
          />
        </div>
        <div className="form-group">
          <div className="label">New password</div>
          <input
            type="password"
            value={passwordForm.new_password}
            onChange={(e) =>
              setPasswordForm((prev) => ({
                ...prev,
                new_password: e.target.value,
              }))
            }
            placeholder="••••••••"
          />
        </div>
        <div className="form-group">
          <div className="label">Confirm new password</div>
          <input
            type="password"
            value={passwordForm.confirm_password}
            onChange={(e) =>
              setPasswordForm((prev) => ({
                ...prev,
                confirm_password: e.target.value,
              }))
            }
            placeholder="••••••••"
          />
        </div>
        {passwordStatus.error && (
          <div className="form-error">{passwordStatus.error}</div>
        )}
        {passwordStatus.success && (
          <div className="form-success">{passwordStatus.success}</div>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={handlePasswordChange}
          disabled={passwordStatus.loading}
        >
          Update password
        </button>
      </div>

      <div className="card scroll-animate">
        <div className="sec-title" style={{ marginBottom: 8 }}>
          Trip stats
        </div>
        {[
          { k: "Total trips", v: stats.total_trips },
          { k: "Total rentals", v: stats.total_rentals },
          { k: "Favourite route", v: stats.favorite_route },
        ].map((s) => (
          <div
            key={s.k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "9px 0",
              borderBottom: "0.5px solid rgba(255,255,255,0.05)",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>{s.k}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{s.v}</span>
          </div>
        ))}
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-red btn-sm" onClick={onLogout}>
            <Icon d={icons.logout} size={12} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
