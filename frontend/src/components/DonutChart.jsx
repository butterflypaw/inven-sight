// components/DonutChart.jsx
import * as React from 'react';
import { PieChart } from '@mui/x-charts/PieChart';

const DonutChart = ({ damaged, intact }) => {
  const isDark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const labelColor = isDark ? "#dce8f9" : "#1f2937";

  const data = [
    { label: 'Damaged', value: damaged, color: '#dc2626' },
    { label: 'Intact', value: intact, color: '#16a34a' },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <PieChart
        series={[
          {
            innerRadius: 40,
            outerRadius: 70,
            data,
            arcLabel: 'value',
          },
        ]}
        width={150}
        height={150}
        margin={{ right: 10 }}
        sx={{
          '& .MuiChartsLegend-root': {
            display: 'none',
          },
          '& .MuiPieArcLabel-root': {
            fill: labelColor,
            fontWeight: 700,
          },
        }}
        slotProps={{ legend: { hidden: true } }}
      />
      <div style={{ display: "grid", gap: "10px", color: labelColor, minWidth: "92px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: "#dc2626", display: "inline-block" }} />
          <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Damaged</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: "#16a34a", display: "inline-block" }} />
          <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Intact</span>
        </div>
      </div>
    </div>
  );
};

export default DonutChart;
