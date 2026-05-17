"""
Real ML models: Random Forest, Gradient Boosting, Neural Net (LSTM-like), Neural Net (GRU-like).
Uses scikit-learn with sliding-window features. Falls back to trend extrapolation if untrained.
SHAP explainability via RF feature importances.
Walk-forward validation via TimeSeriesSplit.
"""
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import TimeSeriesSplit

WINDOW = 20  # how many past prices to use as features


def _make_windows(prices: list[float]):
    arr = np.array(prices, dtype=float)
    X, y = [], []
    for i in range(WINDOW, len(arr)):
        X.append(arr[i - WINDOW:i])
        y.append(arr[i])
    return np.array(X), np.array(y)


class GoldPricePredictor:
    def __init__(self):
        self.rf   = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
        self.gb   = GradientBoostingRegressor(n_estimators=100, random_state=42)
        # LSTM-like: deep MLP with tanh (sequential activation, multiple layers)
        self.lstm = MLPRegressor(hidden_layer_sizes=(128, 64, 32), activation='tanh',
                                 max_iter=500, random_state=42, early_stopping=True)
        # GRU-like: shallower MLP with relu (gated mechanism approximation)
        self.gru  = MLPRegressor(hidden_layer_sizes=(64, 32), activation='relu',
                                 max_iter=500, random_state=42, early_stopping=True)
        self.scaler    = MinMaxScaler()
        self.is_trained = False

    def train(self, prices: list[float]) -> dict:
        if len(prices) < WINDOW + 10:
            return {"status": "not_enough_data", "needed": WINDOW + 10, "got": len(prices)}
        X, y = _make_windows(prices)
        Xs = self.scaler.fit_transform(X)
        self.rf.fit(Xs, y)
        self.gb.fit(Xs, y)
        self.lstm.fit(Xs, y)
        self.gru.fit(Xs, y)
        self.is_trained = True
        return {"status": "trained", "samples": len(X), "window": WINDOW}

    # ── single-step prediction ──────────────────────────────────────────────────
    def _predict_once(self, prices: list[float], regime: str) -> dict:
        w = np.array(prices[-WINDOW:], dtype=float).reshape(1, -1)
        ws = self.scaler.transform(w)
        rf_p   = float(self.rf.predict(ws)[0])
        gb_p   = float(self.gb.predict(ws)[0])
        lstm_p = float(self.lstm.predict(ws)[0])
        gru_p  = float(self.gru.predict(ws)[0])
        wts = _regime_weights(regime)
        ensemble = rf_p * wts['rf'] + gb_p * wts['gb'] + lstm_p * wts['lstm'] + gru_p * wts['gru']
        return {
            "rf":       round(rf_p, 4),
            "gb":       round(gb_p, 4),
            "lstm":     round(lstm_p, 4),
            "gru":      round(gru_p, 4),
            "ensemble": round(ensemble, 4),
        }

    def predict_combined(self, prices: list[float], steps_ahead: int = 1,
                         regime: str = "RANGE") -> dict:
        if not self.is_trained or len(prices) < WINDOW:
            return _fallback(prices, steps_ahead)
        steps = []
        buf = list(prices)
        for _ in range(steps_ahead):
            p = self._predict_once(buf, regime)
            steps.append(p)
            buf.append(p["ensemble"])
        last = steps[-1]
        return {
            "predictions": steps,
            "final_rf":       last["rf"],
            "final_gb":       last["gb"],
            "final_lstm":     last["lstm"],
            "final_gru":      last["gru"],
            "final_ensemble": last["ensemble"],
            "regime":         regime,
            "steps_ahead":    steps_ahead,
            "trained":        True,
        }

    def confidence_interval(self, prices: list[float], simulations: int = 200) -> dict:
        """Bootstrap confidence interval via RF individual tree predictions."""
        if not self.is_trained or len(prices) < WINDOW:
            p = prices[-1] if prices else 0
            return {"point_estimate": p, "ci_68": [p * 0.99, p * 1.01],
                    "ci_95": [p * 0.98, p * 1.02], "probability_up": 0.5, "probability_down": 0.5}
        w = np.array(prices[-WINDOW:], dtype=float).reshape(1, -1)
        ws = self.scaler.transform(w)
        trees = self.rf.estimators_[:simulations]
        preds = np.array([t.predict(ws)[0] for t in trees])
        current = prices[-1]
        return {
            "point_estimate": round(float(np.mean(preds)), 4),
            "ci_68": [round(float(np.percentile(preds, 16)), 4),
                      round(float(np.percentile(preds, 84)), 4)],
            "ci_95": [round(float(np.percentile(preds, 2.5)), 4),
                      round(float(np.percentile(preds, 97.5)), 4)],
            "probability_up":   round(float(np.mean(preds > current)), 3),
            "probability_down": round(float(np.mean(preds < current)), 3),
            "std_dev":          round(float(np.std(preds)), 4),
        }

    def explain_shap(self, prices: list[float]) -> dict:
        """Feature importance via RF's built-in impurity-based importances (fast, no SHAP dep)."""
        if not self.is_trained or len(prices) < WINDOW:
            return {"error": "Model not trained yet"}
        importances = self.rf.feature_importances_
        names = [f"price_t-{WINDOW - i}" for i in range(WINDOW)]
        ranked = sorted(zip(names, importances), key=lambda x: x[1], reverse=True)
        return {
            "method": "RF impurity-based importance",
            "top_features": [{"feature": k, "importance": round(float(v), 6)}
                             for k, v in ranked[:8]],
            "interpretation": "price_t-1 = most recent price, price_t-20 = oldest in window",
        }

    def walk_forward(self, prices: list[float], n_splits: int = 5) -> dict:
        if len(prices) < WINDOW + 30:
            return {"error": "Need at least 50 price points for walk-forward validation"}
        X, y = _make_windows(prices)
        Xs = MinMaxScaler().fit_transform(X)
        tscv   = TimeSeriesSplit(n_splits=n_splits)
        scores = {m: [] for m in ("rf", "gb", "lstm", "gru")}
        model_factories = {
            "rf":   lambda: RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=-1),
            "gb":   lambda: GradientBoostingRegressor(n_estimators=50, random_state=42),
            "lstm": lambda: MLPRegressor(hidden_layer_sizes=(64, 32), activation='tanh',
                                         max_iter=200, random_state=42),
            "gru":  lambda: MLPRegressor(hidden_layer_sizes=(32, 16), activation='relu',
                                         max_iter=200, random_state=42),
        }
        for tr, te in tscv.split(Xs):
            if len(tr) < 10:
                continue
            for name, factory in model_factories.items():
                m = factory()
                m.fit(Xs[tr], y[tr])
                preds = m.predict(Xs[te])
                mape = float(np.mean(np.abs((y[te] - preds) / (np.abs(y[te]) + 1e-9))) * 100)
                scores[name].append(mape)
        avg = {k: round(float(np.mean(v)), 3) if v else None for k, v in scores.items()}
        best = min(avg, key=lambda k: avg[k] or 9999)
        return {
            "validation": "walk_forward_time_series",
            "n_splits":   n_splits,
            "avg_mape":   avg,
            "best_model": best,
            "note": "Lower MAPE is better. Walk-forward prevents look-ahead bias.",
        }


# ── Module-level singleton ───────────────────────────────────────────────────
predictor = GoldPricePredictor()


# ── Helpers ──────────────────────────────────────────────────────────────────
def _regime_weights(regime: str) -> dict:
    table = {
        "TREND":      {"rf": 0.15, "gb": 0.15, "lstm": 0.40, "gru": 0.30},
        "TREND_UP":   {"rf": 0.15, "gb": 0.15, "lstm": 0.40, "gru": 0.30},
        "TREND_DOWN": {"rf": 0.15, "gb": 0.15, "lstm": 0.40, "gru": 0.30},
        "RANGE":      {"rf": 0.35, "gb": 0.35, "lstm": 0.15, "gru": 0.15},
        "VOLATILE":   {"rf": 0.25, "gb": 0.25, "lstm": 0.25, "gru": 0.25},
        "PANIC":      {"rf": 0.40, "gb": 0.40, "lstm": 0.10, "gru": 0.10},
    }
    return table.get(regime, {"rf": 0.25, "gb": 0.25, "lstm": 0.25, "gru": 0.25})


def _fallback(prices: list[float], steps: int) -> dict:
    if len(prices) < 2:
        v = prices[-1] if prices else 0
        return {"final_ensemble": v, "trained": False,
                "predictions": [{"ensemble": v, "rf": v, "gb": v, "lstm": v, "gru": v}]}
    last, prev = prices[-1], prices[-2]
    trend = last - prev
    step_preds = [{"ensemble": round(last + trend * (i + 1), 4),
                   "rf": round(last + trend * (i + 1), 4),
                   "gb": round(last + trend * (i + 1), 4),
                   "lstm": round(last + trend * (i + 1), 4),
                   "gru": round(last + trend * (i + 1), 4)} for i in range(steps)]
    final = step_preds[-1]["ensemble"]
    return {"final_ensemble": final, "final_rf": final, "final_gb": final,
            "final_lstm": final, "final_gru": final,
            "predictions": step_preds, "trained": False}
