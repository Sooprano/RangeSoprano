// Tolerant parser for iPoker / PokerTracker hand-history `.txt` exports.
// Never throws: returns { hand, errors }. Mirrors the tolerant style of
// `handRangeParser.ts`. Pure — no React, no side effects.
//
// The parser extracts the spot (positions, stacks, board per street) and a
// running-pot engine so each decision carries the pot that preceded it — the
// numbers that seed the EV calculators in the análisis module.

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Card = { rank: string; suit: Suit };

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type ActionType =
  | 'post'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'fold'
  | 'allin';

export type Decision = {
  /** Stable id for React keys: `${street}-${index}`. */
  id: string;
  street: Street;
  actor: string;
  isHero: boolean;
  type: ActionType;
  /** Chips this action added to the pot (0 for check/fold). */
  amount: number;
  /** Running pot just before this action — feeds the calculators. */
  potBefore: number;
};

export type PlayerInfo = {
  name: string;
  seat: number;
  stack: number;
  isDealer: boolean;
};

export type StreetData = {
  street: Street;
  /** Cumulative board visible on this street (3 on flop, 4 on turn, 5 on river). */
  board: Card[];
  decisions: Decision[];
  /** Pot at the start of the street (after previous streets). */
  potStart: number;
};

export type Showdown = { name: string; cards: Card[]; description: string };

export type ParsedHand = {
  gameId: string | null;
  dateTime: string | null;
  /** Currency symbol detected in amounts ('€', '$' or ''). */
  currency: string;
  smallBlind: number | null;
  bigBlind: number | null;
  ante: number | null;
  players: PlayerInfo[];
  hero: string | null;
  heroCards: Card[];
  /** Full board, up to 5 cards. */
  board: Card[];
  streets: StreetData[];
  totalPot: number | null;
  shows: Showdown[];
  winners: { name: string; amount: number }[];
};

export type HandParseError = { line: string; reason: string };
export type HandParseResult = { hand: ParsedHand | null; errors: HandParseError[] };

const SUIT_MAP: Record<string, Suit> = {
  H: '♥',
  S: '♠',
  C: '♣',
  D: '♦',
};

const VALID_RANKS = new Set([
  'A',
  'K',
  'Q',
  'J',
  'T',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
]);

/** Parses a single card token like "HJ", "C9" or "D10" → { rank, suit }. */
export function parseCardToken(token: string): Card | null {
  const t = token.trim();
  if (t.length < 2) return null;
  const suit = SUIT_MAP[t[0]!.toUpperCase()];
  if (!suit) return null;
  let rank = t.slice(1).toUpperCase();
  if (rank === '10') rank = 'T';
  if (!VALID_RANKS.has(rank)) return null;
  return { rank, suit };
}

/** Parses the bracketed card list inside a line, e.g. "[HA H7 C9]". */
function parseCardsInBrackets(line: string): Card[] | null {
  const match = line.match(/\[([^\]]*)\]/);
  if (!match) return null;
  const tokens = match[1]!.trim().split(/\s+/).filter(Boolean);
  const cards: Card[] = [];
  for (const tok of tokens) {
    const card = parseCardToken(tok);
    if (!card) return null;
    cards.push(card);
  }
  return cards;
}

/** Extracts the first monetary amount and currency symbol from a string. */
function parseAmount(text: string): { amount: number; currency: string } | null {
  const match = text.match(/([€$£]?)\s*([\d.,]+)/);
  if (!match) return null;
  const currency = match[1] ?? '';
  // Amounts use '.' as decimal and no thousands separators in this format;
  // strip stray commas defensively.
  const numeric = Number(match[2]!.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return null;
  return { amount: numeric, currency };
}

/** Returns the last `... to €Y` amount if present (raise total-to). */
function parseRaiseTo(text: string): number | null {
  const match = text.match(/to\s+[€$£]?\s*([\d.,]+)/i);
  if (!match) return null;
  const numeric = Number(match[1]!.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

const STREET_OF_MARKER: Record<string, Street> = {
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
};

export function parseHandHistory(raw: string): HandParseResult {
  const errors: HandParseError[] = [];
  const lines = raw.split(/\r?\n/);

  const players: PlayerInfo[] = [];
  let gameId: string | null = null;
  let dateTime: string | null = null;
  let currency = '';
  let smallBlind: number | null = null;
  let bigBlind: number | null = null;
  let ante: number | null = null;
  let hero: string | null = null;
  let heroCards: Card[] = [];
  let totalPot: number | null = null;
  const shows: Showdown[] = [];
  const winners: { name: string; amount: number }[] = [];

  // Street accumulators.
  const streets: StreetData[] = [];
  let currentStreet: Street = 'preflop';
  let currentBoard: Card[] = [];
  let runningPot = 0;
  // Chips committed in the current street, per player (to resolve raises "to Y").
  let committed: Record<string, number> = {};
  let inSummary = false;

  const setCurrency = (c: string) => {
    if (c && !currency) currency = c;
  };

  const ensureStreet = (street: Street, board: Card[]): StreetData => {
    let sd = streets.find((s) => s.street === street);
    if (!sd) {
      sd = { street, board, decisions: [], potStart: runningPot };
      streets.push(sd);
    }
    return sd;
  };

  // Seed the preflop street up front so posts/actions have a home.
  ensureStreet('preflop', []);

  const pushDecision = (
    actor: string,
    type: ActionType,
    amount: number,
  ): void => {
    const sd = ensureStreet(currentStreet, currentBoard);
    const potBefore = runningPot;
    if (amount > 0) {
      runningPot += amount;
      committed[actor] = (committed[actor] ?? 0) + amount;
    }
    sd.decisions.push({
      id: `${currentStreet}-${sd.decisions.length}`,
      street: currentStreet,
      actor,
      isHero: actor === hero,
      type,
      amount,
      potBefore,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // ── Header ────────────────────────────────────────────────────────────
    if (line.startsWith('GAME #')) {
      const idMatch = line.match(/GAME #(\d+)/);
      gameId = idMatch ? idMatch[1]! : null;
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      dateTime = dateMatch ? dateMatch[1]! : null;
      continue;
    }

    if (line.startsWith('Table Info:')) {
      const blinds = line.match(/Blinds:\s*([\d.]+)\s*\/\s*([\d.]+)/i);
      if (blinds) {
        smallBlind = Number(blinds[1]);
        bigBlind = Number(blinds[2]);
      }
      const anteMatch = line.match(/Ante:\s*([\d.]+)/i);
      if (anteMatch) ante = Number(anteMatch[1]);
      continue;
    }

    // Seat line: "Seat 6: Balans3 (€572.00 in chips)  DEALER"
    const seatMatch = line.match(/^Seat\s+(\d+):\s+(.+?)\s+\(([^)]*)\)(.*)$/);
    if (seatMatch && !inSummary) {
      const seat = Number(seatMatch[1]);
      const name = seatMatch[2]!.trim();
      const amt = parseAmount(seatMatch[3]!);
      if (amt) setCurrency(amt.currency);
      players.push({
        name,
        seat,
        stack: amt ? amt.amount : 0,
        isDealer: /DEALER/i.test(seatMatch[4] ?? ''),
      });
      continue;
    }

    // ── Street markers ────────────────────────────────────────────────────
    const markerMatch = line.match(/^\*\*\*\s*([A-Z ]+?)\s*\*\*\*/);
    if (markerMatch) {
      const marker = markerMatch[1]!.trim();
      if (marker === 'SUMMARY') {
        inSummary = true;
        continue;
      }
      const street = STREET_OF_MARKER[marker];
      if (street) {
        const cards = parseCardsInBrackets(line);
        if (cards) {
          currentBoard = currentBoard.concat(cards);
        } else if (marker === 'FLOP' || marker === 'TURN' || marker === 'RIVER') {
          errors.push({ line, reason: 'No pude leer el board de la calle' });
        }
        currentStreet = street;
        committed = {};
        ensureStreet(street, currentBoard.slice());
      }
      // HOLE CARDS and any other marker just reset nothing else.
      continue;
    }

    // ── Hero hole cards ───────────────────────────────────────────────────
    const dealtMatch = line.match(/^Dealt to\s+(.+?)\s+\[/);
    if (dealtMatch) {
      hero = dealtMatch[1]!.trim();
      const cards = parseCardsInBrackets(line);
      if (cards) heroCards = cards;
      else errors.push({ line, reason: 'No pude leer las cartas del héroe' });
      continue;
    }

    // ── Summary lines ─────────────────────────────────────────────────────
    if (inSummary) {
      if (/^Total pot/i.test(line)) {
        const amt = parseAmount(line.replace(/Rake.*$/i, ''));
        if (amt) {
          totalPot = amt.amount;
          setCurrency(amt.currency);
        }
        continue;
      }
      const showsMatch = line.match(/^(.+?):\s*Shows?\s+\[([^\]]*)\]\s*(.*)$/i);
      if (showsMatch) {
        const cards = parseCardsInBrackets(line) ?? [];
        shows.push({
          name: showsMatch[1]!.trim(),
          cards,
          description: (showsMatch[3] ?? '').trim(),
        });
        continue;
      }
      const winsMatch = line.match(/^(.+?):\s*wins\s+(.+)$/i);
      if (winsMatch) {
        const amt = parseAmount(winsMatch[2]!);
        if (amt) {
          winners.push({ name: winsMatch[1]!.trim(), amount: amt.amount });
          setCurrency(amt.currency);
        }
        continue;
      }
      continue;
    }

    // ── Action lines: "<name>: <verb> [amount]" ───────────────────────────
    const actionMatch = line.match(/^(.+?):\s+(.+)$/);
    if (actionMatch) {
      const actor = actionMatch[1]!.trim();
      const rest = actionMatch[2]!.trim();
      const lower = rest.toLowerCase();

      if (lower.startsWith('post')) {
        const amt = parseAmount(rest);
        if (amt) {
          setCurrency(amt.currency);
          pushDecision(actor, 'post', amt.amount);
        }
        continue;
      }
      if (lower.startsWith('check')) {
        pushDecision(actor, 'check', 0);
        continue;
      }
      if (lower.startsWith('fold')) {
        pushDecision(actor, 'fold', 0);
        continue;
      }
      if (lower.startsWith('call')) {
        const amt = parseAmount(rest);
        if (amt) {
          setCurrency(amt.currency);
          pushDecision(actor, 'call', amt.amount);
        }
        continue;
      }
      if (lower.startsWith('bet')) {
        const amt = parseAmount(rest);
        if (amt) {
          setCurrency(amt.currency);
          pushDecision(actor, 'bet', amt.amount);
        }
        continue;
      }
      if (lower.startsWith('raise') || lower.includes('all-in') || lower.includes('allin')) {
        const isAllin = lower.includes('all-in') || lower.includes('allin');
        const to = parseRaiseTo(rest);
        const amt = parseAmount(rest);
        // Prefer the "to Y" total when present (additional = total − committed).
        let added: number | null = null;
        if (to !== null) {
          added = to - (committed[actor] ?? 0);
        } else if (amt) {
          added = amt.amount;
        }
        if (amt) setCurrency(amt.currency);
        if (added !== null && added >= 0) {
          pushDecision(actor, isAllin ? 'allin' : 'raise', added);
        }
        continue;
      }
      // Unknown action verb — ignore quietly (tolerant).
      continue;
    }
  }

  // A hand is "parsed" if we at least found players and a hero or a board.
  const hasContent = players.length > 0 || hero !== null || currentBoard.length > 0;
  if (!hasContent) {
    errors.push({
      line: '',
      reason: 'No reconocí ninguna mano en el texto pegado.',
    });
    return { hand: null, errors };
  }

  const hand: ParsedHand = {
    gameId,
    dateTime,
    currency,
    smallBlind,
    bigBlind,
    ante,
    players,
    hero,
    heroCards,
    board: currentBoard,
    streets,
    totalPot,
    shows,
    winners,
  };

  return { hand, errors };
}

/** Renders a card as text, e.g. { rank:'A', suit:'♥' } → "A♥". */
export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}
