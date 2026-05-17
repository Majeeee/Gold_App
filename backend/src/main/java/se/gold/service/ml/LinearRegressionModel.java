package se.gold.service.ml;

import org.apache.commons.math3.stat.regression.SimpleRegression;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.util.List;

/**
 * Linear Regression price prediction using Apache Commons Math.
 * Used for short-term predictions (1 hour ahead).
 */
@Component
public class LinearRegressionModel {

    /**
     * Predict next price based on historical prices.
     * @param prices historical prices (at least 10)
     * @param stepsAhead how many steps to predict
     * @return predicted price
     */
    public double predict(List<BigDecimal> prices, int stepsAhead) {
        if (prices.size() < 5) return prices.get(prices.size() - 1).doubleValue();

        SimpleRegression regression = new SimpleRegression();
        for (int i = 0; i < prices.size(); i++) {
            regression.addData(i, prices.get(i).doubleValue());
        }

        return regression.predict(prices.size() - 1 + stepsAhead);
    }

    /**
     * Check if prediction deviates more than threshold from current price.
     * @return deviation percentage (0.0 to 1.0)
     */
    public double deviationFromPrediction(double currentPrice, double predictedPrice) {
        return Math.abs(currentPrice - predictedPrice) / predictedPrice;
    }

    /**
     * Returns true if price has deviated more than 1.5% from prediction.
     * This triggers a direction change alert.
     */
    public boolean isPlanBroken(double currentPrice, double predictedPrice) {
        return deviationFromPrediction(currentPrice, predictedPrice) > 0.015;
    }
}
