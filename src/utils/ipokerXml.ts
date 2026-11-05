// iPoker hand histories in XML (the room's own format, e.g. Twister spins)
// → the same ParsedHand the text parser builds, so /analisis and Sopranozilla
// read them like any other room.
//
//   <session><general><nickname>Hero</nickname><tablesize>3</tablesize>…
//     <game gamecode="…"><general><smallblind/><bigblind/><ante/>
//       <players><player name seat chips dealer win bet/></players></general>
//       <round no="0"> antes (15) + blinds (1, 2)
//       <round no="1"> preflop · 2 flop · 3 turn · 4 river
//
// Action types: 0 fold · 1 SB · 2 BB · 3 call (chips ADDED) · 4 check ·
// 5 bet · 7 all-in (chips ADDED, call or raise) · 15 ante · 23 raise (street
// TOTAL "to", without the ante). Numbers may carry thousands commas
// ("1,035"). Cards are suit first with "10" for ten ("S10 DK"); hidden ones
// are "X X". A session file can hold many games: the first one is read
// (tolerant: unknown tags and action types are skipped).

import {
  parseCardToken,
  type ActionType,
  type Card,
  type HandParseError,
  type HandParseResult,
  type ParsedHand,
  type PlayerInfo,
  type Showdown,
  type Street,
  type StreetData,
} from './handHistory';

const ROUND_STREET: Record<string, Street> = {
  '0': 'preflop',
  '1': 'preflop',
  '2': 'flop',
  '3': 'turn',
  '4': 'river',
};
const BOARD_SIZE: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

/** Is this text an iPoker XML history? */
export function isIpokerXml(raw: string): boolean {
  return /^\s*(<\?xml[^>]*\?>\s*)?<session\b/i.test(raw);
}

function num(s: string | undefined): number | null {
  if (s === undefined) return null;
  const n = Number(s.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]!] = decode(m[2]!);
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Text of the first <name>…</name> inside `xml`. */
function text(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return m ? decode(m[1]!.trim()) : null;
}

function cardsOf(s: string): Card[] | null {
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.some((t) => /^x$/i.test(t))) return null;
  const cards = tokens.map(parseCardToken);
  return cards.every((c): c is Card => c !== null) ? cards : null;
}

export function parseIpokerXml(raw: string): HandParseResult {
  const errors: HandParseError[] = [];
  const game = /<game\b[^>]*>[\s\S]*?<\/game>/i.exec(raw)?.[0];
  if (!game) {
    return {
      hand: null,
      errors: [{ line: '', reason: 'El XML de iPoker no tiene ninguna mano.' }],
    };
  }
  const sessionGeneral = text(raw.replace(/<game\b[\s\S]*$/i, ''), 'general') ?? '';
  const gameGeneral = text(game, 'general') ?? '';
  const nickname = text(sessionGeneral, 'nickname');

  const players: PlayerInfo[] = [];
  const handBets = new Map<string, number>();
  const winners: { name: string; amount: number }[] = [];
  for (const m of gameGeneral.matchAll(/<player\b[^>]*\/?>/gi)) {
    const a = attrs(m[0]);
    if (!a.name) continue;
    players.push({
      name: a.name,
      seat: num(a.seat) ?? players.length + 1,
      stack: num(a.chips) ?? 0,
      isDealer: a.dealer === '1',
    });
    handBets.set(a.name, num(a.bet) ?? 0);
    const win = num(a.win) ?? 0;
    if (win > 0) winners.push({ name: a.name, amount: win });
  }
  const hero = nickname && players.some((p) => p.name === nickname) ? nickname : null;

  const streets: StreetData[] = [];
  let runningPot = 0;
  let committed: Record<string, number> = {};
  let currentStreet: Street = 'preflop';
  let board: Card[] = [];
  let heroCards: Card[] = [];
  const shows: Showdown[] = [];

  const ensureStreet = (street: Street): StreetData => {
    let sd = streets.find((s) => s.street === street);
    if (!sd) {
      sd = { street, board: board.slice(), decisions: [], potStart: runningPot };
      streets.push(sd);
    }
    return sd;
  };
  ensureStreet('preflop');

  // Chips each player put in the whole hand (antes included): a raise or call
  // that empties the stack is an all-in, which the XML does not always say
  // (a shove is often a plain type 23 raise).
  const stackOf = new Map(players.map((p) => [p.name, p.stack]));
  const spent = new Map<string, number>();

  const push = (actor: string, kind: ActionType, amount: number, countsForRaise: boolean) => {
    const sd = ensureStreet(currentStreet);
    const potBefore = runningPot;
    let type = kind;
    if (amount > 0) {
      runningPot += amount;
      if (countsForRaise) committed[actor] = (committed[actor] ?? 0) + amount;
      const total = (spent.get(actor) ?? 0) + amount;
      spent.set(actor, total);
      const stack = stackOf.get(actor) ?? 0;
      if ((kind === 'raise' || kind === 'bet') && stack > 0 && total >= stack) type = 'allin';
    }
    sd.decisions.push({
      id: `${currentStreet}-${sd.decisions.length}`,
      street: currentStreet,
      actor,
      isHero: actor === hero,
      type,
      amount,
      potBefore,
      ...(!countsForRaise && { isAnte: true }),
    });
  };

  for (const r of game.matchAll(/<round\b([^>]*)>([\s\S]*?)<\/round>/gi)) {
    const no = attrs(r[1]!).no ?? '';
    const street = ROUND_STREET[no];
    if (!street) continue;
    if (street !== currentStreet) {
      currentStreet = street;
      committed = {};
    }
    // Cards and actions in document order.
    for (const el of r[2]!.matchAll(/<(cards|action)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi)) {
      const a = attrs(el[2]!);
      if (el[1]!.toLowerCase() === 'cards') {
        const kind = (a.type ?? '').toLowerCase();
        const cards = cardsOf(el[3] ?? '');
        if (kind === 'pocket') {
          if (cards && a.player === hero) heroCards = cards;
          else if (cards && a.player) shows.push({ name: a.player, cards, description: '' });
        } else if (kind === 'flop' || kind === 'turn' || kind === 'river') {
          if (!cards) {
            errors.push({ line: el[0], reason: 'No pude leer el board de la calle' });
            continue;
          }
          const s = kind as Street;
          board = cards.length === BOARD_SIZE[s] ? cards : board.concat(cards);
          if (currentStreet !== s) {
            currentStreet = s;
            committed = {};
          }
          ensureStreet(s).board = board.slice();
        }
        continue;
      }
      const actor = a.player;
      if (!actor) continue;
      const sum = num(a.sum) ?? 0;
      switch (a.type) {
        case '0':
          push(actor, 'fold', 0, true);
          break;
        case '1':
        case '2':
          push(actor, 'post', sum, true);
          break;
        case '15':
          // Antes go in the pot but not in the street total a raise is "to".
          push(actor, 'post', sum, false);
          break;
        case '3':
          push(actor, 'call', sum, true);
          break;
        case '4':
          push(actor, 'check', 0, true);
          break;
        case '5':
          push(actor, 'bet', sum, true);
          break;
        case '7':
          push(actor, 'allin', sum, true);
          break;
        case '23': {
          const added = sum - (committed[actor] ?? 0);
          push(actor, 'raise', added > 0 ? added : sum, true);
          break;
        }
        default:
          break;
      }
    }
  }

  if (players.length === 0) {
    errors.push({ line: '', reason: 'No reconocí ninguna mano en el XML.' });
    return { hand: null, errors };
  }
  const tablesize = num(text(sessionGeneral, 'tablesize') ?? undefined);
  const hand: ParsedHand = {
    gameId: /<game\b[^>]*gamecode="([^"]+)"/i.exec(game)?.[1] ?? null,
    dateTime: text(gameGeneral, 'startdate'),
    // Tournament chips: no currency (the buy-in is in euros, the stacks are not).
    currency: '',
    smallBlind: num(text(gameGeneral, 'smallblind') ?? undefined),
    bigBlind: num(text(gameGeneral, 'bigblind') ?? undefined),
    ante: num(text(gameGeneral, 'ante') ?? undefined),
    maxSeats: tablesize,
    players,
    hero,
    heroCards,
    board,
    streets,
    totalPot: [...handBets.values()].reduce((s, b) => s + b, 0) || runningPot,
    shows,
    winners,
  };
  return { hand, errors };
}
