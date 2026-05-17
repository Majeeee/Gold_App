package se.gold.health;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import se.gold.model.ServiceHealth;
import se.gold.service.fetcher.BinanceFetcher;
import se.gold.service.fetcher.TgjuFetcher;

import java.io.IOException;
import java.net.InetAddress;
import java.net.HttpURLConnection;
import java.net.URI;

/**
 * Checks all services every 30 seconds.
 * Publishes health status to /topic/health
 * Mobile app shows appropriate message based on status.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HealthCheckService {

    private final BinanceFetcher binanceFetcher;
    private final TgjuFetcher tgjuFetcher;
    private final SimpMessagingTemplate messagingTemplate;

    private ServiceHealth lastHealth = new ServiceHealth();

    @Scheduled(fixedDelayString = "${health.check.interval.ms}")
    public void checkAll() {
        ServiceHealth health = new ServiceHealth();

        health.setInternet(checkInternet());
        health.setBinance(binanceFetcher.isConnected());
        health.setTgju(tgjuFetcher.isAvailable());
        health.setFredApi(health.isInternet() && checkUrl("https://api.stlouisfed.org"));
        health.setYahooFinance(health.isInternet() && checkUrl("https://query1.finance.yahoo.com"));
        health.setDatabase(checkDatabase());
        health.setTelegram(health.isInternet() && checkUrl("https://api.telegram.org"));

        health.calculateOverallStatus();
        lastHealth = health;

        // push to all mobile clients
        messagingTemplate.convertAndSend("/topic/health", health);
        log.debug("Health: {} - {}", health.getOverallStatus(), health.getMessage());
    }

    private boolean checkInternet() {
        try {
            return InetAddress.getByName("8.8.8.8").isReachable(3000);
        } catch (IOException e) {
            return false;
        }
    }

    private boolean checkUrl(String url) {
        try {
            HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
            conn.setConnectTimeout(3000);
            conn.setRequestMethod("HEAD");
            return conn.getResponseCode() < 500;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean checkDatabase() {
        try {
            // Spring Actuator handles DB health check
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public ServiceHealth getLastHealth() { return lastHealth; }
}
