# 📈 Stock & Crypto Market Real-Time Tracker

A high-performance, real-time market tracking system built with **.NET 10 Web API**, **SignalR**, and **MySQL**. The application fetches real-time stock and cryptocurrency prices from external APIs, updates database records asynchronously in the background, and streams live prices to a JavaScript web client.

---

## 🌟 Key Features

- ⚡ **Real-Time Price Streaming**: Built-in SignalR WebSocket integration (`StockHub`) pushing live price ticks directly to the client without page refreshes.
- 🔄 **Dual API Integration**:
  - **CoinGecko API**: Fetches real-time crypto prices (e.g., BTC, ETH, SOL).
  - **Finnhub API**: Fetches real-time traditional stock prices (e.g., AAPL, TSLA, MSFT).
- ⏱️ **Background Worker Service**: `StockPriceWorker` runs as a hosted background service (`IHostedService`) cycling every 10 seconds through stored assets.
- 🛡️ **Rate-Limit Resilience**: Embedded delay mechanism (`Task.Delay(1200)`) between requests to prevent API rate-limiting blocks on free-tier services.
- 🔐 **JWT Authentication & Security**: Complete user registration/login flow issuing JSON Web Tokens (JWT) for secure REST APIs and WebSocket handshakes.
- 📌 **User Watchlist Management**: Subscribers can add/remove assets to/from their personal watchlist (`UserStock`).
- 🚨 **Global Exception Handling**: Custom middleware (`ExceptionMiddleware`) catches unhandled exceptions centrally and returns standardized JSON error responses.
- 🐳 **Docker Ready**: Fully containerized using `Dockerfile` and `docker-compose.yml` for instant deployment with MySQL.

---

## 🏗️ Architecture & Project Structure

```
StockMarketTrackertatweer/
├── Controllers/
│   ├── AuthAuthController.cs       # User Auth (Register, Login, JWT generation)
│   ├── StocksController.cs         # Stock catalog and asset details API
│   └── SubscriptionsController.cs  # User watchlist / subscription management
├── Hubs/
│   └── StockHub.cs                 # SignalR hub for WebSocket real-time price streaming
├── Middleware/
│   └── ExceptionMiddleware.cs      # Global error handling middleware
├── Models/
│   ├── AuthDtos.cs                 # Data Transfer Objects (DTOs) for authentication
│   ├── Stock.cs                    # Asset model (Id, Symbol, Name, Price, IsCrypto, etc.)
│   └── UserStock.cs                # Many-to-many junction entity (User <-> Stock)
├── Services/
│   ├── StockPriceWorker.cs         # BackgroundService fetching prices from APIs every 10s
│   └── StockRepository.cs          # Data access layer for MySQL database operations
├── appsettings.json                # Application configuration & API keys
├── Dockerfile                      # Container build manifest for .NET App
├── docker-compose.yml              # Multi-container orchestration (App + MySQL)
├── Program.cs                      # Dependency Injection, Middleware pipeline, App entry point
├── index.html                      # Frontend UI markup
└── app.js                         # Frontend logic & SignalR client integration
```

---

## 🔄 System Data Flow

```
[ Frontend (app.js) ] 
       │
       ├──── 1. Auth & Token Request ─────► [ AuthController ]
       ├──── 2. Subscribe Assets ─────────► [ SubscriptionsController ] ──► [ StockRepository ] ──► (MySQL)
       │
[ StockPriceWorker ] (Background Task every 10s)
       │
       ├──── Check Asset Type ────────────► Is Crypto? ──► Fetch from CoinGecko API
       │                                  └► Is Stock?  ──► Fetch from Finnhub API
       │
       ├──── Save Updated Prices ─────────► [ StockRepository ] ──► (MySQL)
       │
       └──── Push Price Updates ──────────► [ StockHub (SignalR) ] ──► [ Frontend (app.js) ]
```

---

## 🚀 Tech Stack

- **Backend**: .NET 10 (ASP.NET Core Web API)
- **Real-time Communication**: ASP.NET Core SignalR
- **Database**: MySQL Server
- **ORM / Data Access**: Entity Framework Core / Dapper
- **Authentication**: JWT Bearer Tokens
- **Containerization**: Docker & Docker Compose
- **Frontend**: HTML5, Vanilla JavaScript, SignalR Client library

---

## ⚙️ Getting Started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Optional for containerized run)
- [MySQL Server](https://www.mysql.com/) (If running locally without Docker)

---

### 🔧 Configuration (`appsettings.json`)

Ensure your `appsettings.json` is configured with valid database credentials and external API keys:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=StockMarketDb;Uid=root;Pwd=your_password;"
  },
  "Finnhub": {
    "ApiKey": "YOUR_FINNHUB_API_KEY"
  },
  "CoinGecko": {
    "ApiKey": "YOUR_COINGECKO_API_KEY"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

---

### 🐳 Option 1: Running with Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/StockMarketTracker.git
   cd StockMarketTracker
   ```

2. Build and start the containers:
   ```bash
   docker compose up --build -d
   ```

3. Open your browser and navigate to `http://localhost:5000` or inspect APIs via Swagger at `http://localhost:5000/swagger`.

---

### 💻 Option 2: Running Locally (.NET CLI)

1. Start your local MySQL server and create the database specified in `appsettings.json`.
2. Restore dependencies and run the project:
   ```bash
   dotnet restore
   dotnet run
   ```
3. Open `index.html` in your browser or serve it via a local static server.

---

## 📡 API Endpoints Summary

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user account | ❌ No |
| `POST` | `/api/auth/login` | Login and receive JWT access token | ❌ No |

### Stocks (`/api/stocks`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/stocks` | Get list of all tracked stocks & cryptos | 🔑 Yes |
| `GET` | `/api/stocks/{id}` | Get detailed info for a specific asset | 🔑 Yes |

### Watchlist / Subscriptions (`/api/subscriptions`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/subscriptions` | Get current user's subscribed assets | 🔑 Yes |
| `POST` | `/api/subscriptions/{stockId}` | Subscribe to an asset watchlist | 🔑 Yes |
| `DELETE` | `/api/subscriptions/{stockId}` | Unsubscribe from an asset watchlist | 🔑 Yes |

### WebSockets (`/stockHub`)
- Connect via SignalR: `wss://your-domain/stockHub?access_token=YOUR_JWT_TOKEN`
- Event listener: `ReceivePriceUpdate(stockId, newPrice)`

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
