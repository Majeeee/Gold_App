package se.gold.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import se.gold.model.Alert;
import se.gold.repository.AlertRepository;
import se.gold.service.notification.NotificationService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertService {

    private final AlertRepository       alertRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService   notificationService;

    public void checkAlerts(String market, BigDecimal currentPrice) {
        List<Alert> active = alertRepository.findByMarketAndActiveAndTriggeredFalse(market, true);
        for (Alert alert : active) {
            boolean hit = "ABOVE".equals(alert.getCondition())
                    ? currentPrice.compareTo(alert.getTargetPrice()) >= 0
                    : currentPrice.compareTo(alert.getTargetPrice()) <= 0;

            if (!hit) continue;

            alert.setTriggered(true);
            alert.setActive(false);
            alert.setTriggeredAt(LocalDateTime.now());
            alertRepository.save(alert);

            String userEmail = alert.getUser().getEmail();
            if (userEmail == null) continue;

            String msg = buildAlertMessage(alert, market, currentPrice);

            // Broadcast via WebSocket; payload contains userEmail so clients can filter
            messagingTemplate.convertAndSend(
                    "/topic/alerts",
                    new AlertEvent(alert.getId(), userEmail, market, msg, currentPrice.toPlainString()));

            // Push via Telegram + Email
            notificationService.sendDirectMessage(userEmail, "🔔 Gold Alert", msg);

            log.info("Alert triggered: user={} market={} condition={} price={}",
                    userEmail, market, alert.getCondition(), currentPrice);
        }
    }

    private String buildAlertMessage(Alert alert, String market, BigDecimal currentPrice) {
        String direction = "ABOVE".equals(alert.getCondition()) ? "above" : "below";
        String custom    = alert.getMessage() != null && !alert.getMessage().isBlank()
                ? "\n" + alert.getMessage() : "";
        return String.format("🔔 Price Alert — %s\n\nGold price is now %s your target of %s.\nCurrent: %s%s",
                market, direction, alert.getTargetPrice().toPlainString(),
                currentPrice.toPlainString(), custom);
    }

    public record AlertEvent(Long alertId, String userEmail, String market, String message, String price) {}
}
