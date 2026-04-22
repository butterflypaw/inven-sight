import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDetails } from "../services/api";
import "../styles/Alerts.css";

const Alerts = () => {
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [records, setRecords] = useState([]);
  const [acknowledged, setAcknowledged] = useState(() => {
    const cached = window.localStorage.getItem("acknowledgedAlerts");
    return cached ? JSON.parse(cached) : [];
  });

  const visibleAlerts = useMemo(() => {
    const mapped = records
      .filter((row) => String(row.damage).toLowerCase() === "damaged")
      .map((row) => ({
        id: row.id,
        itemId: row.itemId || row.productName || `INV-${String(row.id).padStart(8, "0")}`,
        sku: row.sku || "N/A",
        severity: Number(row.confidence) >= 75 ? "high" : "medium",
        confidence: row.confidence,
        zone: row.shippedFrom || "Unknown",
        at: row.timestamp || "-",
      }));

    let rows = mapped.filter((a) => !acknowledged.includes(a.id));
    if (showOnlyCritical) {
      rows = rows.filter((a) => a.severity === "high");
    }
    return rows;
  }, [acknowledged, showOnlyCritical, records]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchDetails();
        setRecords(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Failed to fetch alerts:", error);
        setRecords([]);
      }
    };

    load();
    const interval = window.setInterval(load, 7000);

    return () => window.clearInterval(interval);
  }, []);

  const acknowledge = (id) => {
    setAcknowledged((prev) => {
      const next = [...new Set([...prev, id])];
      window.localStorage.setItem("acknowledgedAlerts", JSON.stringify(next));
      return next;
    });
  };

  const resetAlerts = () => {
    setAcknowledged([]);
    window.localStorage.removeItem("acknowledgedAlerts");
  };

  return (
    <section className="alerts-page">
      <div className="alerts-hero">
        <div>
          <h2>Active Alerts</h2>
          <p>Review high-risk detections, acknowledge resolved issues, and keep operators focused.</p>
        </div>
        <div className="alerts-actions">
          <button className="outline-btn" onClick={() => setShowOnlyCritical((prev) => !prev)}>
            {showOnlyCritical ? "Show All" : "Critical Only"}
          </button>
          <button className="outline-btn" onClick={resetAlerts}>Reset</button>
          <Link to="/details" className="filled-btn">Open Full History</Link>
        </div>
      </div>

      <div className="alerts-grid">
        {visibleAlerts.length === 0 && (
          <article className="alert-card empty">
            <h3>No active alerts</h3>
            <p>Everything currently acknowledged. Monitor scan stream for new incidents.</p>
          </article>
        )}

        {visibleAlerts.map((alert) => (
          <article key={alert.id} className={`alert-card ${alert.severity}`}>
            <div className="alert-top">
              <strong>{alert.id}</strong>
              <span className={`severity ${alert.severity}`}>{alert.severity.toUpperCase()}</span>
            </div>
            <h3>{alert.itemId}</h3>
            <p>SKU: {alert.sku}</p>
            <p>Zone: {alert.zone}</p>
            <p>Confidence: {alert.confidence}%</p>
            <p>Detected: {alert.at}</p>
            <button className="ack-btn" onClick={() => acknowledge(alert.id)}>Acknowledge</button>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Alerts;
