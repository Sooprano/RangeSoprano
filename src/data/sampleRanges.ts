import type {
  HandNotation,
  Position,
  Range,
  RangeCellData,
  Situation,
} from '@/types/poker';
import { DEFAULT_ACTION_DEFS } from '@/utils/actionMeta';
import { parseHandRange } from '@/utils/handRangeParser';
import { GTO_OPEN_RAW } from '@/modules/workbook/gtoOpenRanges';
import { GTO_3BET_RAW } from '@/modules/workbook/gto3betRanges';
import { GTO_CALL_RAW } from '@/modules/workbook/gtoCallRanges';
import { GTO_COLD_CALL_RAW } from '@/modules/workbook/gtoColdCallRanges';

// Set de demo por defecto: rangos GTO Wizard reales de cash 6-max, organizados en
// una carpeta madre "Rangos GTO cash" con 4 subcarpetas (OR · 3bet · BBDefend ·
// Call cold). Las notaciones combo-por-combo (peso 0-1 por combo) las autodetecta
// `parseHandRange`, que agrega a peso por mano (0-100). El peso se guarda en la
// acción coloreada; la frecuencia restante queda como fold implícito (celda a
// medio pintar), igual que se ve en GTO Wizard.

const GROUP_ROOT = 'Rangos GTO cash';
const ACTIONS = DEFAULT_ACTION_DEFS.map((d) => ({ ...d }));
const CREATED_AT = '2026-07-02T00:00:00.000Z';

/** "vs UTG" → "UTG" (Position). */
function villainOf(vs: string): Position {
  return vs.replace(/^vs\s+/i, '').trim() as Position;
}

/** Parsea una notación GTO y pinta cada mano en una sola acción a su frecuencia. */
function gtoCells(notation: string, action: string): Record<HandNotation, RangeCellData> {
  const { hands } = parseHandRange(notation);
  const cells: Record<HandNotation, RangeCellData> = {};
  for (const { hand, weight } of hands) {
    const w = Math.round(weight);
    if (w <= 0) continue;
    cells[hand] = { hand, actions: [{ action, weight: w }] };
  }
  return cells;
}

function gtoRange(args: {
  id: string;
  name: string;
  position: Position;
  situation: Situation;
  subfolder: string;
  notation: string;
  action: string;
  villainPosition?: Position;
}): Range {
  return {
    id: args.id,
    name: args.name,
    position: args.position,
    situation: args.situation,
    group: `${GROUP_ROOT}/${args.subfolder}`,
    cells: gtoCells(args.notation, args.action),
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    actions: ACTIONS.map((a) => ({ ...a })),
    tableFormat: '6max',
    ...(args.villainPosition !== undefined && { villainPosition: args.villainPosition }),
  };
}

// ── OR (RFI / aperturas) — acción RAISE ───────────────────────────────────────
const OR_RANGES: Range[] = GTO_OPEN_RAW.map((r) =>
  gtoRange({
    id: `demo-${r.id}`,
    name: `${r.position} RFI ${r.sizing}`,
    position: r.position as Position,
    situation: 'RFI',
    subfolder: 'OR',
    notation: r.notation,
    action: 'RAISE',
  }),
);

// ── 3bet (reg vs reg) — acción 3BET ───────────────────────────────────────────
const THREEBET_RANGES: Range[] = GTO_3BET_RAW.map((r) =>
  gtoRange({
    id: `demo-${r.id}`,
    name: `${r.position} 3bet ${r.vs}`,
    position: r.position as Position,
    situation: 'vs_RFI',
    subfolder: '3bet',
    notation: r.notation,
    action: '3BET',
    villainPosition: villainOf(r.vs),
  }),
);

// ── BBDefend (defensa de la BB, la parte que paga) — acción CALL ──────────────
const BBDEFEND_RANGES: Range[] = GTO_CALL_RAW.map((r) =>
  gtoRange({
    id: `demo-${r.id}`,
    name: `BB call ${r.vs}`,
    position: 'BB',
    situation: 'DEFEND_BB',
    subfolder: 'BBDefend',
    notation: r.notation,
    action: 'CALL',
    villainPosition: villainOf(r.vs),
  }),
);

// ── Call cold (pago en frío de BTN/SB vs un opener) — acción CALL ─────────────
const COLDCALL_RANGES: Range[] = GTO_COLD_CALL_RAW.map((r) =>
  gtoRange({
    id: `demo-${r.id}`,
    name: `${r.position} call ${r.vs}`,
    position: r.position as Position,
    situation: 'vs_RFI',
    subfolder: 'Call cold',
    notation: r.notation,
    action: 'CALL',
    villainPosition: villainOf(r.vs),
  }),
);

/** Set de demo completo: 1 carpeta madre + 4 subcarpetas (30 rangos GTO). */
export const SAMPLE_RANGES: readonly Range[] = [
  ...OR_RANGES,
  ...THREEBET_RANGES,
  ...BBDEFEND_RANGES,
  ...COLDCALL_RANGES,
];

/** Un rango suelto (compat con llamadas antiguas): la apertura de BTN. */
export const SAMPLE_BTN_RFI: Range =
  OR_RANGES.find((r) => r.position === 'BTN') ?? OR_RANGES[0]!;
