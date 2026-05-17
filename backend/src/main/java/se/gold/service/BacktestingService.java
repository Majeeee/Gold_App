package se.gold.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import se.gold.algorithm.SignalGenerator;
import se.gold.model.GoldPrice;
import se.gold.model.Timeframe;
import se.gold.repository.GoldPriceRepository;
import se.gold.service.fetcher.FundamentalDataFetcher;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Simulates trading on historical data.
 * Returns profit/loss for given capital and period.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BacktestingService {

    private final GoldPriceRepository goldPriceRepository;
    private final FundamentalDataFetcher fundamentalFetcher;

    public record BacktestTrade(
            String type,        // BUY or SELL
            double entryPrice,
            double exitPrice,
            double quantity,
            double pnl,
            double pnlPercent,
            LocalDateTime openedAt,
            LocalDateTime closedAt
    ) {}

    public record BacktestResult(
            double initialCapital,
            double finalCapital,
            double totalPnl,
            double totalPnlPercent,
            int totalTrades,
            int winningTrades,
            int losingTrades,
            double winRate,
            double bestTrade,
            double worstTrade,
            List<BacktestTrade> trades,
            List<Double> capitalHistory,  // for chart
            String market,
            String period,
            Timeframe timeframe
    ) {}

    public BacktestResult run(String market, int months, double initialCapital, Timeframe timeframe) {
        int cappedMonths = Math.min(months, 12);
        LocalDateTime from = LocalDateTime.now().minusMonths(cappedMonths);
        List<GoldPrice> prices = goldPriceRepository
                .findBySourceAndFetchedAtAfterOrderByFetchedAtAsc(market, from);

        if (prices.size() < 30) {
            return emptyResult(market, months, initialCapital, timeframe);
        }

        List<BigDecimal> priceValues = prices.stream()
                .map(p -> "GLOBAL".equals(market) ? p.getGlobalPriceUsd() : p.getIranPrice18k())
                .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
                .toList();

        double capital = initialCapital;
        double position = 0; // quantity held
        double entryPrice = 0;
        String positionType = null;

        List<BacktestTrade> trades = new ArrayList<>();
        List<Double> capitalHistory = new ArrayList<>();
        capitalHistory.add(capital);

        double bestTrade = 0, worstTrade = 0;
        int wins = 0, losses = 0;

        // simulate trading with sliding window
        int windowSize = Math.min(50, priceValues.size() / 2);
        for (int i = windowSize; i < priceValues.size(); i++) {
            List<BigDecimal> window = priceValues.subList(i - windowSize, i);

            SignalGenerator.SignalInput input = SignalGenerator.SignalInput.builder()
                    .prices(window)
                    .timeframe(timeframe)
                    .dxyVote(fundamentalFetcher.getDxyVote())
                    .fedRateVote(fundamentalFetcher.getFedRateVote())
                    .cpiVote(fundamentalFetcher.getCpiVote())
                    .etfFlowsVote(fundamentalFetcher.getEtfFlowsVote())
                    .coinBubbleVote(0)
                    .build();

            SignalGenerator.SignalResult signal = SignalGenerator.analyze(input);
            double currentPrice = priceValues.get(i).doubleValue();

            // execute trade logic
            if (positionType == null && signal.getScore() >= 4) {
                // open BUY position
                position = capital / currentPrice;
                entryPrice = currentPrice;
                positionType = "BUY";
                capital = 0;

            } else if ("BUY".equals(positionType) && signal.getScore() <= -3) {
                // close BUY position
                double exitValue = position * currentPrice;
                double pnl = exitValue - (position * entryPrice);
                double pnlPct = (currentPrice - entryPrice) / entryPrice * 100;

                trades.add(new BacktestTrade(
                        "BUY", entryPrice, currentPrice, position,
                        pnl, pnlPct,
                        prices.get(i - 1).getFetchedAt(),
                        prices.get(i).getFetchedAt()
                ));

                capital = exitValue;
                if (pnl > 0) wins++; else losses++;
                bestTrade = Math.max(bestTrade, pnlPct);
                worstTrade = Math.min(worstTrade, pnlPct);
                position = 0;
                positionType = null;
            }

            capitalHistory.add(capital + position * currentPrice);
        }

        // close any open position at end
        if (positionType != null && priceValues.size() > 0) {
            double lastPrice = priceValues.get(priceValues.size() - 1).doubleValue();
            capital = position * lastPrice;
        }

        double totalPnl = capital - initialCapital;
        double totalPnlPct = totalPnl / initialCapital * 100;
        double winRate = trades.isEmpty() ? 0 : (double) wins / trades.size() * 100;

        return new BacktestResult(
                initialCapital, capital, totalPnl, totalPnlPct,
                trades.size(), wins, losses, winRate,
                bestTrade, worstTrade, trades, capitalHistory,
                market, months + " months", timeframe
        );
    }

    private BacktestResult emptyResult(String market, int months,
                                        double capital, Timeframe timeframe) {
        return new BacktestResult(capital, capital, 0, 0,
                0, 0, 0, 0, 0, 0,
                List.of(), List.of(capital),
                market, months + " months", timeframe);
    }
}
