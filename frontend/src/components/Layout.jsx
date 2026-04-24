import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import "./Layout.css";
import {
  FaHome,
  FaBarcode,
  FaBoxes,
  FaBell,
  FaHistory,
  FaMoon,
  FaSun,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import invensightLogo from "../assets/invensight-logo.svg";

const Layout = ({ children, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertBadge, setAlertBadge] = useState(() => {
    const v = window.localStorage.getItem("invensight-active-alert-count");
    return v ? Number(v) : 0;
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.localStorage.getItem("invensight-theme") || "light";
  });
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("invensight-theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleCount = (e) => setAlertBadge(e.detail);
    window.addEventListener("invensight-alert-count-change", handleCount);
    return () => window.removeEventListener("invensight-alert-count-change", handleCount);
  }, []);

  const pageName = useMemo(() => {
    const map = {
      "/": "Dashboard",
      "/scan": "Smart Scan",
      "/inventory": "Inventory",
      "/alerts": "Alerts",
      "/details": "Scan History",
    };
    return map[location.pathname] || "InvenSight";
  }, [location.pathname]);

  const navLinkClass = ({ isActive }) =>
    `nav-link ${isActive ? "active-link" : ""}`;

  return (
    <div className={`layout ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <button
          type="button"
          className="brand brand-btn"
          onClick={() => {
            navigate("/");
            setMenuOpen(false);
          }}
          aria-label="Go to dashboard"
        >
          <img src={invensightLogo} alt="InvenSight Logo" className="logo" />
        </button>

        <nav>
          <NavLink to="/" end className={navLinkClass} onClick={() => setMenuOpen(false)}>
            <FaHome className="icon" />
            Dashboard
          </NavLink>
          <NavLink to="/scan" className={navLinkClass} onClick={() => setMenuOpen(false)}>
            <FaBarcode className="icon" />
            Smart Scan
          </NavLink>
          <NavLink to="/inventory" className={navLinkClass} onClick={() => setMenuOpen(false)}>
            <FaBoxes className="icon" />
            Inventory
          </NavLink>
          <NavLink to="/alerts" className={navLinkClass} onClick={() => setMenuOpen(false)}>
            <FaBell className="icon" />
            Alerts
            {alertBadge > 0 && <span className="nav-badge">{alertBadge}</span>}
          </NavLink>
          <NavLink to="/details" className={navLinkClass} onClick={() => setMenuOpen(false)}>
            <FaHistory className="icon" />
            Scan History
          </NavLink>
        </nav>
      </aside>

      {menuOpen && <div className="mobile-backdrop" onClick={() => setMenuOpen(false)} />}

      <main className="content">
        <div className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              {menuOpen ? <FaTimes /> : <FaBars />}
            </button>
            <div>
              <h1 className="page-name">{pageName}</h1>
              <p className="page-subtitle">Real-time monitoring and quality intelligence</p>
            </div>
          </div>

          <div className="top-actions">
            <button
              className="theme-btn"
              onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
              aria-label="Toggle theme"
              aria-pressed={theme === "dark"}
            >
              {theme === "light" ? <FaMoon /> : <FaSun />}
            </button>
            {onLogout && (
              <button className="logout-btn" onClick={onLogout}>Logout</button>
            )}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default Layout;
