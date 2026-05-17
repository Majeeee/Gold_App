"""
Real TensorFlow LSTM + GRU models for gold price prediction.
Falls back gracefully if TensorFlow is not installed.
"""
import numpy as np
from sklearn.preprocessing import MinMaxScaler

try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, GRU, Dense, Dropout
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    from tensorflow.keras.optimizers import Adam
    tf.get_logger().setLevel('ERROR')
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

WINDOW = 20


def _make_sequences(prices: list[float]):
    arr = np.array(prices, dtype=np.float32).reshape(-1, 1)
    X, y = [], []
    for i in range(WINDOW, len(arr)):
        X.append(arr[i - WINDOW:i])
        y.append(arr[i])
    return np.array(X), np.array(y)


class DeepGoldPredictor:
    def __init__(self):
        self.scaler     = MinMaxScaler()
        self.lstm_model = None
        self.gru_model  = None
        self.is_trained  = False
        self.tf_available = TF_AVAILABLE

    def _build_lstm(self) -> "Sequential":
        m = Sequential([
            LSTM(64, return_sequences=True, input_shape=(WINDOW, 1)),
            Dropout(0.2),
            LSTM(32),
            Dropout(0.1),
            Dense(16, activation='relu'),
            Dense(1),
        ])
        m.compile(optimizer=Adam(0.001), loss='mse', metrics=['mae'])
        return m

    def _build_gru(self) -> "Sequential":
        m = Sequential([
            GRU(64, return_sequences=True, input_shape=(WINDOW, 1)),
            Dropout(0.2),
            GRU(32),
            Dropout(0.1),
            Dense(1),
        ])
        m.compile(optimizer=Adam(0.001), loss='mse', metrics=['mae'])
        return m

    def train(self, prices: list[float], epochs: int = 50, batch_size: int = 16) -> dict:
        if not TF_AVAILABLE:
            return {"status": "tensorflow_not_installed",
                    "hint": "pip install tensorflow"}

        if len(prices) < WINDOW + 20:
            return {"status": "not_enough_data",
                    "needed": WINDOW + 20, "got": len(prices)}

        arr = np.array(prices, dtype=np.float32).reshape(-1, 1)
        arr_scaled = self.scaler.fit_transform(arr)

        X, y = _make_sequences(arr_scaled.flatten().tolist())
        split = int(len(X) * 0.8)
        X_tr, X_val = X[:split], X[split:]
        y_tr, y_val = y[:split], y[split:]

        callbacks = [
            EarlyStopping(patience=8, restore_best_weights=True, verbose=0),
            ReduceLROnPlateau(factor=0.5, patience=4, verbose=0),
        ]

        self.lstm_model = self._build_lstm()
        hist_lstm = self.lstm_model.fit(
            X_tr, y_tr,
            validation_data=(X_val, y_val),
            epochs=epochs, batch_size=batch_size,
            callbacks=callbacks, verbose=0,
        )

        self.gru_model = self._build_gru()
        hist_gru = self.gru_model.fit(
            X_tr, y_tr,
            validation_data=(X_val, y_val),
            epochs=epochs, batch_size=batch_size,
            callbacks=callbacks, verbose=0,
        )

        self.is_trained = True
        return {
            "status":          "trained",
            "samples":         len(X),
            "window":          WINDOW,
            "lstm_val_loss":   round(float(min(hist_lstm.history["val_loss"])), 6),
            "gru_val_loss":    round(float(min(hist_gru.history["val_loss"])), 6),
            "lstm_epochs_run": len(hist_lstm.history["loss"]),
            "gru_epochs_run":  len(hist_gru.history["loss"]),
        }

    def predict(self, prices: list[float], steps_ahead: int = 1,
                regime: str = "RANGE") -> dict:
        if not TF_AVAILABLE:
            return {"error": "tensorflow_not_installed", "hint": "pip install tensorflow"}

        if not self.is_trained:
            return {"error": "model_not_trained",
                    "hint": "POST /ml/dl/train first"}

        buf = np.array(prices, dtype=np.float32).reshape(-1, 1)
        buf_scaled = self.scaler.transform(buf).flatten().tolist()

        lstm_steps, gru_steps = [], []

        for _ in range(steps_ahead):
            seq = np.array(buf_scaled[-WINDOW:], dtype=np.float32).reshape(1, WINDOW, 1)

            lstm_raw = float(self.lstm_model.predict(seq, verbose=0)[0][0])
            gru_raw  = float(self.gru_model.predict(seq, verbose=0)[0][0])

            # Inverse scale
            lstm_price = float(self.scaler.inverse_transform([[lstm_raw]])[0][0])
            gru_price  = float(self.scaler.inverse_transform([[gru_raw]])[0][0])

            # Regime-aware ensemble weights
            w = _regime_weights(regime)
            ensemble = round(lstm_price * w["lstm"] + gru_price * w["gru"], 4)

            lstm_steps.append(round(lstm_price, 4))
            gru_steps.append(round(gru_price, 4))

            # Feed ensemble back for multi-step
            next_scaled = float(self.scaler.transform([[ensemble]])[0][0])
            buf_scaled.append(next_scaled)

        current  = float(prices[-1])
        final_lstm = lstm_steps[-1]
        final_gru  = gru_steps[-1]
        w = _regime_weights(regime)
        final_ensemble = round(final_lstm * w["lstm"] + final_gru * w["gru"], 4)

        return {
            "lstm":           final_lstm,
            "gru":            final_gru,
            "ensemble":       final_ensemble,
            "lstm_steps":     lstm_steps,
            "gru_steps":      gru_steps,
            "steps_ahead":    steps_ahead,
            "regime":         regime,
            "direction":      "UP" if final_ensemble > current else "DOWN",
            "change_pct":     round((final_ensemble - current) / current * 100, 4),
            "trained":        True,
            "model":          "TensorFlow LSTM + GRU",
        }

    def confidence_interval(self, prices: list[float], mc_runs: int = 30) -> dict:
        """Monte Carlo Dropout confidence interval."""
        if not TF_AVAILABLE or not self.is_trained:
            p = prices[-1] if prices else 0
            return {"point_estimate": p, "ci_68": [p * 0.99, p * 1.01],
                    "ci_95": [p * 0.98, p * 1.02], "method": "fallback"}

        buf_scaled = self.scaler.transform(
            np.array(prices, dtype=np.float32).reshape(-1, 1)
        ).flatten().tolist()
        seq = np.array(buf_scaled[-WINDOW:], dtype=np.float32).reshape(1, WINDOW, 1)

        # Use training=True to keep Dropout active (MC Dropout)
        lstm_preds = np.array([
            float(self.scaler.inverse_transform(
                [[float(self.lstm_model(seq, training=True).numpy()[0][0])]]
            )[0][0])
            for _ in range(mc_runs)
        ])

        return {
            "point_estimate": round(float(np.mean(lstm_preds)), 4),
            "ci_68": [round(float(np.percentile(lstm_preds, 16)), 4),
                      round(float(np.percentile(lstm_preds, 84)), 4)],
            "ci_95": [round(float(np.percentile(lstm_preds, 2.5)), 4),
                      round(float(np.percentile(lstm_preds, 97.5)), 4)],
            "std_dev":          round(float(np.std(lstm_preds)), 4),
            "probability_up":   round(float(np.mean(lstm_preds > prices[-1])), 3),
            "probability_down": round(float(np.mean(lstm_preds < prices[-1])), 3),
            "method":           "MC Dropout (TensorFlow LSTM)",
            "mc_runs":          mc_runs,
        }

    def status(self) -> dict:
        return {
            "tensorflow_available": TF_AVAILABLE,
            "is_trained":           self.is_trained,
            "model_type":           "TensorFlow LSTM + GRU" if TF_AVAILABLE else "sklearn MLP (fallback)",
            "window":               WINDOW,
        }


def _regime_weights(regime: str) -> dict:
    table = {
        "TREND":      {"lstm": 0.6, "gru": 0.4},
        "TREND_UP":   {"lstm": 0.6, "gru": 0.4},
        "TREND_DOWN": {"lstm": 0.6, "gru": 0.4},
        "RANGE":      {"lstm": 0.4, "gru": 0.6},
        "VOLATILE":   {"lstm": 0.5, "gru": 0.5},
        "PANIC":      {"lstm": 0.3, "gru": 0.7},
    }
    return table.get(regime, {"lstm": 0.5, "gru": 0.5})


# Singleton
dl_predictor = DeepGoldPredictor()
