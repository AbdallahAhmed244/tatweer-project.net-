# 📈 Real-Time Stock Market Tracker API

A production-ready, real-time stock and cryptocurrency tracking backend built with **ASP.NET Core Web API**, **SignalR**, and **MySQL**. The system automatically fetches live price data from the **Finnhub Financial API**, updates the database, and streams live changes to connected clients instantly.

---

## 🚀 Key Features

* **Real-Time Data Streaming:** Instant price broadcasts using ASP.NET Core SignalR (`/stockHub`).
* **Automated Market Polling:** `StockPriceWorker` background service synchronizes live market quotes with MySQL asynchronously.
* **Role-Based Access Control (RBAC):** Secured endpoints using JWT authentication, distinguishing between `Admin` and standard `User` roles.
* **Multi-Asset Support:** Real-time updates for US Stock Market assets (during market hours) and 24/7 Cryptocurrency tokens.
* **Database Security:** Parameterized queries via `MySqlConnector` preventing SQL Injection vulnerabilities (OWASP Compliant).

---

## 🛠️ Tech Stack

* **Framework:** .NET / ASP.NET Core Web API
* **Real-Time Transport:** ASP.NET Core SignalR
* **Database:** MySQL Server
* **Data Provider:** `MySqlConnector`
* **External Financial API:** [Finnhub.io](https://finnhub.io/)
* **Authentication:** JSON Web Tokens (JWT)

---

## 📋 Architecture & Data Flow

```text
[ Finnhub API ] ──(Polling)──> [ StockPriceWorker ] ──(Update)──> [ MySQL DB ]
                                       │
                                 (Broadcast)
                                       ▼
                                [ SignalR Hub ] ────> [ Client Apps ]
