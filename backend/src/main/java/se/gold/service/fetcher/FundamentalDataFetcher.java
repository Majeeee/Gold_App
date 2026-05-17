package se.gold.service.fetcher;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

/**
 * Fetches fundamental data:
 *   - Fed interest rate (FRED API) - updates rarely
 *   - CPI inflation (FRED API) - monthly
 *   - DXY dollar index (Yahoo Finance) - daily
 *   - ETF flows GLD (Yahoo Finance) - daily volume proxy
 *
 * Cached 6 hours since these change slowly.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FundamentalDataFetcher {

    @Value("${fred.api.key:}")
    private String fredApiKey;

    @Value("${fred.api.url:https://api.stlouisfed.org/fred/series/observations}")
    private String fredUrl;

    @Value("${yahoo.finance.url:https://query1.finance.yahoo.com/v8/finance/chart}")
    private String yahooUrl;

    private final WebClient webClient = WebClient.create();

    // cached values (sensible defaults so signals work before first fetch)
    private double fedRate   = 5.25;
    private double cpi       = 3.2;
    private double dxy       = 103.5;
    private double etfFlows  = 0.0;

    private int fedRateVote   = -1;
    private int cpiVote       = 1;
    private int dxyVote       = 0;
    private int etfFlowsVote  = 0;

    @Scheduled(fixedDelay = 21_600_000)
    public void fetchAll() {
        fetchFedRate();
        fetchCpi();
        fetchDxy();
        fetchEtfFlows();
    }

    // ── FRED: Fed Funds Rate ─────────────────────────────────────────────────
    @SuppressWarnings("unchecked")
    private void fetchFedRate() {
        if (fredApiKey == null || fredApiKey.isBlank()) {
            log.debug("FRED key missing — using cached fed rate {}", fedRate);
            return;
        }
        try {
            String url = fredUrl + "?series_id=FEDFUNDS&api_key=" + fredApiKey
                    + "&file_type=json&sort_order=desc&limit=1";
            Map<String, Object> resp = webClient.get().uri(url).retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {}).block();
            if (resp == null) return;

            List<Map<String, Object>> obs = (List<Map<String, Object>>) resp.get("observations");
            if (obs != null && !obs.isEmpty()) {
                String val = (String) obs.get(0).get("value");
                if (val != null && !val.equals(".")) {
                    fedRate = Double.parseDouble(val);
                    fedRateVote = fedRate > 4.0 ? -1 : fedRate < 2.0 ? 1 : 0;
                    log.debug("Fed rate updated: {}", fedRate);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch Fed rate: {} — using cached {}", e.getMessage(), fedRate);
        }
    }

    // ── FRED: CPI ────────────────────────────────────────────────────────────
    @SuppressWarnings("unchecked")
    private void fetchCpi() {
        if (fredApiKey == null || fredApiKey.isBlank()) return;
        try {
            String url = fredUrl + "?series_id=CPIAUCSL&api_key=" + fredApiKey
                    + "&file_type=json&sort_order=desc&limit=2";
            Map<String, Object> resp = webClient.get().uri(url).retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {}).block();
            if (resp == null) return;

            List<Map<String, Object>> obs = (List<Map<String, Object>>) resp.get("observations");
            if (obs != null && obs.size() >= 2) {
                String cur  = (String) obs.get(0).get("value");
                String prev = (String) obs.get(1).get("value");
                if (cur != null && !cur.equals(".") && prev != null && !prev.equals(".")) {
                    double curVal  = Double.parseDouble(cur);
                    double prevVal = Double.parseDouble(prev);
                    // Year-over-year approximation using MoM change * 12
                    cpi = (curVal - prevVal) / prevVal * 100 * 12;
                    cpiVote = cpi > 3.0 ? 1 : cpi < 2.0 ? -1 : 0;
                    log.debug("CPI annualised: {}%", String.format("%.2f", cpi));
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch CPI: {} — using cached {}", e.getMessage(), cpi);
        }
    }

    // ── Yahoo Finance: DXY ───────────────────────────────────────────────────
    @SuppressWarnings("unchecked")
    private void fetchDxy() {
        try {
            String url = yahooUrl + "/DX-Y.NYB?interval=1d&range=1d";
            Map<String, Object> resp = webClient.get().uri(url).retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {}).block();
            if (resp == null) return;

            Map<String, Object> chart = (Map<String, Object>) resp.get("chart");
            if (chart == null) return;
            List<Map<String, Object>> results = (List<Map<String, Object>>) chart.get("result");
            if (results == null || results.isEmpty()) return;

            Map<String, Object> meta = (Map<String, Object>) results.get(0).get("meta");
            if (meta != null && meta.get("regularMarketPrice") instanceof Number price) {
                dxy = price.doubleValue();
                dxyVote = dxy > 105 ? -1 : dxy < 100 ? 1 : 0;
                log.debug("DXY updated: {}", dxy);
            }
        } catch (Exception e) {
            log.warn("Failed to fetch DXY: {} — using cached {}", e.getMessage(), dxy);
        }
    }

    // ── Yahoo Finance: GLD ETF volume proxy for flows ────────────────────────
    @SuppressWarnings("unchecked")
    private void fetchEtfFlows() {
        try {
            String url = yahooUrl + "/GLD?interval=1d&range=10d";
            Map<String, Object> resp = webClient.get().uri(url).retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {}).block();
            if (resp == null) return;

            Map<String, Object> chart = (Map<String, Object>) resp.get("chart");
            if (chart == null) return;
            List<Map<String, Object>> results = (List<Map<String, Object>>) chart.get("result");
            if (results == null || results.isEmpty()) return;

            Map<String, Object> indicators = (Map<String, Object>) results.get(0).get("indicators");
            if (indicators == null) return;
            List<Map<String, Object>> quotes = (List<Map<String, Object>>) indicators.get("quote");
            if (quotes == null || quotes.isEmpty()) return;

            List<Number> volumes = (List<Number>) quotes.get(0).get("volume");
            List<Number> closes  = (List<Number>) quotes.get(0).get("close");
            if (volumes == null || volumes.size() < 2) return;

            double latestVol = volumes.get(volumes.size() - 1).doubleValue();
            double avgVol    = volumes.subList(0, volumes.size() - 1).stream()
                    .filter(v -> v != null)
                    .mapToDouble(Number::doubleValue).average().orElse(latestVol);

            double priceChange = 0;
            if (closes != null && closes.size() >= 2
                    && closes.get(closes.size() - 1) != null
                    && closes.get(closes.size() - 2) != null) {
                priceChange = closes.get(closes.size() - 1).doubleValue()
                        - closes.get(closes.size() - 2).doubleValue();
            }
            // positive = inflow (volume above avg + price up), negative = outflow
            etfFlows    = (latestVol - avgVol) * Math.signum(priceChange != 0 ? priceChange : 1);
            etfFlowsVote = etfFlows > 0 ? 1 : etfFlows < 0 ? -1 : 0;
            log.debug("ETF flows proxy: {} vol-diff, vote={}", String.format("%.0f", etfFlows), etfFlowsVote);
        } catch (Exception e) {
            log.warn("Failed to fetch ETF flows: {} — using cached {}", e.getMessage(), etfFlows);
        }
    }

    public double getFedRate()    { return fedRate; }
    public double getCpi()        { return cpi; }
    public double getDxy()        { return dxy; }
    public double getEtfFlows()   { return etfFlows; }
    public int getFedRateVote()   { return fedRateVote; }
    public int getCpiVote()       { return cpiVote; }
    public int getDxyVote()       { return dxyVote; }
    public int getEtfFlowsVote()  { return etfFlowsVote; }
}
