import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./../styles/details.css";
import DetailModal from "../components/DetailModal";
import { backendBaseUrl, fetchDetails } from "../services/api";
import { FaEye } from "react-icons/fa";

const Details = () => {
  const location = useLocation();
  const [details, setDetails] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailsPerPage, setDetailsPerPage] = useState(10);
  const [modalImage, setModalImage] = useState(null);
  const [conditionFilter, setConditionFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortBy, setSortBy] = useState("latest");
  const [dateRange, setDateRange] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemIdParam = params.get("itemId");
    if (itemIdParam) setSearch(itemIdParam);
  }, [location.search]);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const response = await fetchDetails();
        setDetails(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Failed to fetch details:", error);
        setDetails([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
    const interval = window.setInterval(loadDetails, 20000);

    return () => window.clearInterval(interval);
  }, []);

  const filteredDetails = details
    .filter((detail) => {
      if (dateRange === "all") return true;
      const ts = new Date(detail.timestamp);
      if (isNaN(ts.getTime())) return false;
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dateRange === "today") return ts >= startOfToday;
      if (dateRange === "7days") {
        const d = new Date(startOfToday); d.setDate(d.getDate() - 6); return ts >= d;
      }
      if (dateRange === "30days") {
        const d = new Date(startOfToday); d.setDate(d.getDate() - 29); return ts >= d;
      }
      return true;
    })
    .filter((detail) =>
      String(detail.itemId || detail.productName || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .filter((detail) =>
      conditionFilter === "all"
        ? true
        : detail.damage?.toLowerCase() === conditionFilter
    )
    .filter((detail) =>
      warehouseFilter === "all" ? true : detail.shippedFrom === warehouseFilter
    )
    .filter((detail) => {
      if (confidenceFilter === "all") return true;
      const [min, max] = confidenceFilter.split("-").map(Number);
      return detail.confidence >= min && detail.confidence < max;
    })
    .sort((a, b) => {
      if (sortBy === "confidence-desc") return b.confidence - a.confidence;
      if (sortBy === "confidence-asc") return a.confidence - b.confidence;
      if (sortBy === "item-id") {
        return String(a.itemId || a.productName || "").localeCompare(
          String(b.itemId || b.productName || "")
        );
      }
      return b.id - a.id;
    });

  const totalDamaged = filteredDetails.filter((item) => item.damage === "damaged").length;
  const avgConfidence = filteredDetails.length
    ? (
        filteredDetails.reduce((sum, item) => sum + item.confidence, 0) /
        filteredDetails.length
      ).toFixed(1)
    : "0.0";

  const totalPages = Math.max(1, Math.ceil(filteredDetails.length / detailsPerPage));
  const indexOfLast = currentPage * detailsPerPage;
  const indexOfFirst = indexOfLast - detailsPerPage;
  const currentDetails = filteredDetails.slice(indexOfFirst, indexOfLast);

  const handlePrev = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const handleChangePerPage = (e) => {
    setDetailsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const getConfidenceClass = (confidence, damage) => {
    const isIntact = damage?.toLowerCase() === "intact";
    if (isIntact) {
      if (confidence === 100) return "conf-green-100";
      if (confidence >= 90) return "conf-green-90";
      if (confidence >= 80) return "conf-green-80";
      if (confidence >= 70) return "conf-green-70";
      if (confidence >= 60) return "conf-green-60";
      return "conf-green-50";
    } else {
      if (confidence >= 90) return "conf-red-90";
      if (confidence >= 80) return "conf-red-80";
      if (confidence >= 70) return "conf-red-70";
      if (confidence >= 60) return "conf-red-60";
      return "conf-red-50";
    }
  };

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

    if (item.image) {
      return item.image;
    }

    const fallbackFolder = String(item.damage).toLowerCase() === "damaged" ? "damaged" : "intact";
    const fallbackFile = fallbackFolder === "damaged" ? "damaged1.jpeg" : "intact1.jpeg";
    return `${backendBaseUrl}/dataset/${fallbackFolder}/${fallbackFile}`;
  };

  const handleClearFilters = () => {
    setConfidenceFilter("all");
    setConditionFilter("all");
    setWarehouseFilter("all");
  };

  const handleExportCsv = () => {
    const headers = ["Record", "Item ID", "SKU", "Condition", "Confidence", "Warehouse"];
    const rows = filteredDetails.map((row) => [
      row.id,
      row.itemId || row.productName,
      row.sku,
      row.damage,
      row.confidence,
      row.shippedFrom,
    ]);
    const csv = [headers, ...rows].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "scan_history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="details-wrapper">
      <div className="top-bar">
        <h1 className="page-title">Scan History</h1>
        <div className="top-bar-actions">
          <div className="date-range-btns">
            {[["all","All"],["today","Today"],["7days","7 Days"],["30days","30 Days"]].map(([val, label]) => (
              <button
                key={val}
                className={`date-range-btn${dateRange === val ? " active" : ""}`}
                onClick={() => { setDateRange(val); setCurrentPage(1); }}
              >{label}</button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search Item ID"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn btn-green"
            onClick={() => setShowFilterModal(true)}
          >
            Filters
          </button>
          <select
            value={sortBy}
            className="sort-select"
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="latest">Latest</option>
            <option value="confidence-desc">Confidence High to Low</option>
            <option value="confidence-asc">Confidence Low to High</option>
            <option value="item-id">Item ID</option>
          </select>
          <button className="btn btn-export" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="history-kpis">
        <article>
          <span>Total Records</span>
          <strong>{isLoading ? "--" : filteredDetails.length}</strong>
        </article>
        <article>
          <span>Damaged Records</span>
          <strong>{isLoading ? "--" : totalDamaged}</strong>
        </article>
        <article>
          <span>Average Confidence</span>
          <strong>{isLoading ? "--" : `${avgConfidence}%`}</strong>
        </article>
      </div>

      <table className="detail-table">
        <thead>
          <tr>
            <th>Record</th>
            <th>Item ID</th>
            <th>SKU</th>
            <th>Condition</th>
            <th>Confidence</th>
            <th>Location</th>
            <th>Image Preview</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={7} className="loading-row">Loading scan history...</td>
            </tr>
          )}
          {!isLoading && currentDetails.length === 0 && (
            <tr>
              <td colSpan={7} className="loading-row">No records found.</td>
            </tr>
          )}
          {currentDetails.map((item, idx) => (
            <tr key={idx}>
              <td>{item.id}</td>
              <td>{item.itemId || item.productName || "-"}</td>
              <td>{item.sku || "-"}</td>
              <td>
                <span
                  className={`badge ${
                    item.damage?.toLowerCase() === "intact"
                      ? "badge-green"
                      : "badge-red"
                  }`}
                >
                  {item.damage?.toUpperCase() || "UNKNOWN"}
                </span>
              </td>
              <td>
                <span
                  className={`badge ${getConfidenceClass(
                    item.confidence,
                    item.damage
                  )}`}
                >
                  {item.confidence}%
                </span>
              </td>
              <td>{item.shippedFrom || "-"}</td>
              <td
                className="preview-cell"
              >
                <button
                  onClick={() => setModalImage(resolveImage(item))}
                  className="preview-icon-btn"
                  type="button"
                  aria-label={`Preview ${item.itemId || item.productName || "item"}`}
                >
                  <FaEye />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination-controls">
        <div className="per-page">
          <label>
            &nbsp;
            <select value={detailsPerPage} onChange={handleChangePerPage}>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={30}>30 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </label>
        </div>
        <div className="page-nav">
          <button onClick={handlePrev} disabled={currentPage === 1}>
            ‹
          </button>
          <span>
            {isLoading
              ? "Loading..."
              : `${filteredDetails.length === 0 ? 0 : indexOfFirst + 1} - ${Math.min(indexOfLast, filteredDetails.length)} of ${filteredDetails.length}`}
          </span>
          <button onClick={handleNext} disabled={currentPage === totalPages}>
            ›
          </button>
        </div>
      </div>

      {modalImage && (
        <DetailModal image={modalImage} onClose={() => setModalImage(null)} />
      )}
      {showFilterModal && (
        <div
          className="custom-modal-overlay"
          onClick={() => setShowFilterModal(false)}
        >
          <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Filter Options</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-field">
                <label>Confidence Range</label>
                <select
                  value={confidenceFilter}
                  onChange={(e) => setConfidenceFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="0-10">0 - 10%</option>
                  <option value="10-20">10 - 20%</option>
                  <option value="20-30">20 - 30%</option>
                  <option value="30-40">30 - 40%</option>
                  <option value="40-50">40 - 50%</option>
                  <option value="50-60">50 - 60%</option>
                  <option value="60-70">60 - 70%</option>
                  <option value="70-80">70 - 80%</option>
                  <option value="80-90">80 - 90%</option>
                  <option value="90-101">90 - 100%</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Condition</label>
                <select
                  value={conditionFilter}
                  onChange={(e) => setConditionFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="intact">Intact</option>
                  <option value="damaged">Damaged</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Warehouse</label>
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  {Array.from(new Set(details.map((d) => d.shippedFrom))).map(
                    (loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-gray" onClick={handleClearFilters}>
                Clear Filters
              </button>
              <button
                className="btn-close"
                onClick={() => setShowFilterModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
