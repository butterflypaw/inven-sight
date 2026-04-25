import { useState, useEffect } from "react";
import { LineChart } from "@mui/x-charts/LineChart";

const DamagedLineChart = ({
  labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  displayData = [],
  label = "Data",
  color = "#1976d2",
}) => {
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

  const axisColor = isDark ? "#9fb2c9" : "#475569";
  const labelColor = isDark ? "#dce8f9" : "#1f2937";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", color: labelColor, marginBottom: "4px", fontSize: "0.9rem", fontWeight: 600 }}>
        <span style={{ width: 18, height: 4, borderRadius: 999, background: color, display: "inline-block" }} />
        <span>{label}</span>
      </div>
      <LineChart
        xAxis={[{ data: labels, scaleType: "point" }]}
        series={[
          {
            curve: "linear",
            data: displayData,
            color,
          },
        ]}
        height={150}
        margin={{ left: 10, right: 30 }}
        legend={{ hidden: true }}
        sx={{
          '& .MuiChartsLegend-root': {
            display: 'none',
          },
          '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
            stroke: axisColor,
          },
          '& .MuiChartsAxis-tickLabel': {
            fill: axisColor,
          },
        }}
      />
    </div>
  );
};

export default DamagedLineChart;
