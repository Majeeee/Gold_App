package se.gold.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "users")
@Data
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    // Iran or Sweden
    @Column(nullable = false)
    private String country = "IR";

    @Enumerated(EnumType.STRING)
    private Role role = Role.ROLE_USER;

    // disabled until admin activates
    private boolean enabled = false;

    // preferred timeframe
    @Enumerated(EnumType.STRING)
    private Timeframe defaultTimeframe = Timeframe.MID;

    // Telegram chat ID for notifications
    private String telegramChatId;

    // Binance API keys (encrypted)
    private String binanceApiKey;
    private String binanceSecretKey;
}
