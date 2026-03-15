'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { SpendingItem } from '@/lib/spending';

interface SpendingByMotiveChartProps {
  items: SpendingItem[];
}

interface TooltipPayload {
  value: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-slate-700 mb-0.5">{label}</p>
      <p className="text-slate-500">
        {payload[0].value.toLocaleString('de-DE', {
          style: 'currency',
          currency: 'EUR',
        })}
      </p>
    </div>
  );
}

export default function SpendingByMotiveChart({ items }: SpendingByMotiveChartProps) {
  const top5 = [...items]
    .filter((i) => i.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5)
    .map((i) => ({ name: i.name, spent: Math.round(i.spent * 100) / 100 }));

  if (top5.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-sm text-slate-400">
        No spending data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={top5}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
      >
        <XAxis
          type="number"
          tickFormatter={(v: number) =>
            v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
          }
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="spent" radius={[0, 4, 4, 0]}>
          {top5.map((_, index) => (
            <Cell
              key={index}
              fill={index === 0 ? 'var(--accent)' : `rgba(99,102,241,${0.85 - index * 0.12})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
