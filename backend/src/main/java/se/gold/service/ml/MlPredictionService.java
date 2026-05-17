package se.gold.service.ml;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import se.gold.model.Timeframe;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Predicts gold price using the Python ML service (RF + GB + LSTM + GRU ensemble).
 * Falls back to LinearRegressionModel when Python service is unavailable.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MlPredictionService {

    private final LinearRegressionModel lr;

    @Value("${ml.service.url:http://localhost:8000}")
    private String mlServiceUrl;

    private final RestTemplate rest = new RestTemplate();

    public record PredictionResult(
        double lrPrediction,
        double lstmPrediction,
        double combinedPrediction,
        int    stepsAhead,
        String timeframeLabel,
        boolean planBroken,
        double deviationPercent,
        double probabilityUp,
        double[] ci68
    ) {}

    public PredictionResult predict(List<BigDecimal> prices, Timeframe timeframe, double currentPrice) {
        int    steps = stepsForTimeframe(timeframe);
        String label = labelForTimeframe(timeframe);

        // Try Python ensemble first
        try {
            Map<String, Object> result = callPython(prices, timeframe, steps);
            if (result != null && result.containsKey("final_ensemble")) {
                double ensemble = toDouble(result.get("final_ensemble"));
                double rf       = toDouble(result.getOrDefault("final_rf", ensemble));
                double gb       = toDouble(result.getOrDefault("final_gb", ensemble));

                double probUp = 0.5;
                double[] ci68 = {ensemble * 0.99, ensemble * 1.01};

                Map<String, Object> conf = castMap(result.get("confidence"));
                if (conf != null) {
                    probUp = toDouble(conf.getOrDefault("probability_up", 0.5));
                    List<Object> ci = castList(conf.get("ci_68"));
                    if (ci != null && ci.size() == 2) {
                        ci68 = new double[]{toDouble(ci.get(0)), toDouble(ci.get(1))};
                    }
                }

                boolean planBroken = Math.abs(currentPrice - ensemble) / ensemble > 0.015;
                double deviation = Math.abs(currentPrice - ensemble) / ensemble * 100;

                log.debug("Python ML prediction: ensemble={} prob_up={}", ensemble, probUp);
                return new PredictionResult(rf, gb, ensemble, steps, label, planBroken, deviation, probUp, ci68);
            }
        } catch (Exception e) {
            log.warn("Python ML unavailable ({}), falling back to LinearRegression", e.getMessage());
        }

        // Fallback: LinearRegression only
        double lrPred    = lr.predict(prices, steps);
        boolean planBroken = lr.isPlanBroken(currentPrice, lrPred);
        double deviation   = lr.deviationFromPrediction(currentPrice, lrPred) * 100;
        return new PredictionResult(lrPred, lrPred, lrPred, steps, label, planBroken, deviation, 0.5,
                new double[]{lrPred * 0.99, lrPred * 1.01});
    }

    private Map<String, Object> callPython(List<BigDecimal> prices, Timeframe timeframe, int steps) {
        List<Double> priceList = prices.stream()
                .map(BigDecimal::doubleValue)
                .toList();
        String regime = "RANGE"; // default; improved by regime detection in SignalService
        Map<String, Object> body = Map.of(
                "prices",      priceList,
                "steps_ahead", steps,
                "regime",      regime,
                "timeframe",   timeframe.name(),
                "with_ci",     true
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map<String, Object>> resp = rest.exchange(
                mlServiceUrl + "/ml/predict/combined",
                Objects.requireNonNull(HttpMethod.POST), entity,
                new ParameterizedTypeReference<>() {});
        return resp.getBody();
    }

    private double toDouble(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        return 0.0;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object o) {
        return (o instanceof Map<?, ?> m) ? (Map<String, Object>) m : null;
    }

    @SuppressWarnings("unchecked")
    private List<Object> castList(Object o) {
        return (o instanceof List<?> l) ? (List<Object>) l : null;
    }

    private int stepsForTimeframe(Timeframe tf) {
        return switch (tf) {
            case SHORT -> 12;
            case MID   -> 24;
            case LONG  -> 7;
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
