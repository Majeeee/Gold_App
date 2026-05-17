package se.gold.algorithm;

import lombok.Builder;
import lombok.Data;
import se.gold.model.Timeframe;

import java.math.BigDecimal;
import java.util.List;

/**
 * Combines all 12 indicators into a final signal.
 * Score range: -10 to +10
 *
 * Technical (7):  RSI, MACD, Bollinger, Trend, Volume, Support/Resistance, MA Cross
 * Fundamental (5): DXY, Fed Rate, CPI, ETF Flows, Coin Bubble (Iran only)
 *
 * Score >= +6  → STRONG BUY
 * +3 to +5     → BUY
 * -2 to +2     → HOLD
 * -3 to -5     → SELL
 * <= -6        → STRONG SELL
 */
public class SignalGenerator {

    @Data
    @Builder
    public static class SignalInput {
        private List<BigDecimal> prices;
        private List<Double> volumes;
        private Timeframe timeframe;
        private double dxyVote;       // -1, 0, +1
        private double fedRateVote;   // -1, 0, +1
        private double cpiVote;       // -1, 0, +1
        private double etfFlowsVote;  // -1, 0, +1
        private double coinBubbleVote; // -1, 0, +1 (Iran only)
    }

    @Data
    @Builder
    public static class SignalResult {
        private String signal;         // STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
        private int score;
        private double rsi;
        private int rsiVote;
        private double macdLine;
        private double macdSignal;
        private int macdVote;
        private String bollingerPosition;
        private int bollingerVote;
        private String trend;
        private int trendVote;
        private int volumeVote;
        private String srPosition;
        private int srVote;
        private int maCrossVote;
        private double dxyVote;
        private double fedRateVote;
        private double cpiVote;
        private double etfFlowsVote;
        private double coinBubbleVote;
        private String reason;
    }

    public static SignalResult analyze(SignalInput input) {
        int[] periods = getPeriods(input.getTimeframe());
        int rsiPeriod = periods[0];
        int macdFast = periods[1], macdSlow = periods[2], macdSignal = periods[3];

        // ── Technical indicators ────────────────────────────
        double rsi = RsiCalculator.calculate(input.getPrices(), rsiPeriod);
        int rsiVote = RsiCalculator.vote(rsi);

        MacdCalculator.MacdResult macd = MacdCalculator.calculate(
                input.getPrices(), macdFast, macdSlow, macdSignal);
        int macdVote = MacdCalculator.vote(macd);

        BollingerCalculator.BollingerResult bb = BollingerCalculator.calculate(input.getPrices());
        int bbVote = BollingerCalculator.vote(bb);

        TrendDetector.Trend trend = TrendDetector.detect(input.getPrices());
        int trendVote = TrendDetector.vote(trend);

        int volumeVote = 0;
        if (input.getVolumes() != null && !input.getVolumes().isEmpty()) {
            List<Double> prices = input.getPrices().stream()
                    .map(BigDecimal::doubleValue).toList();
            volumeVote = VolumeAnalyzer.vote(input.getVolumes(), prices);
        }

        SupportResistanceCalculator.SRResult sr = SupportResistanceCalculator.calculate(input.getPrices());
        int srVote = SupportResistanceCalculator.vote(sr);

        int maCrossVote = MaCrossCalculator.vote(input.getPrices());

        // ── Fundamental indicators ──────────────────────────
        int dxyVoteInt = (int) Math.signum(-input.getDxyVote());   // inverse: high DXY = bearish gold
        int fedVoteInt = (int) Math.signum(-input.getFedRateVote()); // inverse: high rate = bearish gold
        int cpiVoteInt = (int) Math.signum(input.getCpiVote());    // direct: high CPI = bullish gold
        int etfVoteInt = (int) Math.signum(input.getEtfFlowsVote());
        int bubbleVoteInt = (int) Math.signum(input.getCoinBubbleVote());

        // ── Total score ─────────────────────────────────────
        int score = rsiVote + macdVote + bbVote + trendVote + volumeVote
                + srVote + maCrossVote + dxyVoteInt + fedVoteInt
                + cpiVoteInt + etfVoteInt + bubbleVoteInt;

        // clamp to -10 / +10
        score = Math.max(-10, Math.min(10, score));

        String signal = scoreToSignal(score);
        String reason = buildReason(rsi, rsiVote, macd, macdVote, trend, bb, score);

        return SignalResult.builder()
                .signal(signal).score(score)
                .rsi(rsi).rsiVote(rsiVote)
                .macdLine(macd.macdLine()).macdSignal(macd.signalLine()).macdVote(macdVote)
                .bollingerPosition(bb.position()).bollingerVote(bbVote)
                .trend(trend.name()).trendVote(trendVote)
                .volumeVote(volumeVote)
                .srPosition(sr.position()).srVote(srVote)
                .maCrossVote(maCrossVote)
                .dxyVote(input.getDxyVote()).fedRateVote(input.getFedRateVote())
                .cpiVote(input.getCpiVote()).etfFlowsVote(input.getEtfFlowsVote())
                .coinBubbleVote(input.getCoinBubbleVote())
                .reason(reason)
                .build();
    }

    private static String scoreToSignal(int score) {
        if (score >= 6) return "STRONG_BUY";
        if (score >= 3) return "BUY";
        if (score >= -2) return "HOLD";
        if (score >= -5) return "SELL";
        return "STRONG_SELL";
    }

    private static int[] getPeriods(Timeframe tf) {
        return switch (tf) {
            case SHORT -> new int[]{7, 6, 13, 5};
            case LONG  -> new int[]{21, 24, 52, 18};
            default    -> new int[]{14, 12, 26, 9};
        };
    }

    private static String buildReason(double rsi, int rsiVote,
                                       MacdCalculator.MacdResult macd, int macdVote,
                                       TrendDetector.Trend trend,
                                       BollingerCalculator.BollingerResult bb,
                                       int score) {
        StringBuilder sb = new StringBuilder();
        if (rsiVote == 1) sb.append("RSI oversold (").append(String.format("%.1f", rsi)).append("). ");
        else if (rsiVote == -1) sb.append("RSI overbought (").append(String.format("%.1f", rsi)).append("). ");
        if (macdVote == 1) sb.append("MACD bullish. ");
        else if (macdVote == -1) sb.append("MACD bearish. ");
        if (trend == TrendDetector.Trend.BULLISH) sb.append("Trend bullish. ");
        else if (trend == TrendDetector.Trend.BEARISH) sb.append("Trend bearish. ");
        if ("LOWER".equals(bb.position())) sb.append("Bollinger lower band. ");
        else if ("UPPER".equals(bb.position())) sb.append("Bollinger upper band. ");
        return sb.toString().trim();
    }
}
