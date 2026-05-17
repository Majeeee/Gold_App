"""
Meta Model — spårar vilken modell (LR / LSTM / Ensemble) som presterar bäst just nu,
och detekterar aktuellt marknadsregim (TREND / RANGE / VOLATILE / PANIC).
"""
import numpy as np
from collections import deque
from datetime import datetime


class ModelPerformanceTracker:
    """Sliding-window accuracy tracker per modell."""

    def __init__(self, window: int = 50):
        self.window = window
        self._records: dict[str, deque] = {
            "linear_regression": deque(maxlen=window),
            "lstm":              deque(maxlen=window),
            "ensemble":          deque(maxlen=window),
        }

    def record(self, model: str, predicted_direction: int, actual_direction: int):
        """predicted_direction och actual_direction: +1 (upp) eller -1 (ner)."""
        correct = int(predicted_direction == actual_direction)
        self._records[model].append(correct)

    def accuracy(self, model: str) -> float:
        recs = self._records[model]
        return round(sum(recs) / len(recs), 3) if recs else 0.5

    def best_model(self) -> dict:
        accs = {m: self.accuracy(m) for m in self._records}
        best = max(accs, key=lambda k: accs[k])
        return {
            "best":        best,
            "accuracies":  accs,
            "sample_size": {m: len(v) for m, v in self._records.items()},
        }


class MarketRegimeDetector:
    """
    Detekterar marknadsregim från en prisserie.

    TREND    — tydlig riktning, ADX > 25
    RANGE    — priset studsar i ett band, ADX < 20
    VOLATILE — hög volatilitet utan riktning
    PANIC    — extremt snabb rörelse (>3σ)
    """

    def detect(self, prices: list[float], window: int = 20) -> dict:
        if len(prices) < window + 1:
            return {"regime": "UNKNOWN", "confidence": 0.0}

        arr = np.array(prices[-window - 1:], dtype=float)
        returns = np.diff(arr) / arr[:-1]

        # Volatilitet (std av returns)
        vol = float(np.std(returns))

        # Trend-styrka via linjär regression R²
        x = np.arange(len(arr))
        coeffs = np.polyfit(x, arr, 1)
        trend_line = np.polyval(coeffs, x)
        ss_res = np.sum((arr - trend_line) ** 2)
        ss_tot = np.sum((arr - np.mean(arr)) ** 2)
        r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0

        # Senaste rörelse jämfört med historisk std
        last_move = abs(returns[-1]) if len(returns) > 0 else 0.0
        z_score   = last_move / vol if vol > 0 else 0.0

        # Klassificering
        if z_score > 3.0:
            regime, confidence = "PANIC", min(1.0, z_score / 5)
        elif vol > 0.015:
            regime, confidence = "VOLATILE", min(1.0, vol / 0.03)
        elif r2 > 0.7:
            regime, confidence = "TREND", round(r2, 2)
        else:
            regime, confidence = "RANGE", round(1 - r2, 2)

        slope_pct = float(coeffs[0] / arr[0] * 100) if arr[0] != 0 else 0.0

        return {
            "regime":         regime,
            "confidence":     round(confidence, 2),
            "volatility_pct": round(vol * 100, 3),
            "trend_r2":       round(r2, 3),
            "slope_pct_per_bar": round(slope_pct, 4),
            "last_z_score":   round(z_score, 2),
            "window":         window,
        }


class EnsembleWeighter:
    """
    Beräknar dynamiska vikter för LR + LSTM baserat på aktuell regime
    och modellernas senaste accuracy.
    """

    REGIME_WEIGHTS = {
        "TREND":    {"linear_regression": 0.6, "lstm": 0.4},
        "RANGE":    {"linear_regression": 0.4, "lstm": 0.6},
        "VOLATILE": {"linear_regression": 0.3, "lstm": 0.7},
        "PANIC":    {"linear_regression": 0.5, "lstm": 0.5},
        "UNKNOWN":  {"linear_regression": 0.5, "lstm": 0.5},
    }

    def weights(self, regime: str, tracker: ModelPerformanceTracker) -> dict:
        base = self.REGIME_WEIGHTS.get(regime, self.REGIME_WEIGHTS["UNKNOWN"]).copy()

        # Justera med faktisk accuracy om tillräckligt med data
        lr_acc   = tracker.accuracy("linear_regression")
        lstm_acc = tracker.accuracy("lstm")
        total    = lr_acc + lstm_acc

        if total > 0 and (len(tracker._records["linear_regression"]) >= 10 or
                          len(tracker._records["lstm"]) >= 10):
            base["linear_regression"] = round(lr_acc / total, 3)
            base["lstm"]              = round(lstm_acc / total, 3)

        return {
            "regime":  regime,
            "weights": base,
            "note":    "adjusted by recent accuracy" if total > 0 else "using regime defaults",
        }


# Globala singleton-instanser
tracker  = ModelPerformanceTracker()
detector = MarketRegimeDetector()
weighter = EnsembleWeighter()
