import type { ActionDef, ActionId, Range } from '@/types/poker';
import {
  actionLabel,
  normalizeActionLabel,
  trainerAnswerActions,
} from './actionMeta';
import { sampleTrainerHand, type TrainerHand } from './trainerSampler';

/**
 * What a trainer session draws hands from: a single range (the classic mode) or
 * a whole folder — every range inside it, so a folder of `BBvsBU 25bb … 8bb`
 * trains reading the stack before choosing the action, like a real table.
 */
export type TrainerSource =
  | { kind: 'range'; range: Range }
  | { kind: 'folder'; path: string; label: string; ranges: Range[] };

export type TrainerDraw = {
  /** The range this hand came from (the source's own range in single mode). */
  range: Range;
  hand: TrainerHand;
  /**
   * Expected answer expressed in the SOURCE's answer space: the range-local
   * action id in single mode, the merged label key in folder mode.
   */
  answerKey: ActionId;
};

/** Stable identity of a session (leaderboard key, session-reset comparisons). */
export function sourceKey(source: TrainerSource): string {
  return source.kind === 'range' ? source.range.id : `folder:${source.path}`;
}

export function sourceRanges(source: TrainerSource): Range[] {
  return source.kind === 'range' ? [source.range] : source.ranges;
}

/**
 * Answer buttons for the session.
 *
 * Single range: exactly `trainerAnswerActions` (unchanged behavior).
 *
 * Folder: the union of every range's trainer palette, grouped by normalized
 * label — custom actions carry a per-range `crypto.randomUUID()` id, so without
 * grouping a 6-range folder would show six "Call" buttons. The merged def's
 * `id` IS the label key, so every consumer (ActionGrid, useActionHotkeys,
 * feedback) keeps working on `def.id/label/color` with no idea of the merge.
 */
export function trainerPalette(source: TrainerSource): ActionDef[] {
  if (source.kind === 'range') return trainerAnswerActions(source.range.actions);

  const merged = new Map<string, ActionDef>();
  for (const range of source.ranges) {
    for (const def of trainerAnswerActions(range.actions)) {
      const key = normalizeActionLabel(def.label);
      const prev = merged.get(key);
      if (!prev) {
        merged.set(key, { ...def, id: key });
      } else if (def.order < prev.order) {
        // Earliest position across the folder wins; the synthetic Fold keeps
        // its Infinity order, so it still sorts last.
        merged.set(key, { ...prev, order: def.order });
      }
    }
  }
  return [...merged.values()].sort((a, b) => a.order - b.order);
}

/**
 * The buttons to actually SHOW for a hand: the session palette narrowed to what
 * this hand's range offers. An action the range does not define is never a
 * possible answer, so displaying it is noise.
 *
 * Takes the session palette rather than rebuilding it, and filters instead of
 * re-deriving, so the order is a subsequence of the session's: buttons drop out
 * between hands, they never swap columns. `useActionHotkeys` keeps receiving the
 * FULL session palette — its 1-9 fallback is positional, so feeding it this
 * filtered list would make the same action answer to a different number from
 * one hand to the next.
 */
export function answerActionsFor(
  source: TrainerSource,
  palette: ActionDef[],
  range: Range,
): ActionDef[] {
  if (source.kind === 'range') return palette;
  const own = new Set(
    paletteOfRange(range).map((d) => normalizeActionLabel(d.label)),
  );
  return palette.filter((d) => own.has(d.id));
}

/** That range's own palette — for the mixed-strategy breakdown of its cells. */
export function paletteOfRange(range: Range): ActionDef[] {
  return trainerAnswerActions(range.actions);
}

/** Maps a range-local action id into the source's answer space. */
export function answerKeyOf(
  source: TrainerSource,
  range: Range,
  id: ActionId,
): ActionId {
  if (source.kind === 'range') return id;
  return normalizeActionLabel(actionLabel(paletteOfRange(range), id));
}

/**
 * Draws the next question. In folder mode the range is picked uniformly first:
 * every range carries the same total combo weight (the full 1326), so uniform
 * per range is also uniform per combo.
 */
export function drawFromSource(
  source: TrainerSource,
  rng: () => number = Math.random,
): TrainerDraw {
  const range =
    source.kind === 'range'
      ? source.range
      : source.ranges[Math.min(
          source.ranges.length - 1,
          Math.floor(rng() * source.ranges.length),
        )]!;
  const hand = sampleTrainerHand(range, rng);
  return { range, hand, answerKey: answerKeyOf(source, range, hand.expectedAction) };
}
