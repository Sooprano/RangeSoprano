import { useState } from 'react';
import { Bomb, Coins, DollarSign, TrendingUp, Users, Waves } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { EvBasicCalc } from './EvBasicCalc';
import { EvComplexCalc } from './EvComplexCalc';
import { AllInEvCalc } from './AllInEvCalc';
import { ImpliedOddsCalc } from './ImpliedOddsCalc';
import { FloatEvCalc } from './FloatEvCalc';
import { CombinedFoldEquityCalc } from './CombinedFoldEquityCalc';

type CalcMode =
  | 'ev-basic'
  | 'ev-complex'
  | 'all-in-ev'
  | 'implied-odds'
  | 'float-ev'
  | 'combined-fold';

export default function CalculatorsPage() {
  useDocumentTitle('Calculadoras de poker · Range Soprano', {
    description:
      'Calculadoras de EV (expected value), fold equity, implied odds, floating y fold equity combinada multi-way para analizar manos de poker. Sin login, sin tracking.',
    canonical: 'https://rangesoprano.com/calculadoras/',
  });

  const [mode, setMode] = useState<CalcMode>('ev-basic');

  return (
    <>
      <PageHeader
        eyebrow="Matemática · análisis de manos"
        title="Calculadoras"
        description="Herramientas matemáticas para analizar decisiones. Ingresá los valores y obtené el resultado al instante."
      />

      <div className="mb-6 flex justify-start">
        <ModeToggle value={mode} onChange={setMode} />
      </div>

      {mode === 'ev-basic' && <EvBasicCalc />}
      {mode === 'ev-complex' && <EvComplexCalc />}
      {mode === 'all-in-ev' && <AllInEvCalc />}
      {mode === 'implied-odds' && <ImpliedOddsCalc />}
      {mode === 'float-ev' && <FloatEvCalc />}
      {mode === 'combined-fold' && <CombinedFoldEquityCalc />}
    </>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: CalcMode;
  onChange: (next: CalcMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Calculadora"
      className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface/60 p-1"
    >
      <ModeButton
        active={value === 'ev-basic'}
        onClick={() => onChange('ev-basic')}
        icon={<DollarSign className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="EV básico"
      />
      <ModeButton
        active={value === 'ev-complex'}
        onClick={() => onChange('ev-complex')}
        icon={<Coins className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="EV con fold equity"
      />
      <ModeButton
        active={value === 'all-in-ev'}
        onClick={() => onChange('all-in-ev')}
        icon={<Bomb className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="All-in EV"
      />
      <ModeButton
        active={value === 'implied-odds'}
        onClick={() => onChange('implied-odds')}
        icon={<TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Implied Odds"
      />
      <ModeButton
        active={value === 'float-ev'}
        onClick={() => onChange('float-ev')}
        icon={<Waves className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="EV de flotar"
      />
      <ModeButton
        active={value === 'combined-fold'}
        onClick={() => onChange('combined-fold')}
        icon={<Users className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Fold equity combinada"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
        'transition-colors duration-150 ease-out-soft',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
        active
          ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
          : 'text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
