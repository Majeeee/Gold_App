package se.gold.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.gold.model.User;
import se.gold.model.UserPreferences;
import se.gold.repository.UserPreferencesRepository;
import se.gold.repository.UserRepository;


@RestController
@RequestMapping("/api/preferences")
@RequiredArgsConstructor
public class UserPreferencesController {

    private final UserPreferencesRepository prefsRepository;
    private final UserRepository            userRepository;

    @GetMapping
    public ResponseEntity<?> getPreferences(@AuthenticationPrincipal String email) {
        User user = userRepository.findByEmail(email).orElseThrow();
        UserPreferences prefs = prefsRepository.findByUser(user)
                .orElseGet(() -> createDefaults(user));
        return ResponseEntity.ok(prefs);
    }

    @PutMapping
    public ResponseEntity<?> updatePreferences(
            @AuthenticationPrincipal String email,
            @RequestBody PrefsRequest req) {
        User user = userRepository.findByEmail(email).orElseThrow();
        UserPreferences prefs = prefsRepository.findByUser(user)
                .orElseGet(() -> createDefaults(user));

        if (req.defaultMarket()    != null) prefs.setDefaultMarket(req.defaultMarket().toUpperCase());
        if (req.defaultTimeframe() != null) prefs.setDefaultTimeframe(req.defaultTimeframe().toUpperCase());
        if (req.currency()         != null) prefs.setCurrency(req.currency().toUpperCase());
        if (req.emailAlerts()      != null) prefs.setEmailAlerts(req.emailAlerts());
        if (req.telegramAlerts()   != null) prefs.setTelegramAlerts(req.telegramAlerts());
        if (req.pushNotifications() != null) prefs.setPushNotifications(req.pushNotifications());

        prefsRepository.save(prefs);
        return ResponseEntity.ok(prefs);
    }

    private UserPreferences createDefaults(User user) {
        UserPreferences p = new UserPreferences();
        p.setUser(user);
        UserPreferences saved = prefsRepository.save(p);
        return saved != null ? saved : p;
    }

    public record PrefsRequest(
            String defaultMarket, String defaultTimeframe, String currency,
            Boolean emailAlerts, Boolean telegramAlerts, Boolean pushNotifications
    ) {}
}
