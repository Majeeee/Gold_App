package se.gold.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.gold.model.Trade;
import se.gold.repository.TradeRepository;
import se.gold.service.StopLossService;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/stoploss")
@RequiredArgsConstructor
public class StopLossController {

    private final TradeRepository tradeRepository;

    @GetMapping("/{tradeId}")
    public ResponseEntity<?> getStopLoss(
            @PathVariable long tradeId,
            @AuthenticationPrincipal String email) {
        Trade trade = tradeRepository.findById(tradeId).orElse(null);
        if (trade == null) return ResponseEntity.notFound().build();
        if (!trade.getUser().getEmail().equals(email))
            return ResponseEntity.status(403).body(Map.of("error", "Not your trade"));

        return ResponseEntity.ok(Map.of(
                "tradeId",    tradeId,
                "stopLoss",   trade.getStopLoss()   != null ? trade.getStopLoss().toPlainString()   : null,
                "takeProfit", trade.getTakeProfit()  != null ? trade.getTakeProfit().toPlainString() : null,
                "entryPrice", trade.getEntryPrice()  != null ? trade.getEntryPrice().toPlainString() : null,
                "type",       trade.getType()
        ));
    }

    @PutMapping("/{tradeId}")
    public ResponseEntity<?> updateStopLoss(
            @PathVariable long tradeId,
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, String> body) {
        Trade trade = tradeRepository.findById(tradeId).orElse(null);
        if (trade == null) return ResponseEntity.notFound().build();
        if (!trade.getUser().getEmail().equals(email))
            return ResponseEntity.status(403).body(Map.of("error", "Not your trade"));
        if (!"OPEN".equals(trade.getStatus()))
            return ResponseEntity.badRequest().body(Map.of("error", "Trade is not open"));

        try {
            if (body.containsKey("stopLoss") && body.get("stopLoss") != null)
                trade.setStopLoss(new BigDecimal(body.get("stopLoss")));
            if (body.containsKey("takeProfit") && body.get("takeProfit") != null)
                trade.setTakeProfit(new BigDecimal(body.get("takeProfit")));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid price value"));
        }

        tradeRepository.save(trade);
        return ResponseEntity.ok(Map.of(
                "tradeId",    tradeId,
                "stopLoss",   trade.getStopLoss()  != null ? trade.getStopLoss().toPlainString()  : null,
                "takeProfit", trade.getTakeProfit() != null ? trade.getTakeProfit().toPlainString() : null
        ));
    }

    @PostMapping("/calculate")
    public ResponseEntity<?> calculateStops(@RequestBody CalcRequest req) {
        if (req.prices() == null || req.prices().length < 2)
            return ResponseEntity.badRequest().body(Map.of("error", "Need at least 2 price points"));

        double[] stops = StopLossService.calculateAtrStops(req.prices(), req.entryPrice(), req.isBuy());
        return ResponseEntity.ok(Map.of(
                "stopLoss",   stops[0],
                "takeProfit", stops[1],
                "entryPrice", req.entryPrice()
        ));
    }

    public record CalcRequest(double[] prices, double entryPrice, boolean isBuy) {}
}
