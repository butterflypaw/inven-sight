# InvenSight
## Project Description:

### **Overview:**

**InvenSight** is a real-time AI-powered product damage detection system built for enhancing warehouse efficiency and product quality. Designed during **Walmart Sparkathon 2025**, it leverages computer vision to identify damaged inventory-like dents, leaks, and tears-during loading and unloading operations, reducing manual effort and minimizing inventory loss.

---

## Features:

### **1. Real-Time Damage Detection:**

* Detects product defects directly from live video feeds.
* Flags damages instantly with a confidence score.

### **2. Smart Alerting System:**

* Logs damaged items with timestamp and SKU.
* Sends alerts to the dashboard for quick review by staff.

### **3. Intuitive Staff Dashboard:**

* Visual dashboard built with React & Material UI.
* Staff can review, approve, or discard flagged items with ease.

### **4. Backend Automation:**

* All detections are logged and stored using Flask and MongoDB.
* Reduces paperwork and enables damage traceability.

### **5. Integration-Ready:**

* Easily integrates into existing warehouse workflows.
* Future-ready for hardware like auto-removal arms.

---

## Local Setup:

### **To Set Up Locally:**

1. **Clone the repository:**

```bash
git clone 
cd invensight
```

2. **Backend Setup:**

```bash
cd backend
pip install -r requirements.txt
python app.py
```

3. **Frontend Setup:**

```bash
cd ../frontend
npm install
npm start
```

### **Model Training (Recommended):**

Train an improved transfer-learning model using EfficientNet:

```bash
cd backend
python model/train_model.py --data_dir /path/to/dataset --output_dir model
```

For large-scale training (50k-100k images), prepare clean train/val/test splits first:

```bash
cd backend
python model/prepare_dataset.py --raw_dir /path/to/raw --output_dir /path/to/processed_dataset
python model/train_model.py --data_dir /path/to/processed_dataset/train --output_dir model
```

Expected raw format:

```text
raw/
   damaged/
   intact/
```

Expected dataset format inside your data directory:

```text
dataset/
   damaged/
      image1.jpg
      image2.jpg
   intact/
      image1.jpg
      image2.jpg
```

After training, prediction API will auto-load:

- model/model_best.keras
- model/training_metadata.json

If no model is found, backend still starts and returns a clear model-missing error on predict calls.

4. **Open in browser:**
   Visit `http://localhost:3000` for the dashboard
   Visit `http://localhost:5000` for the Flask backend

---

## 🚀 How to Use:

* Open the camera module (or upload video input).
* The AI model scans live frames for damage.
* Damaged items are flagged with visuals and confidence.
* Staff can view alerts on the dashboard and take action.

---

## 🎯 Benefits:

1. **Real-Time Damage Detection:**
   Instant identification of defects during warehouse operations.

2. **Reduced Manual Workload:**
   Automates inspections and frees up staff for higher-value tasks.

3. **Improved Product Quality:**
   Ensures only non-damaged items are sent to customers.

4. **Operational Efficiency:**
   Reduces returns, customer complaints, and loss of inventory.

5. **Data Traceability:**
   Logs with timestamps and SKUs help in auditing and analytics.

6. **Scalability:**
   Architecture ready for hardware integration and cloud deployment.

---

## Conclusion:

InvenSight offers a smart, scalable, and cost-effective way to solve the real-world problem of product damage in warehouses. By combining AI, automation, and intuitive design, it sets the stage for smarter inventory handling in retail supply chains. With continuous improvements and hardware integrations, it has strong potential for real-world adoption.

