import React from "react";
import "./../styles/modal.css";

// Inside DetailModal.jsx
const DetailModal = ({ image, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()} // prevent close on content click
      >
        <img
          src={image}
          alt="Product"
          className="modal-image"
        />
        <button className="close-button" onClick={onClose}>✕</button>
      </div>
    </div>
  );
};

export default DetailModal;
