# Gold App

Smart Gold Trading Platform for Iran & Global markets.
Real-time prices, AI-generated signals, TradingView-style charts with OHLC overlay + volume, automated trade management, price alerts, liquidity depth and advanced ML analytics.

---

## Overview

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 3.2 · Java 21 · Gradle |
| ML Service | Python 3.11+ · FastAPI · NumPy · scikit-learn · SciPy |
| Web | React 18 · Vite · CSS Modules · lightweight-charts · recharts |
| Mobile | Expo · React Native |
| Database | H2 (dev) · PostgreSQL (prod) |
| Real-time | STOMP over SockJS (WebSocket) |
| Auth | JWT (HttpOnly cookie + Bearer fallback) |

---

## Features

### Live Prices
- **Global** — PAXG/USDT polled from Binance REST API every 2 seconds
- **Iran** — 5 assets scraped from TGJU every 30 seconds:
  - طلا ۱۸ عیار (18k gold) · طلا ۲۴ عیار (24k gold) · مثقال طلا (mithqal) · سکه امامی (Emami coin) · نرخ دلار (USD/IRR)
  - Each asset has its own interactive candlestick chart — click a price card to switch

### 5-Year Historical Charts
- **Global** — 1825 daily OHLC candles from Binance klines API (PAXGUSDT, 2 requests × 1000 candles each)
- **Iran** — ~1827 daily records from TGJU summary table; Jalali dates auto-converted to Gregorian
- Both loaded on startup via `HistoricalDataService` and refreshed daily at 06:00

### Candlestick Charts
- TradingView-style dark theme using `lightweight-charts`
- OHLC overlay at top: **O / H / L / C** + change amount + % (updates on hover)
- Volume histogram bars at the bottom (green/red, global 5Y only)
- Timeframes: **Short** (1 min candles) · **Mid** (5 min) · **Long** (1 hour) · **5Y** (daily OHLC)

### Signals
12 indicators → score −10 to +10 → signal per timeframe (SHORT / MID / LONG)

**Technical (7):** RSI · MACD · Bollinger Bands · Trend · Volume · Support/Resistance · MA Cross

**Fundamental (5):** DXY · Fed Rate · CPI · ETF Flows · Coin Bubble (Iran)

| Score | Signal |
|-------|--------|
| ≥ +6 | STRONG BUY |
| +3 to +5 | BUY |
| −2 to +2 | HOLD |
| −3 to −5 | SELL |
| ≤ −6 | STRONG SELL |

### Portfolio
- Open / Closed / Paper trades
- Live unrealized P&L calculated from WebSocket price
- Timeframe badge (Short · Mid · Long)
- Auto-close at Stop Loss or Take Profit — triggered on every incoming price tick
- ATR-based trailing stop + Black Swan emergency close (>4% tick move)
- Close button locks in trade at current live price instantly

### Stop Loss / Take Profit
- Manual SL/TP per trade via **StopLossPanel** (web) / **StopLossCard** (mobile)
- **Auto (ATR)** — fetches 24h price history, calculates ATR-based SL + TP in one click
- SL/TP button visible on every open trade in Portfolio, Global Market, and Iran Market screens
- Works for both USD (global) and Toman (Iran) markets

### Price Alerts
- Create alerts for Global or Iran market: `ABOVE` or `BELOW` a target price
- Triggers fire on every incoming WebSocket price tick via `AlertService`
- Triggered alerts pushed to user via WebSocket (`/queue/alert`) — real-time notification
- **Web:** dedicated Alerts page at `/dashboard/alerts` — create · toggle · delete
- **Mobile:** dedicated Alerts tab — create · toggle · delete

### Open Positions on Market Screens
- Global Market and Iran Market screens both show a live **Open Positions** panel
- Each position displays: type · entry price · quantity · live P&L (from WebSocket)
- Inline **SL/TP** button opens the stop loss modal directly from the market view

### Liquidity Depth
- Real-time order book snapshot from Binance (`PAXGUSDT`, top 5 levels) every 5 seconds
- Metrics: **Best Bid** · **Best Ask** · **Spread** · **Bid Depth** (total USD) · **Ask Depth**
- REST endpoint `GET /api/liquidity` (public) + WebSocket push to `/topic/liquidity`

### Admin Panel
- User management: enable / disable / delete users, assign roles
- Stats: Total Users · Active · Pending counters
- Charts: Status pie chart · Roles pie chart · Countries bar chart (recharts)

### Backtesting
- Simulate signal-based strategy over historical data
- Parameters: market · timeframe (SHORT/MID/LONG) · period (1 week → 1 year) · initial capital
- Results: final capital · total P&L · win rate · best/worst trade · capital history chart
- Available on both web and mobile

### User Preferences
- Default market, default timeframe, currency preference
- Alert channel settings: email · Telegram · push notifications
- REST: `GET /api/preferences` · `PUT /api/preferences`

### Advanced ML Analytics (ml-service)

| Module | Function |
|--------|----------|
| Trade Journal | Log entry reason, indicators, outcome and lessons learned |
| Attribution | Break down P&L per indicator (which indicator made/lost money) |
| Meta Model | Track LR vs LSTM accuracy, detect best model for current regime |
| Market Regime | TREND / RANGE / VOLATILE / PANIC detection from price series |
| Correlations | DXY · Oil · BTC · S&P500 correlation with gold |
| Seasonality | Average return by hour / weekday / month |
| Behavioral | FOMO · Panic · Herd pattern detection |
| Drift Detection | PSI + KS-test — detects when market changes behavior |
| Manipulation | Stop Hunt and Fake Breakout pattern recognition |
| Monte Carlo | 1000 simulations · VaR · CVaR · max drawdown |
| Kelly Criterion | Optimal position size: f = (b×p − q) / b |
| Position Sizing | Units based on ATR stop and max risk % of capital |
| Exposure Analysis | Long/short balance, hedge ratio, hedging suggestions |
| Data Versioning | SHA256 hash + metadata for reproducibility |

### Stop Loss Types

| Type | Description |
|------|-------------|
| Fixed | Fixed % from entry (1% or 2%) |
| ATR Stop | 1.5× ATR from entry — adapts to volatility |
| Technical | Below support / above resistance |
| Trailing | Ratchets with price — locks in profit |
| Black Swan | Closes immediately on >4% tick move |

### ML Prediction
- **Iran:** Linear Regression + LSTM trained on 40 years of Iran market data
- **Global:** Linear Regression + LSTM trained on global market data
- Direction change detection: >1.5% deviation triggers alert

### Notifications
- Iran market → Telegram
- Global market → Telegram + Email

---

## Project Structure

```
guld-app/
├── backend/
│   ├── algorithm/        RSI, MACD, Bollinger, Trend, Volume, SR, MA
│   ├── dto/
│   │   └── OhlcDto.java
│   ├── model/
│   │   ├── Alert.java                Price alert (market, condition, targetPrice)
│   │   └── UserPreferences.java      Per-user defaults (market, timeframe, alerts)
│   ├── service/
│   │   ├── fetcher/
│   │   │   ├── BinanceFetcher.java   REST poll every 2s + alert check
│   │   │   └── TgjuFetcher.java      scrape every 30s (5 Iran assets)
│   │   ├── HistoricalDataService.java
│   │   ├── AlertService.java         check + fire price alerts via WebSocket
│   │   ├── LiquidityService.java     Binance order book depth every 5s
│   │   ├── SignalService.java
│   │   ├── TradeMonitorService.java  auto SL/TP close
│   │   ├── StopLossService.java      ATR / Trailing / Black Swan
│   │   ├── BacktestingService.java
│   │   ├── ml/                       LinearRegressionModel, LstmModel
│   │   └── notification/             EmailService, TelegramService
│   ├── controller/
│   │   ├── GoldController.java           prices · signals · backtest · status
│   │   ├── HistoricalController.java     GET /api/history
│   │   ├── StopLossController.java       GET|PUT /api/stoploss/{id} · POST /calculate
│   │   ├── AlertController.java          GET|POST /api/alerts · DELETE|PATCH /{id}
│   │   ├── LiquidityController.java      GET /api/liquidity (public)
│   │   ├── UserPreferencesController.java GET|PUT /api/preferences
│   │   ├── TradeController.java
│   │   ├── AuthController.java
│   │   ├── AdminController.java
│   │   ├── AdvancedMlController.java
│   │   └── HealthController.java
│   └── config/
│       ├── SecurityConfig.java       explicit matchers for all endpoints
│       ├── filter/JwtAuthFilter.java Bearer header + HttpOnly cookie
│       └── filter/RateLimitFilter.java
├── ml-service/                       Python FastAPI (port 8000)
│   ├── main.py
│   ├── models/
│   └── requirements.txt
├── web/
│   ├── src/pages/Dashboard/
│   │   ├── GlobalMarket.jsx   live price · chart · signal · open positions + SL/TP
│   │   ├── IranMarket.jsx     5 Iran assets · chart · signal · open positions + SL/TP
│   │   ├── Portfolio.jsx      live P&L · SL/TP panel · filters
│   │   ├── Backtest.jsx       sliders · results · capital chart
│   │   └── Alerts.jsx         create · toggle · delete price alerts
│   ├── src/pages/Admin/
│   │   └── AdminPanel.jsx     user table · stats · recharts (pie + bar)
│   ├── src/components/
│   │   ├── CandlestickChart.jsx
│   │   ├── StopLossPanel.jsx  SL/TP modal · manual + ATR auto-calc
│   │   └── TradeModal.jsx
│   └── src/services/
│       ├── api.js             stoploss · alerts · preferences · liquidity endpoints
│       └── websocket.js
├── mobile/
│   ├── app/
│   │   ├── (tabs)/_layout.jsx  Global · Iran · Portfolio · Backtest · Alerts tabs
│   │   ├── global/index.jsx    live price · signal · open positions + SL/TP
│   │   ├── iran/index.jsx      live price · signal · open positions + SL/TP (Farsi)
│   │   ├── portfolio/index.jsx trades · SL/TP card · live P&L
│   │   ├── trade/backtest.jsx  sliders · run simulation · capital chart
│   │   └── settings/index.jsx  price alert management
│   ├── components/
│   │   ├── StopLossCard.jsx   SL/TP modal · manual + ATR auto-calc
│   │   └── signal/SignalCard.jsx
│   └── services/
│       └── api.js             stoploss · alerts · preferences endpoints
├── docker-compose.yml
└── setup.bat
```

---

## Navigation

### Web (`http://localhost:5173`)

| Route | Page |
|-------|------|
| `/dashboard/global` | Global Market — XAUUSD live price, chart, signal, open positions |
| `/dashboard/iran` | Iran Market — 5 assets, chart, signal, open positions (Persian) |
| `/dashboard/portfolio` | Portfolio — all trades, live P&L, SL/TP editing |
| `/dashboard/backtest` | Backtesting simulator |
| `/dashboard/alerts` | Price Alerts — create, toggle, delete |
| `/admin` | Admin Panel (ADMIN role only) |

### Mobile (Expo tabs)

| Tab | Screen |
|-----|--------|
| Global | Live XAUUSD price, chart, signal, open positions |
| Iran | Iran gold prices, chart, signal, open positions (Farsi) |
| Portfolio | All trades with SL/TP editing |
| Backtest | Backtesting simulator |
| Alerts | Price alert management |

---

## Quick Start (Windows)

```cmd
git clone https://github.com/Majeeee/guld-app
cd guld-app
setup.bat
```

**Backend:**
```cmd
cd backend
gradlew.bat bootRun
```

**ML Service:**
```cmd
cd ml-service
python -m pip install --no-cache-dir -r requirements.txt
python main.py
```
Swagger UI: `http://localhost:8000/docs`

**Web:**
```cmd
cd web
npm install
npm run dev
```

**Mobile:**
```cmd
cd mobile
npx expo start
```

---

## API Reference

### Prices & Signals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gold/price/global` | Latest global gold price |
| GET | `/api/gold/price/iran` | Latest Iran 18k gold price |
| GET | `/api/gold/prices/history?market=&hours=24` | Price ticks for live charts |
| GET | `/api/gold/signal?market=&timeframe=MID` | Latest signal |
| GET | `/api/gold/signal/analyze?market=&timeframe=` | Force re-analyze |
| GET | `/api/gold/backtest?market=&months=1&capital=1000&timeframe=MID` | Run backtest |
| GET | `/api/gold/status` | Fetcher connectivity status |
| GET | `/api/history?market=GLOBAL\|IRAN` | 5-year daily OHLC |
| GET | `/api/liquidity` | Live order book snapshot — **public** |

### Stop Loss / Take Profit

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stoploss/{tradeId}` | Get SL/TP for a trade |
| PUT | `/api/stoploss/{tradeId}` | Update SL/TP (`stopLoss`, `takeProfit`) |
| POST | `/api/stoploss/calculate` | ATR-based SL+TP (`prices[]`, `entryPrice`, `isBuy`) |

### Price Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | List alerts for current user |
| POST | `/api/alerts` | Create alert (`market`, `condition`, `targetPrice`, `message`) |
| DELETE | `/api/alerts/{id}` | Delete an alert |
| PATCH | `/api/alerts/{id}/toggle` | Toggle active/inactive |

### User Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/preferences` | Get preferences (auto-creates defaults) |
| PUT | `/api/preferences` | Update preferences |

### Trades

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trades` | All trades for current user |
| GET | `/api/trades/open` | Open trades only |
| POST | `/api/trades/manual` | Add manual trade |
| POST | `/api/trades/paper` | Add paper trade |
| PUT | `/api/trades/{id}/close` | Close trade at exit price |
| DELETE | `/api/trades/{id}` | Delete trade |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/{id}/enable` | Enable user |
| PUT | `/api/admin/users/{id}/disable` | Disable user |
| PUT | `/api/admin/users/{id}/role` | Set role |
| DELETE | `/api/admin/users/{id}` | Delete user |

### ML Service

| Endpoint | Description |
|----------|-------------|
| POST `/ml/advanced/master` | All analysis in one call |
| POST `/ml/stoploss/recommend` | Best stop loss for current ATR |
| POST `/ml/advanced/journal/entry` | Log trade entry |
| PUT  `/ml/advanced/journal/outcome` | Log trade result + lesson |
| GET  `/ml/advanced/journal/analyze` | Win rate, avg win/loss, lessons |
| POST `/ml/advanced/attribution` | P&L breakdown per indicator |
| POST `/ml/advanced/meta/regime` | Market regime + model weights |
| POST `/ml/advanced/correlation` | Cross-market correlation |
| POST `/ml/advanced/seasonality` | Hour/day/month patterns |
| POST `/ml/advanced/behavioral` | FOMO/Panic/Herd detection |
| POST `/ml/advanced/drift` | Distribution drift detection |
| POST `/ml/advanced/manipulation` | Stop Hunt / Fake Breakout |
| POST `/ml/advanced/montecarlo` | 1000 simulations · VaR · CVaR |
| POST `/ml/advanced/portfolio/kelly` | Kelly Criterion position size |
| POST `/ml/advanced/portfolio/exposure` | Portfolio exposure analysis |

---

## Configuration

Edit `backend/src/main/resources/application.properties`:

```properties
# Required API keys
fred.api.key=YOUR_FRED_API_KEY
telegram.bot.token=YOUR_TELEGRAM_BOT_TOKEN
spring.mail.username=YOUR_GMAIL_ADDRESS
spring.mail.password=YOUR_GMAIL_APP_PASSWORD

# Binance WebSocket (default correct for PAXGUSDT)
binance.ws.url=wss://stream.binance.com:9443/ws/paxgusdt@trade

# ML Service
ml.service.url=http://localhost:8000

# CORS — comma-separated origins
cors.allowed-origins=http://localhost:5173,http://localhost:5174,http://10.0.2.2:8081,exp://localhost:19000
```

---

## Default Admin

```
Email:    admin@gold.se
Password: Admin123!
```

---

## Gradle Commands

```cmd
cd backend

gradlew.bat bootRun          # run dev server (port 8081)
gradlew.bat bootJar -x test  # build jar
gradlew.bat test             # run tests
gradlew.bat clean            # clean build
```
