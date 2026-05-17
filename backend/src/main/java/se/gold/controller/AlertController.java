package se.gold.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.gold.model.Alert;
import se.gold.model.User;
import se.gold.repository.AlertRepository;
import se.gold.repository.UserRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertRepository alertRepository;
    private final UserRepository  userRepository;

    @GetMapping
    public ResponseEntity<?> getAlerts(@AuthenticationPrincipal String email) {
        User user = userRepository.findByEmail(email).orElseThrow();
        List<Alert> alerts = alertRepository.findByUserOrderByCreatedAtDesc(user);
        return ResponseEntity.ok(alerts);
    }

    @PostMapping
    public ResponseEntity<?> createAlert(
            @AuthenticationPrincipal String email,
            @RequestBody AlertRequest req) {
        User user = userRepository.findByEmail(email).orElseThrow();

        if (req.targetPrice() == null || req.market() == null || req.condition() == null)
            return ResponseEntity.badRequest().body(Map.of("error", "market, condition and targetPrice are required"));

        if (!req.condition().equals("ABOVE") && !req.condition().equals("BELOW"))
            return ResponseEntity.badRequest().body(Map.of("error", "condition must be ABOVE or BELOW"));

        Alert alert = new Alert();
        alert.setUser(user);
        alert.setMarket(req.market().toUpperCase());
        alert.setCondition(req.condition().toUpperCase());
        alert.setTargetPrice(new BigDecimal(req.targetPrice()));
        alert.setMessage(req.message());
        alertRepository.save(alert);
        return ResponseEntity.ok(alert);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAlert(
            @PathVariable long id,
            @AuthenticationPrincipal String email) {
        Alert alert = alertRepository.findById(id).orElse(null);
        if (alert == null) return ResponseEntity.notFound().build();
        if (!alert.getUser().getEmail().equals(email))
            return ResponseEntity.status(403).body(Map.of("error", "Not your alert"));
        alertRepository.delete(alert);
        return ResponseEntity.ok(Map.of("message", "Alert deleted"));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<?> toggleAlert(
            @PathVariable long id,
            @AuthenticationPrincipal String email) {
        Alert alert = alertRepository.findById(id).orElse(null);
        if (alert == null) return ResponseEntity.notFound().build();
        if (!alert.getUser().getEmail().equals(email))
            return ResponseEntity.status(403).body(Map.of("error", "Not your alert"));
        alert.setActive(!alert.isActive());
        alertRepository.save(alert);
        return ResponseEntity.ok(alert);
    }

    public record AlertRequest(String market, String condition, String targetPrice, String message) {}
}
