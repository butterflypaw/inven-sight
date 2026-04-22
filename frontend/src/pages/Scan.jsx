import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import Webcam from "react-webcam";
import { FaCamera, FaUpload } from "react-icons/fa";
import "./ScanPage.css";
import toast from "react-hot-toast";

const Scan = () => {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [activeEndpoint, setActiveEndpoint] = useState("");
  const [recentScans, setRecentScans] = useState(() => {
    const saved = localStorage.getItem("recentScans");
    return saved ? JSON.parse(saved) : [];
  });

  const configuredBackendUrl = process.env.REACT_APP_BACKEND_URL;
  const backendCandidates = useMemo(() => {
    const roots = [
      configuredBackendUrl,
      "http://127.0.0.1:5000",
      "http://localhost:5000",
    ].filter(Boolean);
    return [...new Set(roots)].map((root) => `${root}/predict`);
  }, [configuredBackendUrl]);

  const confidencePercent = useMemo(() => {
    if (confidence == null) return null;
    return Number((confidence * 100).toFixed(2));
  }, [confidence]);

  const scanQuality = useMemo(() => {
    if (confidencePercent == null) return "-";
    if (confidencePercent >= 95) return "Excellent";
    if (confidencePercent >= 85) return "Strong";
    if (confidencePercent >= 70) return "Moderate";
    return "Low";
  }, [confidencePercent]);

  const sendToBackend = useCallback((file) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("product_name", productName);
    formData.append("sku", sku);
    formData.append("location", "");

    setLoading(true);
    setPrediction(null);
    setConfidence(null);
    setErrorMessage("");

    const tryPredict = async () => {
      let lastError = "";

      for (const endpoint of backendCandidates) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);

          const response = await fetch(endpoint, {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeout);

          let data = {};
          try {
            data = await response.json();
          } catch {
            data = {};
          }

          if (!response.ok || data.error) {
            lastError = data.error || `Request failed with status ${response.status}`;
            continue;
          }

          setActiveEndpoint(endpoint.replace("/predict", ""));
          setPrediction(data.label);
          setConfidence(data.confidence);

          const entry = data.entry;
          const snapshot = {
            id: `${entry?.id || Date.now()}`,
            filename: file.name,
            label: data.label,
            confidence: data.confidence,
            time: entry?.timestamp || new Date().toLocaleString(),
          };

          setRecentScans((prev) => {
            const next = [snapshot, ...prev].slice(0, 6);
            localStorage.setItem("recentScans", JSON.stringify(next));
            return next;
          });

          if (String(data.label).toLowerCase() === "damaged") {
            toast.success("Damaged item has been added to Alerts.");
          }

          return;
        } catch (error) {
          lastError = error?.name === "AbortError" ? "Request timed out" : "Could not reach backend";
        }
      }

      setErrorMessage(
        `Prediction failed. ${lastError || "Backend unavailable"}. Ensure backend is running on port 5000.`
      );
    };

    tryPredict().finally(() => {
      setLoading(false);
      setImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
  }, [backendCandidates, productName, sku]);

  const stopCamera = useCallback(() => {
    const stream = webcamRef.current?.video?.srcObject;
    if (stream && typeof stream.getTracks === "function") {
      stream.getTracks().forEach((track) => track.stop());
    }
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const clearRecentScans = () => {
    setRecentScans([]);
    localStorage.removeItem("recentScans");
  };

  const copyResult = async () => {
    if (!prediction || confidencePercent == null) return;
    const content = `Status: ${prediction.toUpperCase()} | Confidence: ${confidencePercent}% | Quality: ${scanQuality}`;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErrorMessage("Could not copy result to clipboard.");
    }
  };

  const downloadResult = () => {
    if (!prediction || confidencePercent == null) return;
    const payload = {
      status: prediction,
      confidence: confidencePercent,
      quality: scanQuality,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `scan_result_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStartCamera = () => {
    setCameraOn(true);
  };

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      stopCamera();
      fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "webcam.jpg", { type: "image/jpeg" });
          setPreviewUrl(imageSrc);
          sendToBackend(file);
        });
    }
  }, [sendToBackend, stopCamera]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageFile(file);
      setErrorMessage("");
      setPreviewUrl(URL.createObjectURL(file));
      sendToBackend(file);
    }
  };

  return (
    <div className="scanner-container">
      <h1 className="scanner-title">Package Scanner</h1>
      <p>
        Scan a package via webcam or upload an image to check its condition.
      </p>

      <div className="scan-meta-grid">
        <input
          type="text"
          placeholder="Item ID (optional, auto-generated if empty)"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Barcode / Category Code"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        />
      </div>

      <div className="scanner-panels">
        {/* Webcam Panel */}
        <div className="panel webcam-panel">
          <div className="panel-header webcam-header">
            <FaCamera className="icon" /> Webcam
          </div>

          <div className="camera-box">
            {cameraOn ? (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="webcam-feed"
              />
            ) : (
              <span className="camera-note">
                ⚠ Make sure to allow camera access!
              </span>
            )}
          </div>

          {cameraOn ? (
            <button className="open-camera-btn" onClick={handleCapture}>
              Capture & Predict
            </button>
          ) : (
            <button className="open-camera-btn" onClick={handleStartCamera}>
              Open Camera
            </button>
          )}
        </div>

        {/* Upload Image Panel */}
        <div className="panel scanned-panel">
          <div className="panel-header scanned-header">
            <FaUpload className="icon" /> Upload Image
          </div>
          <div className="upload-box">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="file-input"
              ref={fileInputRef} // attach ref
            />
            <label className="upload-hint">Drag an image here or click to browse</label>
            {imageFile && (
              <p className="file-name">Selected: {imageFile.name}</p>
            )}
            {previewUrl && (
              <img src={previewUrl} alt="Selected for scan" className="upload-preview" />
            )}
          </div>
        </div>
      </div>

      <div className="result-section">
        {loading && (
          <div className="result-card loading">
            <div className="spinner"></div>
            <p className="loading-text">Analyzing image, please wait...</p>
          </div>
        )}

        {prediction && !loading && (
          <div className={`result-card ${prediction.toLowerCase()}`}>
            <h2 className="result-title">Scan Result</h2>
            <div className="result-info">
              <p className="result-label">
                <strong>Status:</strong>{" "}
                <span className="status-tag">{prediction.toUpperCase()}</span>
              </p>
              <p className="result-confidence">
                <strong>Confidence:</strong>{" "}
                {confidencePercent}%
              </p>
              <p className="result-confidence">
                <strong>Quality:</strong> {scanQuality}
              </p>
              <div className="result-actions">
                <button className="secondary-action" onClick={copyResult}>
                  {copied ? "Copied" : "Copy Result"}
                </button>
                <button className="secondary-action" onClick={downloadResult}>
                  Download Report
                </button>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="result-card error">
            <h2 className="result-title">Error</h2>
            <p>{errorMessage}</p>
          </div>
        )}
      </div>

      <section className="recent-scan-panel">
        <div className="recent-header">
          <h3>Recent Scans</h3>
          {recentScans.length > 0 && (
            <button className="clear-recent-btn" onClick={clearRecentScans}>
              Clear
            </button>
          )}
        </div>
        <ul>
          {recentScans.length === 0 && <li>No recent scans yet.</li>}
          {recentScans.map((scan) => (
            <li key={scan.id}>
              <strong>{scan.filename}</strong>
              <span className={`scan-badge ${scan.label.toLowerCase()}`}>{scan.label}</span>
              <span>{scan.confidence ? `${(scan.confidence * 100).toFixed(1)}%` : "-"}</span>
              <small>{scan.time}</small>
            </li>
          ))}
        </ul>
      </section>

      <div className="alert-note">
        <strong>Note:</strong> You can find all{" "}
        <span className="highlight-text">damaged items</span> in the{" "}
        <a href="/details" className="alert-link">
          Details Page
        </a>
        . {activeEndpoint ? `Live backend: ${activeEndpoint}` : ""}
      </div>
    </div>
  );
};

export default Scan;
