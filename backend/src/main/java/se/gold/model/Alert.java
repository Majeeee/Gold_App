package se.gold.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "alerts")
@Data
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String market; // GLOBAL or IRAN

    @Column(nullable = false)
    private String condition; // ABOVE or BELOW

    @Column(nullable = false, precision = 20, scale = 4)
    private BigDecimal targetPrice;

    private String message;

    private boolean active = true;
    private boolean triggered = false;

    private LocalDateTime createdAt;
    private LocalDateTime triggeredAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
