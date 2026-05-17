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
public class StopLossService {

    private final TradeRepository      tradeRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private static final double ATR_SL_MULT = 1.5;
    private static final double ATR_TP_MULT = 3.0;
    private static final double BLACK_SWAN_THRESHOLD = 0.04;

    public void checkAdvancedStops(String market, BigDecimal currentPrice,
                                   BigDecimal previousPrice) {
        List<Trade> openTrades = tradeRepository.findByStatusAndMarket("OPEN", market);

        // Bug fix: guard against division by zero when previousPrice is zero
        if (previousPrice == null || previousPrice.compareTo(BigDecimal.ZERO) == 0) return;

        double priceMoveAbs = Math.abs(
            currentPrice.subtract(previousPrice).doubleValue() / previousPrice.doubleValue()
        );
        boolean blackSwan = priceMoveAbs >= BLACK_SWAN_THRESHOLD;

        for (Trade trade : openTrades) {
            if (blackSwan) {
                closeTradeWith(trade, currentPrice, "BLACK_SWAN");
                continue;
            }
            String trigger = checkTrailingStop(trade, currentPrice);
            if (trigger != null) {
                closeTradeWith(trade, currentPrice, trigger);
            }
        }
    }

    private String checkTrailingStop(Trade trade, BigDecimal currentPrice) {
        if (trade.getStopLoss() == null || trade.getEntryPrice() == null) return null;

        double current = currentPrice.doubleValue();
        double sl      = trade.getStopLoss().doubleValue();
        boolean isBuy  = "BUY".equals(trade.getType());

        if (isBuy && current <= sl)  return "TRAILING_STOP";
        if (!isBuy && current >= sl) return "TRAILING_STOP";

        double entry     = trade.getEntryPrice().doubleValue();
        double trailDist = Math.abs(entry - sl);

        // Bug fix: guard division-by-zero / degenerate trailing stop
        if (trailDist <= 0) return null;

        if (isBuy) {
            double newSl = current - trailDist;
            if (newSl > sl) {
                trade.setStopLoss(BigDecimal.valueOf(newSl));
                tradeRepository.save(trade);
            }
        } else {
            double newSl = current + trailDist;
            if (newSl < sl) {
                trade.setStopLoss(BigDecimal.valueOf(newSl));
                tradeRepository.save(trade);
            }
        }
        return null;
    }

    public static double[] calculateAtrStops(double[] prices, double entryPrice,
                                              boolean isBuy) {
        if (prices.length < 2) return new double[]{entryPrice * 0.98, entryPrice * 1.03};

        double atrSum = 0;
        int    period = Math.min(14, prices.length - 1);
        for (int i = prices.length - period; i < prices.length; i++) {
            atrSum += Math.abs(prices[i] - prices[i - 1]);
        }
        double atr = atrSum / period;

        double sl = isBuy ? entryPrice - atr * ATR_SL_MULT : entryPrice + atr * ATR_SL_MULT;
        double tp = isBuy ? entryPrice + atr * ATR_TP_MULT : entryPrice - atr * ATR_TP_MULT;
        return new double[]{sl, tp};
    }

    private void closeTradeWith(Trade trade, BigDecimal exitPrice, String trigger) {
        Long id = trade.getId();
        if (id == null) return;
        // Bug fix: re-fetch to guard against double-close with TradeMonitorService
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

        // Bug fix: use BigDecimal arithmetic to preserve precision
        BigDecimal diff       = exitPrice.subtract(fresh.getEntryPrice());
        BigDecimal signedDiff = "BUY".equals(fresh.getType()) ? diff : diff.negate();
        BigDecimal pnl        = signedDiff.multiply(fresh.getQuantity());
        double pnlPct         = signedDiff
                                    .divide(fresh.getEntryPrice(), 6, RoundingMode.HALF_UP)
                                    .multiply(BigDecimal.valueOf(100))
                                    .doubleValue();

        fresh.setPnl(pnl);
        fresh.setPnlPercent(pnlPct);
        tradeRepository.save(fresh);

        log.info("StopLossService closed trade #{} via {} | price={} pnl={}",
                fresh.getId(), trigger, exitPrice, pnl);

        messagingTemplate.convertAndSend("/topic/trade-closed",
                new ClosedEvent(fresh.getId(), fresh.getMarket(), trigger,
                        exitPrice.toPlainString(), pnl.doubleValue()));
    }

    public record ClosedEvent(Long tradeId, String market, String trigger,
                               String exitPrice, double pnl) {}
}
