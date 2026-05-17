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

    private BigDecimal lastPrice    = BigDecimal.ZERO;
    private int        heartbeatTick = 0;

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
                double open  = k.get(1).asDouble();
                double high  = k.get(2).asDouble();
                double low   = k.get(3).asDouble();
                double close = k.get(4).asDouble();
                if (close <= 0) continue;
                long openMs  = k.get(0).asLong();
                long closeMs = k.get(6).asLong();
                long midMs   = (openMs + closeMs) / 2;

                // Store open at kline open time
                GoldPrice gpO = new GoldPrice();
                gpO.setGlobalPriceUsd(BigDecimal.valueOf(open));
                gpO.setSource("GLOBAL");
                gpO.setFetchedAt(Instant.ofEpochMilli(openMs).atOffset(ZoneOffset.UTC).toLocalDateTime());
                batch.add(gpO);

                // Store high at midpoint (gives toCandles a proper high value)
                if (high > open + 0.0001) {
                    GoldPrice gpH = new GoldPrice();
                    gpH.setGlobalPriceUsd(BigDecimal.valueOf(high));
                    gpH.setSource("GLOBAL");
                    gpH.setFetchedAt(Instant.ofEpochMilli(midMs - 5000).atOffset(ZoneOffset.UTC).toLocalDateTime());
                    batch.add(gpH);
                }

                // Store low at midpoint (gives toCandles a proper low value)
                if (low < open - 0.0001) {
                    GoldPrice gpL = new GoldPrice();
                    gpL.setGlobalPriceUsd(BigDecimal.valueOf(low));
                    gpL.setSource("GLOBAL");
                    gpL.setFetchedAt(Instant.ofEpochMilli(midMs + 5000).atOffset(ZoneOffset.UTC).toLocalDateTime());
                    batch.add(gpL);
                }

                // Store close at kline close time
                GoldPrice gpC = new GoldPrice();
                gpC.setGlobalPriceUsd(BigDecimal.valueOf(close));
                gpC.setSource("GLOBAL");
                gpC.setFetchedAt(Instant.ofEpochMilli(closeMs).atOffset(ZoneOffset.UTC).toLocalDateTime());
                batch.add(gpC);
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

            LocalDateTime now = Instant.now().atOffset(ZoneOffset.UTC).toLocalDateTime();
            GoldPrice gp = new GoldPrice();
            gp.setGlobalPriceUsd(price);
            gp.setSource("GLOBAL");
            gp.setFetchedAt(now);
            goldPriceRepository.save(gp);

            messagingTemplate.convertAndSend("/topic/global-price",
                new PriceUpdate("GLOBAL", price.toPlainString(), now + "Z"));

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
        if (lastPrice.compareTo(BigDecimal.ZERO) == 0) return;
        heartbeatTick++;
        LocalDateTime now = Instant.now().atOffset(ZoneOffset.UTC).toLocalDateTime();
        // Persist price to DB every 60 s even when price unchanged (keeps chart history alive)
        if (heartbeatTick % 6 == 0) {
            GoldPrice gp = new GoldPrice();
            gp.setGlobalPriceUsd(lastPrice);
            gp.setSource("GLOBAL");
            gp.setFetchedAt(now);
            goldPriceRepository.save(gp);
        }
        messagingTemplate.convertAndSend("/topic/global-price",
            new PriceUpdate("GLOBAL", lastPrice.toPlainString(), now + "Z"));
    }

    public boolean isConnected() { return lastPrice.compareTo(BigDecimal.ZERO) > 0; }
    public BigDecimal getLastPrice() { return lastPrice; }

    public record PriceUpdate(String market, String price, String timestamp) {}
}
