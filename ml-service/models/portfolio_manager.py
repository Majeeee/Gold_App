"""
Portföljhantering: Kelly Criterion, positionsstorlek, korrelationsmatris,
exponeringsanalys, hedging-förslag och dataversionshantering.
"""
import numpy as np
import hashlib
import json
from datetime import datetime


# ---------------------------------------------------------------------------
# Kelly Criterion & Positionsstorlek
# ---------------------------------------------------------------------------

def kelly_criterion(win_rate: float, avg_win: float,
                    avg_loss: float, fraction: float = 0.5) -> dict:
    """
    Kelly-formel: f = (b*p - q) / b
    b = avg_win / avg_loss (odds)
    p = win_rate
    q = 1 - win_rate

    fraction=0.5 → Half-Kelly (rekommenderat för att minska risk)
    """
    if avg_loss == 0 or avg_win == 0:
        return {"error": "avg_win and avg_loss must be non-zero"}

    b = avg_win / abs(avg_loss)
    p = win_rate
    q = 1 - p

    kelly_full  = (b * p - q) / b
    kelly_used  = kelly_full * fraction
    kelly_used  = max(0.0, min(kelly_used, 0.25))   # aldrig mer än 25% per affär

    return {
        "kelly_full_pct":  round(kelly_full * 100, 2),
        "kelly_used_pct":  round(kelly_used * 100, 2),
        "fraction_used":   fraction,
        "odds_ratio":      round(b, 3),
        "win_rate":        round(p, 3),
        "interpretation":  _kelly_interpretation(kelly_used),
    }


def _kelly_interpretation(k: float) -> str:
    if k <= 0:      return "Negativ edge — undvik denna strategi"
    if k < 0.02:    return "Mycket liten edge — minimala positioner"
    if k < 0.05:    return "Liten edge — konservativa positioner"
    if k < 0.10:    return "Bra edge — normala positioner"
    return              "Stark edge — men begränsad till 25% max"


def position_size(capital: float, risk_pct: float,
                  entry_price: float, stop_loss: float) -> dict:
    """
    Beräknar antal enheter baserat på max-risk per affär.
    risk_pct = andel av kapitalet vi riskerar (t.ex. 0.02 = 2%)
    """
    if entry_price == stop_loss:
        return {"error": "entry_price cannot equal stop_loss"}

    risk_amount    = capital * risk_pct
    risk_per_unit  = abs(entry_price - stop_loss)
    units          = risk_amount / risk_per_unit
    exposure       = units * entry_price
    exposure_pct   = exposure / capital * 100

    return {
        "units":           round(units, 4),
        "risk_amount":     round(risk_amount, 2),
        "risk_per_unit":   round(risk_per_unit, 4),
        "total_exposure":  round(exposure, 2),
        "exposure_pct":    round(exposure_pct, 2),
        "max_loss":        round(risk_amount, 2),
    }


# ---------------------------------------------------------------------------
# Korrelationsmatris & Exponering
# ---------------------------------------------------------------------------

def correlation_matrix(position_returns: dict[str, list[float]]) -> dict:
    """
    position_returns: {symbol: [ret1, ret2, ...]}
    Returnerar full korrelationsmatris.
    """
    symbols = list(position_returns.keys())
    n = len(symbols)
    if n < 2:
        return {"error": "need at least 2 positions"}

    min_len = min(len(v) for v in position_returns.values())
    matrix  = np.zeros((n, n))

    for i, s1 in enumerate(symbols):
        for j, s2 in enumerate(symbols):
            r1 = np.array(position_returns[s1][:min_len])
            r2 = np.array(position_returns[s2][:min_len])
            if np.std(r1) > 0 and np.std(r2) > 0:
                matrix[i, j] = float(np.corrcoef(r1, r2)[0, 1])
            else:
                matrix[i, j] = 1.0 if i == j else 0.0

    high_corr_pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            if abs(matrix[i, j]) > 0.7:
                high_corr_pairs.append({
                    "pair":        f"{symbols[i]}/{symbols[j]}",
                    "correlation": round(float(matrix[i, j]), 3),
                    "risk":        "HIGH — diversifieringen är låg",
                })

    return {
        "symbols":           symbols,
        "matrix":            [[round(matrix[i, j], 3) for j in range(n)] for i in range(n)],
        "high_corr_pairs":   high_corr_pairs,
        "diversification":   "POOR" if high_corr_pairs else "GOOD",
    }


def exposure_analysis(positions: list[dict], total_capital: float) -> dict:
    """
    positions: [{market, type, quantity, entry_price, current_price}, ...]
    """
    if not positions:
        return {"total_exposure": 0, "positions": []}

    analyzed = []
    total_long  = 0.0
    total_short = 0.0
    total_pnl   = 0.0

    for p in positions:
        exposure   = p["quantity"] * p["current_price"]
        pnl        = (p["current_price"] - p["entry_price"]) * p["quantity"]
        if p["type"] == "SELL":
            pnl = -pnl
        exposure_pct = exposure / total_capital * 100 if total_capital > 0 else 0

        if p["type"] == "BUY":
            total_long += exposure
        else:
            total_short += exposure
        total_pnl += pnl

        analyzed.append({
            **p,
            "exposure":     round(exposure, 2),
            "exposure_pct": round(exposure_pct, 2),
            "pnl":          round(pnl, 2),
        })

    net_exposure = total_long - total_short
    hedge_ratio  = total_short / total_long if total_long > 0 else 0

    return {
        "positions":          analyzed,
        "total_long":         round(total_long, 2),
        "total_short":        round(total_short, 2),
        "net_exposure":       round(net_exposure, 2),
        "hedge_ratio":        round(hedge_ratio, 3),
        "total_pnl":          round(total_pnl, 2),
        "hedging_suggestion": _hedge_suggestion(hedge_ratio, total_long, total_capital),
    }


def _hedge_suggestion(hedge_ratio: float, long_exp: float, capital: float) -> str:
    exp_pct = long_exp / capital * 100 if capital > 0 else 0
    if exp_pct > 80 and hedge_ratio < 0.2:
        return "Hög exponering utan hedge — överväg att öppna en kort position"
    if hedge_ratio > 0.8:
        return "Nästan fullt hedgad — låg risk men begränsad uppgångspotential"
    if 0.2 <= hedge_ratio <= 0.5:
        return "Balanserad hedge — bra riskprofil"
    return "Acceptabel exponering"


# ---------------------------------------------------------------------------
# Dataversionshantering
# ---------------------------------------------------------------------------

def version_dataset(data: list, label: str = "") -> dict:
    """Skapar en deterministisk hash + metadata för reproducerbarhet."""
    serialized = json.dumps(data, sort_keys=True, default=str).encode()
    sha256     = hashlib.sha256(serialized).hexdigest()
    md5        = hashlib.md5(serialized).hexdigest()

    return {
        "label":      label,
        "sha256":     sha256,
        "md5":        md5,
        "rows":       len(data),
        "created_at": datetime.utcnow().isoformat(),
        "size_bytes": len(serialized),
    }
