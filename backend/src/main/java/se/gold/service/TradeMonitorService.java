package se.gold.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import se.gold.model.Trade;
import se.gold.repository.TradeRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TradeMonitorService {

    private final TradeRepository tradeRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public void checkTrades(String market, BigDecimal currentPrice) {
        List<Trade> openTrades = tradeRepository.findByStatusAndMarket("OPEN", market);
        for (Trade trade : openTrades) {
            String trigger = detectTrigger(trade, currentPrice);
            if (trigger != null) {
                closeTrade(trade, currentPrice, trigger);
            }
        }
    }

    private String detectTrigger(Trade trade, BigDecimal price) {
        boolean isBuy = "BUY".equals(trade.getType());

        if (trade.getStopLoss() != null) {
            boolean slHit = isBuy
                ? price.compareTo(trade.getStopLoss()) <= 0
                : price.compareTo(trade.getStopLoss()) >= 0;
            if (slHit) return "STOP_LOSS";
        }

        if (trade.getTakeProfit() != null) {
            boolean tpHit = isBuy
                ? price.compareTo(trade.getTakeProfit()) >= 0
                : price.compareTo(trade.getTakeProfit()) <= 0;
            if (tpHit) return "TAKE_PROFIT";
        }

        return null;
    }

    private void closeTrade(Trade trade, BigDecimal exitPrice, String trigger) {
        Long id = trade.getId();
        if (id == null) return;
        // Bug fix: re-fetch to guard against double-close with StopLossService
        Trade fresh = tradeRepository.findById(id).orElse(null);
        if (fresh == null || !"OPEN".equals(fresh.getStatus())) return;

        // Bug fix: null guard on entry price / quantity
        if (fresh.getEntryPrice() == null || fresh.getQuantity() == null) {
            log.warn("Trade #{} missing entryPrice or quantity, skipping close", fresh.getId());
            return;
        }

        fresh.setExitPrice(exitPrice);
        fresh.setStatus("CLOSED");
        fresh.setClosedAt(LocalDateTime.now());

        // Bug fix: use BigDecimal arithmetic throughout to preserve precision
        BigDecimal diff      = exitPrice.subtract(fresh.getEntryPrice());
        BigDecimal signedDiff = "BUY".equals(fresh.getType()) ? diff : diff.negate();
        BigDecimal pnl       = signedDiff.multiply(fresh.getQuantity());
        double pnlPct        = signedDiff
                                   .divide(fresh.getEntryPrice(), 6, RoundingMode.HALF_UP)
                                   .multiply(BigDecimal.valueOf(100))
                                   .doubleValue();

        fresh.setPnl(pnl);
        fresh.setPnlPercent(pnlPct);
        tradeRepository.save(fresh);

        log.info("Auto-closed trade #{} ({} {} {}) at {} via {} | PnL={}",
                fresh.getId(), fresh.getMarket(), fresh.getType(),
                fresh.getQuantity(), exitPrice, trigger, pnl);

        messagingTemplate.convertAndSend("/topic/trade-closed",
                new TradeClosedEvent(fresh.getId(), fresh.getMarket(), trigger,
                        exitPrice.toPlainString(), pnl.doubleValue()));
    }

    public record TradeClosedEvent(Long tradeId, String market, String trigger,
                                   String exitPrice, double pnl) {}
}
