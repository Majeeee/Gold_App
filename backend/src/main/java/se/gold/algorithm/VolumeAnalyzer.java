package se.gold.algorithm;

import java.util.List;

/**
 * Volume analysis
 * volume > avg * 1.5 and price up → bullish confirmation (+1)
 * volume > avg * 1.5 and price down → bearish confirmation (-1)
 */
public class VolumeAnalyzer {

    public static int vote(List<Double> volumes, List<Double> prices) {
        if (volumes == null || volumes.size() < 5) return 0;

        double avgVolume = volumes.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double lastVolume = volumes.get(volumes.size() - 1);

        if (lastVolume < avgVolume * 1.5) return 0; // no significant volume

        if (prices.size() >= 2) {
            double priceChange = prices.get(prices.size() - 1) - prices.get(prices.size() - 2);
            if (priceChange > 0) return 1;   // high volume + price up → bullish
            if (priceChange < 0) return -1;  // high volume + price down → bearish
        }
        return 0;
    }
}
