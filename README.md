# CryptoTrading Service

## Overview

The **CryptoTrading** service handles:

- 🚀 **Trading Execution**: Order placement, cancellation, trade history.
- 📡 **CEX API Integration**: Relays trade orders to centralized exchanges (CEX) like Binance.
- 📜 **Database Management**: Stores trading-related data (orders, balances, market pairs).
- ⚡ **To Be Added: Market Data Handling**: WebSocket price feeds & OHLCV charting.

---

## 📁 **Project Structure**

```sh
CryptoTrading
├─ config                   
│  ├─ cexConfig.js          # API credentials & settings for CEX integration
│  └─ database.js           # Database connection settings
├─ controllers              
│  └─ tradingController.js  # Handles API request logic for trading functions
├─ middleware               
│  └─ errorhandler.js       # Centralized error handling middleware
├─ models                   
│  ├─ CryptoBalance.js      # Stores user crypto balances
│  ├─ index.js              # Initializes all models
│  ├─ LocalUserCache.js     # Caches user data locally
│  ├─ MarketPair.js         # Tracks supported market pairs (e.g., BTC/USDT)
│  ├─ TradeHistory.js       # Stores executed trade history
│  └─ TradingOrder.js       # Handles user trade orders
├─ routes                   
│  └─ tradingRoutes.js      # API routes for trading-related operations
├─ services                 
│  ├─ cexService.js         # Handles API calls to Binance/CEX
│  └─ cryptoTradingService.js     # Business logic for order execution & balance updates
├─ tests                    # Unit & integration tests (To be implemented)
├─ utils                    
│  ├─ customError.js        # Custom error handling
│  └─ userHelper.js         # Fetches user data from the main module
├─ constants.js             # Constants for order types, market status, etc.
├─ package.json             # Project dependencies & scripts
├─ README.md                # Documentation (You're reading this!)
└─ server.js                # Main entry point for the CryptoTrading service
```

---

## ⚡ To Be Added: Market Data Handling**

⚡ To Be Added: Market Data Handling
Once implemented, this feature will include:

Real-time WebSocket price feeds from Binance/CEX.
Storage of historical OHLCV (Open, High, Low, Close, Volume) data.
REST API endpoints for retrieving price history & charts.

the following to be added:

```sh
├─ models                   
│  ├─ PriceCandle.js        # Stores OHLCV data
├─ routes                   
│  ├─ priceRoutes.js        # API for price data
├─ services                 
│  ├─ priceService.js       # Fetches & stores price data
│  ├─ websocketService.js   # Handles WebSocket for live prices


---

## ⚙️ **Installation & Setup**

### **1️⃣ Clone the Repository**

```sh
git clone <repo-url>
cd CryptoTrading
```

### **2️⃣ Install Dependencies**

```sh
npm install
```

### **3️⃣ Configure Environment Variables (`.env`)**

Create a `.env` file and set up the following:

```sh
# Binance API Configuration
BINANCE_API_URL=https://testnet.binance.vision  # Use testnet for development
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
BINANCE_WS_URL=wss://testnet.binance.vision/ws

# Trading Configuration
TRADING_FEE_RATE=0.001  # 0.1% trading fee
DEFAULT_MARKET_PAIRS=BTCUSDT,ETHUSDT,BNBUSDT  # Comma-separated list of trading pairs

# Database Configuration
CRYPTO_DB_DATABASE=crypto_trading_db
CRYPTO_DB_USERNAME=your_db_username
CRYPTO_DB_PASSWORD=your_db_password
CRYPTO_DB_HOST=127.0.0.1
CRYPTO_DB_PORT=3306
```

### **4️⃣ Run Database Migrations**

```sh
npm run migrate
```

### **5️⃣ Start the Service**

```sh
npm start
```

---

## 🚀 **API Endpoints**

| **Method** | **Route** | **Description** |
|-----------|----------|----------------|
| `POST` | `/api/orders/order` | Place a trade order |
| `GET` | `/api/orders/orders/:userId` | Fetch user orders |
| `POST` | `/api/orders/order/cancel` | Cancel an order |
| `GET` | `/api/orders/trade-history/:userId` | Fetch user trade history |

### **( API if Market Data Handling is Included)**

| **Method** | **Route** | **Description** |
|-----------|----------|----------------|
| `GET` | `/api/prices/prices/:symbol/:interval` | Fetch OHLCV price history |
| `GET` | `/api/prices/realtime` | Check WebSocket status |

---

## 📌 **Tasks for Workers**

### **1️⃣ Implement Missing Features**

- [ ] ✅ **Complete `cryptoTradingService.js`** to handle order execution.
- [ ] ✅ **Integrate `cexService.js`** with Binance API.
- [ ] ✅ **Implement database migrations** for all models.
- [ ] ✅ **Write unit tests** under `/tests/`.

### **2️⃣ Code Standards**

- Follow **clean code principles**.
- Use **async/await** and **try/catch** for error handling.

---

## ❓ **Need Help?**

📩 Contact the lead developer or check the **issue tracker** for assigned tasks.

---

**💡 Now you're set to work on the CryptoTrading service!** 🚀🔥
