package se.gold.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import se.gold.algorithm.SignalGenerator;
import se.gold.model.Timeframe;
import se.gold.model.User;
import se.gold.repository.UserRepository;
import se.gold.service.ml.MlPredictionService;

import java.util.List;

/**
 * Routes notifications to Telegram and Email based on user country.
 * Iran  → Telegram only
 * Sweden → Telegram + Email
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final TelegramService telegramService;
    private final EmailService emailService;
    private final UserRepository userRepository;

    public void sendSignalAlert(String market,
                                 SignalGenerator.SignalResult result,
                                 MlPredictionService.PredictionResult prediction) {
        String emoji = result.getScore() >= 6 ? "🟢" : result.getScore() <= -6 ? "🔴" : "🟡";
        String message = buildSignalMessage(emoji, market, result, prediction);

        List<User> users = userRepository.findAll().stream()
                .filter(User::isEnabled)
                .toList();

        for (User user : users) {
            sendToUser(user, message, false);
        }
    }

    public void sendDirectionChangeAlert(String market, Timeframe timeframe,
                                          double currentPrice,
                                          MlPredictionService.PredictionResult prediction) {
        String message = String.format(
                "⚠️ Direction Change Alert!\n\n" +
                "Market: %s | Timeframe: %s\n" +
                "Current Price: %.2f\n" +
                "Was predicted: %.2f\n" +
                "Deviation: %.1f%%\n\n" +
                "New analysis running...",
                market, timeframe, currentPrice,
                prediction.combinedPrediction(),
                prediction.deviationPercent()
        );

        List<User> users = userRepository.findAll().stream()
                .filter(User::isEnabled)
                .toList();

        for (User user : users) {
            sendToUser(user, message, true);
        }
    }

    private void sendToUser(User user, String message, boolean urgent) {
        // Telegram for all users
        if (user.getTelegramChatId() != null) {
            telegramService.sendMessage(user.getTelegramChatId(), message);
        }

        // Email for Sweden users only
        if ("SE".equals(user.getCountry()) && (urgent || isImportantSignal(message))) {
            emailService.sendSignalEmail(user.getEmail(), "Gold App Signal", message);
        }
    }

    public void sendDirectMessage(String userEmail, String subject, String message) {
        userRepository.findByEmail(userEmail).ifPresent(user -> {
            if (user.getTelegramChatId() != null) {
                telegramService.sendMessage(user.getTelegramChatId(), message);
            }
            emailService.sendSignalEmail(userEmail, subject, message);
        });
    }

    private boolean isImportantSignal(String message) {
        return message.contains("STRONG") || message.contains("⚠️");
    }

    private String buildSignalMessage(String emoji, String market,
                                       SignalGenerator.SignalResult result,
                                       MlPredictionService.PredictionResult prediction) {
        return String.format(
                "%s %s · Score: %+d/10\n\n" +
                "Market: %s\n" +
                "RSI: %.1f | MACD: %s | Trend: %s\n" +
                "Bollinger: %s\n\n" +
                "Prediction (%s): %.2f\n\n" +
                "%s",
                emoji, result.getSignal(), result.getScore(),
                market,
                result.getRsi(),
                result.getMacdVote() > 0 ? "bullish ↑" : result.getMacdVote() < 0 ? "bearish ↓" : "neutral",
                result.getTrend(),
                result.getBollingerPosition(),
                prediction.timeframeLabel(), prediction.combinedPrediction(),
                result.getReason()
        );
    }
}
