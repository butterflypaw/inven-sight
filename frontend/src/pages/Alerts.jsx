import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaVolumeHigh, FaVolumeXmark } from "react-icons/fa6";
import { fetchDetails } from "../services/api";
import "../styles/Alerts.css";

const Alerts = () => {
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [muted, setMuted] = useState(() => window.localStorage.getItem("invensight-mute-alerts") === "true");
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

  const resolvedAlerts = useMemo(() => {
    return mappedAlerts.filter((alert) => resolved.includes(alert.id));
  }, [mappedAlerts, resolved]);

  const displayedAlerts =
    activeTab === "acknowledged" ? acknowledgedAlerts :
    activeTab === "resolved" ? resolvedAlerts :
    visibleAlerts;

  useEffect(() => {
    window.localStorage.setItem("invensight-active-alert-count", String(visibleAlerts.length));
    window.dispatchEvent(new CustomEvent("invensight-alert-count-change", { detail: visibleAlerts.length }));
  }, [visibleAlerts.length]);

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

    if (muted) return;

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
  }, [isLoading, muted, visibleAlerts]);

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

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem("invensight-mute-alerts", String(next));
      return next;
    });
  };

  const unacknowledge = (id) => {
    setAcknowledged((prev) => {
      const next = prev.filter((entryId) => entryId !== id);
      window.localStorage.setItem("acknowledgedAlerts", JSON.stringify(next));
      return next;
    });
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
            <button
              className={`outline-btn ${activeTab === "resolved" ? "tab-active" : ""}`}
              role="tab"
              aria-selected={activeTab === "resolved"}
              onClick={() => setActiveTab("resolved")}
            >
              Resolved ({resolvedAlerts.length})
            </button>
          </div>
          <select
            className="filter-select"
            value={showOnlyCritical ? "critical" : "all"}
            onChange={(e) => setShowOnlyCritical(e.target.value === "critical")}
            aria-label="Severity filter"
          >
            <option value="all">Show All</option>
            <option value="critical">Critical Only</option>
          </select>
          <button className="outline-btn mute-btn" onClick={toggleMute} aria-label={muted ? "Unmute alerts" : "Mute alerts"} title={muted ? "Unmute alerts" : "Mute alerts"}>
            {muted ? <FaVolumeXmark /> : <FaVolumeHigh />}
          </button>
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
            <h3>
              {activeTab === "acknowledged" ? "No acknowledged alerts" :
               activeTab === "resolved" ? "No resolved alerts" :
               "No active alerts"}
            </h3>
            <p>
              {activeTab === "acknowledged"
                ? "Acknowledge an active alert to move it here."
                : activeTab === "resolved"
                ? "Resolved alerts will appear here after you resolve them from the Acknowledged tab."
                : "Everything looks clear. Monitor the scan stream for new incidents."}
            </p>
          </article>
        )}

        {!isLoading && displayedAlerts.map((alert) => (
          <article key={alert.id} className={`alert-card ${alert.severity}`}>
            <div className="alert-top">
              <strong>{alert.id}</strong>
              <span className={`severity ${alert.severity}`}>
                {activeTab === "acknowledged" ? "ACKNOWLEDGED" :
                 activeTab === "resolved" ? "RESOLVED" :
                 alert.severity.toUpperCase()}
              </span>
            </div>
            <h3>{alert.itemId}</h3>
            <p>SKU: {alert.sku}</p>
            <p>Zone: {alert.zone}</p>
            <p>Confidence: {alert.confidence}%</p>
            <p>Detected: {alert.at}</p>
            {activeTab === "active" && (
              <button className="ack-btn" onClick={() => acknowledge(alert.id)}>Acknowledge</button>
            )}
            {activeTab === "acknowledged" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="ack-btn" onClick={() => resolveAlert(alert.id)}>Resolve</button>
                <button className="ack-btn" onClick={() => unacknowledge(alert.id)}>Move to Active</button>
              </div>
            )}
            {activeTab === "resolved" && (
              <span style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 6, display: "block" }}>Resolved</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default Alerts;
