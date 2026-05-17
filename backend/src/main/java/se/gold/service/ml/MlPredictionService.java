package se.gold.service.ml;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import se.gold.model.Timeframe;

import java.math.BigDecimal;
import java.util.List;

/**
 * Combines Linear Regression and LSTM predictions.
 * Chooses the most accurate based on timeframe:
 *   SHORT → Linear Regression
 *   MID   → weighted average LR + LSTM
 *   LONG  → LSTM (or LR fallback)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MlPredictionService {

    private final LinearRegressionModel lr;
    private final LstmModel lstm;

    public record PredictionResult(
        double lrPrediction,
        double lstmPrediction,
        double combinedPrediction,
        int stepsAhead,
        String timeframeLabel,
        boolean planBroken,
        double deviationPercent
    ) {}

    public PredictionResult predict(List<BigDecimal> prices, Timeframe timeframe, double currentPrice) {
        int steps = stepsForTimeframe(timeframe);
        String label = labelForTimeframe(timeframe);

        double lrPred = lr.predict(prices, steps);
        double lstmPred = lstm.predict(prices, steps);

        // weighted combination based on timeframe
        double combined = switch (timeframe) {
            case SHORT -> lrPred;                          // LR only
            case MID   -> lrPred * 0.6 + lstmPred * 0.4; // mostly LR
            case LONG  -> lrPred * 0.3 + lstmPred * 0.7; // mostly LSTM
        };

        boolean planBroken = lr.isPlanBroken(currentPrice, combined);
        double deviation = lr.deviationFromPrediction(currentPrice, combined) * 100;

        return new PredictionResult(lrPred, lstmPred, combined, steps, label, planBroken, deviation);
    }

    private int stepsForTimeframe(Timeframe tf) {
        return switch (tf) {
            case SHORT -> 12;   // 12 x 5min = 1 hour
            case MID   -> 24;   // 24 x 1hr = 1 day
            case LONG  -> 7;    // 7 x 1day = 1 week
        };
    }

    private String labelForTimeframe(Timeframe tf) {
        return switch (tf) {
            case SHORT -> "1 hour ahead";
            case MID   -> "1 day ahead";
            case LONG  -> "1 week ahead";
        };
    }
}
