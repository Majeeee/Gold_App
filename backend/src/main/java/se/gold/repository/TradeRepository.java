package se.gold.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import se.gold.model.Trade;
import se.gold.model.User;
import java.util.List;

public interface TradeRepository extends JpaRepository<Trade, Long> {
    List<Trade> findByUserOrderByOpenedAtDesc(User user);
    List<Trade> findByUserAndStatusOrderByOpenedAtDesc(User user, String status);
    List<Trade> findByStatusAndMarket(String status, String market);
}
