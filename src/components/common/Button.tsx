import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ButtonVariant = 
  | 'primary'          // Vibrant electric blue gradient pill
  | 'primary-arrow'    // Exact screenshot match: electric blue pill with darker royal blue arrow pocket
  | 'secondary'        // Exact screenshot match: clean white/dark pill with crisp border
  | 'danger'           // Red/rose gradient pill for destructive actions
  | 'amber'            // Amber/orange gradient pill
  | 'ghost';           // Transparent pill with subtle hover

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className,
  type = 'button',
  ...props
}, ref) => {
  const isDisabled = disabled || loading;

  // Size specifications
  const sizeStyles = {
    xs: {
      base: 'text-3xs px-2.5 py-1 gap-1 min-h-[26px]',
      arrowPocket: 'w-4 h-4 ml-1.5 -mr-0.5',
      arrowIcon: 'w-2.5 h-2.5',
      iconSize: 'w-3 h-3'
    },
    sm: {
      base: 'text-2xs px-3.5 py-1.5 gap-1.5 min-h-[32px]',
      arrowPocket: 'w-5 h-5 ml-2 -mr-1',
      arrowIcon: 'w-3 h-3',
      iconSize: 'w-3.5 h-3.5'
    },
    md: {
      base: 'text-xs px-5 py-2 gap-2 min-h-[38px]',
      arrowPocket: 'w-6 h-6 ml-2.5 -mr-1.5',
      arrowIcon: 'w-3.5 h-3.5',
      iconSize: 'w-4 h-4'
    },
    lg: {
      base: 'text-sm px-6 py-2.5 gap-2.5 min-h-[44px]',
      arrowPocket: 'w-7 h-7 ml-3 -mr-2',
      arrowIcon: 'w-4 h-4',
      iconSize: 'w-4.5 h-4.5'
    }
  }[size];

  // Primary Dual-Tone with Arrow (Exact screenshot replica)
  if (variant === 'primary-arrow') {
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          'group relative inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 select-none cursor-pointer',
          // Electric blue gradient body with inset highlight
          'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white',
          'shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 hover:from-blue-500 hover:to-blue-600',
          'ring-1 ring-white/20 inset active:scale-[0.98]',
          'disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none',
          fullWidth && 'w-full',
          sizeStyles.base,
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className={cn('animate-spin', sizeStyles.iconSize)} />
        ) : (
          icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
        )}
        <span className="truncate tracking-wide">{children}</span>
        {icon && iconPosition === 'right' && !loading && <span className="shrink-0">{icon}</span>}
        
        {/* Darker Royal Blue Trailing Slot (From screenshot) */}
        <span className={cn(
          'flex items-center justify-center rounded-full bg-blue-800/80 dark:bg-blue-900/90 group-hover:bg-blue-900 transition-colors shadow-inner shrink-0',
          sizeStyles.arrowPocket
        )}>
          {loading ? (
            <Loader2 className={cn('animate-spin text-blue-200', sizeStyles.arrowIcon)} />
          ) : (
            <ArrowRight className={cn('stroke-[2] text-white transition-transform group-hover:translate-x-0.5', sizeStyles.arrowIcon)} />
          )}
        </span>
      </button>
    );
  }

  // Base variant styles
  const variantStyles = {
    // 1. Primary: Vibrant electric blue gradient pill with soft outer glow & subtle highlight
    primary: cn(
      'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white font-semibold',
      'shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 hover:from-blue-500 hover:to-blue-600',
      'ring-1 ring-white/20 inset'
    ),
    // 2. Secondary: Clean white pill with subtle hairline border (matches screenshot right button)
    secondary: cn(
      'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium',
      'border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
      'hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-2xs'
    ),
    // 3. Danger: Vibrant rose gradient pill
    danger: cn(
      'bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 text-white font-semibold',
      'shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/35 hover:from-rose-400 hover:to-rose-600',
      'ring-1 ring-white/20 inset'
    ),
    // 4. Amber: Warm amber gradient pill
    amber: cn(
      'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white font-semibold',
      'shadow-md shadow-amber-500/25 hover:shadow-lg hover:shadow-amber-500/35 hover:from-amber-400 hover:to-amber-600',
      'ring-1 ring-white/20 inset'
    ),
    // 5. Ghost: Transparent pill
    ghost: cn(
      'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
      'hover:bg-slate-100 dark:hover:bg-slate-800/80'
    )
  }[variant];

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center rounded-full transition-all duration-200 select-none cursor-pointer active:scale-[0.98]',
        'disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none',
        fullWidth && 'w-full',
        sizeStyles.base,
        variantStyles,
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn('animate-spin', sizeStyles.iconSize)} />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      <span className="truncate">{children}</span>
      {icon && iconPosition === 'right' && !loading && <span className="shrink-0">{icon}</span>}
    </button>
  );
});

Button.displayName = 'Button';
