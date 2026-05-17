package se.gold.config.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import org.springframework.lang.NonNull;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    @Value("${rate.limit.login.max}")
    private int maxAttempts;

    @Value("${rate.limit.login.window-seconds}")
    private int windowSeconds;

    // ip -> [count, windowStart]
    private final Map<String, long[]> attempts = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {

        if (!"/api/auth/login".equals(request.getRequestURI())) {
            chain.doFilter(request, response);
            return;
        }

        String ip = getClientIp(request);
        long now = System.currentTimeMillis();
        long windowMs = windowSeconds * 1000L;

        attempts.compute(ip, (k, v) -> {
            if (v == null || now - v[1] > windowMs) {
                return new long[]{1, now};
            }
            v[0]++;
            return v;
        });

        long[] data = attempts.get(ip);
        if (data[0] > maxAttempts) {
            response.setStatus(429);
            response.getWriter().write("{\"error\":\"Too many login attempts. Try again later.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        return xff != null ? xff.split(",")[0].trim() : request.getRemoteAddr();
    }
}
