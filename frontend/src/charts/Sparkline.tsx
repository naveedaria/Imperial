import { PricePoint, Tone } from "../types";
import { TONE_COLORS } from "./chartUtils";

export function Sparkline({
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

  const targetSamples = 28;
  const step = Math.max(1, Math.floor(usable.length / targetSamples));
  const samples: PricePoint[] = [];
  for (let i = 0; i < usable.length; i += step) {
    samples.push(usable[i]);
  }
  if (samples[samples.length - 1] !== usable[usable.length - 1]) {
    samples.push(usable[usable.length - 1]);
  }

  const closes = samples.map((point) => point.close as number);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const viewBoxWidth = 96;
  const viewBoxHeight = 28;
  const padY = 2;
  const usableHeight = viewBoxHeight - padY * 2;
  const stepX = viewBoxWidth / (samples.length - 1);

  const linePath = samples
    .map((point, index) => {
      const x = index * stepX;
      const y =
        padY + (1 - ((point.close as number) - min) / range) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-hidden="true"
    >
      <path
        d={linePath}
        fill="none"
        stroke={TONE_COLORS[tone]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
