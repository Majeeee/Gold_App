"""
Marknadskorrelationer, säsongsmönster och beteendefinansiering.
"""
import numpy as np
from datetime import datetime
from collections import defaultdict


# ---------------------------------------------------------------------------
# Korrelationer
# ---------------------------------------------------------------------------

MARKET_DESCRIPTIONS = {
    "dxy":    ("Dollar Index",    "inverse"),
    "oil":    ("Crude Oil",       "positive"),
    "btc":    ("Bitcoin",         "positive"),
    "sp500":  ("S&P 500",         "inverse"),
    "tlt":    ("US Bonds (TLT)",  "positive"),
}


def pearson(x: list[float], y: list[float]) -> float:
    if len(x) != len(y) or len(x) < 3:
        return 0.0
    x_arr, y_arr = np.array(x, dtype=float), np.array(y, dtype=float)
    x_ret = np.diff(x_arr) / x_arr[:-1]
    y_ret = np.diff(y_arr) / y_arr[:-1]
    if np.std(x_ret) == 0 or np.std(y_ret) == 0:
        return 0.0
    return float(np.corrcoef(x_ret, y_ret)[0, 1])


def analyze_correlations(gold_prices: list[float],
                         market_prices: dict[str, list[float]]) -> dict:
    results = {}
    for market, prices in market_prices.items():
        corr = pearson(gold_prices, prices)
        desc, expected = MARKET_DESCRIPTIONS.get(market, (market, "unknown"))
        alignment = "aligned" if (
            (expected == "positive" and corr > 0) or
            (expected == "inverse"  and corr < 0)
        ) else "diverging"
        results[market] = {
            "name":        desc,
            "correlation": round(corr, 3),
            "expected":    expected,
            "alignment":   alignment,
            "signal":      _correlation_signal(market, corr),
        }
    return results


def _correlation_signal(market: str, corr: float) -> str:
    """Tolka vad korrelationen innebär för guld."""
    if market == "dxy":
        if corr < -0.5: return "Strong dollar = bearish gold"
        if corr > 0.3:  return "Dollar weakness = bullish gold"
    if market == "sp500":
        if corr < -0.4: return "Risk-off: investors fleeing to gold"
        if corr > 0.4:  return "Risk-on: gold may lag equities"
    if market == "btc":
        if corr > 0.5: return "Crypto rally supporting gold"
    if market == "oil":
        if corr > 0.4: return "Inflation hedge demand aligned"
    return "neutral"


# ---------------------------------------------------------------------------
# Säsongsmönster
# ---------------------------------------------------------------------------

def seasonality_analysis(prices: list[float],
                          timestamps: list[str]) -> dict:
    """
    Analyserar genomsnittlig avkastning per timme, veckodag och månad.
    timestamps: ISO-format strängar
    """
    if len(prices) < 2 or len(prices) != len(timestamps):
        return {"error": "insufficient data"}

    returns = np.diff(prices) / np.array(prices[:-1])
    dts     = [datetime.fromisoformat(ts) for ts in timestamps[1:]]

    by_hour  = defaultdict(list)
    by_wday  = defaultdict(list)
    by_month = defaultdict(list)

    for i, dt in enumerate(dts):
        by_hour[dt.hour].append(returns[i])
        by_wday[dt.weekday()].append(returns[i])
        by_month[dt.month].append(returns[i])

    WDAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    def avg_pct(d):
        return {str(k): round(float(np.mean(v)) * 100, 3) for k, v in d.items()}

    hourly   = avg_pct(by_hour)
    best_h   = max(hourly, key=lambda k: hourly[k]) if hourly else None
    worst_h  = min(hourly, key=lambda k: hourly[k]) if hourly else None

    weekly   = {WDAYS[int(k)]: v for k, v in avg_pct(by_wday).items()}
    monthly  = {MONTHS[int(k)]: v for k, v in avg_pct(by_month).items() if int(k) < 13}

    return {
        "hourly":      hourly,
        "best_hour":   best_h,
        "worst_hour":  worst_h,
        "weekly":      weekly,
        "monthly":     monthly,
    }


# ---------------------------------------------------------------------------
# Beteendefinansiering
# ---------------------------------------------------------------------------

def behavioral_analysis(prices: list[float],
                         volumes: list[float] | None = None) -> dict:
    if len(prices) < 10:
        return {"pattern": "INSUFFICIENT_DATA"}

    arr     = np.array(prices[-20:], dtype=float)
    returns = np.diff(arr) / arr[:-1]
    vol_std = float(np.std(returns))
    recent  = returns[-5:]

    patterns = []

    # FOMO — snabb uppgång (>2σ) de senaste 5 staplarna
    up_moves = sum(1 for r in recent if r > 2 * vol_std)
    if up_moves >= 3:
        patterns.append({
            "pattern": "FOMO",
            "description": "Snabbt köp → marknad överköpt → möjlig reversering",
            "strength": round(up_moves / 5, 2),
            "action": "Var försiktig med ny long, överväg TP-nivåer",
        })

    # PANIK — snabb nedgång
    down_moves = sum(1 for r in recent if r < -2 * vol_std)
    if down_moves >= 3:
        patterns.append({
            "pattern": "PANIC",
            "description": "Snabb försäljning → oversold → möjlig studs",
            "strength": round(down_moves / 5, 2),
            "action": "Möjlig kontrarian-köpchans, vänta på stabilisering",
        })

    # FLOCK — alla indicators pekar samma håll (behövs signal-input)
    # Detekteras av bredden i prisrörelsen
    breadth = float(np.mean(np.abs(recent))) / vol_std if vol_std > 0 else 0
    if breadth > 2.5 and len(patterns) == 0:
        direction = "bullish" if np.mean(recent) > 0 else "bearish"
        patterns.append({
            "pattern": "HERD",
            "description": f"Flock-beteende ({direction}) — alla åt samma håll",
            "strength": round(min(breadth / 4, 1.0), 2),
            "action": "Var försiktig — flockrörelser reverseras ofta",
        })

    overall_sentiment = "BULLISH" if float(np.mean(returns)) > 0 else "BEARISH"
    rsi_approx = _rsi_approx(prices)

    return {
        "patterns":          patterns,
        "dominant_pattern":  patterns[0]["pattern"] if patterns else "NEUTRAL",
        "overall_sentiment": overall_sentiment,
        "rsi_approx":        rsi_approx,
        "overbought":        rsi_approx > 70,
        "oversold":          rsi_approx < 30,
    }


def _rsi_approx(prices: list[float], period: int = 14) -> float:
    if len(prices) < period + 1:
        return 50.0
    arr   = np.array(prices[-(period + 1):], dtype=float)
    diffs = np.diff(arr)
    gains = np.where(diffs > 0, diffs, 0)
    loses = np.where(diffs < 0, -diffs, 0)
    avg_g = np.mean(gains)
    avg_l = np.mean(loses)
    if avg_l == 0:
        return 100.0
    rs = avg_g / avg_l
    return round(float(100 - 100 / (1 + rs)), 1)
