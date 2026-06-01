import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  descriptionClassName?: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  descriptionClassName,
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-light">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p
            className={cn(
              'mt-2 max-w-xl text-sm text-content-muted',
              descriptionClassName,
            )}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
