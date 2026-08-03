import { useEffect, useRef } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTableThemeStore } from '@/store/tableThemeStore';
import {
  CARD_BACKS,
  CARD_BACK_IDS,
  CHIP_STYLES,
  CHIP_STYLE_IDS,
  LAYER_LABEL,
  LAYER_SWATCHES,
  OPTIONAL_LAYERS,
  PLAYER_BOX_LABEL,
  PLAYER_BOX_STYLES,
  SHAPE_LABEL,
  TABLE_LAYERS,
  TABLE_PRESETS,
  TABLE_SHAPES,
  type TableLayer,
} from '@/data/tableThemes';
import { PokerTable } from './PokerTable';
import { TableSurface } from './TableSurface';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = { onClose: () => void };

export function TableThemeModal({ onClose }: Props) {
  const theme = useTableThemeStore();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const layerValue = (layer: TableLayer): string | null =>
    layer === 'background' ? theme.background : theme[layer];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-theme-title"
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex w-full max-w-lg flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-surface"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2
              id="table-theme-title"
              className="text-base font-semibold text-content"
            >
              Apariencia de la mesa
            </h2>
            <p className="text-xs text-content-muted">
              Personaliza los colores, la forma y el reverso de las cartas.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar apariencia de la mesa"
            className="rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        {/* Live preview — the real components reading the same store, panel
            included, so the background layer previews where it actually lands. */}
        <TableSurface>
          <PokerTable
            heroPosition="BB"
            villainPosition="BTN"
            hand="AKs"
            tableFormat="6max"
            stackLabel="12bb"
          />
        </TableSurface>

        <Section title="Preajustes">
          <div className="flex flex-wrap gap-1.5">
            {TABLE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={theme.presetId === p.id}
                onClick={() => theme.applyPreset(p.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                  theme.presetId === p.id
                    ? 'border-accent/60 bg-surface-hover text-content'
                    : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 rounded-full border border-white/20"
                  style={{ backgroundColor: p.felt }}
                />
                {p.label}
              </button>
            ))}
          </div>
        </Section>

        {TABLE_LAYERS.map((layer) => (
          <Section key={layer} title={LAYER_LABEL[layer]}>
            <div className="flex flex-wrap gap-1.5">
              {LAYER_SWATCHES[layer].map((color) => (
                <Swatch
                  key={color}
                  color={color}
                  active={layerValue(layer) === color}
                  label={`${LAYER_LABEL[layer]} ${color}`}
                  onClick={() => theme.setLayer(layer, color)}
                />
              ))}
              {OPTIONAL_LAYERS.includes(layer) && (
                <NoneSwatch
                  active={layerValue(layer) === null}
                  label={`${LAYER_LABEL[layer]}: ninguno`}
                  onClick={() => theme.setLayer(layer, null)}
                />
              )}
            </div>
          </Section>
        ))}

        <Section title="Riel interior">
          <div className="flex flex-wrap gap-1.5">
            <NoneSwatch
              active={theme.innerRail === null}
              label="Riel interior: ninguno"
              onClick={() => theme.setInnerRail(null)}
            />
            {LAYER_SWATCHES.outerBorder.map((color) => (
              <Swatch
                key={color}
                color={color}
                active={theme.innerRail === color}
                label={`Riel interior ${color}`}
                onClick={() => theme.setInnerRail(color)}
              />
            ))}
          </div>
        </Section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="Forma de la mesa">
            <div className="flex flex-wrap gap-1.5">
              {TABLE_SHAPES.map((s) => (
                <Chip
                  key={s}
                  active={theme.shape === s}
                  label={SHAPE_LABEL[s]}
                  onClick={() => theme.setShape(s)}
                />
              ))}
            </div>
          </Section>

          <Section title="Caja del jugador">
            <div className="flex flex-wrap gap-1.5">
              {PLAYER_BOX_STYLES.map((s) => (
                <Chip
                  key={s}
                  active={theme.playerBox === s}
                  label={PLAYER_BOX_LABEL[s]}
                  onClick={() => theme.setPlayerBox(s)}
                />
              ))}
            </div>
          </Section>
        </div>

        <Section title="Reverso de las cartas">
          <div className="flex flex-wrap gap-1.5">
            {CARD_BACK_IDS.map((id) => {
              const back = CARD_BACKS[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={theme.cardBack === id}
                  onClick={() => theme.setCardBack(id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                    theme.cardBack === id
                      ? 'border-accent/60 bg-surface-hover text-content'
                      : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-3 rounded-[3px]"
                    style={{
                      backgroundColor: back.base,
                      backgroundImage: `repeating-linear-gradient(45deg, ${back.accent}44 0 2px, transparent 2px 5px)`,
                      boxShadow: `inset 0 0 0 1px ${back.accent}66`,
                    }}
                  />
                  {back.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Fichas">
          <div className="flex flex-wrap gap-1.5">
            {CHIP_STYLE_IDS.map((id) => {
              const chip = CHIP_STYLES[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={theme.chipStyle === id}
                  onClick={() => theme.setChipStyle(id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                    theme.chipStyle === id
                      ? 'border-accent/60 bg-surface-hover text-content'
                      : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 rounded-full"
                    style={{
                      backgroundColor: chip.base,
                      boxShadow: `inset 0 0 0 1.5px ${chip.edge}`,
                    }}
                  />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="En la mesa">
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={theme.showLogo}
              label="Logo"
              onClick={() => theme.setShowLogo(!theme.showLogo)}
            />
            <Chip
              active={theme.showStack}
              label="Fichas y stack"
              onClick={() => theme.setShowStack(!theme.showStack)}
            />
          </div>
        </Section>

        <div className="flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={theme.reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-content-muted transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
            Restablecer
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
        {title}
      </span>
      {children}
    </div>
  );
}

function Swatch({
  color,
  active,
  label,
  onClick,
}: {
  color: string;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className="h-6 w-6 rounded-full border border-white/15 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
      style={{
        backgroundColor: color,
        outline: active ? '2px solid rgb(var(--color-accent))' : undefined,
        outlineOffset: active ? 2 : undefined,
      }}
    />
  );
}

function NoneSwatch({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full border border-dashed transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
        active
          ? 'border-accent text-accent'
          : 'border-content-muted text-content-muted hover:border-content hover:text-content',
      )}
      style={{
        outline: active ? '2px solid rgb(var(--color-accent))' : undefined,
        outlineOffset: active ? 2 : undefined,
      }}
    >
      <X className="h-3 w-3" strokeWidth={2} />
    </button>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
        active
          ? 'border-accent/60 bg-surface-hover text-content'
          : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      {label}
    </button>
  );
}
