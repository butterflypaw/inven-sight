import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Inventory.css";
import { FaDownload, FaEye } from "react-icons/fa";
import { backendBaseUrl, fetchInventory } from "../services/api";
import DetailModal from "../components/DetailModal";

const seedInventory = [
  { sku: "BX-0001", itemId: "BOX-0001", warehouse: "Warehouse A", quantity: 4, damageRisk: "Low", imageUrl: "/dataset/intact/intact1.jpeg" },
  { sku: "BX-0002", itemId: "BOX-0002", warehouse: "Warehouse B", quantity: 3, damageRisk: "Medium", imageUrl: "/dataset/intact/intact2.jpeg" },
  { sku: "BX-0003", itemId: "BOX-0003", warehouse: "Warehouse C", quantity: 2, damageRisk: "High", imageUrl: "/dataset/damaged/damaged1.jpeg" },
  { sku: "BX-0004", itemId: "BOX-0004", warehouse: "Warehouse D", quantity: 6, damageRisk: "Low", imageUrl: "/dataset/intact/intact3.jpeg" },
  { sku: "BX-0005", itemId: "BOX-0005", warehouse: "Warehouse A", quantity: 2, damageRisk: "Medium", imageUrl: "/dataset/intact/intact1.jpeg" },
  { sku: "BX-0006", itemId: "BOX-0006", warehouse: "Warehouse B", quantity: 1, damageRisk: "High", imageUrl: "/dataset/damaged/damaged2.jpeg" },
  { sku: "BX-0007", itemId: "BOX-0007", warehouse: "Warehouse C", quantity: 5, damageRisk: "Low", imageUrl: "/dataset/intact/intact2.jpeg" },
  { sku: "BX-0008", itemId: "BOX-0008", warehouse: "Warehouse D", quantity: 3, damageRisk: "Medium", imageUrl: "/dataset/intact/intact3.jpeg" },
];

const Inventory = () => {
  const [rows, setRows] = useState(seedInventory);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [previewImage, setPreviewImage] = useState(null);

  const resolveImage = (item) => {
    if (item.imageUrl) {
      if (item.imageUrl.startsWith("http") || item.imageUrl.startsWith("data:")) {
        return item.imageUrl;
      }
      return `${backendBaseUrl}${item.imageUrl}`;
    }

    if (item.previewImageUrl) {
      if (item.previewImageUrl.startsWith("http") || item.previewImageUrl.startsWith("data:")) {
        return item.previewImageUrl;
      }
      return `${backendBaseUrl}${item.previewImageUrl}`;
    }

    const fallbackFolder = String(item.damageRisk).toLowerCase() === "high" ? "damaged" : "intact";
    const fallbackFile = fallbackFolder === "damaged" ? "damaged1.jpeg" : "intact1.jpeg";
    return `${backendBaseUrl}/dataset/${fallbackFolder}/${fallbackFile}`;
  };

  useEffect(() => {
    const loadInventory = async () => {
      try {
        const response = await fetchInventory();
        if (Array.isArray(response.data) && response.data.length) {
          setRows(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch inventory:", error);
      }
    };

    loadInventory();
    const interval = window.setInterval(loadInventory, 7000);

    return () => window.clearInterval(interval);
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const hit = `${item.itemId || item.productName || ""} ${item.sku || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const riskHit = riskFilter === "All" || item.damageRisk === riskFilter;
      return hit && riskHit;
    });
  }, [rows, search, riskFilter]);

  const totals = useMemo(() => {
    const totalQuantity = filteredRows.reduce((acc, item) => acc + Number(item.quantity || item.stock || 1), 0);
    const uniqueBoxes = filteredRows.length;
    const lowQuantity = filteredRows.filter((item) => Number(item.quantity || item.stock || 1) <= 2).length;
    return { totalQuantity, uniqueBoxes, lowQuantity };
  }, [filteredRows]);

  const exportCsv = () => {
    const headers = ["SKU", "Item ID", "Warehouse", "Quantity", "Damage Risk"];
    const rows = filteredRows.map((row) => [
      row.sku,
      row.itemId || row.productName,
      row.warehouse,
      row.quantity || row.stock || 1,
      row.damageRisk,
    ]);

    const csv = [headers, ...rows].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "inventory_snapshot.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="inventory-page">
      <div className="inventory-header">
        <div>
          <h2>Inventory Control Tower</h2>
          <p>Track stock, reservation pressure, and damage risk by SKU.</p>
        </div>
        <button className="export-btn" onClick={exportCsv}>
          <FaDownload /> Export CSV
        </button>
      </div>

      <div className="inventory-kpis">
        <article>
          <span>Total Quantity</span>
          <strong>{totals.totalQuantity}</strong>
        </article>
        <article>
          <span>Unique Box IDs</span>
          <strong>{totals.uniqueBoxes}</strong>
        </article>
        <article>
          <span>Low Quantity Boxes</span>
          <strong>{totals.lowQuantity}</strong>
        </article>
      </div>

      <div className="inventory-tools">
        <input
          placeholder="Search by SKU or Item ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
          <option>All</option>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
      </div>

      <div className="inventory-table-wrap">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>SKU</th>
              <th>Item ID</th>
              <th>Warehouse</th>
              <th>Quantity</th>
              <th>Damage Risk</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((item) => {
              const quantity = Number(item.quantity || item.stock || 1);
              const availabilityClass = quantity <= 2 ? "danger" : quantity <= 5 ? "warn" : "safe";
              return (
                <tr key={item.sku}>
                  <td>
                    <button
                      type="button"
                      className="preview-icon-btn"
                      onClick={() => setPreviewImage(resolveImage(item))}
                      aria-label={`Preview ${item.itemId || item.productName || "item"}`}
                    >
                      <FaEye />
                    </button>
                  </td>
                  <td>{item.sku}</td>
                  <td>
                    <Link
                      to={`/details?itemId=${encodeURIComponent(item.itemId || item.productName || "")}`}
                      className="item-link"
                    >
                      {item.itemId || item.productName || "-"}
                    </Link>
                  </td>
                  <td>{item.warehouse}</td>
                  <td>
                    <span className={`availability-chip ${availabilityClass}`}>{quantity}</span>
                  </td>
                  <td>
                    <span className={`risk-pill ${item.damageRisk.toLowerCase()}`}>{item.damageRisk}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {previewImage && (
        <DetailModal image={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </section>
  );
};

export default Inventory;
