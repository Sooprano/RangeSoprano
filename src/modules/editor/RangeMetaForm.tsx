import { useId } from 'react';
import { cn } from '@/lib/cn';
import {
  HU_POSITIONS,
  POSITIONS,
  SITUATIONS,
  TABLE_FORMATS,
  huVillainOf,
  type Position,
  type PrintLabels,
  type Range,
  type Situation,
  type TableFormat,
} from '@/types/poker';
import { useRangeStore } from '@/store/rangeStore';
import { MAX_PRINT_LABEL_LEN } from '@/store/schemas';
import {
  SITUATION_LABELS,
  TABLE_FORMAT_LABELS,
  villainDisabledFor,
  FORM_SELECT_CLASS,
} from './editorFormConstants';

type RangePatch = Partial<Omit<Range, 'id' | 'createdAt'>>;

type Props = {
  range: Range;
  className?: string;
};

export function RangeMetaForm({ range, className }: Props) {
  const updateRange = useRangeStore((s) => s.updateRange);
  const pushHistory = useRangeStore((s) => s.pushHistory);

  const positionId = useId();
  const situationId = useId();
  const villainId = useId();
  const tableFormatId = useId();
  const stackId = useId();
  const sizing1Id = useId();
  const sizing2Id = useId();

  const isHU = range.tableFormat === 'HU';
  const positionOptions: readonly Position[] = isHU ? HU_POSITIONS : POSITIONS;
  const villainDisabled = isHU || villainDisabledFor(range.situation);

  const handleTableFormatChange = (next: TableFormat) => {
    pushHistory();
    if (next === 'HU') {
      const validHU = HU_POSITIONS.includes(
        range.position as (typeof HU_POSITIONS)[number],
      );
      const nextPos: Position = validHU ? range.position : 'BTN';
      updateRange(range.id, { tableFormat: next, position: nextPos });
    } else {
      updateRange(range.id, { tableFormat: next });
    }
  };

  const handlePositionChange = (next: Position) => {
    updateRange(range.id, { position: next });
  };

  const handleSituationChange = (next: Situation) => {
    if (villainDisabledFor(next)) {
      updateRange(
        range.id,
        { situation: next, villainPosition: undefined } as unknown as RangePatch,
      );
    } else {
      updateRange(range.id, { situation: next });
    }
  };

  const handleVillainChange = (next: Position | '') => {
    updateRange(
      range.id,
      { villainPosition: next === '' ? undefined : next } as unknown as RangePatch,
    );
  };

  const handlePrintLabelChange = (key: keyof PrintLabels, value: string) => {
    const trimmed = value.slice(0, MAX_PRINT_LABEL_LEN);
    const current = range.printLabels ?? {};
    const next: PrintLabels = { ...current };
    if (trimmed === '') delete next[key];
    else next[key] = trimmed;
    const isEmpty = !next.stack && !next.sizing1 && !next.sizing2;
    updateRange(
      range.id,
      { printLabels: isEmpty ? undefined : next } as unknown as RangePatch,
    );
  };

  return (
    <aside
      aria-label="Range properties"
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-3',
        className,
      )}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-muted">
        Properties
      </h3>

      <div className="flex flex-col gap-1">
        <label htmlFor={tableFormatId} className="text-xs font-medium text-content-muted">
          Mesa
        </label>
        <select
          id={tableFormatId}
          value={range.tableFormat}
          onChange={(e) => handleTableFormatChange(e.target.value as TableFormat)}
          className={selectClass}
        >
          {TABLE_FORMATS.map((t) => (
            <option key={t} value={t}>
              {TABLE_FORMAT_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={positionId} className="text-xs font-medium text-content-muted">
            Position
          </label>
          <select
            id={positionId}
            value={range.position}
            onChange={(e) => handlePositionChange(e.target.value as Position)}
            className={selectClass}
          >
            {positionOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={situationId} className="text-xs font-medium text-content-muted">
            Situation
          </label>
          <select
            id={situationId}
            value={range.situation}
            onChange={(e) => handleSituationChange(e.target.value as Situation)}
            className={selectClass}
          >
            {SITUATIONS.map((s) => (
              <option key={s} value={s}>
                {SITUATION_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={villainId} className="text-xs font-medium text-content-muted">
          Villain
        </label>
        <select
          id={villainId}
          value={isHU ? huVillainOf(range.position) : (range.villainPosition ?? '')}
          onChange={(e) => handleVillainChange(e.target.value as Position | '')}
          disabled={villainDisabled}
          className={cn(selectClass, villainDisabled && 'cursor-not-allowed opacity-50')}
        >
          <option value="">{isHU ? huVillainOf(range.position) : '— None —'}</option>
          {!isHU &&
            POSITIONS.filter((p) => p !== range.position).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
        </select>
        {isHU && (
          <span className="text-[10px] text-content-disabled">
            Auto-set in Heads-Up ({huVillainOf(range.position)} faces {range.position}).
          </span>
        )}
        {!isHU && range.situation === 'RFI' && (
          <span className="text-[10px] text-content-disabled">Not applicable to RFI.</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-muted">
            Print labels
          </span>
          <span className="text-[10px] text-content-disabled">
            Shown above each grid in PDF
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={stackId} className="text-[10px] font-medium text-content-muted">
              Stack (left)
            </label>
            <input
              id={stackId}
              type="text"
              value={range.printLabels?.stack ?? ''}
              onChange={(e) => handlePrintLabelChange('stack', e.target.value)}
              maxLength={MAX_PRINT_LABEL_LEN}
              placeholder="25"
              className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-content placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={sizing1Id} className="text-[10px] font-medium text-content-muted">
              Sizing 1
            </label>
            <input
              id={sizing1Id}
              type="text"
              value={range.printLabels?.sizing1 ?? ''}
              onChange={(e) => handlePrintLabelChange('sizing1', e.target.value)}
              maxLength={MAX_PRINT_LABEL_LEN}
              placeholder="5.78"
              className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-content placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={sizing2Id} className="text-[10px] font-medium text-content-muted">
              Sizing 2
            </label>
            <input
              id={sizing2Id}
              type="text"
              value={range.printLabels?.sizing2 ?? ''}
              onChange={(e) => handlePrintLabelChange('sizing2', e.target.value)}
              maxLength={MAX_PRINT_LABEL_LEN}
              placeholder="3"
              className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-content placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

const selectClass = FORM_SELECT_CLASS;
