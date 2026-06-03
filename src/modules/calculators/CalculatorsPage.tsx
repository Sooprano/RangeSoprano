import { Fragment, useState } from 'react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { CALC_GROUPS, type CalcMode } from './calcMeta';
import { EvBasicCalc } from './EvBasicCalc';
import { EvComplexCalc } from './EvComplexCalc';
import { BluffEvCalc } from './BluffEvCalc';
import { CheckVsBetCalc } from './CheckVsBetCalc';
import { CheckCompoundEvCalc } from './CheckCompoundEvCalc';
import { ValueBluffCalc } from './ValueBluffCalc';
import { DoubleBarrelEvCalc } from './DoubleBarrelEvCalc';
import { MultiStreetEvCalc } from './MultiStreetEvCalc';
import { ImpliedOddsCalc } from './ImpliedOddsCalc';
import { FloatEvCalc } from './FloatEvCalc';
import { CallVsRaiseCalc } from './CallVsRaiseCalc';
import { RaiseBluffEvCalc } from './RaiseBluffEvCalc';
import { RaiseSizingCalc } from './RaiseSizingCalc';
import { AllInEvCalc } from './AllInEvCalc';
import { FoldEquityRequiredCalc } from './FoldEquityRequiredCalc';
import { CombinedFoldEquityCalc } from './CombinedFoldEquityCalc';
import { MultiWayCallEv } from './MultiWayCallEv';

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
        description="Herramientas matemáticas para analizar decisiones. Ingresa los valores y obtén el resultado al instante."
      />

      <div className="mb-6">
        <ModeToggle value={mode} onChange={setMode} />
      </div>

      {mode === 'ev-basic' && <EvBasicCalc />}
      {mode === 'ev-complex' && <EvComplexCalc />}
      {mode === 'bluff-ev' && <BluffEvCalc />}
      {mode === 'check-vs-bet' && <CheckVsBetCalc />}
      {mode === 'check-ev' && <CheckCompoundEvCalc />}
      {mode === 'value-bluff' && <ValueBluffCalc />}
      {mode === 'double-barrel' && <DoubleBarrelEvCalc />}
      {mode === 'multi-street' && <MultiStreetEvCalc />}
      {mode === 'implied-odds' && <ImpliedOddsCalc />}
      {mode === 'float-ev' && <FloatEvCalc />}
      {mode === 'call-vs-raise' && <CallVsRaiseCalc />}
      {mode === 'raise-bluff' && <RaiseBluffEvCalc />}
      {mode === 'raise-sizing' && <RaiseSizingCalc />}
      {mode === 'all-in-ev' && <AllInEvCalc />}
      {mode === 'fold-equity-required' && <FoldEquityRequiredCalc />}
      {mode === 'combined-fold' && <CombinedFoldEquityCalc />}
      {mode === 'multiway-call' && <MultiWayCallEv />}
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
      className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface/60 p-2"
    >
      {CALC_GROUPS.map((group) => (
        <Fragment key={group.label}>
          <span className="mt-2 w-full px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-disabled first:mt-0">
            {group.label}
          </span>
          {group.items.map((item) => (
            <ModeButton
              key={item.mode}
              active={value === item.mode}
              onClick={() => onChange(item.mode)}
              icon={<item.Icon className="h-3.5 w-3.5" strokeWidth={2.25} />}
              label={item.label}
            />
          ))}
        </Fragment>
      ))}
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
          : 'bg-surface/30 ring-1 ring-inset ring-border/50 text-content-muted hover:bg-surface-hover hover:text-content hover:ring-border',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
