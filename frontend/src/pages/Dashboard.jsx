import React, { useEffect, useState } from "react";
import "../styles/Dashboard.css";
import DetailList from "../components/DetailList"; 
import DonutChart from "../components/DonutChart";
import DamagedLineChart from "../components/DamagedLineChart";
import { fetchDashboardStats, fetchDetails } from "../services/api";
import { FaArrowTrendDown, FaArrowTrendUp, FaShieldHalved } from "react-icons/fa6";
import ConfidenceHistogram from "../components/ConfidenceHistogram";
import HourlyScansChart from "../components/HourlyScansChart";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [alerts, setAlerts] = useState([]);

  const buildTrend = (rows) => {
    const toLocalDayKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daySlots = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - idx));
      const key = toLocalDayKey(date);
      return {
        key,
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        damaged: 0,
        intact: 0,
      };
    });

    const slotMap = daySlots.reduce((acc, slot) => {
      acc[slot.key] = slot;
      return acc;
    }, {});

    rows.forEach((item) => {
      const rawTimestamp = item?.timestamp;
      if (!rawTimestamp) return;
      const date = new Date(rawTimestamp);
      if (Number.isNaN(date.getTime())) return;

      const dayKey = toLocalDayKey(date);
      const slot = slotMap[dayKey];
      if (!slot) return;

      if (String(item.damage).toLowerCase() === "damaged") {
        slot.damaged += 1;
      } else {
        slot.intact += 1;
      }
    });

    return {
      labels: daySlots.map((s) => s.label),
      damaged: daySlots.map((s) => s.damaged),
      intact: daySlots.map((s) => s.intact),
    };
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const statsRes = await fetchDashboardStats();
        const alertsRes = await fetchDetails();
        setStats(statsRes.data || { totalScanned: 0, damagedCount: 0 });
        setAlerts(alertsRes.data);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setStats({ totalScanned: 0, damagedCount: 0 });
        setAlerts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
    const interval = window.setInterval(loadDashboard, 20000);

    return () => window.clearInterval(interval);
  }, []);

  const safeStats = stats || { totalScanned: 0, damagedCount: 0 };

  const intactCount = Math.max(0, safeStats.totalScanned - safeStats.damagedCount);
  const damageRate = safeStats.totalScanned
    ? ((safeStats.damagedCount / safeStats.totalScanned) * 100).toFixed(1)
    : "0.0";
  const intactRate = safeStats.totalScanned
    ? ((intactCount / safeStats.totalScanned) * 100).toFixed(1)
    : "0.0";
  const trend = buildTrend(alerts);

  const scansToday = alerts.filter((item) => {
    if (!item.timestamp) return false;
    const date = new Date(item.timestamp);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return date >= startOfToday;
  }).length;

  const damagedVsIntact = safeStats.damagedCount - intactCount;
  const riskTrendText =
    safeStats.totalScanned === 0
      ? "No scans yet. Start scanning boxes to build a risk trend."
      : damagedVsIntact > 0
        ? "Damaged items are ahead of intact items. Recheck the highest-risk boxes and tighten conveyor inspection."
        : Number(damageRate) >= 25
          ? "Damage is elevated. Keep an eye on packaging quality and aisle-level handling."
          : "Damage is under control. Keep the current inspection flow running.";

  const recoverySignalText =
    safeStats.totalScanned === 0
      ? "Recovery signal will appear after the first scans land."
      : intactCount >= safeStats.damagedCount
        ? "Intact flow is stronger than damaged flow. Continue the current packing process and monitor the trend."
        : "Recovery is not stable yet. Focus on reducing damaged detections before scaling up throughput.";

  const aiSuggestionText =
    safeStats.totalScanned === 0
      ? "Use consistent box framing and capture at least one sample to activate smarter guidance."
      : damagedVsIntact > 0
        ? "Capture two angles for each box and slow the conveyor window slightly to confirm borderline damaged cases."
        : Number(damageRate) >= 25
          ? "Keep the camera centered on the box seam and inspect cartons under better light to reduce false damage calls."
          : "Current detection looks healthy. Maintain the present scanning cadence and keep uploading only box/package images.";

  const formatMetric = (value) => (isLoading ? "--" : value);

  return (
    <div className="dashboard-header-banner">
      <div className="dashboard-header">
        <h1>Inventory Overview</h1>
        <p>Monitor scanning activity, damage reports, and stock levels</p>

        <div className="header-stats">
          <div className="header-stat-card">
            <span className="label">Damage Rate</span>
            <strong>{isLoading ? "--" : `${damageRate}%`}</strong>
            <span className="muted">Last 24 hours</span>
          </div>
          <div className="header-stat-card">
            <span className="label">Intact Rate</span>
            <strong>{isLoading ? "--" : `${intactRate}%`}</strong>
            <span className="muted">Share of scans marked intact</span>
          </div>
        </div>
      </div>

      <div className="dashboard-cards">
        <Card
          title="Total Scanned"
          value={formatMetric(safeStats.totalScanned)}
          color="#2563eb"
          loading={isLoading}
          chart={
            <DonutChart
              damaged={safeStats.damagedCount}
              intact={intactCount}
            />
          }
        />
        <Card
          title="Damaged Items"
          value={formatMetric(safeStats.damagedCount)}
          color="#dc2626"
          loading={isLoading}
          chart={
            <DamagedLineChart
              labels={trend.labels}
              displayData={trend.damaged}
              color="#dc2626"
              label="Damaged Items"
            />
          }
        />
        <Card
          title="Intact Items"
          value={formatMetric(intactCount)}
          color="#16a34a"
          loading={isLoading}
          chart={
            <DamagedLineChart
              labels={trend.labels}
              displayData={trend.intact}
              color="#16a34a"
              label="Intact Items"
            />
          }
        />
        <Card
          title="Scans Today"
          value={formatMetric(scansToday)}
          color="#7c3aed"
          loading={isLoading}
          chart={<HourlyScansChart records={alerts} />}
        />
      </div>

      <div className="insight-grid">
        <div className="insight-card warning">
          <FaArrowTrendUp className="insight-icon" />
          <div>
            <h3>Risk Trend</h3>
            <p>{riskTrendText}</p>
          </div>
        </div>
        <div className="insight-card success">
          <FaArrowTrendDown className="insight-icon" />
          <div>
            <h3>Recovery Signal</h3>
            <p>{recoverySignalText}</p>
          </div>
        </div>
        <div className="insight-card info">
          <FaShieldHalved className="insight-icon" />
          <div>
            <h3>AI Suggestion</h3>
            <p>{aiSuggestionText}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Confidence Distribution</h2>
        <ConfidenceHistogram records={alerts} />
      </div>

      <div className="dashboard-section">
        <h2>Recent Scanned Item Details</h2>
        <DetailList alerts={alerts} />
      </div>
    </div>
  );
};

// Card component with optional chart support
const Card = ({ title, value, color, chart, loading }) => (
  <div className={`stat-card ${loading ? "is-loading" : ""}`} style={{ borderTop: `4px solid ${color}` }}>
    <h3>{title}</h3>
    <p>{value}</p>
    {chart && <div className="card-chart">{chart}</div>}
  </div>
);

export default Dashboard;
