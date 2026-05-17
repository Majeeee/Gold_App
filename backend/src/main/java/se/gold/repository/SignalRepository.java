package se.gold.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import se.gold.model.Signal;
import se.gold.model.Timeframe;
import java.util.Optional;

public interface SignalRepository extends JpaRepository<Signal, Long> {
    Optional<Signal> findTopByMarketAndTimeframeOrderByCreatedAtDesc(String market, Timeframe timeframe);
}
