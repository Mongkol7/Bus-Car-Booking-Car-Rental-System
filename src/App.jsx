import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import AdminApp from "./Admin";
import UserApp from "./User";
import Login from "./Login";
import { useAuth } from "./context/AuthContext";

function App() {
  const {
    role,
    userId,
    login,
    logout,
    setGuest,
    redirectToLogin,
    finishRedirect,
  } = useAuth();

  const RoleRoute = ({ targetRole }) => {
    const { login } = useAuth();
    useEffect(() => {
      login({ role: targetRole, userId: null });
    }, [targetRole, login]);

    return <UserApp role={targetRole} userId={null} onLogout={logout} />;
  };

  return (
    <BrowserRouter>
      <LogoutListener
        shouldRedirect={redirectToLogin}
        onDone={finishRedirect}
      />
      <Routes>
        {/* User / Guest Landing Route */}
        <Route
          path="/"
          element={<UserApp role={role} userId={userId} onLogout={logout} />}
        />

        {/* Explicit Role Routes */}
        <Route path="/guest" element={<RoleRoute targetRole="guest" />} />
        <Route path="/user" element={<RoleRoute targetRole="user" />} />

        {/* Login Route */}
        <Route
          path="/login"
          element={
            role !== "guest" ? (
              <Navigate to={role === "admin" ? "/admin" : "/"} />
            ) : (
              <Login onLogin={login} onGuest={setGuest} initialView="login" />
            )
          }
        />

        {/* Register Route */}
        <Route
          path="/register"
          element={
            <Login onLogin={login} onGuest={setGuest} initialView="register" />
          }
        />

        {/* Admin Route Protection */}
        <Route
          path="/admin"
          element={
            role === "admin" ? (
              <AdminApp onLogout={logout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

function LogoutListener({ shouldRedirect, onDone }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (shouldRedirect) {
      navigate("/login", { replace: true });
      onDone();
    }
  }, [shouldRedirect, navigate, onDone]);
  return null;
}
