package se.gold.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.gold.service.HistoricalDataService;

@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
public class HistoricalController {

    private final HistoricalDataService historicalDataService;

    @GetMapping
    public ResponseEntity<?> getHistory(@RequestParam String market) {
        return switch (market.toUpperCase()) {
            case "GLOBAL" -> ResponseEntity.ok(historicalDataService.getGlobalHistory());
            case "IRAN"   -> ResponseEntity.ok(historicalDataService.getIranHistory());
            default       -> ResponseEntity.badRequest().body("Unknown market: " + market);
        };
    }
}
