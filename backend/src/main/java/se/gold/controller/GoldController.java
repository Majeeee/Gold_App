package se.gold.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import se.gold.algorithm.SignalGenerator;
import se.gold.model.GoldPrice;
import se.gold.model.Signal;
import se.gold.model.Timeframe;
import se.gold.repository.GoldPriceRepository;
import se.gold.repository.SignalRepository;
import se.gold.service.BacktestingService;
import se.gold.service.SignalService;
import se.gold.service.fetcher.BinanceFetcher;
import se.gold.service.fetcher.TgjuFetcher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/gold")
@RequiredArgsConstructor
public class GoldController {

    private final GoldPriceRepository goldPriceRepository;
    private final SignalRepository signalRepository;
    private final SignalService signalService;
    private final BacktestingService backtestingService;
    private final BinanceFetcher binanceFetcher;
    private final TgjuFetcher tgjuFetcher;

    // ── Current prices ────────────────────────────────────────

    @GetMapping("/price/global")
    public ResponseEntity<?> globalPrice() {
        Optional<GoldPrice> price = goldPriceRepository
                .findTopBySourceOrderByFetchedAtDesc("GLOBAL");
        if (price.isPresent()) return ResponseEntity.ok(price.get());
        // DB empty right after restart — return in-memory last price from fetcher
        BigDecimal last = binanceFetcher.getLastPrice();
        if (last.compareTo(BigDecimal.ZERO) > 0) {
            GoldPrice gp = new GoldPrice();
            gp.setGlobalPriceUsd(last);
            gp.setSource("GLOBAL");
            return ResponseEntity.ok(gp);
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/price/iran")
    public ResponseEntity<?> iranPrice() {
        Optional<GoldPrice> price = goldPriceRepository
                .findTopBySourceOrderByFetchedAtDesc("IRAN");
        return price.map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/prices/history")
    public ResponseEntity<?> priceHistory(
            @RequestParam String market,
            @RequestParam(defaultValue = "24") int hours) {
        List<GoldPrice> prices = goldPriceRepository
                .findBySourceAndFetchedAtAfterOrderByFetchedAtAsc(
                        market.toUpperCase(), LocalDateTime.now().minusHours(hours));
        return ResponseEntity.ok(prices);
    }

    // ── Signals ───────────────────────────────────────────────

    @GetMapping("/signal")
    public ResponseEntity<?> signal(
            @RequestParam String market,
            @RequestParam(defaultValue = "MID") String timeframe) {
        Timeframe tf;
        try { tf = Timeframe.valueOf(timeframe.toUpperCase()); }
        catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid timeframe: " + timeframe);
        }
        Optional<Signal> sig = signalRepository
                .findTopByMarketAndTimeframeOrderByCreatedAtDesc(market.toUpperCase(), tf);
        return sig.map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/signal/analyze")
    public ResponseEntity<?> analyzeNow(
            @RequestParam String market,
            @RequestParam(defaultValue = "MID") String timeframe) {
        Timeframe tf;
        try { tf = Timeframe.valueOf(timeframe.toUpperCase()); }
        catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid timeframe: " + timeframe);
        }
        SignalGenerator.SignalResult result = signalService.analyzeMarket(market.toUpperCase(), tf);
        return result != null ? ResponseEntity.ok(result)
                : ResponseEntity.noContent().build();
    }

    // ── Backtesting ───────────────────────────────────────────

    @GetMapping("/backtest")
    public ResponseEntity<?> backtest(
            @RequestParam String market,
            @RequestParam(defaultValue = "1") int months,
            @RequestParam(defaultValue = "1000") double capital,
            @RequestParam(defaultValue = "MID") String timeframe) {
        Timeframe tf;
        try { tf = Timeframe.valueOf(timeframe.toUpperCase()); }
        catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid timeframe: " + timeframe);
        }
        BacktestingService.BacktestResult result =
                backtestingService.run(market.toUpperCase(), months, capital, tf);
        return ResponseEntity.ok(result);
    }

    // ── Live status ───────────────────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<?> status() {
        return ResponseEntity.ok(Map.of(
                "binanceConnected", binanceFetcher.isConnected(),
                "lastGlobalPrice", binanceFetcher.getLastPrice(),
                "tgjuAvailable", tgjuFetcher.isAvailable(),
                "lastIranPrice", tgjuFetcher.getLastPrice()
        ));
    }
}
