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

const ENTRIES: Entry[] = [
  // Pares altos: 100% Raise
  [['AA', 'KK', 'QQ', 'JJ', 'TT', '99'], [['RAISE', 100]]],
  // Pares medios: mix Raise/Call
  [['88', '77'], [['RAISE', 70], ['CALL', 30]]],
  [['66', '55', '44', '33', '22'], [['RAISE', 50], ['CALL', 50]]],
  // Suited aces premium
  [['AKs', 'AQs', 'AJs', 'ATs'], [['RAISE', 100]]],
  // Suited aces ruedas: mix
  [
    ['A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s'],
    [['RAISE', 80], ['CALL', 20]],
  ],
  // Broadways suited premium
  [['KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs'], [['RAISE', 100]]],
  // Suited gaps: mix
  [['K9s', 'Q9s', 'J9s', 'T9s'], [['RAISE', 70], ['CALL', 30]]],
  // Suited connectors
  [['98s', '87s', '76s', '65s'], [['RAISE', 60], ['CALL', 40]]],
  // Marginal SC
  [['54s'], [['CALL', 50], ['FOLD', 50]]],
  // Offsuit premium
  [['AKo', 'AQo', 'AJo', 'KQo'], [['RAISE', 100]]],
  // Offsuit broadways: mix Raise/Fold
  [['ATo', 'KJo', 'QJo'], [['RAISE', 80], ['FOLD', 20]]],
  // Marginal offsuit: mix Call/Fold
  [['A9o', 'KTo', 'QTo', 'JTo'], [['CALL', 50], ['FOLD', 50]]],
];

export const SAMPLE_BTN_RFI: Range = {
  id: 'sample-btn-rfi',
  name: 'BTN RFI (demo)',
  position: 'BTN',
  situation: 'RFI',
  cells: buildCells(ENTRIES),
  createdAt: '2026-04-20T00:00:00.000Z',
  updatedAt: '2026-04-20T00:00:00.000Z',
  actions: DEFAULT_ACTION_DEFS.map((d) => ({ ...d })),
};
