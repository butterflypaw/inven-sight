import React, { useEffect, useState } from "react";
import "../styles/Dashboard.css";
import DetailList from "../components/DetailList"; 
import DonutChart from "../components/DonutChart";
import DamagedLineChart from "../components/DamagedLineChart";
import { fetchDashboardStats, fetchDetails } from "../services/api";
import { FaArrowTrendDown, FaArrowTrendUp, FaShieldHalved } from "react-icons/fa6";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalScanned: 287,
    damagedCount: 40,
  });

  const [alerts, setAlerts] = useState([]);

  const buildTrend = (rows) => {
    const slots = Array.from({ length: 7 }, (_, idx) => ({
      key: idx,
      damaged: 0,
      intact: 0,
    }));

    rows.slice(0, 70).forEach((item, idx) => {
      const slotIndex = idx % 7;
      if (String(item.damage).toLowerCase() === "damaged") {
        slots[slotIndex].damaged += 1;
      } else {
        slots[slotIndex].intact += 1;
      }
    });

    return {
      damaged: slots.map((s) => s.damaged),
      intact: slots.map((s) => s.intact),
    };
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const statsRes = await fetchDashboardStats();
        const alertsRes = await fetchDetails();
        setStats(statsRes.data);
        setAlerts(alertsRes.data);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setAlerts([]);
      }
    };

    loadDashboard();
    const interval = window.setInterval(loadDashboard, 7000);

    return () => window.clearInterval(interval);
  }, []);

  const intactCount = Math.max(0, stats.totalScanned - stats.damagedCount);
  const damageRate = stats.totalScanned
    ? ((stats.damagedCount / stats.totalScanned) * 100).toFixed(1)
    : "0.0";
  const healthScore = Math.max(0, 100 - Number(damageRate));
  const trend = buildTrend(alerts);

  return (
    <div className="dashboard-header-banner">
      <div className="dashboard-header">
        <h1>Inventory Overview</h1>
        <p>Monitor scanning activity, damage reports, and stock levels</p>

        <div className="header-stats">
          <div className="header-stat-card">
            <span className="label">Damage Rate</span>
            <strong>{damageRate}%</strong>
            <span className="muted">Last 24 hours</span>
          </div>
          <div className="header-stat-card">
            <span className="label">System Health</span>
            <strong>{healthScore}%</strong>
            <span className="muted">Model + camera reliability</span>
          </div>
        </div>
      </div>

      <div className="dashboard-cards">
        <Card
          title="Total Scanned Today"
          value={stats.totalScanned}
          color="#2563eb"
          chart={
            <DonutChart
              damaged={stats.damagedCount}
              intact={intactCount}
            />
          }
        />
        <Card
          title="Damaged Items"
          value={stats.damagedCount}
          color="#dc2626"
          chart={
            <DamagedLineChart
              displayData={trend.damaged}
              color="#dc2626"
              label="Damaged Items"
            />
          }
        />
        <Card
          title="Intact Items"
          value={intactCount}
          color="#16a34a"
          chart={
            <DamagedLineChart
              displayData={trend.intact}
              color="#16a34a"
              label="Intact Items"
            />
          }
        />
      </div>

      <div className="insight-grid">
        <div className="insight-card warning">
          <FaArrowTrendUp className="insight-icon" />
          <div>
            <h3>Risk Trend</h3>
            <p>
              Damaged detections are above baseline. Trigger an aisle-level recheck
              for high-risk SKUs.
            </p>
          </div>
        </div>
        <div className="insight-card success">
          <FaArrowTrendDown className="insight-icon" />
          <div>
            <h3>Recovery Signal</h3>
            <p>
              Intact flow is stabilizing in the latest scans. Continue current
              packaging process for now.
            </p>
          </div>
        </div>
        <div className="insight-card info">
          <FaShieldHalved className="insight-icon" />
          <div>
            <h3>AI Suggestion</h3>
            <p>
              Improve confidence by capturing two angles for large cartons in
              low-light zones.
            </p>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Recent Scanned Item Details</h2>
        <DetailList alerts={alerts} />

      </div>
    </div>
  );
};

// Card component with optional chart support
const Card = ({ title, value, color, chart }) => (
  <div className="stat-card" style={{ borderTop: `4px solid ${color}` }}>
    <h3>{title}</h3>
    <p>{value}</p>
    {chart && <div className="card-chart">{chart}</div>}
  </div>
);

export default Dashboard;
