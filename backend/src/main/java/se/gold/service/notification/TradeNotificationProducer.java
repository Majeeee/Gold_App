package se.gold.service.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import se.gold.config.RabbitMQConfig;
import se.gold.model.Trade;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Publishes trade lifecycle events to RabbitMQ.
 * Fails gracefully if the broker is unavailable — the trade is still saved.
 */
@Service
@Slf4j
public class TradeNotificationProducer {

    @Autowired(required = false)
    private RabbitTemplate rabbitTemplate;

    public void tradeOpened(Trade trade) {
        publish("trade.opened", buildPayload("OPENED", trade));
    }

    public void tradeClosed(Trade trade) {
        publish("trade.closed", buildPayload("CLOSED", trade));
    }

    public void tradeDeleted(long tradeId, String userEmail) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("event",     "DELETED");
        payload.put("tradeId",   tradeId);
        payload.put("userEmail", userEmail);
        payload.put("timestamp", LocalDateTime.now().toString());
        publish("trade.deleted", payload);
    }

    private void publish(String routingKey, Map<String, Object> payload) {
        if (rabbitTemplate == null) {
            log.debug("RabbitMQ not configured — skipping event '{}'", routingKey);
            return;
        }
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, routingKey, payload);
            log.debug("Published '{}' for trade {}", routingKey, payload.get("tradeId"));
        } catch (AmqpException e) {
            log.warn("RabbitMQ unavailable — trade event '{}' not sent: {}", routingKey, e.getMessage());
        }
    }

    private Map<String, Object> buildPayload(String event, Trade trade) {
        Map<String, Object> m = new HashMap<>();
        m.put("event",       event);
        m.put("tradeId",     trade.getId());
        m.put("userEmail",   trade.getUser().getEmail());
        m.put("market",      trade.getMarket());
        m.put("type",        trade.getType());
        m.put("tradeType",   trade.getTradeType());
        m.put("status",      trade.getStatus());
        m.put("entryPrice",  trade.getEntryPrice());
        m.put("exitPrice",   trade.getExitPrice());
        m.put("quantity",    trade.getQuantity());
        m.put("pnl",         trade.getPnl());
        m.put("pnlPercent",  trade.getPnlPercent());
        m.put("timestamp",   LocalDateTime.now().toString());
        return m;
    }
}
