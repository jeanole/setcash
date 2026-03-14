import Link from 'next/link';
import { FileText, TrendingUp, DollarSign, BarChart2 } from 'lucide-react';

interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
}

const ACTIONS: QuickAction[] = [
  {
    label: 'New Bill',
    href: '/bills',
    icon: <FileText className="w-5 h-5" aria-hidden="true" />,
    description: 'Submit an expense',
  },
  {
    label: 'Spending',
    href: '/spending',
    icon: <TrendingUp className="w-5 h-5" aria-hidden="true" />,
    description: 'View breakdown',
  },
  {
    label: 'Budget',
    href: '/budget',
    icon: <DollarSign className="w-5 h-5" aria-hidden="true" />,
    description: 'Manage budget',
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: <BarChart2 className="w-5 h-5" aria-hidden="true" />,
    description: 'Export & reports',
  },
];

export default function QuickActions() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3" role="list" aria-label="Quick navigation shortcuts">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            role="listitem"
            className="group flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="text-slate-500 group-hover:text-indigo-600">{action.icon}</span>
            <span className="text-xs font-semibold text-slate-700">{action.label}</span>
            <span className="text-[10px] text-slate-400">{action.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
