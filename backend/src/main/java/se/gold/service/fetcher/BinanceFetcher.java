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
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BinanceFetcher {

    private static final String URL =
        "https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT";

    private final GoldPriceRepository  goldPriceRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final TradeMonitorService  tradeMonitorService;
    private final StopLossService      stopLossService;
    private final se.gold.service.AlertService alertService;

    private final RestTemplate rest   = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    private BigDecimal lastPrice = BigDecimal.ZERO;

    /** Seed last 24 h of 1-minute closes so Short/Mid/Long charts have data immediately. */
    @PostConstruct
    public void seedHistory() {
        try {
            long now   = System.currentTimeMillis();
            long start = now - 24L * 3600 * 1000;
            String url = "https://api.binance.com/api/v3/klines"
                       + "?symbol=PAXGUSDT&interval=1m&startTime=" + start
                       + "&endTime=" + now + "&limit=1000";
            String json = rest.getForObject(url, String.class);
            if (json == null || json.isBlank()) return;

            List<GoldPrice> batch = new ArrayList<>();
            for (com.fasterxml.jackson.databind.JsonNode k : mapper.readTree(json)) {
                double close = k.get(4).asDouble();
                if (close <= 0) continue;
                LocalDateTime ts = Instant.ofEpochMilli(k.get(6).asLong())
                                          .atOffset(ZoneOffset.UTC).toLocalDateTime();
                GoldPrice gp = new GoldPrice();
                gp.setGlobalPriceUsd(BigDecimal.valueOf(close));
                gp.setSource("GLOBAL");
                gp.setFetchedAt(ts);
                batch.add(gp);
            }
            goldPriceRepository.saveAll(batch);
            lastPrice = batch.isEmpty() ? BigDecimal.ZERO
                      : batch.get(batch.size() - 1).getGlobalPriceUsd();
            log.info("BinanceFetcher: seeded {} 1-min price records (24 h)", batch.size());
        } catch (Exception e) {
            log.warn("BinanceFetcher: seed failed: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 2000)
    public void poll() {
        try {
            String json  = rest.getForObject(URL, String.class);
            if (json == null) return;
            JsonNode node  = mapper.readTree(json);
            BigDecimal price = new BigDecimal(node.get("price").asText());

            if (price.compareTo(lastPrice) == 0) {
                // price unchanged — still heartbeat every 10th poll (~20s)
                return;
            }

            BigDecimal previousPrice = lastPrice;
            lastPrice = price;

            GoldPrice gp = new GoldPrice();
            gp.setGlobalPriceUsd(price);
            gp.setSource("GLOBAL");
            goldPriceRepository.save(gp);

            messagingTemplate.convertAndSend("/topic/global-price",
                new PriceUpdate("GLOBAL", price.toPlainString(), LocalDateTime.now().toString()));

            tradeMonitorService.checkTrades("GLOBAL", price);
            stopLossService.checkAdvancedStops("GLOBAL", price, previousPrice);
            alertService.checkAlerts("GLOBAL", price);

            log.info("Binance: PAXGUSDT={}", price);

        } catch (Exception e) {
            log.warn("Binance poll failed: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 10000)
    public void heartbeat() {
        if (lastPrice.compareTo(BigDecimal.ZERO) > 0) {
            messagingTemplate.convertAndSend("/topic/global-price",
                new PriceUpdate("GLOBAL", lastPrice.toPlainString(), LocalDateTime.now().toString()));
        }
    }

    public boolean isConnected() { return lastPrice.compareTo(BigDecimal.ZERO) > 0; }
    public BigDecimal getLastPrice() { return lastPrice; }

    public record PriceUpdate(String market, String price, String timestamp) {}
}
