# 🗑️ Smart Waste Management System – Demo

> A full-stack demo app for municipal waste management with real-time bin monitoring, route optimization, and public pickup requests.

## Azure Deployment

See [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md) for backend App Service + frontend Static Web Apps deployment steps.

## 🚀 Quick Start

### 1. Start the Backend

```bash
cd smart-waste-management/backend
npm install
npm start
```

Backend runs on **http://localhost:4000**

### 2. Start the Frontend

```bash
cd smart-waste-management/frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## 🔑 Demo Credentials

| Role   | Email                  | Password |
|--------|------------------------|----------|
| Worker | worker@example.com     | password |
| Admin  | admin@example.com      | password |
| Public | No login required      | –        |

---

## 👥 Features by Role

### 👷 Worker
- Live map of bins (🔴 Full / 🟢 Empty)
- Click any bin → Mark as Collected
- **Optimize Route** button (nearest-neighbor AI)
- Real-time bin status via WebSocket

### 🏛️ Admin
- Stats dashboard (bins, collections, requests)
- Live map with worker locations
- Public request management (resolve/reject)
- Analytics charts (fill levels, pie chart)

### 🌍 Public User
- Click map to pin pickup location
- Submit garbage pickup request form
- No login required

---

## 🗺️ Map
- Default location: **Thillai Nagar, Tiruchirappalli (10.8245, 78.6880)**
- 10 pre-seeded demo bins at real street locations
- Dark-themed OpenStreetMap tiles

## ⏱️ IoT Simulation
When a bin is **collected**, it automatically becomes **Full again after 3 minutes** (mimics IoT sensor refill).

## 🔌 Tech Stack

| Layer     | Tech                              |
|-----------|-----------------------------------|
| Frontend  | React 19 + Vite + Tailwind CSS v4 |
| Maps      | Leaflet.js + react-leaflet        |
| Backend   | Node.js + Express                 |
| Database  | In-memory JSON store (demo)       |
| Auth      | JWT (jsonwebtoken + bcryptjs)     |
| Real-time | WebSocket (ws)                    |
| Charts    | Recharts                          |

## 📁 Folder Structure

```
smart-waste-management/
├── backend/
│   ├── data/
│   │   ├── seedData.js       # 10 demo bins + 2 users
│   │   └── store.js          # In-memory DB
│   ├── middleware/
│   │   └── auth.js           # JWT middleware
│   ├── routes/
│   │   ├── auth.js           # Login, /me
│   │   ├── bins.js           # Bins CRUD + collect + route
│   │   ├── requests.js       # Public requests
│   │   └── admin.js          # Admin stats + workers
│   └── server.js             # Express + WebSocket
└── frontend/
    └── src/
        ├── components/
        │   ├── BinMap.jsx     # Leaflet map component
        │   └── Sidebar.jsx    # Role-aware navigation
        ├── context/
        │   └── AuthContext.jsx
        ├── hooks/
        │   └── useWebSocket.js
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── WorkerPage.jsx
        │   ├── AdminPage.jsx
        │   └── PublicPage.jsx
        └── services/
            └── api.js         # Axios client
```
