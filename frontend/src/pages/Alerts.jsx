import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDetails } from "../services/api";
import "../styles/Alerts.css";

const Alerts = () => {
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const seenAlertIdsRef = useRef(new Set());
  const [acknowledged, setAcknowledged] = useState(() => {
    const cached = window.localStorage.getItem("acknowledgedAlerts");
    return cached ? JSON.parse(cached) : [];
  });
  const [resolved, setResolved] = useState(() => {
    const cached = window.localStorage.getItem("resolvedAlerts");
    return cached ? JSON.parse(cached) : [];
  });

  const mappedAlerts = useMemo(() => {
    return records
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
  }, [records]);

  const visibleAlerts = useMemo(() => {
    let rows = mappedAlerts.filter((a) => !acknowledged.includes(a.id) && !resolved.includes(a.id));
    if (showOnlyCritical) {
      rows = rows.filter((a) => a.severity === "high");
    }
    return rows;
  }, [acknowledged, mappedAlerts, resolved, showOnlyCritical]);

  const acknowledgedAlerts = useMemo(() => {
    return mappedAlerts.filter((alert) => acknowledged.includes(alert.id) && !resolved.includes(alert.id));
  }, [acknowledged, mappedAlerts, resolved]);

  const displayedAlerts = activeTab === "acknowledged" ? acknowledgedAlerts : visibleAlerts;

  useEffect(() => {
    if (isLoading || visibleAlerts.length === 0) {
      return;
    }

    const currentIds = visibleAlerts.map((item) => String(item.id));
    const newIds = currentIds.filter((id) => !seenAlertIdsRef.current.has(id));

    currentIds.forEach((id) => seenAlertIdsRef.current.add(id));
    if (newIds.length === 0) {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = 740;
    gainNode.gain.value = 0.08;

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start();

    window.setTimeout(() => {
      oscillator.stop();
      context.close().catch(() => {});
    }, 260);
  }, [isLoading, visibleAlerts]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchDetails();
        setRecords(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Failed to fetch alerts:", error);
        setRecords([]);
      } finally {
        setIsLoading(false);
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
    setResolved([]);
    window.localStorage.removeItem("acknowledgedAlerts");
    window.localStorage.removeItem("resolvedAlerts");
  };

  const resolveAlert = (id) => {
    setResolved((prev) => {
      const next = [...new Set([...prev, id])];
      window.localStorage.setItem("resolvedAlerts", JSON.stringify(next));
      return next;
    });
    setAcknowledged((prev) => {
      const next = prev.filter((entryId) => entryId !== id);
      window.localStorage.setItem("acknowledgedAlerts", JSON.stringify(next));
      return next;
    });
  };

  return (
    <section className="alerts-page">
      <div className="alerts-hero">
        <div>
          <h2>Active Alerts</h2>
          <p>Review high-risk detections, acknowledge resolved issues, and keep operators focused.</p>
        </div>
        <div className="alerts-actions">
          <div className="alerts-tabs" role="tablist" aria-label="Alert tabs">
            <button
              className={`outline-btn ${activeTab === "active" ? "tab-active" : ""}`}
              role="tab"
              aria-selected={activeTab === "active"}
              onClick={() => setActiveTab("active")}
            >
              Active ({visibleAlerts.length})
            </button>
            <button
              className={`outline-btn ${activeTab === "acknowledged" ? "tab-active" : ""}`}
              role="tab"
              aria-selected={activeTab === "acknowledged"}
              onClick={() => setActiveTab("acknowledged")}
            >
              Acknowledged ({acknowledgedAlerts.length})
            </button>
          </div>
          <button className="outline-btn" onClick={() => setShowOnlyCritical((prev) => !prev)}>
            {showOnlyCritical ? "Show All" : "Critical Only"}
          </button>
          <button className="outline-btn" onClick={resetAlerts}>Reset</button>
          <Link to="/details" className="filled-btn">Open Full History</Link>
        </div>
      </div>

      <div className="alerts-grid">
        {isLoading && (
          <article className="alert-card empty loading">
            <h3>Loading alerts...</h3>
            <p>Fetching latest detection incidents.</p>
          </article>
        )}

        {!isLoading && displayedAlerts.length === 0 && (
          <article className="alert-card empty">
            <h3>{activeTab === "acknowledged" ? "No acknowledged alerts" : "No active alerts"}</h3>
            <p>
              {activeTab === "acknowledged"
                ? "Acknowledge an alert first, then resolve it from this tab."
                : "Everything currently acknowledged. Monitor scan stream for new incidents."}
            </p>
          </article>
        )}

        {!isLoading && displayedAlerts.map((alert) => (
          <article key={alert.id} className={`alert-card ${alert.severity}`}>
            <div className="alert-top">
              <strong>{alert.id}</strong>
              <span className={`severity ${alert.severity}`}>
                {activeTab === "acknowledged" ? "ACKNOWLEDGED" : alert.severity.toUpperCase()}
              </span>
            </div>
            <h3>{alert.itemId}</h3>
            <p>SKU: {alert.sku}</p>
            <p>Zone: {alert.zone}</p>
            <p>Confidence: {alert.confidence}%</p>
            <p>Detected: {alert.at}</p>
            {activeTab === "acknowledged" ? (
              <button className="ack-btn" onClick={() => resolveAlert(alert.id)}>Resolve Alert</button>
            ) : (
              <button className="ack-btn" onClick={() => acknowledge(alert.id)}>Acknowledge</button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default Alerts;
