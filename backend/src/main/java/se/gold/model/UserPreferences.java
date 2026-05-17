package se.gold.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "user_preferences")
@Data
public class UserPreferences {

    @Id
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "id")
    private User user;

    private String defaultMarket    = "GLOBAL";
    private String defaultTimeframe = "MID";
    private boolean emailAlerts     = true;
    private boolean telegramAlerts  = false;
    private boolean pushNotifications = true;
    private String currency         = "USD";
}
