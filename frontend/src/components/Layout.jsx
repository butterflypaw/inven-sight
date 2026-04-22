import React, { useLayoutEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import "./Layout.css";
import {
  FaHome,
  FaBarcode,
  FaBoxes,
  FaBell,
  FaSearch,
  FaMoon,
  FaSun,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import invensightLogo from "../assets/invensight-logo.svg";

const Layout = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
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
        <div className="brand">
          <img src={invensightLogo} alt="InvenSight Logo" className="logo" />
        </div>

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
          <NavLink to="/details" className={navLinkClass} onClick={() => setMenuOpen(false)}>
            <FaBell className="icon" />
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

          <div className="search">
            <FaSearch className="search-icon" />
            <input placeholder="Search SKU or Item ID..." />
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
            <button className="alert-btn" onClick={() => navigate("/alerts")}>Alerts</button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default Layout;
