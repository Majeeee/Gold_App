package se.gold.algorithm;

import java.math.BigDecimal;
import java.util.List;

/**
 * MA50 vs MA200 crossover
 * MA50 > MA200 → Golden Cross → bullish (+1)
 * MA50 < MA200 → Death Cross → bearish (-1)
 */
public class MaCrossCalculator {

    public static int vote(List<BigDecimal> prices) {
        if (prices.size() < 200) return 0;

        double ma50 = TrendDetector.movingAverage(prices, 50);
        double ma200 = TrendDetector.movingAverage(prices, 200);

        if (ma50 > ma200 * 1.001) return 1;   // golden cross
        if (ma50 < ma200 * 0.999) return -1;  // death cross
        return 0;
    }
}
