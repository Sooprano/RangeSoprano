import { useState } from 'react';
import {
  BadgePercent,
  Calculator,
  Crosshair,
  Gauge,
  Layers,
  Percent,
  Sailboat,
  Scale,
  Shield,
  Shuffle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { WhichCalcDrill } from './WhichCalcDrill';
import { ComboCountDrill } from './ComboCountDrill';
import { ValueBluffDrill } from './ValueBluffDrill';
import { FoldEquityDrill } from './FoldEquityDrill';
import { SprDrill } from './SprDrill';
import { RunoutsDrill } from './RunoutsDrill';
import { FloatDrill } from './FloatDrill';
import { AutoProfitDrill } from './AutoProfitDrill';
import { OddsTrainer } from '@/modules/trainer/OddsTrainer';
import { PushFoldTrainer } from '@/modules/trainer/pushfold/PushFoldTrainer';

type Drill =
  | 'which-calc'
  | 'combos'
  | 'value-bluff'
  | 'fold-equity'
  | 'spr'
  | 'runouts'
  | 'floating'
  | 'auto-profit'
  | 'pot-odds'
  | 'push-fold';

type DrillDef = {
  id: Drill;
  icon: typeof Calculator;
  label: string;
};

// Conceptos: los 5 drills de active recall (MC rápido, sin leaderboard).
const CONCEPT_DRILLS: readonly DrillDef[] = [
  { id: 'which-calc', icon: Calculator, label: '¿Qué calculadora?' },
  { id: 'combos', icon: Layers, label: 'Conteo de combos' },
  { id: 'value-bluff', icon: Scale, label: 'Value / Bluff' },
  { id: 'fold-equity', icon: Shield, label: 'Fold equity' },
  { id: 'spr', icon: Gauge, label: 'SPR' },
  { id: 'runouts', icon: Shuffle, label: 'Runouts' },
  { id: 'floating', icon: Sailboat, label: 'Floating' },
  { id: 'auto-profit', icon: BadgePercent, label: 'Auto-profit raise' },
];

// Tablas: entrenadores con sub-modo Estudio/Velocidad y leaderboard propio.
const TABLE_DRILLS: readonly DrillDef[] = [
  { id: 'pot-odds', icon: Percent, label: 'Pot Odds' },
  { id: 'push-fold', icon: Crosshair, label: 'Push/Fold' },
];

// Las tablas (Pot Odds / Push-Fold) necesitan más ancho que los drills MC.
const WIDE_DRILLS: ReadonlySet<Drill> = new Set(['pot-odds', 'push-fold']);

export default function WorkbookPage() {
  useDocumentTitle('Ejercicios de poker · Range Soprano', {
    description:
      'Drills de poker: elige la calculadora de EV correcta, cuenta combos con bloqueadores, balancea value/bluff, calcula fold equity y SPR, y practica pot odds y push/fold de Nash. Sin login, sin tracking.',
    canonical: 'https://rangesoprano.com/ejercicios/',
  });

  const [drill, setDrill] = useState<Drill>('which-calc');
  const isWide = WIDE_DRILLS.has(drill);

  return (
    <>
      <PageHeader
        eyebrow="Entrenamiento"
        title="Ejercicios"
        description="Drills de active recall para internalizar el postflop. Conceptos: elige qué calculadora usar, cuenta combos tras los bloqueadores, balancea tu rango de apuesta, calcula la fold equity mínima de un bluff, decide si comprometerte a cada SPR, estima la probabilidad de un runout en turn/river/completo, evalúa la EV de flotar o decide si un raise es auto-profit por su fold equity. Tablas: entrena pot odds (fold equity al apostar y equity al pagar) y las tablas de Nash de push/fold heads-up. Cada respuesta viene con su explicación."
      />

      <div
        className={cn(
          'mx-auto w-full',
          isWide ? 'max-w-5xl' : 'max-w-3xl',
        )}
      >
        <div className="mb-4 flex justify-center">
          <DrillToggle value={drill} onChange={setDrill} />
        </div>
        {drill === 'which-calc' && <WhichCalcDrill />}
        {drill === 'combos' && <ComboCountDrill />}
        {drill === 'value-bluff' && <ValueBluffDrill />}
        {drill === 'fold-equity' && <FoldEquityDrill />}
        {drill === 'spr' && <SprDrill />}
        {drill === 'runouts' && <RunoutsDrill />}
        {drill === 'floating' && <FloatDrill />}
        {drill === 'auto-profit' && <AutoProfitDrill />}
        {drill === 'pot-odds' && <OddsTrainer />}
        {drill === 'push-fold' && <PushFoldTrainer />}
      </div>
    </>
  );
}

function DrillToggle({
  value,
  onChange,
}: {
  value: Drill;
  onChange: (next: Drill) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Ejercicio"
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-2"
    >
      <DrillGroup
        label="Conceptos"
        drills={CONCEPT_DRILLS}
        value={value}
        onChange={onChange}
      />
      <div className="h-px bg-border/60" aria-hidden />
      <DrillGroup
        label="Tablas"
        drills={TABLE_DRILLS}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function DrillGroup({
  label,
  drills,
  value,
  onChange,
}: {
  label: string;
  drills: readonly DrillDef[];
  value: Drill;
  onChange: (next: Drill) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-content-muted">
        {label}
      </span>
      {drills.map(({ id, icon: Icon, label: drillLabel }) => (
        <DrillButton
          key={id}
          active={value === id}
          onClick={() => onChange(id)}
          icon={<Icon className="h-3.5 w-3.5" strokeWidth={2.25} />}
          label={drillLabel}
        />
      ))}
    </div>
  );
}

function DrillButton({
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
