package se.gold.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "trades")
@Data
public class Trade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    // GLOBAL or IRAN
    private String market;

    // BUY or SELL
    private String type;

    // REAL, PAPER, MANUAL
    private String tradeType;

    // OPEN or CLOSED
    private String status;

    @Enumerated(EnumType.STRING)
    private Timeframe timeframe;

    @Column(precision = 20, scale = 4)
    private BigDecimal entryPrice;

    @Column(precision = 20, scale = 4)
    private BigDecimal exitPrice;

    @Column(precision = 20, scale = 6)
    private BigDecimal quantity;

    @Column(precision = 20, scale = 4)
    private BigDecimal stopLoss;

    @Column(precision = 20, scale = 4)
    private BigDecimal takeProfit;

    @Column(precision = 20, scale = 4)
    private BigDecimal pnl;

    private double pnlPercent;

    // signal that triggered this trade
    private String signalAtEntry;
    private int signalScore;

    private LocalDateTime openedAt;
    private LocalDateTime closedAt;

    @PrePersist
    public void prePersist() {
        openedAt = LocalDateTime.now();
    }
}
