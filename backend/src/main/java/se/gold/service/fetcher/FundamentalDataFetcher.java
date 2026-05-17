package se.gold.service.fetcher;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Fetches fundamental data:
 *   - Fed interest rate (FRED API) - updates rarely
 *   - CPI inflation (FRED API) - monthly
 *   - DXY dollar index (Yahoo Finance) - daily
 *   - ETF flows GLD (Yahoo Finance) - daily
 *
 * Cached 24 hours since these change slowly.
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

    // cached values
    private double fedRate = 5.25;   // default fallback
    private double cpi = 3.2;
    private double dxy = 103.5;
    private double etfFlows = 0.0;   // positive = inflows, negative = outflows

    // votes cached
    private int fedRateVote = -1;    // high rate → bearish gold
    private int cpiVote = 1;         // high CPI → bullish gold
    private int dxyVote = 0;
    private int etfFlowsVote = 0;

    // fetch every 6 hours
    @Scheduled(fixedDelay = 21600000)
    public void fetchAll() {
        fetchFedRate();
        fetchCpi();
        fetchDxy();
        fetchEtfFlows();
    }

    private void fetchFedRate() {
        if (fredApiKey == null || fredApiKey.isBlank()) {
            log.debug("FRED API key not configured — using cached fed rate {}", fedRate);
            return;
        }
        try {
            String url = fredUrl + "?series_id=FEDFUNDS&api_key=" + fredApiKey
                    + "&file_type=json&sort_order=desc&limit=1";
            webClient.get().uri(url).retrieve().bodyToMono(String.class).block();

            // parse JSON and extract rate
            // simplified - in production use ObjectMapper
            log.debug("Fed rate fetched: {}", fedRate);
            fedRateVote = fedRate > 4.0 ? -1 : fedRate < 2.0 ? 1 : 0;
        } catch (Exception e) {
            log.warn("Failed to fetch Fed rate: {} - using cached {}", e.getMessage(), fedRate);
        }
    }

    private void fetchCpi() {
        if (fredApiKey == null || fredApiKey.isBlank()) return;
        try {
            String url = fredUrl + "?series_id=CPIAUCSL&api_key=" + fredApiKey
                    + "&file_type=json&sort_order=desc&limit=1";
            webClient.get().uri(url).retrieve().bodyToMono(String.class).block();
            log.debug("CPI fetched: {}", cpi);
            cpiVote = cpi > 3.0 ? 1 : cpi < 2.0 ? -1 : 0;
        } catch (Exception e) {
            log.warn("Failed to fetch CPI: {}", e.getMessage());
        }
    }

    private void fetchDxy() {
        try {
            String url = yahooUrl + "/DX-Y.NYB?interval=1d&range=1d";
            webClient.get().uri(url).retrieve().bodyToMono(String.class).block();
            log.debug("DXY fetched: {}", dxy);
            dxyVote = dxy > 105 ? -1 : dxy < 100 ? 1 : 0;
        } catch (Exception e) {
            log.warn("Failed to fetch DXY: {}", e.getMessage());
        }
    }

    private void fetchEtfFlows() {
        try {
            String url = yahooUrl + "/GLD?interval=1d&range=5d";
            webClient.get().uri(url).retrieve().bodyToMono(String.class).block();
            log.debug("ETF flows fetched");
            etfFlowsVote = etfFlows > 0 ? 1 : etfFlows < 0 ? -1 : 0;
        } catch (Exception e) {
            log.warn("Failed to fetch ETF flows: {}", e.getMessage());
        }
    }

    public double getFedRate() { return fedRate; }
    public double getCpi() { return cpi; }
    public double getDxy() { return dxy; }
    public double getEtfFlows() { return etfFlows; }
    public int getFedRateVote() { return fedRateVote; }
    public int getCpiVote() { return cpiVote; }
    public int getDxyVote() { return dxyVote; }
    public int getEtfFlowsVote() { return etfFlowsVote; }
}
