package se.gold.model;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ServiceHealth {
    private boolean internet;
    private boolean binance;
    private boolean tgju;
    private boolean fredApi;
    private boolean yahooFinance;
    private boolean database;
    private boolean telegram;

    // overall status: ONLINE, PARTIAL, OFFLINE
    private String overallStatus;

    private String message;
    private LocalDateTime checkedAt;

    public void calculateOverallStatus() {
        checkedAt = LocalDateTime.now();
        if (!internet) {
            overallStatus = "OFFLINE";
            message = "No internet connection · Showing cached prices";
        } else if (binance && tgju) {
            overallStatus = "ONLINE";
            message = "All services online · Live prices";
        } else if (!binance && !tgju) {
            overallStatus = "PARTIAL";
            message = "Both markets unavailable · Showing cached prices";
        } else if (!binance) {
            overallStatus = "PARTIAL";
            message = "Global market unavailable · Iran market live";
        } else if (!tgju) {
            overallStatus = "PARTIAL";
            message = "Iran market unavailable · Global prices live";
        } else {
            overallStatus = "PARTIAL";
            message = "Some services limited";
        }
    }
}
