import React, { useState } from "react";
import "./DetailList.css";


const DetailList = ({ alerts }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [alertsPerPage, setAlertsPerPage] = useState(5); // Default: 5 per page

  const totalPages = Math.ceil(alerts.length / alertsPerPage);
  const indexOfLast = currentPage * alertsPerPage;
  const indexOfFirst = indexOfLast - alertsPerPage;
  const currentAlerts = alerts.slice(indexOfFirst, indexOfLast);

  const handlePrev = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const handleChangePerPage = (e) => {
    setAlertsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page on change
  };

  return (
    <div className="alert-table-wrapper">
      <table className="alert-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Item ID</th>
            <th>SKU</th>
            <th>Damage Type</th>
            <th>Confidence</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {currentAlerts.map((alert, index) => (
            <tr key={index}>
              <td>{indexOfFirst + index + 1}</td>
              <td>{alert.itemId || alert.productName || "-"}</td>
              <td>{alert.sku || "-"}</td>
              <td>{alert.damage || "-"}</td>
              <td>{alert.confidence ? `${alert.confidence}%` : "-"}</td>
              <td>{alert.timestamp || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination-controls">
        <div className="per-page">
          <label>
            &nbsp;
            <select value={alertsPerPage} onChange={handleChangePerPage}>
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </label>
        </div>
        <div className="page-nav">
          <button onClick={handlePrev} disabled={currentPage === 1}>
            ‹
          </button>
          <span>
            {indexOfFirst + 1} - {Math.min(indexOfLast, alerts.length)}
          </span>
          <button onClick={handleNext} disabled={currentPage === totalPages}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailList;
