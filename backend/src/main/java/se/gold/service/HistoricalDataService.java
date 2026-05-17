package se.gold.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import se.gold.dto.OhlcDto;

import java.time.*;
import java.time.LocalDate;
import java.util.*;

@Service
@Slf4j
public class HistoricalDataService {

    private final RestTemplate rest   = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    private volatile List<OhlcDto> globalHistory = Collections.emptyList();
    private volatile List<OhlcDto> iranHistory   = Collections.emptyList();

    @PostConstruct
    public void init() {
        refreshGlobal();
        refreshIran();
    }

    @Scheduled(cron = "0 0 6 * * *")
    public void scheduledRefresh() {
        refreshGlobal();
        refreshIran();
    }

    public List<OhlcDto> getGlobalHistory() { return globalHistory; }
    public List<OhlcDto> getIranHistory()   { return iranHistory; }

    private void refreshGlobal() {
        try {
            // Binance klines max 1000/request → two requests cover 5Y (1000+825 days)
            long day = 24 * 3600 * 1000L;
            long start1 = Instant.now().toEpochMilli() - 1825 * day;
            long start2 = start1 + 1000 * day;

            List<OhlcDto> data = new ArrayList<>();
            for (long startMs : new long[]{start1, start2}) {
                String url = "https://api.binance.com/api/v3/klines"
                           + "?symbol=PAXGUSDT&interval=1d&startTime=" + startMs + "&limit=1000";
                String json = rest.getForObject(url, String.class);
                if (json == null || json.isBlank()) continue;
                for (JsonNode c : mapper.readTree(json)) {
                    LocalDate date = Instant.ofEpochMilli(c.get(0).asLong())
                                            .atZone(ZoneOffset.UTC).toLocalDate();
                    double close  = c.get(4).asDouble();
                    double volume = c.get(5).asDouble();
                    if (close <= 0) continue;
                    data.add(new OhlcDto(date.toString(),
                        c.get(1).asDouble(), c.get(2).asDouble(),
                        c.get(3).asDouble(), close, volume));
                }
            }
            // deduplicate + sort
            Map<String, OhlcDto> deduped = new LinkedHashMap<>();
            data.stream().sorted(Comparator.comparing(OhlcDto::date))
                         .forEach(r -> deduped.put(r.date(), r));
            globalHistory = new ArrayList<>(deduped.values());
            log.info("Historical: loaded {} global PAXGUSDT OHLC candles (5Y)", globalHistory.size());
        } catch (Exception e) {
            log.error("Historical: failed to fetch global data: {}", e.getMessage());
        }
    }

    private void refreshIran() {
        try {
            String url = "https://api.tgju.org/v1/market/indicator/summary-table-data/geram18"
                       + "?draw=1&start=0&length=2000";
            String json = rest.getForObject(url, String.class);
            JsonNode root = mapper.readTree(json);
            JsonNode data = root.path("data");

            List<OhlcDto> result = new ArrayList<>();
            LocalDate cutoff = LocalDate.now().minusYears(5);
            LocalDate today  = LocalDate.now();

            if (data.isArray()) {
                for (int i = 0; i < data.size(); i++) {
                    JsonNode row = data.get(i);
                    try {
                        String raw = row.get(0).asText().replaceAll("[^0-9]", "");
                        if (raw.isEmpty()) continue;
                        double close = Double.parseDouble(raw);

                        // row[1] is Jalali date "1404/02/24"; fall back to index offset
                        LocalDate date;
                        String dateStr = row.size() > 1 ? row.get(1).asText() : "";
                        if (dateStr.matches("\\d{4}/\\d{2}/\\d{2}")) {
                            String[] pts = dateStr.split("/");
                            date = jalaliToGregorian(
                                Integer.parseInt(pts[0]),
                                Integer.parseInt(pts[1]),
                                Integer.parseInt(pts[2]));
                        } else {
                            date = today.minusDays(i);
                        }

                        if (date.isBefore(cutoff)) break;
                        result.add(new OhlcDto(date.toString(), close, close, close, close, 0));
                    } catch (Exception ignored) {}
                }
            }

            result.sort(Comparator.comparing(OhlcDto::date));
            // deduplicate by date
            Map<String, OhlcDto> deduped = new LinkedHashMap<>();
            result.forEach(r -> deduped.put(r.date(), r));
            iranHistory = new ArrayList<>(deduped.values());
            log.info("Historical: loaded {} Iran geram18 daily records (5Y)", iranHistory.size());
        } catch (Exception e) {
            log.error("Historical: failed to fetch Iran data: {}", e.getMessage());
        }
    }

    static LocalDate jalaliToGregorian(int jy, int jm, int jd) {
        int jy1 = jy - 979;
        int jd1 = jd - 1;
        int jDay = 365 * jy1 + (jy1 / 33) * 8 + (jy1 % 33 + 3) / 4;
        for (int i = 0; i < jm - 1; i++) jDay += (i < 6) ? 31 : 30;
        jDay += jd1;
        int gDay = jDay + 79;
        int gy = 1600 + 400 * (gDay / 146097);
        gDay %= 146097;
        boolean leap = false;
        if (gDay >= 36525) {
            gDay--;
            gy += 100 * (gDay / 36524);
            gDay %= 36524;
            if (gDay >= 365) gDay++;
            else leap = true;
        }
        gy += 4 * (gDay / 1461);
        gDay %= 1461;
        if (gDay >= 366) {
            leap = false;
            gDay--;
            gy += gDay / 365;
            gDay %= 365;
        }
        int[] months = {31, 28 + (leap ? 1 : 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
        int gm = 0;
        while (gm < 12 && gDay >= months[gm]) { gDay -= months[gm++]; }
        return LocalDate.of(gy, gm + 1, gDay + 1);
    }
}
