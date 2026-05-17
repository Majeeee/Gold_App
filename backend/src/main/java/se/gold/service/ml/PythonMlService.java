package se.gold.service.ml;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Calls the Python FastAPI ml-service for stop-loss recommendations.
 * Falls back gracefully when the service is unavailable.
 */
@Service
@Slf4j
public class PythonMlService {

    @Value("${ml.service.url:http://localhost:8000}")
    private String mlServiceUrl;

    private final RestTemplate rest = new RestTemplate();

    private static final double BLACK_SWAN_THRESHOLD = 0.04;

    /**
     * Asks the Python ML service for an ATR-based SL/TP recommendation.
     * Returns a map with keys: stop_loss, take_profit (or error on failure).
     */
    public Map<String, Object> getStopLossRecommendation(List<Double> prices,
                                                          double entryPrice,
                                                          String tradeType) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> body = Map.of(
                    "prices",       prices,
                    "entry_price",  entryPrice,
                    "trade_type",   tradeType
            );
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map<String, Object>> resp = rest.exchange(
                    mlServiceUrl + "/ml/stoploss/recommend",
                    Objects.requireNonNull(HttpMethod.POST), entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {});
            return resp.getBody() != null ? resp.getBody() : Map.of();
        } catch (Exception e) {
            log.warn("PythonMlService: stop-loss recommendation unavailable: {}", e.getMessage());
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Returns true if the price move between two ticks exceeds the black-swan
     * threshold (≥ 4%). Used as a secondary check alongside StopLossService.
     */
    public boolean checkBlackSwan(double currentPrice, double previousPrice) {
        if (previousPrice == 0) return false;
        double pct = Math.abs((currentPrice - previousPrice) / previousPrice);
        return pct >= BLACK_SWAN_THRESHOLD;
    }
}
