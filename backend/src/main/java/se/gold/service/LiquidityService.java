package se.gold.service;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class LiquidityService {

    private final SimpMessagingTemplate messagingTemplate;
    private final RestTemplate restTemplate = new RestTemplate();

    private static final String DEPTH_URL =
            "https://api.binance.com/api/v3/depth?symbol=PAXGUSDT&limit=5";

    @Getter
    private volatile LiquiditySnapshot latest = null;

    @Scheduled(fixedDelay = 5000)
    public void fetchAndPush() {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = restTemplate.getForObject(DEPTH_URL, Map.class);
            if (body == null) return;

            @SuppressWarnings("unchecked")
            List<List<String>> asks = (List<List<String>>) body.get("asks");
            @SuppressWarnings("unchecked")
            List<List<String>> bids = (List<List<String>>) body.get("bids");

            if (asks == null || asks.isEmpty() || bids == null || bids.isEmpty()) return;

            double bestAsk = Double.parseDouble(asks.get(0).get(0));
            double bestBid = Double.parseDouble(bids.get(0).get(0));
            double spread  = bestAsk - bestBid;

            double askDepth = asks.stream()
                    .mapToDouble(l -> Double.parseDouble(l.get(1))).sum();
            double bidDepth = bids.stream()
                    .mapToDouble(l -> Double.parseDouble(l.get(1))).sum();

            latest = new LiquiditySnapshot(bestBid, bestAsk, spread, bidDepth, askDepth);
            messagingTemplate.convertAndSend("/topic/liquidity", latest);

        } catch (Exception e) {
            log.debug("Liquidity fetch error: {}", e.getMessage());
        }
    }

    public record LiquiditySnapshot(
            double bestBid,
            double bestAsk,
            double spread,
            double bidDepth,
            double askDepth
    ) {}
}
