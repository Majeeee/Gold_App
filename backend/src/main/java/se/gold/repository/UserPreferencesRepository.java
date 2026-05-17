package se.gold.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import se.gold.model.User;
import se.gold.model.UserPreferences;

import java.util.Optional;

public interface UserPreferencesRepository extends JpaRepository<UserPreferences, Long> {
    Optional<UserPreferences> findByUser(User user);
}
