import { cn } from '@/lib/cn';
import {
  KIND_LABEL,
  sizingFraction,
  type OddsQuestion,
  type QuestionKind,
  type Sizing,
} from '@/utils/potOdds';

/**
 * Rich prompt block reused by Pot Odds Estudio and Velocidad.
 * Layout: kind eyebrow → ScenarioChip (datum amber) → question with the
 * concept asked highlighted in accent → MiniPot table view (only on direct
 * kinds where the sizing is given as input).
 */
export function OddsPrompt({ question }: { question: OddsQuestion }) {
  return (
    <div className="flex flex-col items-stretch gap-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-muted">
          {KIND_LABEL[question.kind]}
        </span>
        <ScenarioChip
          label={question.scenarioLabel}
          value={question.scenarioValue}
        />
        <p className="max-w-xl text-sm leading-relaxed text-content sm:text-base">
          {question.question.lead}{' '}
          <span className="font-semibold text-accent-light">
            {question.question.keyword}
          </span>{' '}
          {question.question.tail}
        </p>
      </div>
      {question.visualSize !== undefined && (
        <MiniPot size={question.visualSize} kind={question.kind} />
      )}
    </div>
  );
}

export function ScenarioChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="inline-flex flex-col items-center gap-0.5 rounded-xl border border-border bg-surface px-4 py-2 shadow-surface">
      <span className="text-[10px] uppercase tracking-wider text-content-muted">
        {label}
      </span>
      <span className="font-mono text-2xl font-bold tabular-nums text-amber-200">
        {value}
      </span>
    </div>
  );
}

// Visual mini-table: pot stack (100 BB anchor) + bet stack with chips
// proportional to the sizing. Mirrors what an online table renders so the
// magnitude is read pre-attentively, without parsing fractions.
export function MiniPot({ size, kind }: { size: Sizing; kind: QuestionKind }) {
  const fraction = sizingFraction(size);
  const POT_BB = 100;
  const betBB = Math.round(POT_BB * fraction);
  const overpot = fraction > 1;
  const heroBets = kind === 'bluff-fe' || kind === 'bluff-size';
  const betLabel = heroBets ? 'Vos apostás' : 'Villano apuesta';
  return (
    <div className="mx-auto flex w-full max-w-md items-end justify-center gap-6 px-2">
      <ChipStack label="Pot" amount={POT_BB} tone="muted" />
      <div className="flex flex-col items-center gap-1">
        <span
          className={cn(
            'text-[9px] font-semibold uppercase tracking-[0.18em]',
            heroBets ? 'text-accent-light' : 'text-rose-300',
          )}
        >
          {betLabel}
        </span>
        <ChipStack label="Bet" amount={betBB} tone={overpot ? 'amber' : 'accent'} />
      </div>
    </div>
  );
}

const CHIP_TONE: Record<
  'muted' | 'accent' | 'amber',
  { bar: string; ring: string; label: string; value: string }
> = {
  muted: {
    bar: 'bg-content/30',
    ring: 'ring-white/10',
    label: 'text-content-muted',
    value: 'text-content',
  },
  accent: {
    bar: 'bg-accent',
    ring: 'ring-accent-light/40',
    label: 'text-accent-light',
    value: 'text-content',
  },
  amber: {
    bar: 'bg-amber-400',
    ring: 'ring-amber-200/40',
    label: 'text-amber-300',
    value: 'text-amber-200',
  },
};

function ChipStack({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: 'muted' | 'accent' | 'amber';
}) {
  // 1 chip per 20 BB, capped at 10. Smallest non-zero amount keeps 1 chip.
  const chips =
    amount <= 0 ? 0 : Math.max(1, Math.min(10, Math.ceil(amount / 20)));
  const palette = CHIP_TONE[tone];
  const CHIP_GAP_PX = 4;
  const CHIP_HEIGHT_PX = 6;
  const stackHeight = chips * CHIP_GAP_PX + CHIP_HEIGHT_PX;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative w-12"
        style={{ height: `${stackHeight}px` }}
        aria-hidden
      >
        {Array.from({ length: chips }, (_, i) => (
          <div
            key={i}
            className={cn(
              'absolute left-0 right-0 h-1.5 rounded-full ring-1',
              palette.bar,
              palette.ring,
            )}
            style={{ bottom: `${i * CHIP_GAP_PX}px` }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center leading-tight">
        <span
          className={cn('text-[10px] uppercase tracking-wider', palette.label)}
        >
          {label}
        </span>
        <span
          className={cn(
            'font-mono text-sm font-bold tabular-nums',
            palette.value,
          )}
        >
          {amount} BB
        </span>
      </div>
    </div>
  );
}
