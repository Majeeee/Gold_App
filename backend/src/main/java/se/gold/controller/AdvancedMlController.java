package se.gold.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import se.gold.service.StopLossService;

import java.util.List;
import java.util.Map;

/**
 * Proxies advanced ML endpoints to the Python FastAPI ml-service.
 * Also exposes ATR stop loss calculation directly from Java.
 */
@RestController
@RequestMapping("/api/ml")
@RequiredArgsConstructor
@Slf4j
public class AdvancedMlController {

    @Value("${ml.service.url:http://localhost:8000}")
    private String mlServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    // ── Generic proxy helper ────────────────────────────────────────────────
    private ResponseEntity<?> proxy(String path, Object body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Object> entity = new HttpEntity<>(body, headers);
            return restTemplate.exchange(
                mlServiceUrl + path, HttpMethod.POST, entity, Object.class);
        } catch (Exception e) {
            log.warn("ML service unavailable: {}", e.getMessage());
            return ResponseEntity.status(503)
                .body(Map.of("error", "ML service unavailable", "detail", e.getMessage()));
        }
    }

    private ResponseEntity<?> proxyGet(String path) {
        try {
            return restTemplate.getForEntity(mlServiceUrl + path, Object.class);
        } catch (Exception e) {
            log.warn("ML service unavailable: {}", e.getMessage());
            return ResponseEntity.status(503)
                .body(Map.of("error", "ML service unavailable", "detail", e.getMessage()));
        }
    }

    // ── Master ─────────────────────────────────────────────────────────────
    @PostMapping("/advanced/master")
    public ResponseEntity<?> master(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/master", body);
    }

    // ── Stop Loss ───────────────────────────────────────────────────────────
    @PostMapping("/stoploss/recommend")
    public ResponseEntity<?> stopLossRecommend(@RequestBody Map<String, Object> body) {
        return proxy("/ml/stoploss/recommend", body);
    }

    /** ATR stops beräknade direkt i Java utan ML-service */
    @PostMapping("/stoploss/atr")
    public ResponseEntity<?> atrStops(@RequestBody AtrRequest req) {
        double[] stops = StopLossService.calculateAtrStops(
            req.prices().stream().mapToDouble(Double::doubleValue).toArray(),
            req.entryPrice(), "BUY".equalsIgnoreCase(req.tradeType()));
        return ResponseEntity.ok(Map.of(
            "stop_loss",   stops[0],
            "take_profit", stops[1],
            "trade_type",  req.tradeType(),
            "entry_price", req.entryPrice()
        ));
    }

    // ── Trade Journal ───────────────────────────────────────────────────────
    @PostMapping("/advanced/journal/entry")
    public ResponseEntity<?> journalEntry(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/journal/entry", body);
    }

    @PutMapping("/advanced/journal/outcome")
    public ResponseEntity<?> journalOutcome(@RequestBody Map<String, Object> body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Object> entity = new HttpEntity<>(body, headers);
            return restTemplate.exchange(
                mlServiceUrl + "/ml/advanced/journal/outcome",
                HttpMethod.PUT, entity, Object.class);
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/advanced/journal/analyze")
    public ResponseEntity<?> journalAnalyze() {
        return proxyGet("/ml/advanced/journal/analyze");
    }

    @GetMapping("/advanced/journal/all")
    public ResponseEntity<?> journalAll() {
        return proxyGet("/ml/advanced/journal/all");
    }

    // ── Attribution ─────────────────────────────────────────────────────────
    @PostMapping("/advanced/attribution")
    public ResponseEntity<?> attribution(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/attribution", body);
    }

    @PostMapping("/advanced/attribution/portfolio")
    public ResponseEntity<?> portfolioAttribution(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/attribution/portfolio", body);
    }

    // ── Meta Model & Regime ─────────────────────────────────────────────────
    @PostMapping("/advanced/meta/regime")
    public ResponseEntity<?> regime(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/meta/regime", body);
    }

    @GetMapping("/advanced/meta/best")
    public ResponseEntity<?> bestModel() {
        return proxyGet("/ml/advanced/meta/best");
    }

    // ── Correlation ─────────────────────────────────────────────────────────
    @PostMapping("/advanced/correlation")
    public ResponseEntity<?> correlation(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/correlation", body);
    }

    // ── Seasonality ─────────────────────────────────────────────────────────
    @PostMapping("/advanced/seasonality")
    public ResponseEntity<?> seasonality(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/seasonality", body);
    }

    // ── Behavioral ──────────────────────────────────────────────────────────
    @PostMapping("/advanced/behavioral")
    public ResponseEntity<?> behavioral(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/behavioral", body);
    }

    // ── Drift ───────────────────────────────────────────────────────────────
    @PostMapping("/advanced/drift")
    public ResponseEntity<?> drift(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/drift", body);
    }

    @PostMapping("/advanced/manipulation")
    public ResponseEntity<?> manipulation(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/manipulation", body);
    }

    // ── Monte Carlo ─────────────────────────────────────────────────────────
    @PostMapping("/advanced/montecarlo")
    public ResponseEntity<?> monteCarlo(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/montecarlo", body);
    }

    // ── Portfolio ────────────────────────────────────────────────────────────
    @PostMapping("/advanced/portfolio/kelly")
    public ResponseEntity<?> kelly(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/portfolio/kelly", body);
    }

    @PostMapping("/advanced/portfolio/size")
    public ResponseEntity<?> positionSize(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/portfolio/size", body);
    }

    @PostMapping("/advanced/portfolio/exposure")
    public ResponseEntity<?> exposure(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/portfolio/exposure", body);
    }

    @PostMapping("/advanced/portfolio/correlation")
    public ResponseEntity<?> portfolioCorrelation(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/portfolio/correlation", body);
    }

    @PostMapping("/advanced/portfolio/version")
    public ResponseEntity<?> version(@RequestBody Map<String, Object> body) {
        return proxy("/ml/advanced/portfolio/version", body);
    }

    // ── Records ──────────────────────────────────────────────────────────────
    public record AtrRequest(List<Double> prices, double entryPrice, String tradeType) {}
}
