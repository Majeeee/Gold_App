from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn

from models.trade_journal      import journal, JournalEntry
from models.attribution_analyzer import attribute_pnl, portfolio_attribution
from models.meta_model         import tracker, detector, weighter
from models.market_correlations import (analyze_correlations,
                                         seasonality_analysis,
                                         behavioral_analysis)
from models.drift_detection    import detect_drift, detect_manipulation, monte_carlo
from models.portfolio_manager  import (kelly_criterion, position_size,
                                        correlation_matrix, exposure_analysis,
                                        version_dataset)

app = FastAPI(title="Gold App ML Service", version="3.0")


# ── Health ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service"}


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
    model:                str
    predicted_direction:  int
    actual_direction:     int

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
    regime_info = detector.detect(req.prices, req.window)
    weights     = weighter.weights(regime_info["regime"], tracker)
    return {**regime_info, "model_weights": weights}


# ── Correlations ─────────────────────────────────────────────────────────────
class CorrelationRequest(BaseModel):
    gold_prices:    list[float]
    market_prices:  dict[str, list[float]]

@app.post("/ml/advanced/correlation")
def correlation(req: CorrelationRequest):
    return analyze_correlations(req.gold_prices, req.market_prices)


# ── Seasonality ───────────────────────────────────────────────────────────────
class SeasonalityRequest(BaseModel):
    prices:     list[float]
    timestamps: list[str]

@app.post("/ml/advanced/seasonality")
def seasonality(req: SeasonalityRequest):
    return seasonality_analysis(req.prices, req.timestamps)


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
    prices:        list[float]
    horizon_days:  Optional[int]   = 10
    simulations:   Optional[int]   = 1000
    confidence:    Optional[float] = 0.95

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
    capital:      float
    risk_pct:     float
    entry_price:  float
    stop_loss:    float

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
    # Use last 15 closes to compute 14-period ATR.
    # Without separate OHLC we approximate TR as |close[i] - close[i-1]|.
    # If the caller has OHLC they should compute ATR server-side for accuracy.
    closes = np.array(req.prices[-15:], dtype=float)
    tr  = np.abs(np.diff(closes))   # shape (14,)
    atr = float(np.mean(tr))

    is_buy = req.trade_type.upper() == "BUY"

    sl_atr      = req.entry_price - atr * req.atr_mult if is_buy else req.entry_price + atr * req.atr_mult
    sl_fixed_1  = req.entry_price * (0.99 if is_buy else 1.01)
    sl_fixed_2  = req.entry_price * (0.98 if is_buy else 1.02)
    tp_atr      = req.entry_price + atr * req.tp_mult  if is_buy else req.entry_price - atr * req.tp_mult

    recent_low  = float(np.min(closes[-5:]))
    recent_high = float(np.max(closes[-5:]))
    sl_technical = recent_low * 0.999 if is_buy else recent_high * 1.001

    return {
        "entry_price":    round(req.entry_price, 4),
        "atr":            round(atr, 4),
        "trade_type":     req.trade_type.upper(),
        "recommendations": {
            "atr_stop":       round(sl_atr, 4),
            "technical_stop": round(sl_technical, 4),
            "fixed_1pct":     round(sl_fixed_1, 4),
            "fixed_2pct":     round(sl_fixed_2, 4),
            "take_profit":    round(tp_atr, 4),
        },
        "risk_reward":    round(abs(tp_atr - req.entry_price) / abs(sl_atr - req.entry_price), 2) if sl_atr != req.entry_price else 0,
        "recommended":    "atr_stop",
    }


# ── Master endpoint ────────────────────────────────────────────────────────────
class MasterRequest(BaseModel):
    prices:       list[float]
    timestamps:   Optional[list[str]] = None
    entry_price:  Optional[float]     = None
    trade_type:   Optional[str]       = "BUY"
    indicators:   Optional[dict]      = None

@app.post("/ml/advanced/master")
def master(req: MasterRequest):
    result = {}

    # Regime
    result["regime"] = detector.detect(req.prices)

    # Behavioral
    result["behavioral"] = behavioral_analysis(req.prices)

    # Drift (compare first half vs second half)
    mid = len(req.prices) // 2
    if mid >= 20:
        result["drift"] = detect_drift(req.prices[:mid], req.prices[mid:])

    # Manipulation
    result["manipulation"] = detect_manipulation(req.prices)

    # Monte Carlo
    if len(req.prices) >= 30:
        result["monte_carlo"] = monte_carlo(req.prices)

    # Stop Loss
    if req.entry_price and len(req.prices) >= 15:
        sl_req = StopLossRequest(
            prices=req.prices, entry_price=req.entry_price, trade_type=req.trade_type or "BUY"
        )
        result["stop_loss"] = stoploss_recommend(sl_req)

    # Seasonality
    if req.timestamps and len(req.timestamps) == len(req.prices):
        result["seasonality"] = seasonality_analysis(req.prices, req.timestamps)

    # Attribution
    if req.indicators:
        result["attribution"] = attribute_pnl(0.0, req.indicators, req.trade_type or "BUY")

    # Model weights
    result["model_weights"] = weighter.weights(result["regime"]["regime"], tracker)

    return result


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
