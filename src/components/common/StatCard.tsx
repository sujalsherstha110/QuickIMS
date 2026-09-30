import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatCardProps {
  title: string;
  value: string;
  nepaliValue?: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  subtitle?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
  id?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  nepaliValue,
  change,
  isPositive,
  icon,
  subtitle,
  color = 'blue',
  id
}) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-100 dark:border-blue-900/40',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-100 dark:border-amber-900/40',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-100 dark:border-rose-900/40',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 border-violet-100 dark:border-violet-900/40'
  };

  return (
    <div
      id={id}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {value}
            </span>
          </div>
          {nepaliValue && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {nepaliValue}
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-lg border', colorMap[color])}>
          {icon}
        </div>
      </div>

      {(subtitle || change) && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{subtitle}</span>
          {change && (
            <span
              className={cn(
                'font-medium inline-flex items-center px-1.5 py-0.5 rounded text-2xs',
                isPositive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
              )}
            >
              {isPositive ? '↑' : '↓'} {change}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const norm = status.toLowerCase();
  
  let styles = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  let dotColor = 'bg-slate-400';

  if (['paid', 'completed', 'active', 'received', 'accepted', 'instock'].includes(norm)) {
    styles = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40';
    dotColor = 'bg-emerald-500';
  } else if (['partial', 'pending', 'ordered', 'low_stock', 'due_soon', 'partially_returned'].includes(norm)) {
    styles = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40';
    dotColor = 'bg-amber-500';
  } else if (['unpaid', 'overdue', 'cancelled', 'out_of_stock', 'damage', 'loss', 'rejected'].includes(norm)) {
    styles = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40';
    dotColor = 'bg-rose-500';
  } else if (['returned', 'sale_return', 'refunded'].includes(norm)) {
    styles = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800';
    dotColor = 'bg-rose-500';
  } else if (['wholesale', 'contractor', 'dealer', 'draft', 'transfer_in', 'transfer_out'].includes(norm)) {
    styles = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/40';
    dotColor = 'bg-blue-500';
  }

  const displayText = label || status.replace('_', ' ').toUpperCase();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold tracking-wide uppercase border',
        styles,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
      {displayText}
    </span>
  );
};
