package se.gold.algorithm;

import java.math.BigDecimal;
import java.util.List;

/**
 * Trend detection using MA20 and linear regression slope
 * price > MA20 and slope > 0 → BULLISH (+1)
 * price < MA20 and slope < 0 → BEARISH (-1)
 */
public class TrendDetector {

    public enum Trend { BULLISH, BEARISH, NEUTRAL }

    public static Trend detect(List<BigDecimal> prices) {
        if (prices.size() < 20) return Trend.NEUTRAL;

        double ma20 = movingAverage(prices, 20);
        double current = prices.get(prices.size() - 1).doubleValue();
        double slope = linearSlope(prices.subList(Math.max(0, prices.size() - 10), prices.size()));

        if (current > ma20 && slope > 0) return Trend.BULLISH;
        if (current < ma20 && slope < 0) return Trend.BEARISH;
        return Trend.NEUTRAL;
    }

    public static int vote(Trend trend) {
        return switch (trend) {
            case BULLISH -> 1;
            case BEARISH -> -1;
            default -> 0;
        };
    }

    public static double movingAverage(List<BigDecimal> prices, int period) {
        int start = Math.max(0, prices.size() - period);
        return prices.subList(start, prices.size()).stream()
                .mapToDouble(BigDecimal::doubleValue).average().orElse(0);
    }

    public static double linearSlope(List<BigDecimal> prices) {
        int n = prices.size();
        double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (int i = 0; i < n; i++) {
            sumX += i; sumY += prices.get(i).doubleValue();
            sumXY += i * prices.get(i).doubleValue(); sumX2 += (double) i * i;
        }
        double denom = n * sumX2 - sumX * sumX;
        return denom == 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    }
}
