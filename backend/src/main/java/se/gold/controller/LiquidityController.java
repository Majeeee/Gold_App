package se.gold.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import se.gold.service.LiquidityService;

@RestController
@RequestMapping("/api/liquidity")
@RequiredArgsConstructor
public class LiquidityController {

    private final LiquidityService liquidityService;

    @GetMapping
    public ResponseEntity<?> getLiquidity() {
        LiquidityService.LiquiditySnapshot snap = liquidityService.getLatest();
        if (snap == null) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(snap);
    }
}
