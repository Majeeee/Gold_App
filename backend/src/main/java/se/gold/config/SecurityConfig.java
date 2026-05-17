package se.gold.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import se.gold.config.filter.JwtAuthFilter;
import se.gold.config.filter.RateLimitFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitFilter rateLimitFilter;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${spring.h2.console.enabled:false}")
    private boolean h2ConsoleEnabled;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> {
                // ── Public ──────────────────────────────────────────
                auth.requestMatchers("/api/auth/**").permitAll()
                    .requestMatchers("/api/health/**").permitAll()
                    .requestMatchers("/api/history/**").permitAll()
                    .requestMatchers("/api/gold/prices/history").permitAll()
                    .requestMatchers("/api/gold/price/**").permitAll()
                    .requestMatchers("/api/gold/signal").permitAll()
                    .requestMatchers("/api/gold/signal/analyze").permitAll()
                    .requestMatchers("/api/gold/status").permitAll()
                    .requestMatchers("/api/liquidity").permitAll()
                    .requestMatchers("/ws/**").permitAll()
                    .requestMatchers("/actuator/**").permitAll()
                    // ── Admin only ───────────────────────────────────
                    .requestMatchers("/api/admin/**").hasRole("ADMIN")
                    // ── Authenticated user endpoints ─────────────────
                    .requestMatchers("/api/gold/backtest").authenticated()
                    .requestMatchers("/api/trades/**").authenticated()
                    .requestMatchers("/api/stoploss/**").authenticated()
                    .requestMatchers("/api/alerts/**").authenticated()
                    .requestMatchers("/api/preferences/**").authenticated()
                    .requestMatchers("/api/ml/**").authenticated();
                // H2 console must be added BEFORE anyRequest()
                if (h2ConsoleEnabled) {
                    auth.requestMatchers("/h2-console/**").permitAll();
                }
                auth.anyRequest().authenticated();
            })
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        if (h2ConsoleEnabled) {
            http.headers(h -> h.frameOptions(f -> f.disable()));
        }

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
