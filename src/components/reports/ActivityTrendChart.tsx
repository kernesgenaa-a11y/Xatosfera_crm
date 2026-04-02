import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ActivityPoint = {
  week: string;
  label: string;
  deals: number;
  viewings: number;
  properties: number;
  clients: number;
};

type Props = {
  data: ActivityPoint[];
  chartPalette: {
    deals: string;
    viewings: string;
    properties: string;
    clients: string;
  };
  metricLabels: Record<string, string>;
};

export function ActivityTrendChart({ data, chartPalette, metricLabels }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="dealsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartPalette.deals} stopOpacity={0.28} />
            <stop offset="100%" stopColor={chartPalette.deals} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={false}
          contentStyle={{
            background: '#111214',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            color: '#fff',
          }}
          labelFormatter={(label) => `Період: ${label}`}
          formatter={(value: number, name: string) => [value, metricLabels[name] ?? name]}
        />
        <Legend
          formatter={(value) => metricLabels[String(value)] ?? value}
          wrapperStyle={{ color: '#d4d4d8' }}
        />
        <Area
          type="monotone"
          dataKey="deals"
          stroke={chartPalette.deals}
          fill="url(#dealsFill)"
          strokeWidth={3}
        />
        <Area
          type="monotone"
          dataKey="viewings"
          stroke={chartPalette.viewings}
          fillOpacity={0}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="properties"
          stroke={chartPalette.properties}
          fillOpacity={0}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="clients"
          stroke={chartPalette.clients}
          fillOpacity={0}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
