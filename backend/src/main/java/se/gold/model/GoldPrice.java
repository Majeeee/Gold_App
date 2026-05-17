package se.gold.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "gold_prices")
@Data
public class GoldPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // global price USD per ounce (Binance)
    @Column(precision = 20, scale = 4)
    private BigDecimal globalPriceUsd;

    // Iran price IRR per gram 18k (TGJU)
    @Column(precision = 20, scale = 0)
    private BigDecimal iranPrice18k;

    // Iran price 24k per gram
    @Column(precision = 20, scale = 0)
    private BigDecimal iranPrice24k;

    // Iran price per mithqal
    @Column(precision = 20, scale = 0)
    private BigDecimal iranPriceMithqal;

    // Emami coin price
    @Column(precision = 20, scale = 0)
    private BigDecimal iranCoinEmami;

    // USD to IRR rate
    @Column(precision = 20, scale = 0)
    private BigDecimal usdIrr;

    // source: GLOBAL or IRAN
    @Column(nullable = false)
    private String source;

    @Column(nullable = false)
    private LocalDateTime fetchedAt;

    @PrePersist
    public void prePersist() {
        if (fetchedAt == null) fetchedAt = LocalDateTime.now();
    }
}
