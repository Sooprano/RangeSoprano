import { describe, expect, it } from 'vitest';
import type { RowTarget } from '../../store/analyzerStore';
import { keyToAction, moveSelection } from '../shortcuts';

const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
  keyToAction({ key, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe('shortcuts', () => {
  it('maps the keys of §10', () => {
    expect(k('ArrowDown')).toEqual({ kind: 'move', dir: 1 });
    expect(k('ArrowUp')).toEqual({ kind: 'move', dir: -1 });
    expect(k('1')).toEqual({ kind: 'weight', w: 10 });
    expect(k('9')).toEqual({ kind: 'weight', w: 90 });
    expect(k('0')).toEqual({ kind: 'weight', w: 100 });
    expect(k('f')).toEqual({ kind: 'mark', mark: 'follow' });
    expect(k('X')).toEqual({ kind: 'mark', mark: 'exclude' });
    expect(k('p')).toBeNull();
    expect(k('[')).toEqual({ kind: 'street', dir: -1 });
    expect(k(']')).toEqual({ kind: 'street', dir: 1 });
  });

  it('ignores other keys and any combination with Ctrl / Cmd / Alt', () => {
    expect(k('a')).toBeNull();
    expect(k('Enter')).toBeNull();
    expect(k('f', { ctrlKey: true })).toBeNull();
    expect(k('1', { metaKey: true })).toBeNull();
    expect(k('[', { altKey: true })).toBeNull();
  });

  it('moves between rows and stops at the ends', () => {
    const rows: RowTarget[] = [
      { kind: 'cat', id: 'set' },
      { kind: 'cat', id: 'top-pair' },
      { kind: 'custom', id: 'f1' },
    ];
    expect(moveSelection(rows, null, 1)).toEqual(rows[0]);
    expect(moveSelection(rows, null, -1)).toEqual(rows[2]);
    expect(moveSelection(rows, rows[0]!, 1)).toEqual(rows[1]);
    expect(moveSelection(rows, rows[2]!, 1)).toEqual(rows[2]);
    expect(moveSelection(rows, rows[0]!, -1)).toEqual(rows[0]);
    expect(moveSelection([], null, 1)).toBeNull();
  });
});
