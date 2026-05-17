package se.gold.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import se.gold.algorithm.SignalGenerator;
import se.gold.model.GoldPrice;
import se.gold.model.Signal;
import se.gold.model.Timeframe;
import se.gold.repository.GoldPriceRepository;
import se.gold.repository.SignalRepository;
import se.gold.service.fetcher.FundamentalDataFetcher;
import se.gold.service.ml.MlPredictionService;
import se.gold.service.notification.NotificationService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Runs algorithm every 5 minutes for all timeframes and both markets.
 * Detects direction changes and triggers notifications.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SignalService {

    private final GoldPriceRepository goldPriceRepository;
    private final SignalRepository signalRepository;
    private final FundamentalDataFetcher fundamentalFetcher;
    private final MlPredictionService mlService;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedDelay = 300000) // every 5 minutes
    public void runForAllTimeframes() {
        for (Timeframe tf : Timeframe.values()) {
            analyzeMarket("GLOBAL", tf);
            analyzeMarket("IRAN", tf);
        }
    }

    public SignalGenerator.SignalResult analyzeMarket(String market, Timeframe timeframe) {
        List<GoldPrice> prices = goldPriceRepository
                .findBySourceAndFetchedAtAfterOrderByFetchedAtAsc(
                        market, LocalDateTime.now().minusHours(48));

        if (prices.size() < 20) {
            log.debug("Not enough data for {} {} signal", market, timeframe);
            return null;
        }

        List<BigDecimal> priceValues = prices.stream()
                .map(p -> "GLOBAL".equals(market) ? p.getGlobalPriceUsd() : p.getIranPrice18k())
                .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
                .toList();

        if (priceValues.size() < 20) return null;

        // coin bubble vote (Iran only)
        double coinBubbleVote = "IRAN".equals(market) ? calculateCoinBubble() : 0;

        SignalGenerator.SignalInput input = SignalGenerator.SignalInput.builder()
                .prices(priceValues)
                .timeframe(timeframe)
                .dxyVote(fundamentalFetcher.getDxyVote())
                .fedRateVote(fundamentalFetcher.getFedRateVote())
                .cpiVote(fundamentalFetcher.getCpiVote())
                .etfFlowsVote(fundamentalFetcher.getEtfFlowsVote())
                .coinBubbleVote(coinBubbleVote)
                .build();

        SignalGenerator.SignalResult result = SignalGenerator.analyze(input);

        // ML prediction
        double currentPrice = priceValues.get(priceValues.size() - 1).doubleValue();
        MlPredictionService.PredictionResult prediction = mlService.predict(priceValues, timeframe, currentPrice);

        // save signal
        Signal signal = new Signal();
        signal.setMarket(market);
        signal.setTimeframe(timeframe);
        signal.setSignal(result.getSignal());
        signal.setScore(result.getScore());
        signal.setRsi(result.getRsi());
        signal.setRsiVote(result.getRsiVote());
        signal.setMacdLine(result.getMacdLine());
        signal.setMacdVote(result.getMacdVote());
        signal.setBollingerVote(result.getBollingerVote());
        signal.setBollingerPosition(result.getBollingerPosition());
        signal.setTrendScore(result.getTrendVote());
        signal.setTrendName(result.getTrend());
        signal.setTrendVote(result.getTrendVote());
        signal.setDxyVote(result.getDxyVote());
        signal.setFedRateVote(result.getFedRateVote());
        signal.setCpiVote(result.getCpiVote());
        signal.setEtfFlowsVote(result.getEtfFlowsVote());
        signal.setCoinBubbleVote(coinBubbleVote);
        signal.setLrPrediction(BigDecimal.valueOf(prediction.lrPrediction()));
        signal.setLstmPrediction(BigDecimal.valueOf(prediction.lstmPrediction()));
        signal.setCombinedPrediction(BigDecimal.valueOf(prediction.combinedPrediction()));
        signal.setPriceAtSignal(priceValues.get(priceValues.size() - 1));
        signal.setReason(result.getReason());
        signalRepository.save(signal);

        // push to mobile
        messagingTemplate.convertAndSend("/topic/signal/" + market.toLowerCase(), signal);

        // send notification for strong signals
        if (Math.abs(result.getScore()) >= 6) {
            notificationService.sendSignalAlert(market, result, prediction);
        }

        // check direction change
        checkDirectionChange(market, timeframe, currentPrice, prediction);

        log.info("{} {} signal: {} (score: {})", market, timeframe, result.getSignal(), result.getScore());
        return result;
    }

    private void checkDirectionChange(String market, Timeframe timeframe,
                                       double currentPrice, MlPredictionService.PredictionResult prediction) {
        if (prediction.planBroken()) {
            log.warn("Direction change detected! {} {} - deviation: {}%",
                    market, timeframe, String.format("%.1f", prediction.deviationPercent()));
            notificationService.sendDirectionChangeAlert(market, timeframe, currentPrice, prediction);
        }
    }

    private double calculateCoinBubble() {
        // coin bubble = (emami coin price / theoretical price based on gold)
        // if bubble > 10% → bearish (coin overvalued)
        // if bubble < 0%  → bullish (coin undervalued)
        return 0; // implement with TGJU data when available
    }
}
