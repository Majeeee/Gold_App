package se.gold.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.gold.model.Trade;
import se.gold.model.Timeframe;
import se.gold.model.User;
import se.gold.repository.TradeRepository;
import se.gold.repository.UserRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trades")
@RequiredArgsConstructor
public class TradeController {

    private final TradeRepository tradeRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getAllTrades(@AuthenticationPrincipal String email) {
        User user = userRepository.findByEmail(email).orElseThrow();
        List<Trade> trades = tradeRepository.findByUserOrderByOpenedAtDesc(user);
        return ResponseEntity.ok(trades);
    }

    @GetMapping("/open")
    public ResponseEntity<?> getOpenTrades(@AuthenticationPrincipal String email) {
        User user = userRepository.findByEmail(email).orElseThrow();
        List<Trade> trades = tradeRepository.findByUserAndStatusOrderByOpenedAtDesc(user, "OPEN");
        return ResponseEntity.ok(trades);
    }

    @PostMapping("/manual")
    public ResponseEntity<?> addManualTrade(
            @AuthenticationPrincipal String email,
            @RequestBody ManualTradeRequest req) {
        User user = userRepository.findByEmail(email).orElseThrow();

        // Bug fix: validate timeframe before valueOf to avoid 500
        Timeframe tf;
        try { tf = Timeframe.valueOf(req.timeframe().toUpperCase()); }
        catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid timeframe: " + req.timeframe()));
        }

        // Bug fix: validate numeric fields before BigDecimal conversion
        if (req.entryPrice() == null || req.quantity() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "entryPrice and quantity are required"));
        }
        BigDecimal entryPrice, quantity;
        try {
            entryPrice = new BigDecimal(req.entryPrice());
            quantity   = new BigDecimal(req.quantity());
            if (entryPrice.compareTo(BigDecimal.ZERO) <= 0 || quantity.compareTo(BigDecimal.ZERO) <= 0)
                throw new NumberFormatException("must be positive");
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid entryPrice or quantity"));
        }

        Trade trade = new Trade();
        trade.setUser(user);
        trade.setMarket(req.market());
        trade.setType(req.type());
        trade.setTradeType("MANUAL");
        trade.setStatus(req.status());
        trade.setTimeframe(tf);
        trade.setEntryPrice(entryPrice);
        trade.setQuantity(quantity);
        try {
            if (req.exitPrice() != null)  trade.setExitPrice(new BigDecimal(req.exitPrice()));
            if (req.stopLoss() != null)   trade.setStopLoss(new BigDecimal(req.stopLoss()));
            if (req.takeProfit() != null) trade.setTakeProfit(new BigDecimal(req.takeProfit()));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid optional price field"));
        }

        tradeRepository.save(trade);
        return ResponseEntity.ok(trade);
    }

    @PostMapping("/paper")
    public ResponseEntity<?> addPaperTrade(
            @AuthenticationPrincipal String email,
            @RequestBody ManualTradeRequest req) {
        User user = userRepository.findByEmail(email).orElseThrow();

        Timeframe tf;
        try { tf = Timeframe.valueOf(req.timeframe().toUpperCase()); }
        catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid timeframe: " + req.timeframe()));
        }

        if (req.entryPrice() == null || req.quantity() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "entryPrice and quantity are required"));
        }
        BigDecimal entryPrice, quantity;
        try {
            entryPrice = new BigDecimal(req.entryPrice());
            quantity   = new BigDecimal(req.quantity());
            if (entryPrice.compareTo(BigDecimal.ZERO) <= 0 || quantity.compareTo(BigDecimal.ZERO) <= 0)
                throw new NumberFormatException("must be positive");
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid entryPrice or quantity"));
        }

        Trade trade = new Trade();
        trade.setUser(user);
        trade.setMarket(req.market());
        trade.setType(req.type());
        trade.setTradeType("PAPER");
        trade.setStatus("OPEN");
        trade.setTimeframe(tf);
        trade.setEntryPrice(entryPrice);
        trade.setQuantity(quantity);
        try {
            if (req.stopLoss() != null)   trade.setStopLoss(new BigDecimal(req.stopLoss()));
            if (req.takeProfit() != null) trade.setTakeProfit(new BigDecimal(req.takeProfit()));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid optional price field"));
        }

        tradeRepository.save(trade);
        return ResponseEntity.ok(trade);
    }

    @PutMapping("/{id}/close")
    public ResponseEntity<?> closeTrade(
            @PathVariable long id,
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, String> body) {
        Trade trade = tradeRepository.findById(id).orElseThrow();

        if (!trade.getUser().getEmail().equals(email)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your trade"));
        }

        // Bug fix: null-check exitPrice before BigDecimal conversion
        String exitPriceStr = body.get("exitPrice");
        if (exitPriceStr == null || exitPriceStr.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "exitPrice is required"));
        }
        BigDecimal exitPrice;
        try { exitPrice = new BigDecimal(exitPriceStr); }
        catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid exitPrice"));
        }

        trade.setExitPrice(exitPrice);
        trade.setStatus("CLOSED");
        trade.setClosedAt(LocalDateTime.now());

        // Bug fix: BigDecimal precision for P&L
        BigDecimal diff       = exitPrice.subtract(trade.getEntryPrice());
        BigDecimal signedDiff = "SELL".equals(trade.getType()) ? diff.negate() : diff;
        BigDecimal pnl        = signedDiff.multiply(trade.getQuantity());
        double pnlPct         = signedDiff
                                    .divide(trade.getEntryPrice(), 6, RoundingMode.HALF_UP)
                                    .multiply(BigDecimal.valueOf(100))
                                    .doubleValue();

        trade.setPnl(pnl);
        trade.setPnlPercent(pnlPct);
        tradeRepository.save(trade);

        return ResponseEntity.ok(trade);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTrade(
            @PathVariable long id,
            @AuthenticationPrincipal String email) {
        Trade trade = tradeRepository.findById(id).orElseThrow();
        if (!trade.getUser().getEmail().equals(email)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your trade"));
        }
        tradeRepository.delete(trade);
        return ResponseEntity.ok(Map.of("message", "Trade deleted"));
    }

    public record ManualTradeRequest(
            String market, String type, String status, String timeframe,
            String entryPrice, String exitPrice, String quantity,
            String stopLoss, String takeProfit
    ) {}
}
