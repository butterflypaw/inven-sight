import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import Webcam from "react-webcam";
import { FaCamera, FaUpload } from "react-icons/fa";
import "./ScanPage.css";
import toast from "react-hot-toast";
import { Link, useLocation } from "react-router-dom";

const Scan = () => {
  const location = useLocation();
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
  const [activeEndpoint, setActiveEndpoint] = useState("");
  const [scanMode, setScanMode] = useState("manual");
  const [beltRunning, setBeltRunning] = useState(false);
  const [beltState, setBeltState] = useState("IDLE");
  const [windowDuration, setWindowDuration] = useState(5000);
  const [frameIntervalMs, setFrameIntervalMs] = useState(500);
  const [cooldownMs, setCooldownMs] = useState(1500);
  const [minConfidence, setMinConfidence] = useState(0.7);
  const previewObjectUrlRef = useRef("");

  const configuredBackendUrl = process.env.REACT_APP_BACKEND_URL;
  const backendRoots = useMemo(() => {
    const roots = [
      configuredBackendUrl,
      "http://127.0.0.1:5000",
      "http://localhost:5000",
    ].filter(Boolean);
    return [...new Set(roots)];
  }, [configuredBackendUrl]);

  const backendCandidates = useMemo(
    () => backendRoots.map((root) => `${root}/predict`),
    [backendRoots]
  );

  const framePredictCandidates = useMemo(
    () => backendRoots.map((root) => `${root}/predict-frame`),
    [backendRoots]
  );

  const frameLoopRef = useRef(null);
  const windowTimerRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const predictingRef = useRef(false);
  const windowClosedRef = useRef(false);
  const damageDetectedRef = useRef(false);
  const damagedStreakRef = useRef(0);
  const lastFrameBlobRef = useRef(null);

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

  const playAlertSound = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.08;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();

    window.setTimeout(() => {
      oscillator.stop();
      audioContext.close().catch(() => {
        // Ignore close errors from already-closed contexts.
      });
    }, 220);
  }, []);

  const sendToEndpoint = useCallback(async (file, candidates) => {
    let lastError = "";
    for (const endpoint of candidates) {
      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("product_name", "");
        formData.append("sku", "");
        formData.append("location", "");
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

        if (response.status === 422 && data?.rejected_input) {
          setActiveEndpoint(endpoint.replace("/predict", "").replace("/predict-frame", ""));
          return data;
        }

        if (!response.ok || data.error) {
          lastError = data.error || `Request failed with status ${response.status}`;
          continue;
        }

        setActiveEndpoint(endpoint.replace("/predict", "").replace("/predict-frame", ""));
        return data;
      } catch (error) {
        lastError = error?.name === "AbortError" ? "Request timed out" : "Could not reach backend";
      }
    }

    throw new Error(lastError || "Backend unavailable");
  }, []);

  const finalizeProductScan = useCallback(async (blob, sourceLabel = "webcam.jpg") => {
    if (!blob) {
      return;
    }

    setLoading(true);
    setPrediction(null);
    setConfidence(null);
    setErrorMessage("");

    const file = new File([blob], sourceLabel, { type: "image/jpeg" });
    try {
      const data = await sendToEndpoint(file, backendCandidates);

      if (data?.rejected_input || String(data?.label).toLowerCase() === "human" || String(data?.label).toLowerCase() === "not_package") {
        setPrediction(null);
        setConfidence(null);
        setErrorMessage(data?.message || "This is not a package or box. Please scan only packaged boxes.");
        return;
      }

      if (data?.duplicate) {
        setPrediction(data.label || null);
        setConfidence(data.confidence ?? null);
        setErrorMessage(data.message || "Duplicate scan skipped for the same item.");
        return;
      }

      setPrediction(data.label);
      setConfidence(data.confidence);

      if (String(data.label).toLowerCase() === "damaged") {
        toast.error("Alert added: damaged item detected.");
        playAlertSound();
      }
    } catch (error) {
      setErrorMessage(`Prediction failed. ${error.message}. Ensure backend is running on port 5000.`);
    } finally {
      setLoading(false);
      setImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [backendCandidates, playAlertSound, sendToEndpoint]);

  const clearConveyorTimers = useCallback(() => {
    if (frameLoopRef.current) {
      window.clearInterval(frameLoopRef.current);
      frameLoopRef.current = null;
    }
    if (windowTimerRef.current) {
      window.clearTimeout(windowTimerRef.current);
      windowTimerRef.current = null;
    }
    if (cooldownTimerRef.current) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const closeWindow = useCallback(async (trigger, frameBlob) => {
    if (windowClosedRef.current) {
      return;
    }
    windowClosedRef.current = true;
    if (frameLoopRef.current) {
      window.clearInterval(frameLoopRef.current);
      frameLoopRef.current = null;
    }
    if (windowTimerRef.current) {
      window.clearTimeout(windowTimerRef.current);
      windowTimerRef.current = null;
    }

    const targetBlob = frameBlob || lastFrameBlobRef.current;
    if (targetBlob) {
      await finalizeProductScan(targetBlob, trigger === "damage" ? "belt-damaged.jpg" : "belt-intact.jpg");
    }

    setBeltState("COOLDOWN");
    cooldownTimerRef.current = window.setTimeout(() => {
      if (!beltRunning) {
        setBeltState("IDLE");
        return;
      }
      damageDetectedRef.current = false;
      damagedStreakRef.current = 0;
      windowClosedRef.current = false;
      setBeltState("SCANNING");
      startWindow();
    }, Math.max(300, Number(cooldownMs) || 1500));
  }, [beltRunning, cooldownMs, finalizeProductScan]);

  const captureCurrentFrameBlob = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      return null;
    }
    setPreviewUrl(imageSrc);
    const response = await fetch(imageSrc);
    return response.blob();
  }, []);

  const startWindow = useCallback(() => {
    damageDetectedRef.current = false;
    damagedStreakRef.current = 0;
    windowClosedRef.current = false;
    predictingRef.current = false;

    const interval = Math.max(200, Number(frameIntervalMs) || 500);
    const duration = Math.max(interval, Number(windowDuration) || 5000);

    frameLoopRef.current = window.setInterval(async () => {
      if (predictingRef.current || windowClosedRef.current) {
        return;
      }
      predictingRef.current = true;

      try {
        const blob = await captureCurrentFrameBlob();
        if (!blob) {
          return;
        }
        lastFrameBlobRef.current = blob;
        const probeFile = new File([blob], "belt-frame.jpg", { type: "image/jpeg" });
        const frameResult = await sendToEndpoint(probeFile, framePredictCandidates);
        const label = String(frameResult?.label || "").toLowerCase();
        const conf = Number(frameResult?.confidence || 0);

        if (label === "damaged" && conf >= Number(minConfidence || 0.7)) {
          damagedStreakRef.current += 1;
        } else {
          damagedStreakRef.current = 0;
        }

        if (!damageDetectedRef.current && damagedStreakRef.current >= 2) {
          damageDetectedRef.current = true;
          await closeWindow("damage", blob);
        }
      } catch {
        // Ignore one frame failures and continue scanning.
      } finally {
        predictingRef.current = false;
      }
    }, interval);

    windowTimerRef.current = window.setTimeout(async () => {
      if (windowClosedRef.current) {
        return;
      }
      await closeWindow("intact", lastFrameBlobRef.current);
    }, duration);
  }, [captureCurrentFrameBlob, closeWindow, frameIntervalMs, framePredictCandidates, minConfidence, sendToEndpoint, windowDuration]);

  const stopCamera = useCallback(() => {
    const stream = webcamRef.current?.video?.srcObject;
    if (stream && typeof stream.getTracks === "function") {
      stream.getTracks().forEach((track) => track.stop());
    }
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => {
      clearConveyorTimers();
      stopCamera();
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = "";
      }
    };
  }, [clearConveyorTimers, stopCamera]);

  useEffect(() => {
    // Reset transient UI state when opening this page from any route.
    setPrediction(null);
    setConfidence(null);
    setErrorMessage("");
    setPreviewUrl("");
    setImageFile(null);
  }, [location.key]);

  useEffect(() => {
    if (scanMode !== "manual") {
      // Do not carry manual preview/result into conveyor mode.
      setPreviewUrl("");
      setImageFile(null);
      setPrediction(null);
      setConfidence(null);
      setErrorMessage("");
    }
  }, [scanMode]);

  useEffect(() => {
    if (scanMode === "conveyor" && beltRunning && !cameraOn) {
      setCameraOn(true);
    }
  }, [beltRunning, cameraOn, scanMode]);

  useEffect(() => {
    if (scanMode === "conveyor" && beltRunning && cameraOn) {
      clearConveyorTimers();
      startWindow();
    }
  }, [beltRunning, cameraOn, clearConveyorTimers, scanMode, startWindow]);

  const startBeltScan = async () => {
    if (beltRunning) {
      return;
    }
    setScanMode("conveyor");
    setBeltRunning(true);
    setBeltState("SCANNING");
    setErrorMessage("");
    setCameraOn(true);
  };

  const stopBeltScan = () => {
    setBeltRunning(false);
    setBeltState("IDLE");
    clearConveyorTimers();
    stopCamera();
  };

  const copyResult = async () => {
    if (!prediction || confidencePercent == null) return;
    const content = `Status: ${prediction.toUpperCase()} | Confidence: ${confidencePercent}% | Quality: ${scanQuality}`;

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      setErrorMessage("Clipboard is unavailable in this browser context.");
      return;
    }

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
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      stopCamera();
      fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "webcam.jpg", { type: "image/jpeg" });
          setPreviewUrl(imageSrc);
          finalizeProductScan(blob, file.name);
        })
        .catch(() => {
          setErrorMessage("Could not capture image from camera. Please try again.");
        });
    }
  }, [finalizeProductScan, stopCamera]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const isImage = file.type.startsWith("image/");
    const maxBytes = 10 * 1024 * 1024;
    if (!isImage) {
      setErrorMessage("Please upload a valid image file.");
      return;
    }
    if (file.size > maxBytes) {
      setErrorMessage("Image is too large. Please use a file under 10MB.");
      return;
    }

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = "";
    }

    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setImageFile(file);
    setErrorMessage("");
    setPreviewUrl(objectUrl);
    finalizeProductScan(file, file.name);
  };

  return (
    <div className="scanner-container">
      <h1 className="scanner-title">Package Scanner</h1>
      <p>
        Scan a package via webcam or upload an image to check its condition.
      </p>

      <div className="mode-switch">
        <button
          type="button"
          className={scanMode === "manual" ? "active" : ""}
          onClick={() => {
            stopBeltScan();
            setScanMode("manual");
          }}
        >
          Manual Scan
        </button>
        <button
          type="button"
          className={scanMode === "conveyor" ? "active" : ""}
          onClick={() => setScanMode("conveyor")}
        >
          Conveyor Scan
        </button>
      </div>

      {scanMode === "conveyor" && (
        <section className="conveyor-config">
          <h3>Conveyor Config</h3>
          <div className="conveyor-grid">
            <label>
              Window Duration (ms)
              <input type="number" value={windowDuration} onChange={(e) => setWindowDuration(Number(e.target.value))} />
            </label>
            <label>
              Frame Interval (ms)
              <input type="number" value={frameIntervalMs} onChange={(e) => setFrameIntervalMs(Number(e.target.value))} />
            </label>
            <label>
              Cooldown (ms)
              <input type="number" value={cooldownMs} onChange={(e) => setCooldownMs(Number(e.target.value))} />
            </label>
            <label>
              Min Damage Confidence
              <input type="number" step="0.01" min="0" max="1" value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} />
            </label>
          </div>
          <div className="conveyor-actions">
            {beltRunning ? (
              <button type="button" className="open-camera-btn" onClick={stopBeltScan} disabled={loading}>Stop Belt Scan</button>
            ) : (
              <button type="button" className="open-camera-btn" onClick={startBeltScan} disabled={loading}>Start Belt Scan</button>
            )}
            <span className="belt-state">State: {beltState}</span>
          </div>
        </section>
      )}

      {scanMode === "manual" && (
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
              <button className="open-camera-btn" onClick={handleCapture} disabled={loading || beltRunning}>
                Capture & Predict
              </button>
            ) : (
              <button className="open-camera-btn" onClick={handleStartCamera} disabled={loading}>
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
                disabled={loading}
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
      )}

      {scanMode === "conveyor" && (
        <div className="scanner-panels conveyor-view">
          <div className="panel webcam-panel">
            <div className="panel-header webcam-header">
              <FaCamera className="icon" /> Conveyor Live Feed
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
                <span className="camera-note">Start scan to check.</span>
              )}
            </div>
          </div>
        </div>
      )}

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

      <div className="alert-note">
        <strong>Note:</strong> You can find all{" "}
        <span className="highlight-text">damaged items</span> in the{" "}
        <Link to="/details" className="alert-link">
          Details Page
        </Link>
        . {activeEndpoint ? `Live backend: ${activeEndpoint}` : ""}
      </div>
    </div>
  );
};

export default Scan;
