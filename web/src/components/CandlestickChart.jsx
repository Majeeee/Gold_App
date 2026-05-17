import { useEffect, useRef, useLayoutEffect } from 'react';
import { createChart } from 'lightweight-charts';

export default function CandlestickChart({ data, volumes, height = 500, onOhlcChange }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const candleRef    = useRef(null);
  const volRef       = useRef(null);
  const onOhlcRef    = useRef(onOhlcChange);
  const dataRef      = useRef(data);

  useEffect(() => { onOhlcRef.current = onOhlcChange; }, [onOhlcChange]);
  useEffect(() => { dataRef.current = data; },           [data]);

  // Create chart synchronously after DOM is painted — autoSize handles width automatically
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
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
        rightOffset:    5,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#b8860b99', labelBackgroundColor: '#1a1200' },
        horzLine: { color: '#b8860b99', labelBackgroundColor: '#1a1200' },
      },
    });

    const candle = chart.addCandlestickSeries({
      upColor:         '#22c55e',
      downColor:       '#ef4444',
      borderUpColor:   '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor:     '#22c55e',
      wickDownColor:   '#ef4444',
    });

    const vol = chart.addHistogramSeries({
      priceFormat:  { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chart.subscribeCrosshairMove(param => {
      const cb = onOhlcRef.current;
      if (!cb) return;
      if (param?.time) {
        const bar = param.seriesData?.get(candle);
        if (bar && 'open' in bar) { cb(bar); return; }
      }
      const d = dataRef.current;
      if (d?.length) cb(d[d.length - 1]);
      else cb(null);
    });

    chartRef.current  = chart;
    candleRef.current = candle;
    volRef.current    = vol;

    // Load data that may already be available
    const d = dataRef.current;
    if (d?.length) {
      try {
        candle.setData(d);
        chart.timeScale().fitContent();
        onOhlcRef.current?.(d[d.length - 1]);
      } catch (e) {
        console.error('[Chart] initial setData failed:', e.message);
      }
    }

    return () => {
      chart.remove();
      chartRef.current  = null;
      candleRef.current = null;
      volRef.current    = null;
    };
  }, [height]); // eslint-disable-line

  // Update candles when data prop changes
  useEffect(() => {
    const candle = candleRef.current;
    const chart  = chartRef.current;
    if (!candle || !chart) return;

    const d = data ?? [];
    console.log('[Chart] setData', d.length, 'candles');
    try {
      candle.setData(d);
    } catch (err) {
      console.error('[Chart] setData failed:', err.message, d.slice(0, 2));
      return;
    }
    if (d.length) {
      // Defer fitContent one frame so the chart has time to process new data
      requestAnimationFrame(() => chart.timeScale().fitContent());
      onOhlcChange?.(d[d.length - 1]);
    } else {
      onOhlcChange?.(null);
    }
  }, [data]); // eslint-disable-line

  // Update volumes
  useEffect(() => {
    if (!volRef.current || !volumes?.length) return;
    try { volRef.current.setData(volumes); } catch { /* ignore */ }
  }, [volumes]); // eslint-disable-line

  return (
    <div style={{ position: 'relative', width: '100%', height, background: '#0b0b14' }}>
      <div ref={containerRef} style={{ width: '100%', height }} />

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
          <span style={{ fontSize: 13 }}>Väntar på marknadsdata…</span>
          <span style={{ fontSize: 11, color: '#333' }}>Backend hämtar från Binance / TGJU</span>
        </div>
      )}

      {/* Debug badge — ta bort efter att chartet funkar */}
      {data && data.length > 0 && (
        <div style={{
          position: 'absolute', top: 6, left: 8, zIndex: 10,
          background: '#00000088', borderRadius: 4,
          padding: '2px 6px', fontSize: 10, color: '#888',
          pointerEvents: 'none',
        }}>
          {data.length} ljus
        </div>
      )}
    </div>
  );
}
