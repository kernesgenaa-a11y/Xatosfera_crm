import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ManagerChartItem = {
  name: string;
  fullName: string;
  properties: number;
  clients: number;
  deals: number;
};

type Props = {
  data: ManagerChartItem[];
  chartPalette: {
    deals: string;
    viewings: string;
    properties: string;
    clients: string;
  };
  managerMetricLabels: Record<string, string>;
};

export function ManagerComparisonChart({ data, chartPalette, managerMetricLabels }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 16 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          dataKey="name"
          type="category"
          width={90}
          tick={{ fill: '#d4d4d8', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={false}
          contentStyle={{
            background: '#111214',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            color: '#fff',
          }}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
          formatter={(value: number, name: string) => [
            value,
            managerMetricLabels[String(name)] ?? name,
          ]}
        />
        <Legend
          formatter={(value) => managerMetricLabels[String(value)] ?? value}
          wrapperStyle={{ color: '#d4d4d8' }}
        />
        <Bar dataKey="properties" fill={chartPalette.properties} radius={[0, 6, 6, 0]} />
        <Bar dataKey="clients" fill={chartPalette.clients} radius={[0, 6, 6, 0]} />
        <Bar dataKey="deals" fill={chartPalette.deals} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
