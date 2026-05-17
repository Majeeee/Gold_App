# Gold App v3.0

Smart Gold Trading Platform for Iran & Global markets.
Real-time prices · AI ensemble signals · TradingView-style charts · automated trade management · price alerts · advanced ML analytics.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 3.2 · Java 21 · Gradle |
| ML Service | Python 3.11 · FastAPI · scikit-learn · NumPy · SciPy · TextBlob · feedparser |
| Web | React 18 · Vite · CSS Modules · lightweight-charts |
| Mobile | Expo SDK · React Native |
| Database | H2 (dev) · PostgreSQL (prod) |
| Real-time | STOMP over SockJS (WebSocket) |
| Auth | JWT (HttpOnly cookie + Bearer header fallback) |
| Notifications | Telegram Bot · Gmail SMTP |

---

## Features

### Live Prices
- **Global** — PAXG/USDT from Binance REST API every 2 seconds
- **Iran** — 5 assets from TGJU every 30 seconds:
  - طلا ۱۸ عیار (18k) · طلا ۲۴ عیار (24k) · مثقال طلا (mithqal) · سکه امامی (Emami coin) · نرخ دلار (USD/IRR)

### Charts
- TradingView-style dark candlestick charts using `lightweight-charts`
- OHLC overlay: O / H / L / C + change % (updates on hover)
- Volume histogram (global 5Y only)
- Timeframes: **Short** (1 min) · **Mid** (5 min) · **Long** (1 hour) · **5Y** (daily OHLC)
- 5-year historical data: Binance klines (global) + TGJU table (Iran)

### Signals — 12 Indicators, Score −10 to +10

**Technical (7):** RSI · MACD · Bollinger Bands · Trend · Volume · Support/Resistance · MA Cross

**Fundamental (5):** DXY · Fed Rate · CPI · ETF Flows · Coin Bubble (Iran)

| Score | Signal |
|-------|--------|
| ≥ +6  | STRONG BUY |
| +3 to +5 | BUY |
| −2 to +2 | HOLD |
| −3 to −5 | SELL |
| ≤ −6 | STRONG SELL |

### ML Prediction Ensemble
- **Random Forest** + **Gradient Boosting** (scikit-learn)
- **LSTM-MLP** (deep neural network, tanh activation)
- **GRU-MLP** (shallower neural network, relu activation)
- Regime-based ensemble weights: TREND → LSTM/GRU weighted · RANGE → RF/GB weighted · PANIC → RF/GB dominant
- Falls back to Linear Regression if Python service is unavailable
- Outputs: `probabilityUp` + 68% / 95% confidence intervals

### Portfolio
- Open / Closed / Paper trades
- Live unrealized P&L via WebSocket price
- Auto-close at Stop Loss or Take Profit on every price tick
- ATR trailing stop + Black Swan emergency close (>4% move)

### Stop Loss Types

| Type | Description |
|------|-------------|
| ATR Stop | 1.5× ATR from entry — adapts to volatility |
| Technical | Below support / above resistance |
| Fixed 1% | Fixed 1% from entry price |
| Fixed 2% | Fixed 2% from entry price |
| Trailing | Ratchets with price — locks in profit |
| Black Swan | Emergency close on >4% tick move |

### Price Alerts
- Create alerts: `ABOVE` or `BELOW` a target price for GLOBAL or IRAN
- Fires on every WebSocket price tick via `AlertService`
- Real-time toast notification in browser when alert triggers (WebSocket `/topic/alerts`)
- Telegram + Email notification on trigger
- Web: `/dashboard/alerts` — create · toggle · delete
- Mobile: Alerts tab

### Trade Journal
- Record every trade: entry reason · signal score · indicators · timeframe
- Log outcome: exit price · PnL · lesson learned
- Statistics: win rate · avg win/loss · win rate by signal score · recent lessons
- News sentiment tab: TextBlob analysis of live gold RSS feeds (BULLISH / NEUTRAL / BEARISH)
- Web: `/dashboard/journal` — entries · analysis · sentiment

### Backtesting
- Simulate signal-based strategy on historical data
- Parameters: market · timeframe · period (1 week → 1 year) · initial capital
- Results: final capital · PnL · win rate · best/worst trade

### Advanced ML Analytics

| Module | Description |
|--------|-------------|
| Predict Combined | RF + GB + LSTM + GRU ensemble with regime weights |
| Full Analysis | Prediction + SHAP feature importance + confidence interval + SL/TP |
| Attribution | PnL breakdown per indicator — what made/lost money |
| Meta Model | Track model accuracy, detect best model per regime |
| Market Regime | TREND / RANGE / VOLATILE / PANIC from price series |
| Walk-Forward | TimeSeriesSplit validation — prevents overfitting |
| Correlations | DXY · Oil · BTC · S&P500 · Bonds correlation with gold |
| Seasonality | Avg return by hour / weekday / month |
| Behavioral | FOMO · Panic · Herd pattern detection |
| Drift Detection | PSI + KS-test — detects when market changes behavior |
| Manipulation | Stop Hunt · Fake Breakout pattern recognition |
| Monte Carlo | 1000 simulations · VaR · CVaR · max drawdown |
| Black Swan | Detects >4% moves; emergency action flag |
| Kelly Criterion | Optimal position size: f = (b×p − q) / b · half-Kelly applied |
| Position Sizing | Units based on ATR stop + max risk % |
| Exposure Analysis | Long/short balance · hedge ratio · hedging suggestions |
| Portfolio Correlation | Correlation matrix between positions |
| Sentiment | TextBlob + RSS feeds — news sentiment for gold |
| Data Versioning | SHA256 + MD5 hash for reproducibility |

### Notifications
| User Country | Channels |
|---|---|
| 🇮🇷 Iran | Telegram only |
| 🇸🇪 Sweden | Telegram + Email |

### Admin Panel
- Enable / disable / delete users · assign roles
- Stats: total users · active · pending

---

## Project Structure

```
guld-app/
├── backend/
│   ├── src/main/java/se/gold/
│   │   ├── algorithm/         RSI · MACD · Bollinger · Trend · Volume · SR · MACross
│   │   ├── config/            SecurityConfig · WebSocketConfig · DataLoader
│   │   │   └── filter/        JwtAuthFilter · RateLimitFilter
│   │   ├── controller/        Auth · Gold · Trade · Alert · StopLoss · Preferences
│   │   │                      Liquidity · History · AdvancedMl · Admin · Health
│   │   ├── model/             User · Trade · GoldPrice · Signal · Alert · UserPreferences
│   │   ├── repository/        JPA repositories (6)
│   │   ├── service/
│   │   │   ├── fetcher/       BinanceFetcher · TgjuFetcher · FundamentalDataFetcher
│   │   │   ├── ml/            MlPredictionService · LinearRegressionModel · LstmModel
│   │   │   │                  PythonMlService
│   │   │   └── notification/  EmailService · TelegramService · NotificationService
│   │   │   AlertService · SignalService · StopLossService · TradeMonitorService
│   │   │   BacktestingService · HistoricalDataService · LiquidityService
│   │   └── util/              JwtUtil
│   └── src/main/resources/
│       ├── application.properties         H2 dev config
│       └── application-prod.properties    PostgreSQL prod config
│
├── ml-service/                Python FastAPI (port 8000)
│   ├── main.py                All endpoints
│   ├── models/
│   │   ├── ml_models.py       RF · GB · LSTM-MLP · GRU-MLP · ensemble · walk-forward
│   │   ├── sentiment.py       TextBlob + RSS feed sentiment
│   │   ├── trade_journal.py   Journal storage (JSON file)
│   │   ├── attribution_analyzer.py
│   │   ├── meta_model.py      ModelPerformanceTracker · MarketRegimeDetector · EnsembleWeighter
│   │   ├── drift_detection.py PSI · KS-test · Monte Carlo · Manipulation
│   │   ├── market_correlations.py  Correlations · Seasonality · Behavioral
│   │   └── portfolio_manager.py    Kelly · PositionSize · Exposure · Versioning
│   └── requirements.txt
│
├── web/
│   └── src/
│       ├── pages/Dashboard/
│       │   ├── GlobalMarket.jsx   live price · chart · signal · positions · SL/TP
│       │   ├── IranMarket.jsx     5 Iran assets · chart · signal · positions · SL/TP
│       │   ├── Portfolio.jsx      trades · live PnL · SL/TP panel
│       │   ├── Backtest.jsx       simulator
│       │   ├── Alerts.jsx         create · toggle · delete · real-time toast
│       │   └── Journal.jsx        entries · analysis · news sentiment
│       ├── pages/Admin/AdminPanel.jsx
│       ├── components/
│       │   ├── CandlestickChart.jsx
│       │   ├── StopLossPanel.jsx
│       │   └── TradeModal.jsx
│       └── services/
│           ├── api.js             all REST + ML endpoints
│           └── websocket.js       onGlobalPrice · onIranPrice · onSignal · onAlert · onTradeClosed
│
├── mobile/
│   └── app/
│       ├── (tabs)/_layout.jsx     Global · Iran · Portfolio · Backtest · Alerts
│       ├── global/index.jsx
│       ├── iran/index.jsx
│       ├── portfolio/index.jsx
│       ├── trade/backtest.jsx
│       └── settings/index.jsx
│   └── components/
│       ├── StopLossCard.jsx
│       └── signal/SignalCard.jsx
│
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
| `/dashboard/portfolio` | Portfolio — trades, live PnL, SL/TP editing |
| `/dashboard/backtest` | Backtesting simulator |
| `/dashboard/alerts` | Price Alerts — create · toggle · delete · real-time toast |
| `/dashboard/journal` | Trade Journal — entries · statistics · news sentiment |
| `/admin` | Admin Panel (ADMIN role only) |

### Mobile (Expo tabs)

| Tab | Screen |
|-----|--------|
| Global | XAUUSD live price, chart, signal, open positions |
| Iran | Iran gold prices, chart, signal, open positions (Farsi) |
| Portfolio | Trades with SL/TP editing |
| Backtest | Backtesting simulator |
| Alerts | Price alert management |

---

## Quick Start (Windows)

```cmd
git clone https://github.com/Majeeee/Gold_App
cd Gold_App
setup.bat
```

**Backend** (port 8080):
```cmd
cd backend
gradlew.bat bootRun
```

**ML Service** (port 8000):
```cmd
cd ml-service
pip install -r requirements.txt
python main.py
```
Swagger UI → `http://localhost:8000/docs`

**Web** (port 5173):
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

## Configuration

`backend/src/main/resources/application.properties`:

```properties
# Required API keys
fred.api.key=YOUR_FRED_API_KEY
telegram.bot.token=YOUR_TELEGRAM_BOT_TOKEN
spring.mail.username=YOUR_GMAIL_ADDRESS
spring.mail.password=YOUR_GMAIL_APP_PASSWORD

# Binance WebSocket
binance.ws.url=wss://stream.binance.com:9443/ws/paxgusdt@trade

# ML Service
ml.service.url=http://localhost:8000

# CORS
cors.allowed-origins=http://localhost:5173,http://localhost:5174,http://10.0.2.2:8081,exp://localhost:19000
```

---

## API Reference

### Prices & Signals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gold/price/global` | Latest global gold price |
| GET | `/api/gold/price/iran` | Latest Iran gold prices (5 assets) |
| GET | `/api/gold/prices/history?market=&hours=24` | Price ticks for live charts |
| GET | `/api/gold/signal?market=&timeframe=MID` | Latest signal |
| GET | `/api/gold/signal/analyze?market=&timeframe=` | Force re-analyze now |
| GET | `/api/gold/backtest?market=&months=1&capital=1000&timeframe=MID` | Run backtest |
| GET | `/api/history?market=GLOBAL\|IRAN` | 5-year daily OHLC |
| GET | `/api/liquidity` | Live order book snapshot (public) |
| GET | `/api/health` | System health status |

### Stop Loss / Take Profit

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stoploss/{tradeId}` | Get SL/TP for trade |
| PUT | `/api/stoploss/{tradeId}` | Update SL/TP |
| POST | `/api/stoploss/calculate` | ATR-based SL+TP calculation |

### Price Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | List user alerts |
| POST | `/api/alerts` | Create alert |
| DELETE | `/api/alerts/{id}` | Delete alert |
| PATCH | `/api/alerts/{id}/toggle` | Toggle active/inactive |

### Trades

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trades` | All user trades |
| GET | `/api/trades/open` | Open trades only |
| POST | `/api/trades/manual` | Add manual trade |
| POST | `/api/trades/paper` | Add paper trade |
| PUT | `/api/trades/{id}/close` | Close trade |
| DELETE | `/api/trades/{id}` | Delete trade |

### User Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/preferences` | Get preferences |
| PUT | `/api/preferences` | Update preferences |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/{id}/enable` | Enable user |
| PUT | `/api/admin/users/{id}/disable` | Disable user |
| PUT | `/api/admin/users/{id}/role` | Set role |
| DELETE | `/api/admin/users/{id}` | Delete user |

### ML Service (Python FastAPI — port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ml/train` | Train RF+GB+LSTM+GRU on price history |
| POST | `/ml/predict/combined` | Ensemble prediction with confidence interval |
| POST | `/ml/analysis/full` | Prediction + SHAP + regime + SL/TP in one call |
| POST | `/ml/stoploss/recommend` | Best SL/TP for current ATR |
| POST | `/ml/stoploss/blackswan` | Black swan detection (>4% move check) |
| POST | `/ml/advanced/master` | All analysis in one call |
| POST | `/ml/advanced/journal/entry` | Log trade entry |
| PUT  | `/ml/advanced/journal/outcome` | Log trade result + lesson |
| GET  | `/ml/advanced/journal/analyze` | Win rate · avg win/loss · lessons |
| GET  | `/ml/advanced/journal/all` | All journal entries |
| POST | `/ml/advanced/attribution` | PnL breakdown per indicator |
| POST | `/ml/advanced/meta/regime` | Market regime + model weights |
| GET  | `/ml/advanced/meta/best` | Best performing model |
| POST | `/ml/advanced/correlation` | Cross-market correlation |
| POST | `/ml/advanced/seasonality` | Hour/day/month return patterns |
| GET  | `/ml/advanced/sentiment` | News sentiment from RSS feeds |
| POST | `/ml/advanced/behavioral` | FOMO/Panic/Herd detection |
| POST | `/ml/advanced/drift` | Distribution drift (PSI + KS-test) |
| POST | `/ml/advanced/manipulation` | Stop Hunt / Fake Breakout |
| POST | `/ml/advanced/montecarlo` | 1000 simulations · VaR · CVaR |
| POST | `/ml/advanced/walkforward` | Walk-forward validation (TimeSeriesSplit) |
| POST | `/ml/advanced/portfolio/kelly` | Kelly Criterion position size |
| POST | `/ml/advanced/portfolio/size` | Position size from risk % |
| POST | `/ml/advanced/portfolio/exposure` | Portfolio exposure analysis |
| POST | `/ml/advanced/portfolio/correlation` | Correlation matrix |
| POST | `/ml/advanced/portfolio/version` | Dataset versioning (SHA256) |

### WebSocket Topics

| Topic | Description |
|-------|-------------|
| `/topic/global-price` | Live XAUUSD price tick |
| `/topic/iran-price` | Live Iran price tick (all 5 assets) |
| `/topic/signal/{market}` | New signal (global / iran) |
| `/topic/alerts` | Alert triggered — payload includes `userEmail` |
| `/topic/trade-closed` | Trade auto-closed by SL/TP |
| `/topic/health` | System health update |

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
gradlew.bat bootRun          # start dev server (port 8080)
gradlew.bat bootJar -x test  # build jar
gradlew.bat test             # run tests
gradlew.bat clean            # clean build
```
