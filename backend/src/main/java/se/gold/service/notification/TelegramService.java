package se.gold.service.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Sends Telegram messages via Bot API.
 * Works for both Iran and Sweden users.
 */
@Service
@Slf4j
public class TelegramService {

    @Value("${telegram.bot.token:}")
    private String botToken;

    private final WebClient webClient = WebClient.create("https://api.telegram.org");

    public void sendMessage(String chatId, String text) {
        if (chatId == null || chatId.isBlank()) return;
        if (botToken == null || botToken.isBlank()) {
            log.debug("Telegram bot token not configured — skipping message to {}", chatId);
            return;
        }
        try {
            String url = "/bot" + botToken + "/sendMessage";
            webClient.post()
                    .uri(url)
                    .bodyValue(new TelegramRequest(chatId, text, "HTML"))
                    .retrieve()
                    .bodyToMono(String.class)
                    .subscribe(
                            resp -> log.debug("Telegram sent to {}", chatId),
                            err  -> log.warn("Telegram error for {}: {}", chatId, err.getMessage())
                    );
        } catch (Exception e) {
            log.error("Failed to send Telegram message: {}", e.getMessage());
        }
    }

    public record TelegramRequest(String chat_id, String text, String parse_mode) {}
}
