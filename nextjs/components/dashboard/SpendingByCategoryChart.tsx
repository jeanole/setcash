'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { SpendingItem } from '@/lib/spending';

interface SpendingByCategoryChartProps {
  items: SpendingItem[];
}

const COLORS = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#a855f7', // purple
  '#94a3b8', // slate (Other)
];

interface TooltipPayload {
  name: string;
  value: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TooltipPayload }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-slate-700 mb-0.5">{item.name}</p>
      <p className="text-slate-500">
        {item.value.toLocaleString('de-DE', {
          style: 'currency',
          currency: 'EUR',
        })}
      </p>
    </div>
  );
}

export default function SpendingByCategoryChart({ items }: SpendingByCategoryChartProps) {
  const withSpending = items
    .filter((i) => i.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  if (withSpending.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-sm text-slate-400">
        No spending data yet
      </div>
    );
  }

  // Bucket categories beyond index 5 into "Other"
  const top5 = withSpending.slice(0, 5);
  const rest = withSpending.slice(5);

  const chartData = [
    ...top5.map((i) => ({ name: i.name, value: Math.round(i.spent * 100) / 100 })),
    ...(rest.length > 0
      ? [{ name: 'Other', value: Math.round(rest.reduce((s, i) => s + i.spent, 0) * 100) / 100 }]
      : []),
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="75%"
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((_, index) => (
            <Cell
              key={index}
              fill={COLORS[index % COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span className="text-xs text-slate-600">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
