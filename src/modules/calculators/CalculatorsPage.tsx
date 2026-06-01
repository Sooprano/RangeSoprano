import { useState } from 'react';
import { ArrowBigUp, Bomb, ChevronsUp, Coins, DollarSign, Flame, GitFork, Hand, Ratio, Scale, Shield, Swords, TrendingUp, Users, VenetianMask, Waves, Workflow } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { EvBasicCalc } from './EvBasicCalc';
import { EvComplexCalc } from './EvComplexCalc';
import { BluffEvCalc } from './BluffEvCalc';
import { DoubleBarrelEvCalc } from './DoubleBarrelEvCalc';
import { MultiStreetEvCalc } from './MultiStreetEvCalc';
import { ValueBluffCalc } from './ValueBluffCalc';
import { CheckVsBetCalc } from './CheckVsBetCalc';
import { CheckCompoundEvCalc } from './CheckCompoundEvCalc';
import { AllInEvCalc } from './AllInEvCalc';
import { FoldEquityRequiredCalc } from './FoldEquityRequiredCalc';
import { CallVsRaiseCalc } from './CallVsRaiseCalc';
import { RaiseSizingCalc } from './RaiseSizingCalc';
import { RaiseBluffEvCalc } from './RaiseBluffEvCalc';
import { ImpliedOddsCalc } from './ImpliedOddsCalc';
import { FloatEvCalc } from './FloatEvCalc';
import { CombinedFoldEquityCalc } from './CombinedFoldEquityCalc';
import { MultiWayCallEv } from './MultiWayCallEv';

type CalcMode =
  | 'ev-basic'
  | 'ev-complex'
  | 'bluff-ev'
  | 'double-barrel'
  | 'multi-street'
  | 'value-bluff'
  | 'check-vs-bet'
  | 'check-ev'
  | 'all-in-ev'
  | 'fold-equity-required'
  | 'call-vs-raise'
  | 'raise-sizing'
  | 'raise-bluff'
  | 'implied-odds'
  | 'float-ev'
  | 'combined-fold'
  | 'multiway-call';

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
      {mode === 'bluff-ev' && <BluffEvCalc />}
      {mode === 'double-barrel' && <DoubleBarrelEvCalc />}
      {mode === 'multi-street' && <MultiStreetEvCalc />}
      {mode === 'value-bluff' && <ValueBluffCalc />}
      {mode === 'check-vs-bet' && <CheckVsBetCalc />}
      {mode === 'check-ev' && <CheckCompoundEvCalc />}
      {mode === 'all-in-ev' && <AllInEvCalc />}
      {mode === 'fold-equity-required' && <FoldEquityRequiredCalc />}
      {mode === 'call-vs-raise' && <CallVsRaiseCalc />}
      {mode === 'raise-sizing' && <RaiseSizingCalc />}
      {mode === 'raise-bluff' && <RaiseBluffEvCalc />}
      {mode === 'implied-odds' && <ImpliedOddsCalc />}
      {mode === 'float-ev' && <FloatEvCalc />}
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
      className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface/60 p-1.5"
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
        active={value === 'bluff-ev'}
        onClick={() => onChange('bluff-ev')}
        icon={<VenetianMask className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="EV de bluff"
      />
      <ModeButton
        active={value === 'double-barrel'}
        onClick={() => onChange('double-barrel')}
        icon={<Flame className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Doble barrel"
      />
      <ModeButton
        active={value === 'multi-street'}
        onClick={() => onChange('multi-street')}
        icon={<Workflow className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="EV multi-calle"
      />
      <ModeButton
        active={value === 'value-bluff'}
        onClick={() => onChange('value-bluff')}
        icon={<Ratio className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Value / Bluff"
      />
      <ModeButton
        active={value === 'check-vs-bet'}
        onClick={() => onChange('check-vs-bet')}
        icon={<Scale className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Check vs Bet"
      />
      <ModeButton
        active={value === 'check-ev'}
        onClick={() => onChange('check-ev')}
        icon={<Hand className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="EV de checkear"
      />
      <ModeButton
        active={value === 'all-in-ev'}
        onClick={() => onChange('all-in-ev')}
        icon={<Bomb className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="All-in EV"
      />
      <ModeButton
        active={value === 'fold-equity-required'}
        onClick={() => onChange('fold-equity-required')}
        icon={<Shield className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="FE requerida"
      />
      <ModeButton
        active={value === 'call-vs-raise'}
        onClick={() => onChange('call-vs-raise')}
        icon={<Swords className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Call vs Raise"
      />
      <ModeButton
        active={value === 'raise-sizing'}
        onClick={() => onChange('raise-sizing')}
        icon={<ChevronsUp className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Raise sizing"
      />
      <ModeButton
        active={value === 'raise-bluff'}
        onClick={() => onChange('raise-bluff')}
        icon={<ArrowBigUp className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="EV del raise"
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
      <ModeButton
        active={value === 'multiway-call'}
        onClick={() => onChange('multiway-call')}
        icon={<GitFork className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Call multi-way"
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
          : 'bg-surface/30 ring-1 ring-inset ring-border/50 text-content-muted hover:bg-surface-hover hover:text-content hover:ring-border',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
