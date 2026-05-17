package se.gold.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import se.gold.model.GoldPrice;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface GoldPriceRepository extends JpaRepository<GoldPrice, Long> {
    Optional<GoldPrice> findTopBySourceOrderByFetchedAtDesc(String source);
    List<GoldPrice> findBySourceAndFetchedAtAfterOrderByFetchedAtAsc(String source, LocalDateTime after);
}
