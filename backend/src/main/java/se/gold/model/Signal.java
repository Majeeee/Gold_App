package se.gold.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "signals")
@Data
public class Signal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // GLOBAL or IRAN
    @Column(nullable = false)
    private String market;

    @Enumerated(EnumType.STRING)
    private Timeframe timeframe;

    // BUY, SELL, HOLD
    @Column(nullable = false)
    private String signal;

    // -10 to +10
    private int score;

    // individual indicator values & votes
    private double rsi;
    private Integer rsiVote;

    @Column(name = "macd")
    private double macdLine;
    private Integer macdVote;

    @Column(name = "bollinger_bands")
    private Integer bollingerVote;
    private String bollingerPosition;

    @Column(name = "trend")
    private double trendScore;
    private String trendName;
    private Integer trendVote;

    private double volume;
    private double supportResistance;
    private double maCross;

    @Column(name = "dxy")
    private double dxyVote;
    @Column(name = "fed_rate")
    private double fedRateVote;
    @Column(name = "cpi")
    private double cpiVote;
    @Column(name = "etf_flows")
    private double etfFlowsVote;
    @Column(name = "coin_bubble")
    private double coinBubbleVote;

    // ML predictions
    @Column(precision = 20, scale = 4)
    private BigDecimal lrPrediction;

    @Column(precision = 20, scale = 4)
    private BigDecimal lstmPrediction;

    @Column(precision = 20, scale = 4)
    private BigDecimal combinedPrediction;

    // price at signal time
    @Column(precision = 20, scale = 4)
    private BigDecimal priceAtSignal;

    private String reason;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
