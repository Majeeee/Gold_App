package se.gold.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import se.gold.model.Role;
import se.gold.model.User;
import se.gold.repository.UserRepository;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataLoader implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (!userRepository.existsByEmail("admin@gold.se")) {
            User admin = new User();
            admin.setEmail("admin@gold.se");
            admin.setPassword(passwordEncoder.encode("Admin123!"));
            admin.setFirstName("Admin");
            admin.setLastName("Gold");
            admin.setRole(Role.ROLE_ADMIN);
            admin.setEnabled(true);
            admin.setCountry("SE");
            userRepository.save(admin);
            log.info("Default admin created: admin@gold.se / Admin123!");
        }
    }
}
