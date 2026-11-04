// Category catalogue (spec §5): ids, groups, labels and the tooltip
// definitions shown in the UI. Definitions are our own.

export const MADE_CATEGORIES = [
  'sf-quads',
  'full-house',
  'flush',
  'straight',
  'set',
  'trips',
  'two-pair',
  'overpair',
  'top-pair',
  'pp-below-top',
  'middle-pair',
  'pp-below-second',
  'weak-pair',
  'pp-below-board',
  // "Sin hecho" sub-rows, exclusive by high card
  'ace-high',
  'king-high',
  'nothing',
] as const;
export type MadeCategory = (typeof MADE_CATEGORIES)[number];

export const NO_MADE_CATEGORIES = [
  'ace-high',
  'king-high',
  'nothing',
] as const satisfies readonly MadeCategory[];

/** One-pair rows (8–14): what "+ par" means in combo draws. */
export const ONE_PAIR_CATEGORIES = [
  'overpair',
  'top-pair',
  'pp-below-top',
  'middle-pair',
  'pp-below-second',
  'weak-pair',
  'pp-below-board',
] as const satisfies readonly MadeCategory[];

export const DRAW_CATEGORIES = [
  'fd-2',
  'fd-1',
  'oesd-2',
  'oesd-1',
  'double-gutshot',
  'gutshot-2',
  'gutshot-1',
  'bdfd-2',
  'bdfd-1',
  // Filter element only: shown in the table combined with BDFD (§5.2).
  'bdsd',
  // Not exclusive, every street; pocket pairs excluded (they are overpairs).
  'two-overcards',
  'one-overcard',
] as const;
export type DrawCategory = (typeof DRAW_CATEGORIES)[number];

export const COMBO_DRAW_CATEGORIES = [
  'fd-oesd',
  'fd-gutshot',
  'fd-pair',
  'oesd-pair',
  'gutshot-pair',
  'fd-overcards',
  'bdsd-bdfd',
  'gutshot-bdfd',
] as const;
export type ComboDrawCategory = (typeof COMBO_DRAW_CATEGORIES)[number];

/** Aggregates: filter-builder elements only, never table rows. */
export const AGGREGATE_CATEGORIES = [
  'any-fd',
  'any-straight-draw',
  'any-bdfd',
  'one-pair',
  'pair-or-better',
  'no-made',
] as const;
export type AggregateCategory = (typeof AGGREGATE_CATEGORIES)[number];

export type CategoryId = MadeCategory | DrawCategory | ComboDrawCategory | AggregateCategory;

export const ALL_CATEGORIES: readonly CategoryId[] = [
  ...MADE_CATEGORIES,
  ...DRAW_CATEGORIES,
  ...COMBO_DRAW_CATEGORIES,
  ...AGGREGATE_CATEGORIES,
];

const CATEGORY_SET = new Set<string>(ALL_CATEGORIES);

export function isCategoryId(id: string): id is CategoryId {
  return CATEGORY_SET.has(id);
}

/** Members of each aggregate. */
export const AGGREGATE_MEMBERS: Record<AggregateCategory, readonly CategoryId[]> = {
  'any-fd': ['fd-2', 'fd-1'],
  'any-straight-draw': ['oesd-2', 'oesd-1', 'double-gutshot', 'gutshot-2', 'gutshot-1'],
  'any-bdfd': ['bdfd-2', 'bdfd-1'],
  'one-pair': ONE_PAIR_CATEGORIES,
  'pair-or-better': MADE_CATEGORIES.slice(0, MADE_CATEGORIES.indexOf('ace-high')),
  'no-made': NO_MADE_CATEGORIES,
};

/** Draw rows shown in the table (BDSD alone is not a row). */
export const DRAW_ROWS: readonly DrawCategory[] = DRAW_CATEGORIES.filter((c) => c !== 'bdsd');

/** Draws exist only on the flop and turn (overcards on every street); backdoors only on the flop. */
export const FLOP_ONLY: ReadonlySet<CategoryId> = new Set<CategoryId>([
  'bdfd-2',
  'bdfd-1',
  'bdsd',
  'bdsd-bdfd',
  'gutshot-bdfd',
]);

/** Rows that matter most for the villain's check-raise presets (§12, phase 6). */
export const CHECK_RAISE_KEY_ROWS: readonly CategoryId[] = ['bdsd-bdfd', 'gutshot-bdfd'];

export type CategoryInfo = { label: string; definition: string };

export const CATEGORY_INFO: Record<CategoryId, CategoryInfo> = {
  'sf-quads': {
    label: 'Escalera de color / póker',
    definition:
      'Escalera de color o póker en el que participa al menos una carta propia. Un póker del board con tu kicker no cuenta.',
  },
  'full-house': {
    label: 'Full house',
    definition:
      'Full house en el que una carta propia es parte del trío o de la pareja. Ej.: board K-K-7 y tienes 7-x, o board K-K-7-7 y tienes K-x.',
  },
  flush: {
    label: 'Color',
    definition:
      'Color en el que al menos una carta propia está entre las 5 que juegan. Atributo: nut-rank de tu carta más alta del palo.',
  },
  straight: {
    label: 'Escalera',
    definition:
      'Escalera que usa al menos una carta propia que no está en el board. Atributo: usa 1 o 2 cartas propias.',
  },
  set: {
    label: 'Set',
    definition: 'Pocket pair más una carta del board de ese rango.',
  },
  trips: {
    label: 'Trío',
    definition: 'Una carta propia más un board pareado de ese rango.',
  },
  'two-pair': {
    label: 'Doble pareja',
    definition:
      'Cada carta propia empareja un rango distinto del board. Atributo: top two / top + otra / dos de abajo. Una carta que empareja en un board ya pareado no es doble pareja: se clasifica como par según su posición.',
  },
  overpair: {
    label: 'Overpair',
    definition:
      'Pocket pair por encima de la carta más alta del board. En board pareado el pocket pair se clasifica igual, por su posición.',
  },
  'top-pair': {
    label: 'Top pair',
    definition:
      'Una carta propia empareja el rango más alto del board. En board pareado cuenta la posición del rango que emparejas entre los rangos distintos. Atributo: kicker.',
  },
  'pp-below-top': {
    label: 'PP < top card',
    definition: 'Pocket pair entre el rango más alto y el segundo del board.',
  },
  'middle-pair': {
    label: 'Middle pair',
    definition: 'Una carta propia empareja el segundo rango distinto del board. Atributo: kicker.',
  },
  'pp-below-second': {
    label: 'PP < 2nd card',
    definition:
      'Pocket pair por debajo del segundo rango del board y por encima del rango más bajo.',
  },
  'weak-pair': {
    label: 'Weak pair',
    definition:
      'Una carta propia empareja el tercer rango distinto del board o uno menor. Atributo: kicker.',
  },
  'pp-below-board': {
    label: 'PP < board',
    definition: 'Pocket pair por debajo del rango más bajo del board.',
  },
  'ace-high': {
    label: 'A-high',
    definition: 'Sin mano hecha y con un As.',
  },
  'king-high': {
    label: 'K-high',
    definition: 'Sin mano hecha, con un K y sin As.',
  },
  nothing: {
    label: 'Nada',
    definition:
      'Sin mano hecha y sin As ni K. En el river, un combo cuyas cartas no mejoran lo que ya da el board también es "sin hecho" (A-high, K-high o Nada según sus cartas).',
  },
  'two-overcards': {
    label: 'Dos overcards',
    definition:
      'Ambas cartas propias por encima del rango más alto del board. No es exclusiva: puede sumarse a otras filas. Los pocket pairs no cuentan (son overpair).',
  },
  'one-overcard': {
    label: 'Una overcard',
    definition:
      'Exactamente una carta propia por encima del rango más alto del board (la otra puede emparejar). No es exclusiva.',
  },
  'fd-2': {
    label: 'FD 2 cartas',
    definition: 'Tus dos cartas del mismo palo y dos cartas del board de ese palo.',
  },
  'fd-1': {
    label: 'FD 1 carta',
    definition: 'Una carta propia del palo y tres cartas del board de ese palo.',
  },
  'oesd-2': {
    label: 'OESD 2 cartas',
    definition:
      'Dos o más rangos de outs y 4 rangos consecutivos abiertos por ambos lados que incluyen una carta propia. Toda escalera completada necesita tus dos cartas.',
  },
  'oesd-1': {
    label: 'OESD 1 carta',
    definition:
      'Como el OESD de 2 cartas, pero alguna escalera se completa usando solo una de tus cartas.',
  },
  'double-gutshot': {
    label: 'Double gutshot',
    definition:
      'Dos o más rangos de outs sin 4 rangos consecutivos abiertos por ambos lados (ej.: 9-7 en J-8-5).',
  },
  'gutshot-2': {
    label: 'Gutshot 2 cartas',
    definition: 'Exactamente un rango de out y la escalera necesita tus dos cartas.',
  },
  'gutshot-1': {
    label: 'Gutshot 1 carta',
    definition: 'Exactamente un rango de out y la escalera se completa con una sola de tus cartas.',
  },
  'bdfd-2': {
    label: 'BDFD 2 cartas',
    definition: 'Solo flop: tus dos cartas del mismo palo y una carta del board de ese palo.',
  },
  'bdfd-1': {
    label: 'BDFD 1 carta',
    definition: 'Solo flop: una carta propia del palo y dos cartas del board de ese palo.',
  },
  bdsd: {
    label: 'BDSD',
    definition:
      'Solo flop: turn + river pueden completar una escalera que usa al menos una carta propia, y no tienes OESD, double gutshot ni gutshot. Atributo: usa 1 o 2 cartas propias.',
  },
  'fd-oesd': {
    label: 'FD + OESD',
    definition: 'Flush draw (1 o 2 cartas) más OESD o double gutshot.',
  },
  'fd-gutshot': {
    label: 'FD + gutshot',
    definition: 'Flush draw más gutshot.',
  },
  'fd-pair': {
    label: 'FD + par',
    definition: 'Flush draw más una pareja (overpair, top/middle/weak pair o pocket pair).',
  },
  'oesd-pair': {
    label: 'OESD + par',
    definition: 'OESD o double gutshot más una pareja.',
  },
  'gutshot-pair': {
    label: 'Gutshot + par',
    definition: 'Gutshot más una pareja.',
  },
  'fd-overcards': {
    label: 'FD + overcards',
    definition: 'Flush draw sin mano hecha y con al menos una overcard.',
  },
  'bdsd-bdfd': {
    label: 'BDSD + BDFD',
    definition:
      'Solo flop: backdoor de escalera y backdoor de color a la vez. Candidatos típicos a check-raise de farol OOP.',
  },
  'gutshot-bdfd': {
    label: 'Gutshot + BDFD',
    definition:
      'Solo flop: gutshot (1 o 2 cartas) más backdoor de color (1 o 2 cartas). Otra fila clave para check-raise de farol OOP.',
  },
  'any-fd': { label: 'Flush draw', definition: 'FD de 1 o 2 cartas.' },
  'any-straight-draw': {
    label: 'Proyecto de escalera',
    definition: 'OESD, double gutshot o gutshot.',
  },
  'any-bdfd': { label: 'BDFD', definition: 'BDFD de 1 o 2 cartas.' },
  'one-pair': {
    label: 'Una pareja',
    definition: 'Overpair, top/middle/weak pair o cualquier pocket pair por posición.',
  },
  'pair-or-better': { label: 'Par o mejor', definition: 'Cualquier mano hecha.' },
  'no-made': { label: 'Sin hecho', definition: 'Ninguna mano hecha.' },
};
