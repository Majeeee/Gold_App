"""
Backtesting engine — simulerar ML-signaler mot historiska priser.
Beräknar: Return, Max Drawdown, Sharpe, Win Rate, Profit Factor.
"""
import numpy as np
from typing import Optional


def _signals_from_prices(prices: list[float], window: int = 5) -> list[int]:
    """Simple momentum signal: +1 (BUY) om MA[short] > MA[long], annars -1 (SELL)."""
    arr = np.array(prices, dtype=float)
    short_ma = np.convolve(arr, np.ones(window) / window, mode='valid')
    long_ma  = np.convolve(arr, np.ones(window * 3) / (window * 3), mode='valid')
    min_len  = min(len(short_ma), len(long_ma))
    signals  = np.where(short_ma[-min_len:] > long_ma[-min_len:], 1, -1)
    # Pad beginning with 0 (no position)
    pad = len(prices) - len(signals)
    return [0] * pad + signals.tolist()


def _max_drawdown(equity_curve: np.ndarray) -> float:
    peak = np.maximum.accumulate(equity_curve)
    dd   = (equity_curve - peak) / peak
    return float(np.min(dd))


def _sharpe(returns: np.ndarray, periods_per_year: int = 252) -> float:
    if len(returns) < 2 or np.std(returns) == 0:
        return 0.0
    return float(np.mean(returns) / np.std(returns) * np.sqrt(periods_per_year))


def run_backtest(
    prices:        list[float],
    signals:       Optional[list[int]] = None,
    initial_capital: float = 10_000.0,
    commission_pct:  float = 0.001,
    stop_loss_pct:   Optional[float] = None,
    take_profit_pct: Optional[float] = None,
) -> dict:
    """
    prices:   closing prices (ascending time order)
    signals:  +1=BUY, -1=SELL, 0=FLAT per price bar.
              If None → auto-generated from momentum.
    """
    if len(prices) < 10:
        return {"error": "Need at least 10 prices for backtesting"}

    if signals is None:
        signals = _signals_from_prices(prices)

    prices  = np.array(prices, dtype=float)
    signals = np.array(signals[:len(prices)], dtype=int)

    capital    = initial_capital
    position   = 0        # shares/oz held
    entry_px   = 0.0
    entry_sig  = 0
    equity     = [capital]
    trades     = []

    for i in range(1, len(prices)):
        sig   = int(signals[i])
        price = float(prices[i])
        prev  = float(prices[i - 1])

        # Check stop-loss / take-profit
        if position != 0 and entry_px > 0:
            pct_move = (price - entry_px) / entry_px * entry_sig
            if stop_loss_pct and pct_move <= -stop_loss_pct:
                sig = 0   # force close
            elif take_profit_pct and pct_move >= take_profit_pct:
                sig = 0

        # Close existing position if signal changed
        if position != 0 and sig != entry_sig:
            pnl = position * (price - entry_px) * entry_sig
            cost = abs(position) * price * commission_pct
            capital += pnl - cost
            trades.append({
                "entry": round(entry_px, 4),
                "exit":  round(price, 4),
                "type":  "BUY" if entry_sig == 1 else "SELL",
                "pnl":   round(pnl - cost, 4),
                "bars":  i,
            })
            position = 0
            entry_px = 0.0
            entry_sig = 0

        # Open new position
        if position == 0 and sig != 0:
            position  = capital / price
            entry_px  = price
            entry_sig = sig
            capital  -= position * price * commission_pct

        equity.append(capital + (position * (price - entry_px) * entry_sig if position != 0 else 0))

    # Force-close at end
    if position != 0:
        price = float(prices[-1])
        pnl   = position * (price - entry_px) * entry_sig
        cost  = abs(position) * price * commission_pct
        capital += pnl - cost
        trades.append({
            "entry": round(entry_px, 4),
            "exit":  round(price, 4),
            "type":  "BUY" if entry_sig == 1 else "SELL",
            "pnl":   round(pnl - cost, 4),
            "bars":  len(prices),
        })
        equity[-1] = capital

    eq_arr   = np.array(equity, dtype=float)
    ret_arr  = np.diff(eq_arr) / eq_arr[:-1]

    wins     = [t for t in trades if t["pnl"] > 0]
    losses   = [t for t in trades if t["pnl"] <= 0]
    win_rate = len(wins) / len(trades) if trades else 0.0
    avg_win  = float(np.mean([t["pnl"] for t in wins]))  if wins   else 0.0
    avg_loss = float(np.mean([t["pnl"] for t in losses])) if losses else 0.0
    profit_factor = (
        abs(sum(t["pnl"] for t in wins) / sum(t["pnl"] for t in losses))
        if losses and sum(t["pnl"] for t in losses) != 0 else float("inf")
    )

    total_return = (capital - initial_capital) / initial_capital * 100
    bah_return   = (float(prices[-1]) - float(prices[0])) / float(prices[0]) * 100

    return {
        "summary": {
            "initial_capital":   round(initial_capital, 2),
            "final_capital":     round(capital, 2),
            "total_return_pct":  round(total_return, 3),
            "buy_and_hold_pct":  round(bah_return, 3),
            "alpha_pct":         round(total_return - bah_return, 3),
            "max_drawdown_pct":  round(_max_drawdown(eq_arr) * 100, 3),
            "sharpe_ratio":      round(_sharpe(ret_arr), 3),
            "total_trades":      len(trades),
            "win_rate_pct":      round(win_rate * 100, 1),
            "avg_win":           round(avg_win, 4),
            "avg_loss":          round(avg_loss, 4),
            "profit_factor":     round(profit_factor, 3) if profit_factor != float("inf") else 999,
        },
        "equity_curve":  [round(float(v), 2) for v in eq_arr[::max(1, len(eq_arr)//100)]],
        "trades":        trades[-20:],  # last 20 trades
        "params": {
            "commission_pct":   commission_pct,
            "stop_loss_pct":    stop_loss_pct,
            "take_profit_pct":  take_profit_pct,
            "price_bars":       len(prices),
        },
    }
