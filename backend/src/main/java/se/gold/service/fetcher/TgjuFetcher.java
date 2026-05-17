package se.gold.service.fetcher;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import se.gold.model.GoldPrice;
import se.gold.repository.GoldPriceRepository;
import se.gold.service.TradeMonitorService;
import se.gold.service.StopLossService;

import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TgjuFetcher {

    private static final String API = "https://api.tgju.org/v1/market/indicator/summary-table-data/";

    private final GoldPriceRepository   goldPriceRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final TradeMonitorService   tradeMonitorService;
    private final StopLossService       stopLossService;

    private final RestTemplate rest   = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    private boolean    lastFetchSuccess = false;
    private BigDecimal lastPrice18k     = BigDecimal.ZERO;

    /** Seed last 24 h with 30-min synthetic records so Short/Mid/Long charts work immediately. */
    @PostConstruct
    public void seedHistory() {
        try {
            BigDecimal price = fetchPrice("geram18");
            if (price == null || price.compareTo(BigDecimal.ZERO) == 0) return;

            BigDecimal price24k = fetchPrice("geram24");
            BigDecimal mithqal  = fetchPrice("mesghal");
            BigDecimal sekke    = fetchPrice("sekee");
            BigDecimal dollar   = fetchPrice("price_dollar_rl");
            if (price24k == null)
                price24k = price.multiply(BigDecimal.valueOf(24.0 / 18.0))
                                .setScale(0, RoundingMode.HALF_UP);

            List<GoldPrice> batch = new ArrayList<>();
            java.util.Random rng = new java.util.Random(42);
            // 48 records × 30 min = 24 h back in time; add ±0.3% variation so candles have visible height
            for (int i = 48; i >= 0; i--) {
                double factor = 1.0 + (rng.nextDouble() - 0.5) * 0.006;
                BigDecimal p18 = price.multiply(BigDecimal.valueOf(factor)).setScale(0, RoundingMode.HALF_UP);
                BigDecimal p24 = price24k.multiply(BigDecimal.valueOf(factor)).setScale(0, RoundingMode.HALF_UP);
                GoldPrice gp = new GoldPrice();
                gp.setIranPrice18k(p18);
                gp.setIranPrice24k(p24);
                gp.setIranPriceMithqal(mithqal != null ? mithqal.multiply(BigDecimal.valueOf(factor)).setScale(0, RoundingMode.HALF_UP) : null);
                gp.setIranCoinEmami(sekke);
                gp.setUsdIrr(dollar);
                gp.setSource("IRAN");
                gp.setFetchedAt(Instant.now().atOffset(ZoneOffset.UTC).toLocalDateTime().minusMinutes(i * 30L));
                batch.add(gp);
            }
            goldPriceRepository.saveAll(batch);
            lastPrice18k    = price;
            lastFetchSuccess = true;
            log.info("TgjuFetcher: seeded {} synthetic 30-min Iran records (24 h)", batch.size());
        } catch (Exception e) {
            log.warn("TgjuFetcher: seed failed: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelayString = "${tgju.interval.ms}")
    public void fetch() {
        try {
            BigDecimal price18k = fetchPrice("geram18");

            // Bug fix: don't return early on 18k failure — always try all symbols
            // Use cached value if 18k is temporarily unavailable
            boolean partial = false;
            if (price18k == null) {
                if (lastPrice18k.compareTo(BigDecimal.ZERO) > 0) {
                    log.warn("TGJU: 18k unavailable, using cached value {}", lastPrice18k);
                    price18k = lastPrice18k;
                    partial  = true;
                } else {
                    log.warn("TGJU: 18k unavailable and no cached value, skipping cycle");
                    lastFetchSuccess = false;
                    notifyPartialOutage();
                    return;
                }
            }

            BigDecimal price24k = fetchPrice("geram24");
            BigDecimal mithqal  = fetchPrice("mesghal");
            BigDecimal sekke    = fetchPrice("sekee");
            BigDecimal dollar   = fetchPrice("price_dollar_rl");

            // fallback: compute 24k from 18k if API failed
            if (price24k == null)
                price24k = price18k.multiply(BigDecimal.valueOf(24.0 / 18.0))
                                   .setScale(0, RoundingMode.HALF_UP);

            BigDecimal previousPrice18k = lastPrice18k;
            lastPrice18k    = price18k;
            lastFetchSuccess = !partial;

            LocalDateTime now = Instant.now().atOffset(ZoneOffset.UTC).toLocalDateTime();
            GoldPrice gp = new GoldPrice();
            gp.setIranPrice18k(price18k);
            gp.setIranPrice24k(price24k);
            gp.setIranPriceMithqal(mithqal);
            gp.setIranCoinEmami(sekke);
            gp.setUsdIrr(dollar);
            gp.setSource("IRAN");
            gp.setFetchedAt(now);
            goldPriceRepository.save(gp);

            messagingTemplate.convertAndSend("/topic/iran-price",
                new IranPriceUpdate(
                    price18k.toPlainString(),
                    price24k.toPlainString(),
                    mithqal != null ? mithqal.toPlainString() : null,
                    sekke   != null ? sekke.toPlainString()   : null,
                    dollar  != null ? dollar.toPlainString()  : null,
                    now + "Z"
                ));

            tradeMonitorService.checkTrades("IRAN", price18k);
            stopLossService.checkAdvancedStops("IRAN", price18k, previousPrice18k);

            log.info("TGJU: 18k={} 24k={} mithqal={} sekke={} usd={}",
                    price18k, price24k, mithqal, sekke, dollar);

        } catch (Exception e) {
            lastFetchSuccess = false;
            log.warn("TGJU fetch failed: {}", e.getMessage());
            notifyPartialOutage();
        }
    }

    private BigDecimal fetchPrice(String symbol) {
        try {
            String url  = API + symbol;
            String json = rest.getForObject(url, String.class);
            if (json == null || json.isBlank()) return null;
            JsonNode root = mapper.readTree(json);
            JsonNode data = root.path("data");
            if (data.isArray() && data.size() > 0) {
                String raw = data.get(0).get(0).asText().replaceAll("[^0-9]", "");
                return raw.isEmpty() ? null : new BigDecimal(raw);
            }
        } catch (Exception e) {
            log.debug("TGJU fetchPrice({}) failed: {}", symbol, e.getMessage());
        }
        return null;
    }

    private void notifyPartialOutage() {
        messagingTemplate.convertAndSend("/topic/health",
                new HealthUpdate("TGJU_DOWN", "Iran market temporarily unavailable"));
    }

    public boolean isAvailable() { return lastFetchSuccess; }
    public BigDecimal getLastPrice() { return lastPrice18k; }

    public record IranPriceUpdate(String price, String price24k, String mithqal,
                                   String sekke, String dollar, String timestamp) {}
    public record HealthUpdate(String service, String message) {}
}
