import { memo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useThemeColors, type ColorToken } from '@/app/providers/ThemeProvider';
import type { SeriesPoint } from '@/simulations/engine';

export interface SeriesConfig {
  key: string;
  label: string;
  color: ColorToken;
  /** Draw as a line instead of a filled area (used for thresholds). */
  dashed?: boolean;
}

interface LiveChartProps {
  data: SeriesPoint[];
  series: SeriesConfig[];
  height?: number;
  unit?: string;
  variant?: 'area' | 'line';
  yDomain?: [number | 'auto', number | 'auto'];
  formatValue?: (value: number) => string;
}

/**
 * Time-series chart for live simulation metrics. Colours are resolved from the
 * active theme so the chart looks right in both light and dark mode.
 */
export const LiveChart = memo(function LiveChart({
  data,
  series,
  height = 180,
  unit,
  variant = 'area',
  yDomain = [0, 'auto'],
  formatValue,
}: LiveChartProps) {
  const colors = useThemeColors();

  const axisProps = {
    stroke: colors.faint,
    tick: { fill: colors.faint, fontSize: 10 },
    tickLine: false,
    axisLine: false,
  } as const;

  const tooltip = (
    <Tooltip
      isAnimationActive={false}
      contentStyle={{
        background: colors.surface,
        border: `1px solid ${colors.line}`,
        borderRadius: 12,
        fontSize: 12,
        color: colors.ink,
      }}
      labelStyle={{ color: colors.faint, fontSize: 11 }}
      formatter={(value: number, name: string) => [
        formatValue ? formatValue(value) : `${Math.round(value * 10) / 10}${unit ? ` ${unit}` : ''}`,
        name,
      ]}
      labelFormatter={() => ''}
    />
  );

  const legend = series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11, color: colors.muted }} /> : null;

  if (variant === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={colors.line} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" {...axisProps} hide />
          <YAxis {...axisProps} domain={yDomain} width={48} />
          {tooltip}
          {legend}
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={colors[item.color]}
              strokeWidth={2}
              strokeDasharray={item.dashed ? '4 4' : undefined}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <defs>
          {series.map((item) => (
            <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[item.color]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colors[item.color]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={colors.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" {...axisProps} hide />
        <YAxis {...axisProps} domain={yDomain} width={48} />
        {tooltip}
        {legend}
        {series.map((item) => (
          <Area
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.label}
            stroke={colors[item.color]}
            strokeWidth={2}
            fill={`url(#fill-${item.key})`}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
});
