import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => {
    if (typeof window === "undefined") return "guest";
    return window.localStorage.getItem("role") || "guest";
  });

  const [userId, setUserId] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("user_id");
  });

  const [redirectToLogin, setRedirectToLogin] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("role", role);
    }
  }, [role]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (userId != null) {
        window.localStorage.setItem("user_id", userId);
      } else {
        window.localStorage.removeItem("user_id");
      }
    }
  }, [userId]);

  const login = (payload) => {
    if (typeof payload === "string") {
      setRole(payload);
      return;
    }
    setRole(payload?.role ?? "guest");
    setUserId(payload?.userId ?? null);
  };

  const logout = () => {
    setRole("guest");
    setUserId(null);
    setRedirectToLogin(true);
  };

  const setGuest = () => {
    setRole("guest");
    setUserId(null);
  };

  const finishRedirect = () => {
    setRedirectToLogin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        userId,
        login,
        logout,
        setGuest,
        redirectToLogin,
        finishRedirect,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
