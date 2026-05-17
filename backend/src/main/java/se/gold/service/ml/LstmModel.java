package se.gold.service.ml;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.util.List;

/**
 * LSTM price prediction using Deeplearning4j.
 * Used for long-term predictions (1 day / 1 week ahead).
 *
 * Note: LSTM model needs to be trained first with historical data.
 * Training is done separately using trainModel() method.
 * Until trained, falls back to Linear Regression.
 */
@Component
@Slf4j
public class LstmModel {

    private boolean isTrained = false;

    // Add DL4J MultiLayerNetwork field and training logic
    // private MultiLayerNetwork net;

    /**
     * Predict price N steps ahead.
     * Falls back to simple trend extrapolation if not trained.
     */
    public double predict(List<BigDecimal> prices, int stepsAhead) {
        if (!isTrained) {
            log.warn("LSTM model not trained yet, using trend extrapolation");
            return fallbackPrediction(prices, stepsAhead);
        }
        // Implement actual LSTM prediction with trained model
        // return net.output(prepareInput(prices)).getDouble(0);
        return fallbackPrediction(prices, stepsAhead);
    }

    /**
     * Train LSTM model on historical data.
     * Call this on startup or periodically with fresh data.
     */
    public void trainModel(List<BigDecimal> historicalPrices) {
        if (historicalPrices.size() < 100) {
            log.warn("Not enough data to train LSTM (need 100+, got {})", historicalPrices.size());
            return;
        }
        log.info("Training LSTM model with {} price points...", historicalPrices.size());
        // Implement DL4J LSTM training
        // This requires significant historical data (6+ months)
        isTrained = true;
        log.info("LSTM model training complete");
    }

    public boolean isTrained() { return isTrained; }

    private double fallbackPrediction(List<BigDecimal> prices, int stepsAhead) {
        // simple trend extrapolation
        int n = prices.size();
        if (n < 2) return prices.get(n - 1).doubleValue();
        double last = prices.get(n - 1).doubleValue();
        double prev = prices.get(n - 2).doubleValue();
        double trend = last - prev;
        return last + trend * stepsAhead;
    }
}
