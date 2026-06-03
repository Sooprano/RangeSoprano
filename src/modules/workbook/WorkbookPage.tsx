import { useState } from 'react';
import { Calculator, Layers, Scale, Shield } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { WhichCalcDrill } from './WhichCalcDrill';
import { ComboCountDrill } from './ComboCountDrill';
import { ValueBluffDrill } from './ValueBluffDrill';
import { FoldEquityDrill } from './FoldEquityDrill';

type Drill = 'which-calc' | 'combos' | 'value-bluff' | 'fold-equity';

export default function WorkbookPage() {
  useDocumentTitle('Ejercicios de poker · Range Soprano', {
    description:
      'Drills de poker: practica elegir la calculadora de EV correcta para cada spot y cuenta combos con bloqueadores. Mano, board y explicación. Sin login, sin tracking.',
    canonical: 'https://rangesoprano.com/ejercicios/',
  });

  const [drill, setDrill] = useState<Drill>('which-calc');

  return (
    <>
      <PageHeader
        eyebrow="Entrenamiento"
        title="Ejercicios"
        description="Drills de active recall para internalizar el postflop: elige qué calculadora usar en un spot real, cuenta combos tras los bloqueadores, balancea tu rango de apuesta con la cantidad correcta de faroles, o calcula la fold equity mínima para un bluff. Cada respuesta viene con su explicación."
      />

      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex justify-center">
          <DrillToggle value={drill} onChange={setDrill} />
        </div>
        {drill === 'which-calc' && <WhichCalcDrill />}
        {drill === 'combos' && <ComboCountDrill />}
        {drill === 'value-bluff' && <ValueBluffDrill />}
        {drill === 'fold-equity' && <FoldEquityDrill />}
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
      className="flex flex-wrap items-center justify-center gap-1 rounded-xl border border-border bg-surface/60 p-1"
    >
      <DrillButton
        active={value === 'which-calc'}
        onClick={() => onChange('which-calc')}
        icon={<Calculator className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="¿Qué calculadora?"
      />
      <DrillButton
        active={value === 'combos'}
        onClick={() => onChange('combos')}
        icon={<Layers className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Conteo de combos"
      />
      <DrillButton
        active={value === 'value-bluff'}
        onClick={() => onChange('value-bluff')}
        icon={<Scale className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Value / Bluff"
      />
      <DrillButton
        active={value === 'fold-equity'}
        onClick={() => onChange('fold-equity')}
        icon={<Shield className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Fold equity"
      />
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
