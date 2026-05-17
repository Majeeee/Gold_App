package se.gold.algorithm;

import java.math.BigDecimal;
import java.util.List;

/**
 * MACD - Moving Average Convergence Divergence
 * Periods vary by timeframe:
 *   SHORT → (6, 13, 5)
 *   MID   → (12, 26, 9)
 *   LONG  → (24, 52, 18)
 *
 * macdLine > signalLine → bullish (+1)
 * macdLine < signalLine → bearish (-1)
 */
public class MacdCalculator {

    public record MacdResult(double macdLine, double signalLine, double histogram) {}

    public static MacdResult calculate(List<BigDecimal> prices, int fast, int slow, int signal) {
        if (prices.size() < slow + signal) {
            return new MacdResult(0, 0, 0);
        }

        double fastMult = 2.0 / (fast + 1);
        double slowMult = 2.0 / (slow + 1);
        double sigMult  = 2.0 / (signal + 1);

        // Build fast and slow EMA series in one pass
        double emaFast = prices.get(0).doubleValue();
        double emaSlow = prices.get(0).doubleValue();

        // Collect MACD line history starting from index (slow - 1)
        double[] macdHistory = new double[prices.size() - (slow - 1)];

        for (int i = 1; i < prices.size(); i++) {
            double p = prices.get(i).doubleValue();
            emaFast = (p - emaFast) * fastMult + emaFast;
            emaSlow = (p - emaSlow) * slowMult + emaSlow;
            if (i >= slow - 1) {
                macdHistory[i - (slow - 1)] = emaFast - emaSlow;
            }
        }

        double macdLine = macdHistory[macdHistory.length - 1];

        // Bug fix: signal line = proper EMA of MACD history (was wrong single-value approximation)
        double signalLine = macdHistory[0];
        for (int i = 1; i < macdHistory.length; i++) {
            signalLine = (macdHistory[i] - signalLine) * sigMult + signalLine;
        }

        double histogram = macdLine - signalLine;
        return new MacdResult(macdLine, signalLine, histogram);
    }

    public static int vote(MacdResult result) {
        if (result.macdLine() > result.signalLine()) return 1;
        if (result.macdLine() < result.signalLine()) return -1;
        return 0;
    }
}
