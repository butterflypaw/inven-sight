import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { useMemo, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Inventory from "./pages/Inventory";
import Details from "./pages/Details"; 
import Alerts from "./pages/Alerts";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import { Toaster } from "react-hot-toast";

const STORAGE_KEY = "invensight-auth";

function AppShell() {
  const [user, setUser] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  const handleLogin = (payload) => {
    const nextUser = {
      provider: payload?.provider || "local",
      name: payload?.name || "Operator",
      email: payload?.email || "",
      at: new Date().toISOString(),
    };
    setUser(nextUser);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  };

  const handleLogout = () => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <Layout onLogout={handleLogout}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: "14px",
            padding: "12px 16px",
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/details" element={<Details />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
