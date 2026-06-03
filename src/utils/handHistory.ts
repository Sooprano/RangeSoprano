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

/**
 * Parses a single card token, order-agnostic, so both dialects work:
 *   - iPoker: suit-first uppercase, e.g. "HJ", "C9", "D10"
 *   - GGPoker/Stars: rank-first, suit lowercase, e.g. "Js", "Td", "9c"
 * The suit is the single char in {s,h,c,d} (any case); the rest is the rank.
 * Rank letters (A,K,Q,J,T) never collide with suit letters (S,H,C,D).
 */
export function parseCardToken(token: string): Card | null {
  const t = token.trim();
  if (t.length < 2) return null;
  let suit: Suit | undefined;
  let rankChars = '';
  for (const ch of t) {
    const up = ch.toUpperCase();
    if (up === 'S' || up === 'H' || up === 'C' || up === 'D') {
      if (suit) return null; // two suit chars → not a card
      suit = SUIT_MAP[up];
    } else {
      rankChars += ch;
    }
  }
  if (!suit) return null;
  let rank = rankChars.toUpperCase();
  if (rank === '10') rank = 'T';
  if (!VALID_RANKS.has(rank)) return null;
  return { rank, suit };
}

/**
 * Parses every bracketed card group in a line, concatenated.
 *   - iPoker "[HA H7 C9]" → 3 cards; "[H3]" → 1 card
 *   - GG "[2h Qc 5s] [Ah]" → 4 cards (full board repeated each street)
 * Returns null if any token fails to parse.
 */
function parseAllCardsInBrackets(line: string): Card[] | null {
  const groups = line.match(/\[([^\]]*)\]/g);
  if (!groups) return null;
  const cards: Card[] = [];
  for (const group of groups) {
    const inner = group.slice(1, -1).trim();
    if (!inner) continue;
    for (const tok of inner.split(/\s+/).filter(Boolean)) {
      const card = parseCardToken(tok);
      if (!card) return null;
      cards.push(card);
    }
  }
  return cards;
}

/** Expected total board size once a street is reached. */
const BOARD_SIZE: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

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
  let buttonSeat: number | null = null;
  const shows: Showdown[] = [];
  const winners: { name: string; amount: number }[] = [];

  const addShow = (name: string, cards: Card[], description: string) => {
    if (shows.some((s) => s.name === name)) return;
    shows.push({ name, cards, description });
  };
  // Body "collected" lines are authoritative and can repeat per player on split
  // pots (main + side) — sum them.
  const addCollected = (name: string, amount: number) => {
    const existing = winners.find((w) => w.name === name);
    if (existing) existing.amount += amount;
    else winners.push({ name, amount });
  };
  // Summary "won/wins" is a fallback — skip if the player already has a total.
  const addWinner = (name: string, amount: number) => {
    if (winners.some((w) => w.name === name)) return;
    winners.push({ name, amount });
  };

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

    // ── Header (iPoker "GAME #…" / GG "Poker Hand #…" / PokerStars / Winamax) ─
    if (
      line.startsWith('GAME #') ||
      line.startsWith('Poker Hand #') ||
      line.startsWith('PokerStars') ||
      line.startsWith('Winamax')
    ) {
      const idMatch = line.match(/#(\S+?)[\s:]/);
      gameId = idMatch ? idMatch[1]! : null;
      const dateMatch = line.match(
        /(\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}:\d{2})/,
      );
      dateTime = dateMatch ? dateMatch[1]! : null;
      // Blinds in parens, with optional currency: GG "Level1(10/20)",
      // Winamax "(40/80)", PokerStars cash "($0.02/$0.05 USD)".
      const blinds = line.match(
        /\(\s*([€$£]?)(\d+(?:\.\d+)?)\s*\/\s*[€$£]?(\d+(?:\.\d+)?)/,
      );
      if (blinds) {
        setCurrency(blinds[1] ?? '');
        smallBlind = Number(blinds[2]);
        bigBlind = Number(blinds[3]);
      }
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

    // Table line with the button seat:
    //   GG:      "Table '36270' 3-max Seat #1 is the button"
    //   Winamax: "Table: 'Expresso(…)#0' 3-max (real money) Seat #3 is the button"
    // (iPoker "Table Info:" was already handled above.)
    if (line.startsWith('Table')) {
      const btn = line.match(/Seat #(\d+) is the button/i);
      if (btn) buttonSeat = Number(btn[1]);
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
        const cards = parseAllCardsInBrackets(line);
        if (cards) {
          // GG repeats the full board each street (length === expected); iPoker
          // lists only the new card(s) → concat. Pick whichever yields the board.
          const expected = BOARD_SIZE[street];
          currentBoard =
            cards.length === expected ? cards : currentBoard.concat(cards);
        } else {
          errors.push({ line, reason: 'No pude leer el board de la calle' });
        }
        currentStreet = street;
        committed = {};
        ensureStreet(street, currentBoard.slice());
      }
      // HOLE CARDS and any other marker just reset nothing else.
      continue;
    }

    // ── Hero hole cards (only the line with brackets is the hero; in GG the
    //    opponents also have "Dealt to X" lines but without cards) ───────────
    const dealtMatch = line.match(/^Dealt to\s+(.+?)\s+\[/);
    if (dealtMatch) {
      hero = dealtMatch[1]!.trim();
      const cards = parseAllCardsInBrackets(line);
      if (cards) heroCards = cards;
      else errors.push({ line, reason: 'No pude leer las cartas del héroe' });
      continue;
    }

    // ── Uncalled bet returned (subtract from pot — it was never matched) ────
    //    PokerStars wraps the amount with currency: "Uncalled bet ($1.01)".
    const uncalled = line.match(/^Uncalled bet \(([^)]+)\) returned to (.+)$/i);
    if (uncalled) {
      const amt = parseAmount(uncalled[1]!);
      const name = uncalled[2]!.trim();
      if (amt) {
        setCurrency(amt.currency);
        runningPot -= amt.amount;
        committed[name] = (committed[name] ?? 0) - amt.amount;
      }
      continue;
    }

    // ── Winner via "name collected X from [main/side] pot" (GG/Stars/Winamax) ─
    const collected = line.match(
      /^(.+?)\s+collected\s+([€$£]?[\d.,]+)\s+from\b/i,
    );
    if (collected && !inSummary) {
      const amt = parseAmount(collected[2]!);
      if (amt) {
        setCurrency(amt.currency);
        addCollected(collected[1]!.trim(), amt.amount);
      }
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
      // iPoker: "Balans3: Shows [HJ S9] One Pair, Nines"
      const showsMatch = line.match(/^(.+?):\s*Shows?\s+\[([^\]]*)\]\s*(.*)$/i);
      if (showsMatch) {
        addShow(showsMatch[1]!.trim(), parseAllCardsInBrackets(line) ?? [], (showsMatch[3] ?? '').trim());
        continue;
      }
      // iPoker: "Balans3: wins €350.00"
      const winsMatch = line.match(/^(.+?):\s*wins\s+(.+)$/i);
      if (winsMatch) {
        const amt = parseAmount(winsMatch[2]!);
        if (amt) {
          addWinner(winsMatch[1]!.trim(), amt.amount);
          setCurrency(amt.currency);
        }
        continue;
      }
      // GG/Stars: "Seat 1: Hero (big blind) showed [9c Qh] and won (540) with a pair of Queens"
      const ggSeat = line.match(/^Seat\s+\d+:\s+(.+?)\s+\(/);
      if (ggSeat) {
        const name = ggSeat[1]!.trim();
        if (/show(?:ed|s)?\s+\[/i.test(line)) {
          const desc = line.match(/\bwith\s+(.+)$/i);
          addShow(name, parseAllCardsInBrackets(line) ?? [], desc ? desc[1]!.trim() : '');
        }
        // "won (540)" / "won 1438" / PokerStars "won ($2.67)" — parens and
        // currency optional.
        const won = line.match(/\bwon\s+\(?([€$£]?[\d.,]+)/i);
        if (won) {
          const a = parseAmount(won[1]!);
          if (a) addWinner(name, a.amount);
        }
        continue;
      }
      continue;
    }

    // ── Action lines ──────────────────────────────────────────────────────
    // iPoker/GG/Stars use "Name: verb …"; Winamax omits the colon
    // ("Atenea. posts small blind 40"). Try the colon form first, then fall
    // back to a verb-anchored match for the colon-less dialect.
    // Only treat a colon line as an action if what follows the colon is a known
    // verb — Winamax hand descriptions contain " : " (e.g. "Two pairs : 5 and
    // 4") which would otherwise false-match the "Name: rest" shape.
    const colonRaw = line.match(/^(.+?):\s+(.+)$/);
    const colonMatch =
      colonRaw &&
      /^(posts?|raises?|calls?|checks?|folds?|bets?|shows?|wins?)\b/i.test(
        colonRaw[2]!,
      )
        ? colonRaw
        : null;
    const wmxMatch = colonMatch
      ? null
      : line.match(
          /^(\S.*?)\s+(posts|raises|calls|checks|folds|bets|shows)\b\s*(.*)$/i,
        );
    const actor = colonMatch
      ? colonMatch[1]!.trim()
      : wmxMatch
        ? wmxMatch[1]!.trim()
        : null;
    if (actor !== null) {
      const rest = colonMatch
        ? colonMatch[2]!.trim()
        : `${wmxMatch![2]} ${wmxMatch![3] ?? ''}`.trim();
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
      // Cards shown inline (GG all-in runout / Winamax show down):
      //   "Hero: shows [9c Qh]" · "Atenea. shows [5h 5c] (Two pairs : 5 and 4)"
      if (lower.startsWith('show')) {
        const cards = parseAllCardsInBrackets(line);
        if (cards) {
          const parenDesc = line.match(/\(([^)]*)\)\s*$/);
          addShow(actor, cards, parenDesc ? parenDesc[1]!.trim() : '');
        }
        continue;
      }

      const isAllin = lower.includes('all-in') || lower.includes('allin');

      if (lower.startsWith('call')) {
        // A call that is all-in is still a call (matches what's in front).
        const amt = parseAmount(rest);
        if (amt) {
          setCurrency(amt.currency);
          pushDecision(actor, 'call', amt.amount);
        }
        continue;
      }
      if (lower.startsWith('bet') || lower.startsWith('raise')) {
        const to = parseRaiseTo(rest);
        const amt = parseAmount(rest);
        // Raises use "to Y" (additional = total − already committed this street);
        // bets/all-in shoves give the amount directly.
        let added: number | null = null;
        if (lower.startsWith('raise') && to !== null) {
          added = to - (committed[actor] ?? 0);
        } else if (amt) {
          added = amt.amount;
        }
        if (amt) setCurrency(amt.currency);
        if (added !== null && added >= 0) {
          const type: ActionType = isAllin
            ? 'allin'
            : lower.startsWith('bet')
              ? 'bet'
              : 'raise';
          pushDecision(actor, type, added);
        }
        continue;
      }
      // Unknown action verb — ignore quietly (tolerant).
      continue;
    }
  }

  // GG/Stars mark the button on the table line, not the seat line.
  if (buttonSeat !== null) {
    for (const p of players) {
      if (p.seat === buttonSeat) p.isDealer = true;
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
