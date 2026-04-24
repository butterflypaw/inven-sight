# InvenSight

**InvenSight** is a real-time AI-powered product damage detection system built for enhancing warehouse efficiency and product quality. It leverages computer vision to identify damaged inventory — dents, leaks, tears — during loading and unloading operations, reducing manual effort and minimising inventory loss.

---

## Features

**1. Real-Time Damage Detection**
Detects product defects from live webcam feeds or uploaded images. Flags damage instantly with a confidence score.

**2. Conveyor Belt Scanning**
Automated scanning mode with a configurable state machine (`IDLE → SCANNING → COOLDOWN`). Supports window duration, frame interval, cooldown period, and minimum confidence threshold.

**3. Smart Gating**
Rejects non-package inputs — human faces and irrelevant scenes — before running the damage model, reducing false positives.

**4. Operational Dashboard**
KPI cards (total scanned, damaged, intact, scans today), 7-day trend charts, confidence distribution histogram, hourly scan breakdown, and an AI-generated risk summary.

**5. Alerts System**
Active / Acknowledged / Resolved alert lifecycle with severity classification (high/medium based on confidence), mute toggle, and a live badge count on the sidebar.

**6. Scan History**
Paginated table with date range filter, search by item ID, condition/warehouse/confidence filters, and CSV export.

**7. Inventory Tracking**
Stock overview with damage risk levels and direct links from each item to its full scan history.

**8. Backend Automation**
All detections are logged and stored using Flask and MongoDB. Reduces paperwork and enables damage traceability.

**9. Integration-Ready**
Easily integrates into existing warehouse workflows. Future-ready for hardware like auto-removal arms.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, MUI v7, MUI X Charts v8 |
| Backend | Flask 3, Flask-CORS |
| ML | TensorFlow 2 / Keras, MobileNetV2 (scene gating) |
| Database | MongoDB (local) |
| Image handling | Pillow, OpenCV |

---

## Project Structure

```
inven-sight/
├── backend/
│   ├── app.py              # Flask entry point
│   ├── data_store.py       # MongoDB read/write + in-memory fallback
│   ├── model/
│   │   ├── model.py        # Inference pipeline + smart gating
│   │   └── model.h5        # Pre-trained Keras model (not in repo)
│   ├── routes/
│   │   ├── predict.py      # /predict and /predict-frame endpoints
│   │   ├── data_api.py     # /dashboard, /details, /inventory, /health
│   │   └── auth_api.py     # /auth/register, /auth/login
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/          # Dashboard, Scan, Alerts, Inventory, Details, Login
    │   ├── components/     # Layout, charts, modals
    │   ├── services/api.js # Axios client
    │   └── styles/         # Per-page CSS
    └── package.json
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB running on `localhost:27017`
- Pre-trained model file at `backend/model/model.h5`

### 1. Clone the repository

```bash
git clone <repo-url>
cd inven-sight
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Runs on `http://localhost:5000`. Creates `uploads/` and `dataset/` directories automatically. Seeds MongoDB with sample data if collections are empty.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
```

Runs on `http://localhost:3000`. Connects to the backend at `http://127.0.0.1:5000` by default.

To point to a different backend:

```bash
REACT_APP_BACKEND_URL=http://your-backend-host:5000 npm start
```

### 4. Open in browser

- Dashboard: `http://localhost:3000`
- Flask API: `http://localhost:5000`

---

## Model Training

Train an improved transfer-learning model using EfficientNet:

```bash
cd backend
python model/train_model.py --data_dir /path/to/dataset --output_dir model
```

For large-scale training (50k–100k images), prepare clean train/val/test splits first:

```bash
cd backend
python model/prepare_dataset.py --raw_dir /path/to/raw --output_dir /path/to/processed_dataset
python model/train_model.py --data_dir /path/to/processed_dataset/train --output_dir model
```

**Expected raw format:**

```
raw/
  damaged/
  intact/
```

**Expected dataset format:**

```
dataset/
  damaged/
    image1.jpg
    image2.jpg
  intact/
    image1.jpg
    image2.jpg
```

After training, the prediction API will auto-load:
- `model/model_best.keras`
- `model/training_metadata.json`

If no model is found, the backend still starts and returns a clear error on predict calls.

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/predict` | Full prediction — saves image and logs result to DB |
| `POST` | `/predict-frame` | Lightweight inference — no DB write, used by conveyor mode |
| `GET` | `/dashboard` | Aggregate stats (total scanned, damaged count) |
| `GET` | `/details` | Full scan history |
| `GET` | `/inventory` | Current inventory |
| `GET` | `/health` | Health check |
| `POST` | `/auth/register` | Create user |
| `POST` | `/auth/login` | Authenticate user |

---

## Conveyor Belt Mode

The Scan page implements a state machine (`IDLE → SCANNING → COOLDOWN`) for continuous belt scanning.

| Parameter | Default | Description |
|---|---|---|
| Window duration | 5000ms | How long to scan each product |
| Frame interval | 500ms | Time between frames sent to `/predict-frame` |
| Cooldown | 1500ms | Pause between products |
| Min confidence | 0.70 | Threshold below which results are ignored |

The belt logs one record per product via `/predict` and exits the window early if damage is detected at sufficient confidence.

---

## Benefits

1. **Real-Time Damage Detection** — Instant identification of defects during warehouse operations.
2. **Reduced Manual Workload** — Automates inspections and frees up staff for higher-value tasks.
3. **Improved Product Quality** — Ensures only non-damaged items reach customers.
4. **Operational Efficiency** — Reduces returns, customer complaints, and inventory loss.
5. **Data Traceability** — Logs with timestamps and SKUs support auditing and analytics.
6. **Scalability** — Architecture ready for hardware integration and cloud deployment.

---

## Conclusion

InvenSight offers a smart, scalable, and cost-effective solution to the real-world problem of product damage in warehouses. By combining AI, automation, and an intuitive dashboard, it sets the stage for smarter inventory handling across retail supply chains. With continuous improvements and hardware integrations, it has strong potential for real-world adoption.
