import { useState, useEffect, useMemo } from "react";
import { LineChart } from "@mui/x-charts/LineChart";

const BUCKET_LABELS = ["12 AM", "3 AM", "6 AM", "9 AM", "12 PM", "3 PM", "6 PM", "9 PM"];

const HourlyScansChart = ({ records }) => {
  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.dataset.theme === "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const data = useMemo(() => {
    const counts = Array(8).fill(0);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    records.forEach((r) => {
      if (!r.timestamp) return;
      const d = new Date(r.timestamp);
      if (isNaN(d.getTime()) || d < startOfToday) return;
      counts[Math.floor(d.getHours() / 3)] += 1;
    });
    return counts;
  }, [records]);

  const axisColor = isDark ? "#9fb2c9" : "#475569";
  const labelColor = isDark ? "#dce8f9" : "#1f2937";
  const color = "#7c3aed";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", color: labelColor, marginBottom: "4px", fontSize: "0.9rem", fontWeight: 600 }}>
        <span style={{ width: 18, height: 4, borderRadius: 999, background: color, display: "inline-block" }} />
        <span>Scans Today</span>
      </div>
      <LineChart
        xAxis={[{ data: BUCKET_LABELS, scaleType: "point" }]}
        series={[{ curve: "linear", data, color }]}
        height={150}
        margin={{ left: 10, right: 30 }}
        legend={{ hidden: true }}
        sx={{
          "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { stroke: axisColor },
          "& .MuiChartsAxis-tickLabel": { fill: axisColor },
        }}
      />
    </div>
  );
};

export default HourlyScansChart;
