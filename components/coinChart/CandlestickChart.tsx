import {
  computeCandleLayout,
  describeCandles,
  priceDomain,
  niceTicks,
  priceToY,
  formatAxisPrice,
  formatAxisTime,
  evenlySpacedIndices,
  type Candle,
} from '@/lib/candleChart';
import styles from './CandlestickChart.module.css';

const RIGHT_AXIS = 52;
const BOTTOM_AXIS = 22;
const X_LABEL_COUNT = 5;
const AXIS_FONT = 10;

interface CandlestickChartProps {
  candles: Candle[];
  width: number;
  height: number;
  days: number;
}

export default function CandlestickChart({
  candles,
  width,
  height,
  days,
}: CandlestickChartProps) {
  const plotWidth = Math.max(width - RIGHT_AXIS, 0);
  const plotHeight = Math.max(height - BOTTOM_AXIS, 0);

  const { min, max } = priceDomain(candles);
  const ticks = niceTicks(min, max, 5);
  const domain = { min: ticks[0], max: ticks[ticks.length - 1] };

  const layout = computeCandleLayout(
    candles,
    { width: plotWidth, height: plotHeight },
    domain,
  );
  const labelIdx = evenlySpacedIndices(candles.length, X_LABEL_COUNT);

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={describeCandles(candles, days)}
    >
      {/* Y gridlines + price labels (right axis) */}
      {ticks.map((t, i) => {
        const y = priceToY(t, domain, plotHeight);
        return (
          <g key={`y${i}`}>
            <line x1={0} y1={y} x2={plotWidth} y2={y} className={styles.grid} />
            <text
              x={plotWidth + 4}
              y={y + AXIS_FONT / 3}
              fontSize={AXIS_FONT}
              className={styles.label}
            >
              {formatAxisPrice(t)}
            </text>
          </g>
        );
      })}

      {/* Candles: wick (high–low line) + body (open–close rect) */}
      {layout.map((c, i) => (
        <g key={`c${i}`} className={c.up ? styles.up : styles.down}>
          <line
            x1={c.wickX}
            y1={c.wickTop}
            x2={c.wickX}
            y2={c.wickBottom}
            stroke="currentColor"
            strokeWidth={1}
          />
          <rect
            x={c.x}
            y={c.bodyY}
            width={c.bodyWidth}
            height={c.bodyHeight}
            fill="currentColor"
          />
        </g>
      ))}

      {/* X time labels */}
      {labelIdx.map((idx) => {
        const c = layout[idx];
        if (!c) return null;
        return (
          <text
            key={`x${idx}`}
            x={c.wickX}
            y={height - 6}
            fontSize={AXIS_FONT}
            className={styles.label}
            textAnchor="middle"
          >
            {formatAxisTime(candles[idx].t, days)}
          </text>
        );
      })}
    </svg>
  );
}
