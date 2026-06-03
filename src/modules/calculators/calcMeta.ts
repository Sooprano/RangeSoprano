import {
  ArrowBigUp,
  Bomb,
  ChevronsUp,
  Coins,
  DollarSign,
  Flame,
  GitFork,
  Hand,
  Ratio,
  Scale,
  Shield,
  Swords,
  TrendingUp,
  Users,
  VenetianMask,
  Waves,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for which calculators exist, how they're labeled and
 * ordered. Shared between `CalculatorsPage` (renders the selector) and the
 * análisis module (`spotCalc` maps a hand decision to one of these modes, the
 * worksheet renders the calc inline and shows its label).
 */
export type CalcMode =
  | 'ev-basic'
  | 'ev-complex'
  | 'bluff-ev'
  | 'check-vs-bet'
  | 'check-ev'
  | 'value-bluff'
  | 'double-barrel'
  | 'multi-street'
  | 'implied-odds'
  | 'float-ev'
  | 'call-vs-raise'
  | 'raise-bluff'
  | 'raise-sizing'
  | 'all-in-ev'
  | 'fold-equity-required'
  | 'combined-fold'
  | 'multiway-call';

export type CalcItem = { mode: CalcMode; Icon: LucideIcon; label: string };
export type CalcGroup = { label: string; items: readonly CalcItem[] };

// Orden pedagógico: agrupado por la acción que tienes enfrente, de fundamentos
// a situaciones específicas. Editar este array reordena el selector.
export const CALC_GROUPS: readonly CalcGroup[] = [
  {
    label: 'Fundamentos',
    items: [
      { mode: 'ev-basic', Icon: DollarSign, label: 'EV básico' },
      { mode: 'ev-complex', Icon: Coins, label: 'EV con fold equity' },
      { mode: 'bluff-ev', Icon: VenetianMask, label: 'EV de bluff' },
    ],
  },
  {
    label: 'Cuando apuestas tú',
    items: [
      { mode: 'check-vs-bet', Icon: Scale, label: 'Check vs Bet' },
      { mode: 'check-ev', Icon: Hand, label: 'EV de checkear' },
      { mode: 'value-bluff', Icon: Ratio, label: 'Value / Bluff' },
      { mode: 'double-barrel', Icon: Flame, label: 'Doble barrel' },
      { mode: 'multi-street', Icon: Workflow, label: 'EV multi-calle' },
    ],
  },
  {
    label: 'Cuando enfrentas una apuesta',
    items: [
      { mode: 'implied-odds', Icon: TrendingUp, label: 'Implied Odds' },
      { mode: 'float-ev', Icon: Waves, label: 'EV de flotar' },
      { mode: 'call-vs-raise', Icon: Swords, label: 'Call vs Raise' },
      { mode: 'raise-bluff', Icon: ArrowBigUp, label: 'EV del raise' },
      { mode: 'raise-sizing', Icon: ChevronsUp, label: 'Raise sizing' },
    ],
  },
  {
    label: 'All-in',
    items: [
      { mode: 'all-in-ev', Icon: Bomb, label: 'All-in EV' },
      { mode: 'fold-equity-required', Icon: Shield, label: 'FE requerida' },
    ],
  },
  {
    label: 'Multi-way',
    items: [
      { mode: 'combined-fold', Icon: Users, label: 'Fold equity combinada' },
      { mode: 'multiway-call', Icon: GitFork, label: 'Call multi-way' },
    ],
  },
];

/** Flat lookup mode → { label, Icon }. Derived from CALC_GROUPS. */
export const CALC_META: Record<CalcMode, { label: string; Icon: LucideIcon }> =
  CALC_GROUPS.reduce(
    (acc, group) => {
      for (const item of group.items) {
        acc[item.mode] = { label: item.label, Icon: item.Icon };
      }
      return acc;
    },
    {} as Record<CalcMode, { label: string; Icon: LucideIcon }>,
  );
