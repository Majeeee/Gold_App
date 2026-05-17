package se.gold.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import se.gold.model.Alert;
import se.gold.model.User;

import java.util.List;

public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findByUserOrderByCreatedAtDesc(User user);
    List<Alert> findByActiveAndTriggeredFalse(boolean active);
    List<Alert> findByMarketAndActiveAndTriggeredFalse(String market, boolean active);
}
