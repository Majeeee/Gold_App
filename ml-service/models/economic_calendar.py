"""
Economic Calendar — CPI, FOMC, NFP events via FRED API + fallback static schedule.
"""
import httpx
from datetime import datetime, timedelta, date
from typing import Optional

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


def _fred_latest(series_id: str, api_key: Optional[str] = None) -> Optional[dict]:
    if not api_key:
        return None
    try:
        resp = httpx.get(FRED_BASE, params={
            "series_id":      series_id,
            "api_key":        api_key,
            "file_type":      "json",
            "sort_order":     "desc",
            "limit":          3,
            "observation_start": (date.today() - timedelta(days=120)).isoformat(),
        }, timeout=8)
        resp.raise_for_status()
        obs = resp.json().get("observations", [])
        return [{"date": o["date"], "value": o["value"]} for o in obs if o["value"] != "."]
    except Exception:
        return None


def _static_upcoming() -> list[dict]:
    """Static schedule of major gold-relevant events for the next 90 days."""
    today = date.today()
    events = []

    # FOMC meetings 2025 (approximately every 6–8 weeks)
    fomc_dates = [
        date(2025, 6, 18), date(2025, 7, 30), date(2025, 9, 17),
        date(2025, 10, 29), date(2025, 12, 10),
    ]
    for d in fomc_dates:
        if d >= today:
            days_away = (d - today).days
            events.append({
                "event":       "FOMC Meeting (Fed Rate Decision)",
                "date":        d.isoformat(),
                "days_away":   days_away,
                "impact":      "HIGH",
                "category":    "MONETARY_POLICY",
                "gold_impact": "Rate hold/cut → Gold UP · Rate hike → Gold DOWN",
            })

    # CPI releases (approximately 2nd Tuesday of each month)
    cpi_dates = [
        date(2025, 6, 11), date(2025, 7, 11), date(2025, 8, 12),
        date(2025, 9, 10), date(2025, 10, 14), date(2025, 11, 13),
    ]
    for d in cpi_dates:
        if d >= today:
            events.append({
                "event":       "US CPI Release",
                "date":        d.isoformat(),
                "days_away":   (d - today).days,
                "impact":      "HIGH",
                "category":    "INFLATION",
                "gold_impact": "High CPI → Gold UP (inflation hedge) · Low CPI → Gold neutral/DOWN",
            })

    # NFP (Non-Farm Payrolls) — first Friday of each month
    nfp_dates = [
        date(2025, 6, 6), date(2025, 7, 4), date(2025, 8, 1),
        date(2025, 9, 5), date(2025, 10, 3), date(2025, 11, 7),
    ]
    for d in nfp_dates:
        if d >= today:
            events.append({
                "event":       "Non-Farm Payrolls (NFP)",
                "date":        d.isoformat(),
                "days_away":   (d - today).days,
                "impact":      "HIGH",
                "category":    "EMPLOYMENT",
                "gold_impact": "Weak NFP → Gold UP (risk-off) · Strong NFP → Gold DOWN",
            })

    return sorted(
        [e for e in events if 0 <= e["days_away"] <= 90],
        key=lambda x: x["days_away"]
    )


def get_economic_calendar(fred_api_key: Optional[str] = None) -> dict:
    upcoming = _static_upcoming()
    next_event = upcoming[0] if upcoming else None
    days_to_next = next_event["days_away"] if next_event else None

    # Risk level: HIGH if major event within 3 days
    risk = "HIGH" if days_to_next is not None and days_to_next <= 3 else (
        "MEDIUM" if days_to_next is not None and days_to_next <= 7 else "LOW"
    )

    result = {
        "generated_at":  datetime.utcnow().isoformat() + "Z",
        "upcoming_events": upcoming[:10],
        "next_event":    next_event,
        "event_risk":    risk,
        "trading_advice": (
            "Reduce position size before major events" if risk == "HIGH" else
            "Monitor closely" if risk == "MEDIUM" else
            "Normal trading conditions"
        ),
    }

    # Enrich with live FRED data if API key provided
    if fred_api_key:
        cpi_data = _fred_latest("CPIAUCSL", fred_api_key)
        fed_data = _fred_latest("FEDFUNDS", fred_api_key)
        if cpi_data:
            result["latest_cpi"] = cpi_data
        if fed_data:
            result["latest_fed_rate"] = fed_data

    return result
