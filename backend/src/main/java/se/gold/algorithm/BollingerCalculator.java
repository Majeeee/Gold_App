package se.gold.algorithm;

import java.math.BigDecimal;
import java.util.List;

/**
 * Bollinger Bands (20, 2)
 * price < lower band → oversold → bullish (+1)
 * price > upper band → overbought → bearish (-1)
 * price near middle → neutral (0)
 */
public class BollingerCalculator {

    private static final int PERIOD = 20;
    private static final double STD_DEV = 2.0;

    public record BollingerResult(double upper, double middle, double lower, String position) {}

    public static BollingerResult calculate(List<BigDecimal> prices) {
        if (prices.size() < PERIOD) {
            double p = prices.get(prices.size() - 1).doubleValue();
            return new BollingerResult(p * 1.02, p, p * 0.98, "MIDDLE");
        }

        List<BigDecimal> recent = prices.subList(prices.size() - PERIOD, prices.size());
        double mean = recent.stream().mapToDouble(BigDecimal::doubleValue).average().orElse(0);
        double variance = recent.stream()
                .mapToDouble(p -> Math.pow(p.doubleValue() - mean, 2))
                .average().orElse(0);
        double stdDev = Math.sqrt(variance);

        double upper = mean + STD_DEV * stdDev;
        double lower = mean - STD_DEV * stdDev;
        double current = prices.get(prices.size() - 1).doubleValue();

        String position;
        if (current < lower) position = "LOWER";
        else if (current > upper) position = "UPPER";
        else position = "MIDDLE";

        return new BollingerResult(upper, mean, lower, position);
    }

    public static int vote(BollingerResult result) {
        return switch (result.position()) {
            case "LOWER" -> 1;   // oversold
            case "UPPER" -> -1;  // overbought
            default -> 0;
        };
    }
}
