"""
Driftdetektering, marknadsmanipulationsdetektering och Monte Carlo VaR.
"""
import numpy as np
from scipy import stats


# ---------------------------------------------------------------------------
# Driftdetektering — PSI (Population Stability Index)
# ---------------------------------------------------------------------------

def psi(expected: list[float], actual: list[float], buckets: int = 10) -> float:
    """
    PSI < 0.1  → ingen drift
    PSI 0.1-0.2 → måttlig drift
    PSI > 0.2  → signifikant drift
    """
    e = np.array(expected, dtype=float)
    a = np.array(actual,   dtype=float)
    bins = np.percentile(e, np.linspace(0, 100, buckets + 1))
    bins[0]  -= 1e-8
    bins[-1] += 1e-8

    e_counts = np.histogram(e, bins=bins)[0]
    a_counts = np.histogram(a, bins=bins)[0]

    e_pct = np.where(e_counts == 0, 1e-6, e_counts / len(e))
    a_pct = np.where(a_counts == 0, 1e-6, a_counts / len(a))

    return float(np.sum((a_pct - e_pct) * np.log(a_pct / e_pct)))


def detect_drift(baseline_prices: list[float],
                 current_prices:  list[float]) -> dict:
    if len(baseline_prices) < 20 or len(current_prices) < 10:
        return {"drift": False, "reason": "insufficient data"}

    b_ret = np.diff(baseline_prices) / np.array(baseline_prices[:-1])
    c_ret = np.diff(current_prices)  / np.array(current_prices[:-1])

    psi_score = psi(b_ret.tolist(), c_ret.tolist())

    # KS-test
    ks_stat, ks_p = stats.ks_2samp(b_ret, c_ret)

    baseline_vol = float(np.std(b_ret))
    current_vol  = float(np.std(c_ret))
    vol_change   = (current_vol - baseline_vol) / baseline_vol if baseline_vol > 0 else 0

    if psi_score > 0.2 or ks_p < 0.05:
        level = "HIGH" if psi_score > 0.25 else "MODERATE"
    else:
        level = "LOW"

    return {
        "drift":           level != "LOW",
        "drift_level":     level,
        "psi_score":       round(psi_score, 4),
        "ks_statistic":    round(float(ks_stat), 4),
        "ks_p_value":      round(float(ks_p), 4),
        "volatility_change_pct": round(vol_change * 100, 2),
        "recommendation":  _drift_recommendation(level, vol_change),
    }


def _drift_recommendation(level: str, vol_change: float) -> str:
    if level == "HIGH":
        return "Marknaden har förändrat beteende väsentligt — reducera positionsstorlek"
    if level == "MODERATE":
        return "Måttlig drift detekterad — bevaka noggrant och dra åt SL"
    return "Marknaden beter sig normalt"


# ---------------------------------------------------------------------------
# Manipulationsdetektering
# ---------------------------------------------------------------------------

def detect_manipulation(prices: list[float], window: int = 20) -> dict:
    if len(prices) < window:
        return {"patterns": [], "risk": "LOW"}

    arr     = np.array(prices[-window:], dtype=float)
    returns = np.diff(arr) / arr[:-1]
    vol     = float(np.std(returns))

    patterns = []

    # Stop Hunt — spike + omedelbar reversering
    for i in range(1, len(returns) - 1):
        spike    = abs(returns[i])
        reversal = returns[i + 1]
        if spike > 3 * vol and np.sign(reversal) != np.sign(returns[i]):
            direction = "UP" if returns[i] > 0 else "DOWN"
            patterns.append({
                "type":       "STOP_HUNT",
                "bar":        i,
                "direction":  direction,
                "spike_pct":  round(float(returns[i]) * 100, 3),
                "description": f"Kort spike {direction} + omedelbar reversering",
            })

    # Fake Breakout — bryter nivå men återvänder direkt
    high = float(np.max(arr[:-3]))
    low  = float(np.min(arr[:-3]))
    last = float(arr[-1])

    if arr[-3] > high * 1.002 and last < high:
        patterns.append({
            "type":       "FAKE_BREAKOUT",
            "direction":  "UPSIDE",
            "level":      round(high, 4),
            "description": "Bröt motstånd men återvände — möjlig fälla",
        })
    elif arr[-3] < low * 0.998 and last > low:
        patterns.append({
            "type":       "FAKE_BREAKOUT",
            "direction":  "DOWNSIDE",
            "level":      round(low, 4),
            "description": "Bröt stöd men återvände — möjlig fälla",
        })

    risk = "HIGH" if len(patterns) >= 2 else ("MODERATE" if patterns else "LOW")

    return {
        "patterns":  patterns,
        "risk":      risk,
        "window":    window,
    }


# ---------------------------------------------------------------------------
# Monte Carlo VaR
# ---------------------------------------------------------------------------

def monte_carlo(prices: list[float],
                horizon_days: int = 10,
                simulations:  int = 1000,
                confidence:   float = 0.95) -> dict:
    if len(prices) < 30:
        return {"error": "need at least 30 prices"}

    arr     = np.array(prices, dtype=float)
    returns = np.diff(arr) / arr[:-1]
    mu      = float(np.mean(returns))
    sigma   = float(np.std(returns))
    S0      = float(arr[-1])

    rng          = np.random.default_rng(42)
    rand_returns = rng.normal(mu, sigma, (simulations, horizon_days))
    paths        = S0 * np.cumprod(1 + rand_returns, axis=1)
    final_prices = paths[:, -1]

    pnl_pct = (final_prices - S0) / S0

    var_pct  = float(np.percentile(pnl_pct, (1 - confidence) * 100))
    cvar_pct = float(np.mean(pnl_pct[pnl_pct <= var_pct]))
    max_dd   = float(np.mean(
        np.min(paths / S0 - 1, axis=1)
    ))

    prob_loss = float(np.mean(final_prices < S0))
    prob_gain = float(np.mean(final_prices > S0))

    return {
        "simulations":       simulations,
        "horizon_days":      horizon_days,
        "confidence":        confidence,
        "current_price":     round(S0, 4),
        "var_pct":           round(var_pct * 100, 3),
        "var_abs":           round(var_pct * S0, 4),
        "cvar_pct":          round(cvar_pct * 100, 3),
        "expected_max_drawdown_pct": round(max_dd * 100, 3),
        "prob_loss_pct":     round(prob_loss * 100, 1),
        "prob_gain_pct":     round(prob_gain * 100, 1),
        "percentiles": {
            "p5":  round(float(np.percentile(final_prices, 5)),  4),
            "p25": round(float(np.percentile(final_prices, 25)), 4),
            "p50": round(float(np.percentile(final_prices, 50)), 4),
            "p75": round(float(np.percentile(final_prices, 75)), 4),
            "p95": round(float(np.percentile(final_prices, 95)), 4),
        },
    }
