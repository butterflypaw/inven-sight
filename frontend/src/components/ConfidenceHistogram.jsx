import { useState, useEffect } from "react";
import { BarChart } from "@mui/x-charts";

const BUCKETS = [
  { label: "0-10", min: 0, max: 10 },
  { label: "10-20", min: 10, max: 20 },
  { label: "20-30", min: 20, max: 30 },
  { label: "30-40", min: 30, max: 40 },
  { label: "40-50", min: 40, max: 50 },
  { label: "50-60", min: 50, max: 60 },
  { label: "60-70", min: 60, max: 70 },
  { label: "70-80", min: 70, max: 80 },
  { label: "80-90", min: 80, max: 90 },
  { label: "90-100", min: 90, max: 101 },
];

const ConfidenceHistogram = ({ records }) => {
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

  const data = BUCKETS.map(({ min, max }) =>
    records.filter((r) => Number(r.confidence) >= min && Number(r.confidence) < max).length
  );

  const textColor = isDark ? "#9caec4" : "#6b7280";
  const gridColor = isDark ? "rgba(148,163,184,0.15)" : "#e5e7eb";

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 5,
        zIndex: 1,
      }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: "#0ea5a1", flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 12, color: textColor }}>Scans</span>
      </div>
      <BarChart
        xAxis={[{
          data: BUCKETS.map((b) => b.label),
          scaleType: "band",
          tickLabelStyle: { fill: textColor, fontSize: 11 },
        }]}
        yAxis={[{ tickLabelStyle: { fill: textColor, fontSize: 11 } }]}
        series={[{ data, color: "#0ea5a1" }]}
        height={220}
        margin={{ top: 14, bottom: 34, left: 34, right: 10 }}
        sx={{
          "& .MuiChartsAxis-line": { stroke: gridColor },
          "& .MuiChartsAxis-tick": { stroke: gridColor },
          "& .MuiChartsAxis-tickLabel tspan": { fill: textColor },
        }}
      />
    </div>
  );
};

export default ConfidenceHistogram;
