# 💎 AssetAura: Your Personal Wealth Dashboard

**AssetAura** is a premium, locally hosted net worth tracker designed for data privacy, elegant visualization, and zero-maintenance tracking. Get a crystal-clear, consolidated view of your entire wealth across diverse asset classes—stocks, mutual funds, cash, and gold—in one beautifully designed dashboard.

Stop juggling multiple spreadsheets and broker apps. Let AssetAura orchestrate the tedious work of live price tracking, foreign exchange conversions, and data aggregation, so you can focus on the big picture.


## 🔒 100% Local & Private by Design

Your net worth is your business. **AssetAura is fundamentally a local-first application.**

- **Zero Tracking**: Your financial data, asset holdings, and net worth history are stored entirely on your local machine inside an offline SQLite database (`/data/portfolio.db`). **No financial data ever leaves your computer.**
- **Why do we use the internet?** The app only makes outbound HTTP requests to fetch public market data—specifically querying public tickers against Yahoo Finance and mfapi.in to get the latest unit prices, company names, and currency exchange rates.
- **Works 100% Offline**: If you disconnect from the internet or APIs go down, the app remains fully functional. You can rely entirely on the most recently cached prices, or manually override the prices yourself via the edit panel to keep your dashboard perfectly accurate without ever going online.

## ✨ What Makes AssetAura Special?

AssetAura is built to combine high aesthetics with resilient engineering. Here are the core features:

### 1. 🌍 Intelligent Multi-Currency Engine
- **Base Currency Flexibility**: Define your preferred base currency (e.g., **INR**, **USD**).
- **Silent FX Conversion**: Hold cash in USD and stocks in INR? AssetAura actively fetches the latest FX exchange rates and dynamically normalizes all your holdings to your base currency in real time.

### 2. ⚡ Hybrid & Resilient Price Tracking
The market isn't always reliable, but your net worth chart should be. AssetAura includes a multi-layered pricing engine:
- **Live Market Data**: Integrates seamlessly with **Yahoo Finance** and **mfapi.in** for real-time asset pricing and name enrichment.
- **Smart Caching**: Employs a 24-hour cache layer to prevent unnecessary rate limiting and ensure snappy dashboard loads, even on weekends when markets are closed.
- **The "Safety Net" Fallback Hierarchy**: If a live API fails or goes offline, AssetAura elegantly falls back to: 
    1. Your last manually overriden price.
    2. The most recent successful price from the cache.
    3. Your original purchase price. 
    *Result? Your net worth chart never falsely crashes to $0 during an API outage.*

### 3. 🎨 Premium Glassmorphic UI/UX
- Engineered with a bespoke, dark-mode-first **Glassmorphism** design using Vanilla CSS.
- Features fluid layout transitions, micro-animations, and hovering tooltips powered by **Recharts**.
- Status badges indicate data health at a glance (e.g., `AUTOMATED` vs. `FAILED`).

### 4. 🏷️ Smart Asset Naming & Organization
- **Custom Nicknames**: Long, cluttered names like *"quant Small Cap Fund - Growth Option - Direct Plan"*? Rename them to *"Quant Small Cap"* using the **Display Name / Nickname** feature. 
- **Algorithmic Cleanup**: No nickname set? The built-in algorithmic cleaner automatically detects and strips industry jargon, keeping your dashboard pristine.

### 5. 📊 Rich Data Visualizations
- **Portfolio History**: 90-day interactive area chart showing your wealth progression.
- **Top 5 Holdings**: Quickly identify your highest concentrations.
- **Asset Allocation**: Understand your exposure split between Equities, Mutual Funds, Gold, and Cash.
- **Currency Exposure**: Track the geographical distribution of your assets.

### 6. 📥 1-Click Broker Imports
Currently featuring native CSV import support for **Zerodha**. Simply upload your holdings spreadsheet and watch your dashboard populate instantly. (The architecture is extensible to support other brokers soon).

---

## 🚀 Getting Started

AssetAura is completely local and private—your financial data never leaves your computer. Here is how a first-time user can set it up in minutes.

### Prerequisites
You need basically two things installed on your system:
- **Node.js** (v18 or higher recommended)
- **Git**

### Step-by-Step Installation

#### 1. Download the Project
Clone the repository to your local machine:
```bash
git clone https://github.com/your-username/consolidated-net-worth-calculator.git
cd "consolidated-net-worth-calculator"
```

#### 2. Start the Backend Server (Database & APIs)
The backend manages the SQLite database, fetches live prices, and handles data consolidation.

```bash
cd server
npm install

# Start the server (runs on Port 3001)
npm run dev
```

#### 3. Start the Frontend Application (UI)
Open a **new terminal window/tab**, and navigate to the client directory:

```bash
cd client
npm install

# Start the development server (runs on Port 5173)
npm run dev
```

#### 4. Access Your Dashboard
Open your favorite web browser and go to:
👉 **[http://localhost:5173](http://localhost:5173)**

That's it! You can now start adding assets manually via the "Manage Assets" page or upload a Zerodha CSV. 

---

## 🛠️ Technology Stack Built For Speed
- **Frontend**: React 19, Vite, Zustand (State Management), Recharts.
- **Backend**: Node.js 18+, Express.js.
- **Database**: `better-sqlite3` (Zero configuration, file-based, exceptionally fast).
- **Observability**: Winston daily-rotating file logs (`/server/logs/`).

## 🤝 Contributing
Feel free to fork this project, submit pull requests, or request new broker parsers. AssetAura is designed with a plugin-style `BrokerParser` architecture making it easy to add support for apps like Groww, Upstox, or international brokers.

## 📝 License
This project is open-source and available under the [MIT License](LICENSE).
