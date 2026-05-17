import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function CandlestickChart({ data, volumes, height = 500, onOhlcChange }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const candleRef    = useRef(null);
  const volRef       = useRef(null);

  // Keep latest data/volumes in refs so the RAF can read them synchronously
  const dataRef    = useRef(data);
  const volumesRef = useRef(volumes);
  const ohlcCbRef  = useRef(onOhlcChange);
  useEffect(() => { dataRef.current    = data;          }, [data]);
  useEffect(() => { volumesRef.current = volumes;       }, [volumes]);
  useEffect(() => { ohlcCbRef.current  = onOhlcChange;  }, [onOhlcChange]);

  // Create chart after one animation frame so the container has its real width.
  // The `active` flag lets React Strict-Mode cleanup cancel the RAF safely.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let chart, candle, vol, ro;
    let active = true;

    const rafId = requestAnimationFrame(() => {
      if (!active || !containerRef.current) return;

      const w = containerRef.current.clientWidth
             || containerRef.current.getBoundingClientRect().width
             || 600;

      chart = createChart(containerRef.current, {
        width:  w,
        height,
        layout: {
          background: { color: '#0b0b14' },
          textColor:  '#9ca3af',
          fontSize:   11,
        },
        grid: {
          vertLines: { color: '#ffffff0d' },
          horzLines: { color: '#ffffff0d' },
        },
        rightPriceScale: {
          borderColor:  '#ffffff15',
          textColor:    '#9ca3af',
          scaleMargins: { top: 0.06, bottom: 0.22 },
        },
        timeScale: {
          borderColor:    '#ffffff15',
          timeVisible:    true,
          secondsVisible: false,
        },
        crosshair: {
          mode: 1,
          vertLine: { color: '#b8860b99', labelBackgroundColor: '#1a1200' },
          horzLine: { color: '#b8860b99', labelBackgroundColor: '#1a1200' },
        },
      });

      candle = chart.addCandlestickSeries({
        upColor:         '#22c55e',
        downColor:       '#ef4444',
        borderUpColor:   '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor:     '#22c55e',
        wickDownColor:   '#ef4444',
      });

      vol = chart.addHistogramSeries({
        priceFormat:  { type: 'volume' },
        priceScaleId: 'vol',
      });
      chart.priceScale('vol').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });

      chart.subscribeCrosshairMove(param => {
        const cb = ohlcCbRef.current;
        if (!cb) return;
        if (param?.time) {
          const bar = param.seriesData?.get(candle);
          if (bar && 'open' in bar) { cb(bar); return; }
        }
        // Crosshair left chart — fall back to last candle
        const d = dataRef.current;
        if (d?.length) cb(d[d.length - 1]);
        else cb(null);
      });

      chartRef.current  = chart;
      candleRef.current = candle;
      volRef.current    = vol;

      // Set whatever data is already available at creation time
      const d = dataRef.current;
      if (d?.length) {
        candle.setData(d);
        chart.timeScale().fitContent();
        ohlcCbRef.current?.(d[d.length - 1]);
      }
      const vols = volumesRef.current;
      if (vols?.length) vol.setData(vols);

      ro = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current);
    });

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      chart?.remove();
      chartRef.current  = null;
      candleRef.current = null;
      volRef.current    = null;
    };
  }, [height]); // eslint-disable-line

  // Update data after async fetch
  useEffect(() => {
    if (!candleRef.current) return;
    const d = data ?? [];
    candleRef.current.setData(d);
    if (d.length) {
      chartRef.current?.timeScale().fitContent();
      onOhlcChange?.(d[d.length - 1]);
    } else {
      onOhlcChange?.(null); // clear OHLC when no data (e.g. after timeframe switch)
    }
  }, [data]); // eslint-disable-line

  useEffect(() => {
    if (!volRef.current || !volumes?.length) return;
    volRef.current.setData(volumes);
  }, [volumes]); // eslint-disable-line

  return (
    <div style={{ position: 'relative', width: '100%', height, background: '#0b0b14' }}>
      <div ref={containerRef} style={{ width: '100%', height, display: 'block' }} />
      {(!data || data.length === 0) && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#555', gap: 8, pointerEvents: 'none',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span style={{ fontSize: 13 }}>Waiting for market data…</span>
          <span style={{ fontSize: 11, color: '#333' }}>Backend fetching from Binance / TGJU</span>
        </div>
      )}
    </div>
  );
}
