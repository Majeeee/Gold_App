from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn

from models.trade_journal       import journal, JournalEntry
from models.attribution_analyzer import attribute_pnl, portfolio_attribution
from models.meta_model          import tracker, detector, weighter
from models.market_correlations import (analyze_correlations,
                                         seasonality_analysis,
                                         behavioral_analysis)
from models.drift_detection     import detect_drift, detect_manipulation, monte_carlo
from models.portfolio_manager   import (kelly_criterion, position_size,
                                         correlation_matrix, exposure_analysis,
                                         version_dataset)
from models.ml_models           import predictor
from models.sentiment           import get_gold_sentiment, analyze_text
from models.economic_calendar   import get_economic_calendar
from models.backtesting         import run_backtest
from models.deep_learning       import dl_predictor

app = FastAPI(title="Gold App ML Service", version="3.0")


# ── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service", "models_trained": predictor.is_trained}


# ── Train ────────────────────────────────────────────────────────────────────
class TrainRequest(BaseModel):
    prices: list[float]

@app.post("/ml/train")
def train(req: TrainRequest):
    return predictor.train(req.prices)


# ── Combined prediction (RF + GB + LSTM + GRU + Ensemble) ───────────────────
class PredictRequest(BaseModel):
    prices:      list[float]
    steps_ahead: Optional[int]   = 1
    regime:      Optional[str]   = "RANGE"
    timeframe:   Optional[str]   = "MID"
    with_ci:     Optional[bool]  = True

@app.post("/ml/predict/combined")
def predict_combined(req: PredictRequest):
    if len(req.prices) < 5:
        raise HTTPException(400, "Need at least 5 prices")

    # Auto-train if not trained yet
    if not predictor.is_trained and len(req.prices) >= 30:
        predictor.train(req.prices)

    steps = req.steps_ahead or 1
    result = predictor.predict_combined(req.prices, steps, req.regime or "RANGE")

    if req.with_ci:
        result["confidence"] = predictor.confidence_interval(req.prices)

    # Timeframe labels
    label_map = {"SHORT": "1 hour ahead", "MID": "1 day ahead", "LONG": "1 week ahead"}
    result["timeframe_label"] = label_map.get(req.timeframe or "MID", "custom")

    return result


# ── Full analysis (prediction + SHAP + confidence + regime) ─────────────────
class FullAnalysisRequest(BaseModel):
    prices:      list[float]
    regime:      Optional[str]  = None
    timeframe:   Optional[str]  = "MID"
    entry_price: Optional[float] = None
    trade_type:  Optional[str]  = "BUY"

@app.post("/ml/analysis/full")
def full_analysis(req: FullAnalysisRequest):
    prices = req.prices
    if len(prices) < 5:
        raise HTTPException(400, "Need at least 5 prices")

    if not predictor.is_trained and len(prices) >= 30:
        predictor.train(prices)

    regime_info = detector.detect(prices)
    regime = req.regime or regime_info.get("regime", "RANGE")

    steps_map = {"SHORT": 12, "MID": 24, "LONG": 7}
    steps = steps_map.get(req.timeframe or "MID", 24)

    prediction   = predictor.predict_combined(prices, steps, regime)
    confidence   = predictor.confidence_interval(prices)
    shap_info    = predictor.explain_shap(prices)
    model_weights = weighter.weights(regime, tracker)

    result = {
        "prediction":    prediction,
        "confidence":    confidence,
        "shap":          shap_info,
        "regime":        regime_info,
        "model_weights": model_weights,
        "timeframe":     req.timeframe,
    }

    if req.entry_price and len(prices) >= 15:
        import numpy as np
        closes = np.array(prices[-15:], dtype=float)
        atr = float(np.mean(np.abs(np.diff(closes))))
        is_buy = (req.trade_type or "BUY").upper() == "BUY"
        result["stop_loss"] = {
            "atr":        round(atr, 4),
            "stop_loss":  round(req.entry_price - atr * 1.5 if is_buy else req.entry_price + atr * 1.5, 4),
            "take_profit": round(req.entry_price + atr * 3.0 if is_buy else req.entry_price - atr * 3.0, 4),
        }

    return result


# ── Trade Journal ────────────────────────────────────────────────────────────
class JournalEntryRequest(BaseModel):
    trade_id:     str
    market:       str
    trade_type:   str
    entry_reason: str
    signal_score: int
    indicators:   dict
    timeframe:    str
    entry_price:  float

class OutcomeRequest(BaseModel):
    trade_id:   str
    exit_price: float
    pnl:        float
    lesson:     Optional[str] = ""

@app.post("/ml/advanced/journal/entry")
def add_journal_entry(req: JournalEntryRequest):
    entry = JournalEntry(**req.model_dump())
    return journal.add_entry(entry)

@app.put("/ml/advanced/journal/outcome")
def update_outcome(req: OutcomeRequest):
    try:
        return journal.update_outcome(req.trade_id, req.exit_price, req.pnl, req.lesson)
    except ValueError as e:
        raise HTTPException(404, str(e))

@app.get("/ml/advanced/journal/analyze")
def analyze_journal():
    return journal.analyze()

@app.get("/ml/advanced/journal/all")
def get_all_journal():
    return journal.get_all()


# ── Attribution ──────────────────────────────────────────────────────────────
class AttributionRequest(BaseModel):
    pnl:        float
    indicators: dict
    trade_type: str = "BUY"

class PortfolioAttributionRequest(BaseModel):
    trades: list[dict]

@app.post("/ml/advanced/attribution")
def attribution(req: AttributionRequest):
    return attribute_pnl(req.pnl, req.indicators, req.trade_type)

@app.post("/ml/advanced/attribution/portfolio")
def portfolio_attr(req: PortfolioAttributionRequest):
    return portfolio_attribution(req.trades)


# ── Meta Model & Regime ───────────────────────────────────────────────────────
class RecordPredictionRequest(BaseModel):
    model:               str
    predicted_direction: int
    actual_direction:    int

class RegimeRequest(BaseModel):
    prices: list[float]
    window: Optional[int] = 20

@app.post("/ml/advanced/meta/record")
def record_prediction(req: RecordPredictionRequest):
    tracker.record(req.model, req.predicted_direction, req.actual_direction)
    return {"recorded": True}

@app.get("/ml/advanced/meta/best")
def best_model():
    return tracker.best_model()

@app.post("/ml/advanced/meta/regime")
def market_regime(req: RegimeRequest):
    regime_info  = detector.detect(req.prices, req.window)
    weights      = weighter.weights(regime_info["regime"], tracker)
    return {**regime_info, "model_weights": weights}


# ── Correlations ─────────────────────────────────────────────────────────────
class CorrelationRequest(BaseModel):
    gold_prices:   list[float]
    market_prices: dict[str, list[float]]

@app.post("/ml/advanced/correlation")
def correlation(req: CorrelationRequest):
    return analyze_correlations(req.gold_prices, req.market_prices)


# ── Seasonality ───────────────────────────────────────────────────────────────
class SeasonalityRequest(BaseModel):
    prices:     list[float]
    timestamps: list[str]

@app.post("/ml/advanced/seasonality")
def seasonality_post(req: SeasonalityRequest):
    return seasonality_analysis(req.prices, req.timestamps)

# Keep GET alias for doc compatibility
@app.get("/ml/advanced/seasonality")
def seasonality_get():
    return {"note": "Use POST /ml/advanced/seasonality with {prices, timestamps}"}


# ── Behavioral Finance ────────────────────────────────────────────────────────
class BehavioralRequest(BaseModel):
    prices:  list[float]
    volumes: Optional[list[float]] = None

@app.post("/ml/advanced/behavioral")
def behavioral(req: BehavioralRequest):
    return behavioral_analysis(req.prices, req.volumes)


# ── Drift Detection ───────────────────────────────────────────────────────────
class DriftRequest(BaseModel):
    baseline_prices: list[float]
    current_prices:  list[float]

class ManipulationRequest(BaseModel):
    prices: list[float]
    window: Optional[int] = 20

@app.post("/ml/advanced/drift")
def drift(req: DriftRequest):
    return detect_drift(req.baseline_prices, req.current_prices)

@app.post("/ml/advanced/manipulation")
def manipulation(req: ManipulationRequest):
    return detect_manipulation(req.prices, req.window)


# ── Monte Carlo ───────────────────────────────────────────────────────────────
class MonteCarloRequest(BaseModel):
    prices:       list[float]
    horizon_days: Optional[int]   = 10
    simulations:  Optional[int]   = 1000
    confidence:   Optional[float] = 0.95

@app.post("/ml/advanced/montecarlo")
def montecarlo(req: MonteCarloRequest):
    return monte_carlo(req.prices, req.horizon_days, req.simulations, req.confidence)


# ── Portfolio ─────────────────────────────────────────────────────────────────
class KellyRequest(BaseModel):
    win_rate: float
    avg_win:  float
    avg_loss: float
    fraction: Optional[float] = 0.5

class PositionSizeRequest(BaseModel):
    capital:     float
    risk_pct:    float
    entry_price: float
    stop_loss:   float

class ExposureRequest(BaseModel):
    positions:     list[dict]
    total_capital: float

class CorrelMatrixRequest(BaseModel):
    position_returns: dict[str, list[float]]

class VersionRequest(BaseModel):
    data:  list
    label: Optional[str] = ""

@app.post("/ml/advanced/portfolio/kelly")
def kelly(req: KellyRequest):
    return kelly_criterion(req.win_rate, req.avg_win, req.avg_loss, req.fraction)

@app.post("/ml/advanced/portfolio/size")
def pos_size(req: PositionSizeRequest):
    return position_size(req.capital, req.risk_pct, req.entry_price, req.stop_loss)

@app.post("/ml/advanced/portfolio/exposure")
def exposure(req: ExposureRequest):
    return exposure_analysis(req.positions, req.total_capital)

@app.post("/ml/advanced/portfolio/correlation")
def correl_matrix(req: CorrelMatrixRequest):
    return correlation_matrix(req.position_returns)

@app.post("/ml/advanced/portfolio/version")
def version(req: VersionRequest):
    return version_dataset(req.data, req.label)

@app.get("/ml/advanced/versions")
def list_versions():
    return {"note": "Use POST /ml/advanced/portfolio/version to create versioned snapshots"}


# ── Sentiment ─────────────────────────────────────────────────────────────────
class SentimentTextRequest(BaseModel):
    text: str

@app.get("/ml/advanced/sentiment")
def sentiment_news():
    return get_gold_sentiment()

@app.post("/ml/advanced/sentiment/text")
def sentiment_text(req: SentimentTextRequest):
    return analyze_text(req.text)


# ── Walk-Forward Validation ───────────────────────────────────────────────────
class WalkForwardRequest(BaseModel):
    prices:   list[float]
    n_splits: Optional[int] = 5

@app.post("/ml/advanced/walkforward")
def walk_forward(req: WalkForwardRequest):
    if not predictor.is_trained and len(req.prices) >= 30:
        predictor.train(req.prices)
    return predictor.walk_forward(req.prices, req.n_splits or 5)


# ── Stop Loss Recommendation ──────────────────────────────────────────────────
class StopLossRequest(BaseModel):
    prices:      list[float]
    entry_price: float
    trade_type:  str = "BUY"
    atr_mult:    Optional[float] = 1.5
    tp_mult:     Optional[float] = 3.0

@app.post("/ml/stoploss/recommend")
def stoploss_recommend(req: StopLossRequest):
    if len(req.prices) < 15:
        raise HTTPException(400, "Need at least 15 prices for ATR calculation")
    import numpy as np
    closes  = np.array(req.prices[-15:], dtype=float)
    atr     = float(np.mean(np.abs(np.diff(closes))))
    is_buy  = req.trade_type.upper() == "BUY"
    sl_atr  = req.entry_price - atr * req.atr_mult if is_buy else req.entry_price + atr * req.atr_mult
    tp_atr  = req.entry_price + atr * req.tp_mult  if is_buy else req.entry_price - atr * req.tp_mult
    sl_tech = float(np.min(closes[-5:])) * 0.999 if is_buy else float(np.max(closes[-5:])) * 1.001
    rr = round(abs(tp_atr - req.entry_price) / abs(sl_atr - req.entry_price), 2) if sl_atr != req.entry_price else 0
    return {
        "entry_price": round(req.entry_price, 4),
        "atr":         round(atr, 4),
        "trade_type":  req.trade_type.upper(),
        "recommendations": {
            "atr_stop":       round(sl_atr, 4),
            "technical_stop": round(sl_tech, 4),
            "fixed_1pct":     round(req.entry_price * (0.99 if is_buy else 1.01), 4),
            "fixed_2pct":     round(req.entry_price * (0.98 if is_buy else 1.02), 4),
            "take_profit":    round(tp_atr, 4),
        },
        "risk_reward": rr,
        "recommended": "atr_stop",
    }


# ── Black Swan Detection ──────────────────────────────────────────────────────
class BlackSwanRequest(BaseModel):
    current_price:  float
    previous_price: float
    threshold:      Optional[float] = 0.04   # 4%

@app.post("/ml/stoploss/blackswan")
def black_swan(req: BlackSwanRequest):
    if req.previous_price == 0:
        return {"black_swan": False, "pct_move": 0}
    pct = abs((req.current_price - req.previous_price) / req.previous_price)
    is_bs = pct >= req.threshold
    return {
        "black_swan":     is_bs,
        "pct_move":       round(pct * 100, 3),
        "threshold_pct":  round(req.threshold * 100, 1),
        "direction":      "UP" if req.current_price > req.previous_price else "DOWN",
        "action":         "EMERGENCY_CLOSE_ALL" if is_bs else "NORMAL",
        "message":        f"Black swan detected! {pct*100:.1f}% move exceeds {req.threshold*100:.0f}% threshold" if is_bs else "Normal price movement",
    }


# ── Master endpoint ────────────────────────────────────────────────────────────
class MasterRequest(BaseModel):
    prices:      list[float]
    timestamps:  Optional[list[str]]  = None
    entry_price: Optional[float]      = None
    trade_type:  Optional[str]        = "BUY"
    indicators:  Optional[dict]       = None
    timeframe:   Optional[str]        = "MID"

@app.post("/ml/advanced/master")
def master(req: MasterRequest):
    prices = req.prices
    result = {}

    if not predictor.is_trained and len(prices) >= 30:
        predictor.train(prices)

    result["regime"]     = detector.detect(prices)
    result["behavioral"] = behavioral_analysis(prices)

    mid = len(prices) // 2
    if mid >= 20:
        result["drift"] = detect_drift(prices[:mid], prices[mid:])

    result["manipulation"] = detect_manipulation(prices)

    if len(prices) >= 30:
        result["monte_carlo"] = monte_carlo(prices)

    if req.entry_price and len(prices) >= 15:
        sl_req = StopLossRequest(
            prices=prices, entry_price=req.entry_price, trade_type=req.trade_type or "BUY")
        result["stop_loss"] = stoploss_recommend(sl_req)

    if req.timestamps and len(req.timestamps) == len(prices):
        result["seasonality"] = seasonality_analysis(prices, req.timestamps)

    if req.indicators:
        result["attribution"] = attribute_pnl(0.0, req.indicators, req.trade_type or "BUY")

    regime = result["regime"]["regime"]
    result["model_weights"] = weighter.weights(regime, tracker)

    # Combined ML prediction
    steps_map = {"SHORT": 12, "MID": 24, "LONG": 7}
    steps = steps_map.get(req.timeframe or "MID", 24)
    result["prediction"] = predictor.predict_combined(prices, steps, regime)
    result["confidence"]  = predictor.confidence_interval(prices)
    result["shap"]        = predictor.explain_shap(prices)

    return result


# ── Economic Calendar ─────────────────────────────────────────────────────────
class CalendarRequest(BaseModel):
    fred_api_key: Optional[str] = None

@app.get("/ml/advanced/economic-calendar")
def economic_calendar_get():
    return get_economic_calendar()

@app.post("/ml/advanced/economic-calendar")
def economic_calendar_post(req: CalendarRequest):
    return get_economic_calendar(req.fred_api_key)


# ── Backtesting ───────────────────────────────────────────────────────────────
class BacktestRequest(BaseModel):
    prices:           list[float]
    signals:          Optional[list[int]]   = None
    initial_capital:  Optional[float]       = 10000.0
    commission_pct:   Optional[float]       = 0.001
    stop_loss_pct:    Optional[float]       = None
    take_profit_pct:  Optional[float]       = None

@app.post("/ml/advanced/backtest")
def backtest(req: BacktestRequest):
    if len(req.prices) < 10:
        raise HTTPException(400, "Need at least 10 prices")
    return run_backtest(
        prices=req.prices,
        signals=req.signals,
        initial_capital=req.initial_capital or 10000.0,
        commission_pct=req.commission_pct or 0.001,
        stop_loss_pct=req.stop_loss_pct,
        take_profit_pct=req.take_profit_pct,
    )


# ── Deep Learning (TensorFlow LSTM + GRU) ────────────────────────────────────
class DLTrainRequest(BaseModel):
    prices:     list[float]
    epochs:     Optional[int] = 50
    batch_size: Optional[int] = 16

class DLPredictRequest(BaseModel):
    prices:      list[float]
    steps_ahead: Optional[int] = 1
    regime:      Optional[str] = "RANGE"

class DLConfidenceRequest(BaseModel):
    prices:  list[float]
    mc_runs: Optional[int] = 30

@app.get("/ml/dl/status")
def dl_status():
    return dl_predictor.status()

@app.post("/ml/dl/train")
def dl_train(req: DLTrainRequest):
    return dl_predictor.train(req.prices, req.epochs or 50, req.batch_size or 16)

@app.post("/ml/dl/predict")
def dl_predict(req: DLPredictRequest):
    result = dl_predictor.predict(req.prices, req.steps_ahead or 1, req.regime or "RANGE")
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result

@app.post("/ml/dl/confidence")
def dl_confidence(req: DLConfidenceRequest):
    return dl_predictor.confidence_interval(req.prices, req.mc_runs or 30)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
