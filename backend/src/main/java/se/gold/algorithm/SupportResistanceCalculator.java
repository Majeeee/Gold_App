package se.gold.algorithm;

import java.math.BigDecimal;
import java.util.List;

/**
 * Support and Resistance levels
 * price near support → bullish (+1)
 * price near resistance → bearish (-1)
 */
public class SupportResistanceCalculator {

    private static final double THRESHOLD = 0.005; // 0.5%

    public record SRResult(double support, double resistance, String position) {}

    public static SRResult calculate(List<BigDecimal> prices) {
        if (prices.size() < 10) {
            double p = prices.get(prices.size() - 1).doubleValue();
            return new SRResult(p * 0.98, p * 1.02, "MIDDLE");
        }

        double min = prices.stream().mapToDouble(BigDecimal::doubleValue).min().orElse(0);
        double max = prices.stream().mapToDouble(BigDecimal::doubleValue).max().orElse(0);
        double current = prices.get(prices.size() - 1).doubleValue();

        // nearest support = recent low, resistance = recent high
        double support = prices.subList(Math.max(0, prices.size() - 20), prices.size())
                .stream().mapToDouble(BigDecimal::doubleValue).min().orElse(min);
        double resistance = prices.subList(Math.max(0, prices.size() - 20), prices.size())
                .stream().mapToDouble(BigDecimal::doubleValue).max().orElse(max);

        String position;
        double distSupport = Math.abs(current - support) / support;
        double distResistance = Math.abs(resistance - current) / resistance;

        if (distSupport < THRESHOLD) position = "NEAR_SUPPORT";
        else if (distResistance < THRESHOLD) position = "NEAR_RESISTANCE";
        else position = "MIDDLE";

        return new SRResult(support, resistance, position);
    }

    public static int vote(SRResult result) {
        return switch (result.position()) {
            case "NEAR_SUPPORT" -> 1;
            case "NEAR_RESISTANCE" -> -1;
            default -> 0;
        };
    }
}
