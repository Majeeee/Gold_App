package se.gold.algorithm;

import java.math.BigDecimal;
import java.util.List;

/**
 * RSI - Relative Strength Index
 * Period varies by timeframe:
 *   SHORT → 7
 *   MID   → 14
 *   LONG  → 21
 *
 * < 30 = oversold  → bullish signal (+1)
 * > 70 = overbought → bearish signal (-1)
 */
public class RsiCalculator {

    public static double calculate(List<BigDecimal> prices, int period) {
        if (prices.size() < period + 1) return 50.0;

        double avgGain = 0, avgLoss = 0;

        for (int i = 1; i <= period; i++) {
            double change = prices.get(i).subtract(prices.get(i - 1)).doubleValue();
            if (change >= 0) avgGain += change;
            else avgLoss += Math.abs(change);
        }
        avgGain /= period;
        avgLoss /= period;

        for (int i = period + 1; i < prices.size(); i++) {
            double change = prices.get(i).subtract(prices.get(i - 1)).doubleValue();
            double gain = change >= 0 ? change : 0;
            double loss = change < 0 ? Math.abs(change) : 0;
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
        }

        if (avgLoss == 0) return 100.0;
        double rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    public static int vote(double rsi) {
        if (rsi < 30) return 1;   // oversold → bullish
        if (rsi > 70) return -1;  // overbought → bearish
        return 0;
    }
}
