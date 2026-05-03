import { PricePoint, Tone } from "../types";
import { TONE_COLORS, formatChartTime } from "./chartUtils";

export function PriceLineChart({
  points,
  tone,
}: {
  points: PricePoint[];
  tone: Tone;
}) {
  const usable = points.filter((point) => point.close != null);
  if (usable.length < 2) {
    return null;
  }

  const closes = usable.map((point) => point.close as number);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const padding = (maxClose - minClose) * 0.06 || maxClose * 0.01 || 1;
  const yMin = minClose - padding;
  const yMax = maxClose + padding;
  const yRange = yMax - yMin || 1;

  const viewBoxWidth = 720;
  const viewBoxHeight = 340;
  const chartLeft = 52;
  const chartRight = viewBoxWidth - 10;
  const chartTop = 14;
  const chartBottom = viewBoxHeight - 26;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  const stepX = chartWidth / (usable.length - 1);
  const color = TONE_COLORS[tone];
  const gradientId = `chart-gradient-${tone}`;

  const pointToCoords = (point: PricePoint, index: number) => {
    const x = chartLeft + index * stepX;
    const y =
      chartTop + (1 - ((point.close as number) - yMin) / yRange) * chartHeight;
    return { x, y };
  };

  const linePath = usable
    .map((point, index) => {
      const { x, y } = pointToCoords(point, index);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPath = `${linePath} L ${chartRight.toFixed(2)} ${chartBottom.toFixed(2)} L ${chartLeft.toFixed(2)} ${chartBottom.toFixed(2)} Z`;

  const last = usable[usable.length - 1];
  const lastCoords = pointToCoords(last, usable.length - 1);

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label={`Line chart of close prices (${tone})`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <line
        x1={chartLeft}
        x2={chartRight}
        y1={chartTop}
        y2={chartTop}
        className="chart-grid"
      />
      <line
        x1={chartLeft}
        x2={chartRight}
        y1={chartTop + chartHeight / 2}
        y2={chartTop + chartHeight / 2}
        className="chart-grid"
      />
      <line
        x1={chartLeft}
        x2={chartRight}
        y1={chartBottom}
        y2={chartBottom}
        className="chart-grid"
      />

      <text
        x={chartLeft - 6}
        y={chartTop + 4}
        className="chart-label"
        textAnchor="end"
      >
        {maxClose.toFixed(2)}
      </text>
      <text
        x={chartLeft - 6}
        y={chartTop + chartHeight / 2 + 4}
        className="chart-label"
        textAnchor="end"
      >
        {((maxClose + minClose) / 2).toFixed(2)}
      </text>
      <text
        x={chartLeft - 6}
        y={chartBottom + 4}
        className="chart-label"
        textAnchor="end"
      >
        {minClose.toFixed(2)}
      </text>

      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={linePath}
        className="chart-line"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <circle
        cx={lastCoords.x}
        cy={lastCoords.y}
        r={4}
        fill={color}
        stroke="white"
        strokeWidth="2"
      />

      <text x={chartLeft} y={viewBoxHeight - 8} className="chart-label">
        {formatChartTime(usable[0].timestamp)}
      </text>
      <text
        x={chartRight}
        y={viewBoxHeight - 8}
        className="chart-label"
        textAnchor="end"
      >
        {formatChartTime(usable[usable.length - 1].timestamp)}
      </text>
    </svg>
  );
}
