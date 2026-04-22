import React from "react";
import "./DetailCard.css";

const DetailCard = ({ alert }) => {
  const { id, itemId, productName, sku, image, shippedFrom, confidence, timestamp } =
    alert;
  const displayItemId = itemId || productName || `INV-${String(id || "").padStart(8, "0")}`;

  const time = new Date(timestamp).toLocaleTimeString();
  const date = new Date(timestamp).toDateString();

  return (
    <div className="alert-card">
      <img src={image} alt={displayItemId} className="alert-image" />

      <div className="alert-details">
        <div className="alert-row">
          <span className="alert-id">ID: {id}</span>
          <span className="alert-time">{time}</span>
        </div>

        <div className="alert-product">Item ID: {displayItemId}</div>
        <div className="alert-sku">SKU: {sku}</div>
        <div className="alert-ship">Shipped From: {shippedFrom}</div>
        <div className="alert-confidence">Confidence: {confidence}%</div>
        
      </div>
    </div>
  );
};

export default DetailCard;
