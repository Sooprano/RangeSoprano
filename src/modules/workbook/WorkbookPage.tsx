import { useState } from 'react';
import {
  BadgePercent,
  Calculator,
  Coins,
  Crosshair,
  Gauge,
  Grid3x3,
  Layers,
  Percent,
  Sailboat,
  Scale,
  Shapes,
  Shield,
  Shuffle,
  Swords,
  Target,
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
import { RiverCallShoveDrill } from './RiverCallShoveDrill';
import { RiverCheckBetDrill } from './RiverCheckBetDrill';
import { RangeStatsDrill } from './RangeStatsDrill';
import { RangeCompositionDrill } from './RangeCompositionDrill';
import { RangeTypeDrill } from './RangeTypeDrill';
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
  | 'river-call-shove'
  | 'river-check-bet'
  | 'range-stats'
  | 'range-composition'
  | 'range-type'
  | 'pot-odds'
  | 'push-fold';

type DrillDef = {
  id: Drill;
  icon: typeof Calculator;
  label: string;
  /** Objetivo breve del ejercicio, mostrado al activarlo. */
  objective: string;
};

// Conceptos: drills cortos de opción múltiple (sin leaderboard).
// Ordenados de menor a mayor dificultad para no frustrar al arrancar
// (combos y value/bluff son avanzados, van más atrás).
const CONCEPT_DRILLS: readonly DrillDef[] = [
  {
    id: 'which-calc',
    icon: Calculator,
    label: '¿Qué calculadora?',
    objective: 'Reconocer qué calculadora de EV usar en cada situación postflop.',
  },
  {
    id: 'fold-equity',
    icon: Shield,
    label: 'Fold equity',
    objective: 'Calcular el % de folds que hace rentable un bluff (break-even).',
  },
  {
    id: 'runouts',
    icon: Shuffle,
    label: 'Runouts',
    objective: 'Estimar la probabilidad de un runout en el turn, en el river o el runout completo.',
  },
  {
    id: 'auto-profit',
    icon: BadgePercent,
    label: 'Auto-profit raise',
    objective: 'Reconocer cuándo un raise gana solo por su fold equity (auto-profit).',
  },
  {
    id: 'spr',
    icon: Gauge,
    label: 'SPR',
    objective: 'Decidir si comprometerte según el SPR y la EV de hacerlo.',
  },
  {
    id: 'floating',
    icon: Sailboat,
    label: 'Floating',
    objective: 'Evaluar la EV de flotar un cbet con aire para apostar la siguiente calle.',
  },
  {
    id: 'value-bluff',
    icon: Scale,
    label: 'Value / Bluff',
    objective: 'Balancear el rango de apuesta: cuántos bluffs por cada combo de value.',
  },
  {
    id: 'combos',
    icon: Layers,
    label: 'Conteo de combos',
    objective: 'Contar cuántos combos de una mano quedan después de los blockers.',
  },
  {
    id: 'river-call-shove',
    icon: Swords,
    label: 'River: call o shove',
    objective: 'Frente a un bet en el river, elegir entre call, fold o shove (all-in).',
  },
  {
    id: 'river-check-bet',
    icon: Coins,
    label: 'River: check o bet',
    objective: 'Cuando te checkean el river, elegir entre check o bet (y a qué sizing).',
  },
];

// Rangos: lectura y construcción de rangos (range-independent, banco curado).
const RANGE_DRILLS: readonly DrillDef[] = [
  {
    id: 'range-stats',
    icon: Grid3x3,
    label: '% y combos',
    objective: 'Leer un rango en el grid y decir qué % del total y cuántos combos representa.',
  },
  {
    id: 'range-composition',
    icon: Shapes,
    label: 'Composición',
    objective:
      'Dimensionar la cifra del HUD: si un villano 3-betea X% con rango lineal, qué manos son.',
  },
  {
    id: 'range-type',
    icon: Shapes,
    label: 'Tipo de rango',
    objective: 'Identificar la forma de un rango: lineal, polarizado, mergeado o condensado.',
  },
];

// Tablas: entrenadores con sub-modo Estudio/Velocidad y leaderboard propio.
const TABLE_DRILLS: readonly DrillDef[] = [
  {
    id: 'pot-odds',
    icon: Percent,
    label: 'Pot Odds',
    objective: 'Entrenar pot odds: la equity necesaria para pagar y los sizings de bluff/value.',
  },
  {
    id: 'push-fold',
    icon: Crosshair,
    label: 'Push/Fold',
    objective: 'Memorizar las tablas de Nash de push/fold heads-up según el stack efectivo.',
  },
];

// Las tablas (Pot Odds / Push-Fold) necesitan más ancho que los drills MC.
const WIDE_DRILLS: ReadonlySet<Drill> = new Set(['pot-odds', 'push-fold']);

// Objetivo por drill, derivado de las definiciones (single source of truth).
const OBJECTIVES: Record<Drill, string> = Object.fromEntries(
  [...CONCEPT_DRILLS, ...RANGE_DRILLS, ...TABLE_DRILLS].map((d) => [
    d.id,
    d.objective,
  ]),
) as Record<Drill, string>;

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
        description="Practica el postflop con una explicación en cada respuesta. Conceptos: elige la calculadora correcta, cuenta combos tras los bloqueadores, balancea value/bluff, calcula la fold equity mínima de un bluff, decide si comprometerte según el SPR, estima la probabilidad de un runout, evalúa la EV de flotar, reconoce un raise auto-profit y resuelve el river (pagar vs all-in, o checkear vs apostar). Rangos: lee un rango en el grid y di qué porcentaje del total y cuántos combos representa, dimensiona la cifra del HUD (si un villano 3-betea X% con rango lineal, qué manos son) e identifica la forma del rango (lineal, polarizado, mergeado o condensado). Tablas: pot odds y las tablas de Nash de push/fold heads-up."
        descriptionClassName="text-justify"
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
        <ObjectiveBanner objective={OBJECTIVES[drill]} />
        {drill === 'which-calc' && <WhichCalcDrill />}
        {drill === 'combos' && <ComboCountDrill />}
        {drill === 'value-bluff' && <ValueBluffDrill />}
        {drill === 'fold-equity' && <FoldEquityDrill />}
        {drill === 'spr' && <SprDrill />}
        {drill === 'runouts' && <RunoutsDrill />}
        {drill === 'floating' && <FloatDrill />}
        {drill === 'auto-profit' && <AutoProfitDrill />}
        {drill === 'river-call-shove' && <RiverCallShoveDrill />}
        {drill === 'river-check-bet' && <RiverCheckBetDrill />}
        {drill === 'range-stats' && <RangeStatsDrill />}
        {drill === 'range-composition' && <RangeCompositionDrill />}
        {drill === 'range-type' && <RangeTypeDrill />}
        {drill === 'pot-odds' && <OddsTrainer />}
        {drill === 'push-fold' && <PushFoldTrainer />}
      </div>
    </>
  );
}

function ObjectiveBanner({ objective }: { objective: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-2xl items-start justify-center gap-2 px-2">
      <Target
        className="mt-0.5 h-4 w-4 shrink-0 text-accent-light"
        strokeWidth={2.25}
        aria-hidden
      />
      <p className="text-center text-sm leading-relaxed text-content-muted">
        <span className="font-medium text-content">Objetivo: </span>
        {objective}
      </p>
    </div>
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
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-2.5"
    >
      <DrillGroup
        label="Conceptos"
        drills={CONCEPT_DRILLS}
        value={value}
        onChange={onChange}
      />
      <div className="h-px bg-border" aria-hidden />
      <DrillGroup
        label="Rangos"
        drills={RANGE_DRILLS}
        value={value}
        onChange={onChange}
      />
      <div className="h-px bg-border" aria-hidden />
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
    <div className="flex flex-col gap-1.5">
      <span className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-content-muted">
        {label}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
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
