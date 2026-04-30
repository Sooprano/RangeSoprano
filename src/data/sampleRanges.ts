import type {
  Action,
  HandAction,
  HandNotation,
  Range,
  RangeCellData,
} from '@/types/poker';
import { DEFAULT_ACTION_DEFS } from '@/utils/actionMeta';

type Entry = [hands: HandNotation[], actions: Array<[Action, number]>];

function toActions(pairs: Array<[Action, number]>): HandAction[] {
  return pairs.map(([action, weight]) => ({ action, weight }));
}

function buildCells(entries: Entry[]): Record<HandNotation, RangeCellData> {
  const cells: Record<HandNotation, RangeCellData> = {};
  for (const [hands, actionPairs] of entries) {
    const actions = toActions(actionPairs);
    const total = actions.reduce((acc, a) => acc + a.weight, 0);
    const filled =
      total < 100
        ? [...actions, { action: 'FOLD' as const, weight: 100 - total }]
        : actions;
    for (const hand of hands) {
      cells[hand] = { hand, actions: filled };
    }
  }
  return cells;
}

const BTN_RFI_ENTRIES: Entry[] = [
  [['AA', 'KK', 'QQ', 'JJ', 'TT', '99'], [['RAISE', 100]]],
  [['88', '77'], [['RAISE', 70], ['CALL', 30]]],
  [['66', '55', '44', '33', '22'], [['RAISE', 50], ['CALL', 50]]],
  [['AKs', 'AQs', 'AJs', 'ATs'], [['RAISE', 100]]],
  [
    ['A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s'],
    [['RAISE', 80], ['CALL', 20]],
  ],
  [['KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs'], [['RAISE', 100]]],
  [['K9s', 'Q9s', 'J9s', 'T9s'], [['RAISE', 70], ['CALL', 30]]],
  [['98s', '87s', '76s', '65s'], [['RAISE', 60], ['CALL', 40]]],
  [['54s'], [['CALL', 50], ['FOLD', 50]]],
  [['AKo', 'AQo', 'AJo', 'KQo'], [['RAISE', 100]]],
  [['ATo', 'KJo', 'QJo'], [['RAISE', 80], ['FOLD', 20]]],
  [['A9o', 'KTo', 'QTo', 'JTo'], [['CALL', 50], ['FOLD', 50]]],
];

const CO_RFI_ENTRIES: Entry[] = [
  [['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88'], [['RAISE', 100]]],
  [['77', '66', '55'], [['RAISE', 80], ['CALL', 20]]],
  [['44', '33', '22'], [['RAISE', 60], ['CALL', 40]]],
  [['AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A5s', 'A4s'], [['RAISE', 100]]],
  [['A8s', 'A7s', 'A6s', 'A3s', 'A2s'], [['RAISE', 70], ['CALL', 30]]],
  [['KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s'], [['RAISE', 100]]],
  [['K9s', 'Q9s', 'J9s', '87s', '76s', '65s'], [['RAISE', 80], ['CALL', 20]]],
  [['54s'], [['RAISE', 50], ['FOLD', 50]]],
  [['AKo', 'AQo', 'AJo', 'KQo', 'KJo'], [['RAISE', 100]]],
  [['ATo', 'QJo'], [['RAISE', 80], ['FOLD', 20]]],
];

const UTG_RFI_ENTRIES: Entry[] = [
  [['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77'], [['RAISE', 100]]],
  [['66', '55'], [['RAISE', 60], ['CALL', 40]]],
  [['AKs', 'AQs', 'AJs', 'ATs'], [['RAISE', 100]]],
  [['A5s', 'A4s'], [['RAISE', 70], ['FOLD', 30]]],
  [['KQs', 'KJs', 'QJs', 'JTs', 'T9s'], [['RAISE', 100]]],
  [['KTs', '98s', '87s'], [['RAISE', 70], ['CALL', 30]]],
  [['AKo', 'AQo', 'AJo', 'KQo'], [['RAISE', 100]]],
];

const BB_VS_BTN_ENTRIES: Entry[] = [
  [['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'], [['THREEBET', 100]]],
  [['TT', '99', '88', 'AQs', 'AQo'], [['THREEBET', 60], ['CALL', 40]]],
  [['77', '66', '55', '44', '33', '22'], [['CALL', 100]]],
  [['AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'JTs', 'T9s'], [['CALL', 100]]],
  [
    ['A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s'],
    [['CALL', 80], ['THREEBET', 20]],
  ],
  [['KTs', 'K9s', 'QTs', 'Q9s', 'J9s', '98s', '87s', '76s', '65s'], [['CALL', 100]]],
  [['K8s', 'K7s', 'Q8s', 'J8s', 'T8s', '54s'], [['CALL', 70], ['FOLD', 30]]],
  [['AJo', 'ATo', 'KQo', 'KJo', 'QJo'], [['CALL', 100]]],
  [['A9o', 'KTo', 'QTo', 'JTo', 'T9o', '98o'], [['CALL', 60], ['FOLD', 40]]],
];

const ACTIONS = DEFAULT_ACTION_DEFS.map((d) => ({ ...d }));

function sample(
  id: string,
  name: string,
  position: Range['position'],
  situation: Range['situation'],
  group: string,
  entries: Entry[],
  extra: Partial<Range> = {},
): Range {
  return {
    id,
    name,
    position,
    situation,
    group,
    cells: buildCells(entries),
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    actions: ACTIONS.map((a) => ({ ...a })),
    tableFormat: '6max',
    ...extra,
  };
}

/** Single-range demo (kept for backwards-compat callers). */
export const SAMPLE_BTN_RFI: Range = sample(
  'sample-btn-rfi',
  'BTN RFI (demo)',
  'BTN',
  'RFI',
  'Demo/Opens',
  BTN_RFI_ENTRIES,
);

/** Multi-range demo: 1 folder + 1 subfolder + 4 ranges so Overview/RangeManager
 *  show off folder navigation, palette reuse and comparison out of the box. */
export const SAMPLE_RANGES: readonly Range[] = [
  SAMPLE_BTN_RFI,
  sample(
    'sample-co-rfi',
    'CO RFI (demo)',
    'CO',
    'RFI',
    'Demo/Opens',
    CO_RFI_ENTRIES,
  ),
  sample(
    'sample-utg-rfi',
    'UTG RFI (demo)',
    'UTG',
    'RFI',
    'Demo/Opens',
    UTG_RFI_ENTRIES,
  ),
  sample(
    'sample-bb-vs-btn',
    'BB vs BTN (demo)',
    'BB',
    'vs_RFI',
    'Demo/Defense',
    BB_VS_BTN_ENTRIES,
    { villainPosition: 'BTN' },
  ),
];
