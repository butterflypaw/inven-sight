import React, { useState } from "react";
import "../styles/Login.css";
import { loginUser, registerUser } from "../services/api";

const Login = ({ onLogin }) => {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

  const handleAuth = async (targetMode) => {
    const user = normalizeUsername(username);
    if (!user || !password) {
      setAuthError("Username and password are required.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      const response = targetMode === "register"
        ? await registerUser(user, password)
        : await loginUser(user, password);

      const profile = response?.data?.user || { username: user };
      onLogin({
        provider: targetMode,
        name: profile.username,
        email: "",
      });
    } catch (error) {
      const message = error?.response?.data?.error || "Authentication failed.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <section className="login-page">
      <div className="login-card">
        <h1>InvenSight</h1>
        <p>
          {mode === "login"
            ? "Sign in to access the warehouse monitoring dashboard."
            : "Create an account to start monitoring scans and alerts."}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setAuthError("");
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setAuthError("");
            }}
          >
            Register
          </button>
        </div>

        <div className="login-fields">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {authError && <small className="auth-error">{authError}</small>}

        <div className="login-actions">
          <button
            className="login-fallback"
            onClick={() => handleAuth(mode)}
            disabled={authLoading}
          >
            {authLoading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </div>

      </div>
    </section>
  );
};

export default Login;
