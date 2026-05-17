"""
Attribution Analysis — delar upp P&L per indikator.
Metod: varje indikator ger en "vote" vid entry (-1/0/+1).
Vid stängning fördelas P&L proportionellt mot riktiga votes.
"""
from typing import Optional
import numpy as np


INDICATORS = [
    "rsi", "macd", "bollinger", "trend", "volume",
    "support_resistance", "ma_cross",          # tekniska
    "dxy", "fed_rate", "cpi", "etf_flows", "coin_bubble",  # fundamentala
]


def _normalize_votes(votes: dict) -> dict:
    """Normalisera votes till [-1, 0, 1]."""
    result = {}
    for ind in INDICATORS:
        v = votes.get(ind, 0)
        result[ind] = max(-1, min(1, int(v)))
    return result


def attribute_pnl(pnl: float, entry_votes: dict,
                  trade_type: str = "BUY") -> dict:
    """
    Beräkna hur mycket P&L varje indikator bidrog med.

    pnl         : faktisk P&L (positiv = vinst)
    entry_votes : {rsi: 1, macd: -1, ...} snapshot vid entry
    trade_type  : BUY | SELL
    """
    votes = _normalize_votes(entry_votes)

    # För en BUY-trade är positiva votes "rätt", negativa "fel"
    # För en SELL-trade är det omvänt
    direction = 1 if trade_type == "BUY" else -1

    aligned   = {k: v * direction for k, v in votes.items()}
    pos_sum   = sum(max(0, v) for v in aligned.values())
    neg_sum   = sum(min(0, v) for v in aligned.values())

    attribution = {}
    for ind, vote in aligned.items():
        if pnl >= 0:
            # P&L är positiv → fördela på indikatorer som pekade rätt
            share = (vote / pos_sum * pnl) if pos_sum > 0 and vote > 0 else 0.0
        else:
            # P&L är negativ → fördela förlusten på indikatorer som pekade fel
            share = (vote / neg_sum * pnl) if neg_sum < 0 and vote < 0 else 0.0
        attribution[ind] = round(share, 4)

    return {
        "pnl":          round(pnl, 4),
        "trade_type":   trade_type,
        "attribution":  attribution,
        "top_positive": _top_n(attribution, 3, positive=True),
        "top_negative": _top_n(attribution, 3, positive=False),
        "accuracy_score": _accuracy_score(votes, pnl, direction),
    }


def _top_n(attr: dict, n: int, positive: bool) -> list:
    filtered = {k: v for k, v in attr.items()
                if (v > 0 if positive else v < 0)}
    sorted_items = sorted(filtered.items(),
                          key=lambda x: abs(x[1]), reverse=True)
    return [{"indicator": k, "contribution": v} for k, v in sorted_items[:n]]


def _accuracy_score(votes: dict, pnl: float, direction: int) -> float:
    """Hur väl stämde indikatorerna med utfallet? 0–1."""
    correct = sum(1 for v in votes.values() if v * direction * (1 if pnl >= 0 else -1) > 0)
    total   = sum(1 for v in votes.values() if v != 0)
    return round(correct / total, 2) if total else 0.0


def portfolio_attribution(trades: list[dict]) -> dict:
    """Aggregerad attribution över flera avslutade trades."""
    totals: dict[str, float] = {ind: 0.0 for ind in INDICATORS}
    count = 0

    for t in trades:
        if t.get("pnl") is None or not t.get("indicators"):
            continue
        result = attribute_pnl(t["pnl"], t["indicators"], t.get("trade_type", "BUY"))
        for ind, val in result["attribution"].items():
            totals[ind] = totals.get(ind, 0.0) + val
        count += 1

    if count == 0:
        return {"error": "no closed trades with indicator data"}

    return {
        "trades_analyzed": count,
        "total_attribution": {k: round(v, 2) for k, v in totals.items()},
        "best_indicator":  max(totals, key=lambda k: totals[k]),
        "worst_indicator": min(totals, key=lambda k: totals[k]),
    }
