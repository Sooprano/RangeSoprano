import { describe, expect, it } from 'vitest';
import { parseCards } from '../../engine/cards';
import {
  clearSlot,
  nextEmpty,
  place,
  slotOf,
  slotsFromText,
  slotsToText,
} from '../cardSlots';

const card = (t: string) => parseCards(t)![0]!;

describe('card picker slots (D105)', () => {
  it('reads and writes the text of the hand', () => {
    const s = slotsFromText('AsKs', 'Kh 9h 4c 7s');
    expect(slotsToText(s)).toEqual({ hero: 'As Ks', board: 'Kh 9h 4c 7s' });
    expect(nextEmpty(s)).toEqual({ kind: 'board', i: 4 });
  });

  it('a swapped flop card stays in the flop (rainbow board)', () => {
    let s = slotsFromText('AsKs', 'Kh 9h 4c 7s 2d');
    const at = slotOf(s, card('9h'))!;
    expect(at).toEqual({ kind: 'board', i: 1 });
    s = clearSlot(s, at);
    s = place(s, at, card('9s'));
    expect(slotsToText(s).board).toBe('Kh 9s 4c 7s 2d');
  });

  it('placing a card already on the table moves it there', () => {
    const s = place(slotsFromText('AsKs', 'Kh 9h 4c'), { kind: 'board', i: 3 }, card('9h'));
    expect(slotsToText(s).board).toBe('Kh 4c 9h');
    expect(slotOf(s, card('9h'))).toEqual({ kind: 'board', i: 3 });
  });

  it('fills Hero first, then flop, turn and river; wraps from the current slot', () => {
    const empty = slotsFromText('', '');
    expect(nextEmpty(empty)).toEqual({ kind: 'hero', i: 0 });
    const s = slotsFromText('AsKs', '');
    expect(nextEmpty(s)).toEqual({ kind: 'board', i: 0 });
    expect(nextEmpty(slotsFromText('AsKs', 'Kh 9h 4c 7s 2d'))).toBeNull();
  });
});
