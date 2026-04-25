import { useMemo, useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEVELS = 5;
const CELL = 14;
const GAP = 3;
const STEP = CELL + GAP;

const toKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const DamageHeatmap = ({ records = [] }) => {
  const [tooltip, setTooltip] = useState(null);
  const [filter, setFilter] = useState("damaged");

  const { columns, maxCount } = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      if (!r.timestamp) return;
      const d = new Date(r.timestamp);
      if (isNaN(d.getTime())) return;
      const isDamaged = String(r.damage).toLowerCase() === "damaged";
      if (filter === "damaged" && !isDamaged) return;
      if (filter === "intact" && isDamaged) return;
      const key = toKey(d);
      map[key] = (map[key] || 0) + 1;
    });

    const maxCount = Math.max(1, ...Object.values(map));

    const cursor = new Date();
    cursor.setMonth(cursor.getMonth() - 12);
    cursor.setDate(1);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const columns = [];
    while (cursor <= end) {
      const col = new Array(7).fill(null);
      const startRow = (cursor.getDay() + 6) % 7;
      const colMonth = cursor.getMonth();
      for (let row = startRow; row < 7; row++) {
        if (cursor > end) break;
        if (cursor.getMonth() !== colMonth) break;
        const key = toKey(cursor);
        col[row] = { date: key, count: map[key] || 0 };
        cursor.setDate(cursor.getDate() + 1);
      }
      columns.push(col);
    }

    return { columns, maxCount };
  }, [records, filter]);

  const activeColor =
    filter === "damaged"
      ? "var(--danger)"
      : filter === "intact"
        ? "#16a34a"
        : "var(--accent)";

  const cellColor = (count) => {
    if (count === 0) return "var(--line)";
    const level = Math.ceil((count / maxCount) * (LEVELS - 1));
    return `color-mix(in srgb, ${activeColor} ${[20, 40, 60, 80, 100][level]}%, transparent)`;
  };

  const tooltipLabel =
    filter === "damaged" ? "damaged" : filter === "intact" ? "intact" : "scans";

  const handleMouseEnter = (e, cell) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      date: cell.date,
      count: cell.count,
      x: Math.max(
        80,
        Math.min(rect.left + rect.width / 2, window.innerWidth - 80),
      ),
      y: rect.top,
    });
  };

  const gridWidth = columns.reduce((acc, col, ci) => {
    if (ci === 0) return CELL;
    const current = col.find((c) => c);
    const prev = columns[ci - 1].find((c) => c);
    let extraGap = GAP;
    if (current && prev) {
      const d1 = new Date(prev.date + "T12:00:00");
      const d2 = new Date(current.date + "T12:00:00");
      if (d1.getMonth() !== d2.getMonth()) extraGap += 8;
    }
    return acc + CELL + extraGap;
  }, 0);

  return (
    <>
      {tooltip && (
        <div
          style={{
            position: "fixed",
            top: tooltip.y - 36,
            left: tooltip.x,
            transform: "translateX(-50%)",
            background: "var(--surface-elevated)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: "0.75rem",
            color: "var(--text-main)",
            pointerEvents: "none",
            zIndex: 1000,
            whiteSpace: "nowrap",
          }}
        >
          {tooltip.date} — {tooltip.count} {tooltipLabel}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          paddingLeft: "0",
          paddingRight: "20px",
        }}
      >
        <div style={{ padding: "0 24px 0 17px" }}>
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                fontSize: "0.8rem",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                background: "var(--surface-card, #fff)",
                color: "var(--text-main)",
                cursor: "pointer",
                marginBottom: "20px",
              }}
            >
              <option value="damaged">Damaged</option>
              <option value="intact">Intact</option>
              <option value="all">All Scans</option>
            </select>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "flex-start",
              transformOrigin: "left top",
              transform: (() => {
                const scale = Math.min(
                  1,
                  (window.innerWidth - 120) / gridWidth,
                );
                const shift = scale < 1 ? (1 - scale) * gridWidth * 0.1 : 0;
                return `translateX(-${shift}px) scale(${scale})`;
              })(),
            }}
          >
            {/* Weekday labels */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gap: `${GAP}px`,
                flexShrink: 0,
              }}
            >
              {DAYS.map((d) => (
                <span
                  key={d}
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    lineHeight: `${CELL}px`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {d}
                </span>
              ))}
            </div>

            {/* Grid + month labels */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              {/* Cell grid */}
              <div style={{ display: "flex" }}>
                {columns.map((col, ci) => {
                  const current = col.find((c) => c);
                  const prev = ci > 0 ? columns[ci - 1].find((c) => c) : null;
                  let extraGap = 0;
                  if (current && prev) {
                    const d1 = new Date(prev.date + "T12:00:00");
                    const d2 = new Date(current.date + "T12:00:00");
                    if (d1.getMonth() !== d2.getMonth()) extraGap = 8;
                  }
                  return (
                    <div
                      key={ci}
                      style={{
                        display: "grid",
                        gridTemplateRows: `repeat(7, ${CELL}px)`,
                        gap: `${GAP}px`,
                        marginLeft: ci === 0 ? 0 : GAP + extraGap,
                      }}
                    >
                      {col.map((cell, row) =>
                        cell ? (
                          <div
                            key={row}
                            style={{
                              width: CELL,
                              height: CELL,
                              borderRadius: 3,
                              background: cellColor(cell.count),
                              cursor: "default",
                            }}
                            onMouseEnter={(e) => handleMouseEnter(e, cell)}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        ) : (
                          <div
                            key={row}
                            style={{ width: CELL, height: CELL }}
                          />
                        ),
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Month labels — centered over each month's column span */}
              <div
                style={{ position: "relative", width: gridWidth, height: 16 }}
              >
                {(() => {
                  const months = [];
                  let current = null;
                  columns.forEach((col, i) => {
                    const firstCell = col.find((c) => c);
                    if (!firstCell) return;
                    const date = new Date(firstCell.date + "T12:00:00");
                    const month = date.getMonth();
                    const year = date.getFullYear();
                    if (
                      !current ||
                      current.month !== month ||
                      current.year !== year
                    ) {
                      if (current) current.end = i - 1;
                      current = { month, year, start: i, end: i };
                      months.push(current);
                    } else {
                      current.end = i;
                    }
                  });
                  return months.map((m, i) => {
                    const mid = (m.start + m.end) / 2;
                    return (
                      <span
                        key={i}
                        style={{
                          position: "absolute",
                          left: mid * STEP,
                          transform: "translateX(-50%)",
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(m.year, m.month).toLocaleString("default", {
                          month: "short",
                        })}
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "16px",
              justifyContent: "flex-end",
            }}
          >
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              Less
            </span>
            {[0, 1, 2, 3, 4].map((l) => (
              <div
                key={l}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 3,
                  background:
                    l === 0
                      ? "var(--line)"
                      : `color-mix(in srgb, ${activeColor} ${[20, 40, 60, 80, 100][l]}%, transparent)`,
                }}
              />
            ))}
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              More
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default DamageHeatmap;
