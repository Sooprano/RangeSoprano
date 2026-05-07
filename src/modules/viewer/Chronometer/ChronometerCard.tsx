import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Flag, Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChronometerStore } from '@/store/chronometerStore';
import { useToastStore } from '@/store/toastStore';
import type { ChronometerLap } from '@/store/schemas';

// ─── helpers ─────────────────────────────────────────────────────────────────

interface TimeParts {
  h: string;
  m: string;
  s: string;
  cs: string;
}

function msToTimeParts(ms: number): TimeParts {
  const total = Math.max(0, Math.floor(ms));
  const cs = Math.floor((total % 1000) / 10);
  const totalSec = Math.floor(total / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { h: pad(h), m: pad(m), s: pad(s), cs: pad(cs) };
}

function formatLapMs(ms: number): string {
  const { h, m, s, cs } = msToTimeParts(ms);
  return h !== '00' ? `${h}:${m}:${s}.${cs}` : `${m}:${s}.${cs}`;
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface TimeBlockProps {
  value: string;
  label: string;
}

function TimeBlock({ value, label }: TimeBlockProps) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-2xl font-bold tabular-nums leading-none">
        {value}
      </span>
      <span className="mt-0.5 text-[9px] leading-none text-content-disabled">
        {label}
      </span>
    </div>
  );
}

function Sep({ dot }: { dot?: boolean }) {
  return (
    <span className="pb-3 font-mono text-lg font-bold leading-none text-content-disabled">
      {dot ? '.' : ':'}
    </span>
  );
}

interface LapRowProps {
  lap: ChronometerLap;
}

function LapRow({ lap }: LapRowProps) {
  return (
    <div className="grid grid-cols-[16px_1fr_1fr] items-center gap-x-2 py-0.5 text-xs">
      <span className="text-right font-mono text-content-disabled">{lap.n}</span>
      <span className="font-mono tabular-nums">{formatLapMs(lap.delta)}</span>
      <span className="font-mono tabular-nums text-content-muted">
        {formatLapMs(lap.total)}
      </span>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function ChronometerCard() {
  const running = useChronometerStore((s) => s.running);
  const elapsed = useChronometerStore((s) => s.elapsed);
  const lastStartedAt = useChronometerStore((s) => s.lastStartedAt);
  const laps = useChronometerStore((s) => s.laps);
  const toggle = useChronometerStore((s) => s.toggle);
  const flag = useChronometerStore((s) => s.flag);
  const reset = useChronometerStore((s) => s.reset);
  const pushToast = useToastStore((s) => s.pushToast);

  const [, forceRender] = useState(0);
  const [lapsOpen, setLapsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Tick every 100 ms while running to refresh the display.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => forceRender((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [running]);

  // Close laps panel on click outside.
  useEffect(() => {
    if (!lapsOpen) return;
    const handler = (e: MouseEvent) => {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      if (e.target instanceof Node && wrap.contains(e.target)) return;
      setLapsOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [lapsOpen]);

  // Close laps panel on Escape.
  useEffect(() => {
    if (!lapsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLapsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lapsOpen]);

  const displayMs =
    running && lastStartedAt !== null
      ? elapsed + (Date.now() - lastStartedAt)
      : elapsed;

  const { h, m, s, cs } = msToTimeParts(displayMs);

  const handleFlag = () => {
    const beforeLen = laps.length;
    flag();
    // Read updated state after flag()
    const updatedLaps = useChronometerStore.getState().laps;
    const newLap = updatedLaps[beforeLen];
    if (newLap) {
      pushToast({
        kind: 'success',
        message: `Sesión ${newLap.n} — ${formatLapMs(newLap.delta)}`,
        duration: 3000,
      });
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-[260px] max-w-full">
      <section
        aria-label="Cronómetro de sesión"
        className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5 shadow-surface"
      >
        {/* Time display */}
        <div
          className={cn(
            'flex items-end justify-center gap-0.5 rounded-lg border border-border bg-bg/60 px-3 py-2',
            running ? 'text-white' : 'text-content-muted',
          )}
        >
          <TimeBlock value={h} label="h" />
          <Sep />
          <TimeBlock value={m} label="min" />
          <Sep />
          <TimeBlock value={s} label="seg" />
          <Sep dot />
          <TimeBlock value={cs} label="cs" />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-1.5">
          {/* Play / Pause */}
          <button
            type="button"
            onClick={toggle}
            aria-label={running ? 'Pausar' : 'Iniciar'}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            {running ? (
              <Pause className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <Play className="h-4 w-4" strokeWidth={2.25} />
            )}
          </button>

          {/* Flag */}
          <button
            type="button"
            onClick={handleFlag}
            aria-label="Marcar vuelta"
            disabled={displayMs === 0}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-bg/60 p-1.5 text-content-muted transition-colors hover:border-success/50 hover:text-success disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <Flag className="h-4 w-4" strokeWidth={2} />
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={reset}
            aria-label="Resetear cronómetro"
            disabled={displayMs === 0 && laps.length === 0}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-bg/60 p-1.5 text-content-muted transition-colors hover:border-rose-400/50 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
          </button>

          {/* Laps toggle / hint */}
          <div className="ml-auto flex items-center">
            {laps.length > 0 ? (
              <button
                type="button"
                onClick={() => setLapsOpen((v) => !v)}
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs text-content-muted transition-colors hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
              >
                {laps.length} {laps.length === 1 ? 'vuelta' : 'vueltas'}
                {lapsOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            ) : (
              <span className="text-[10px] leading-tight text-content-disabled">
                Pausá en descansos
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Laps panel — absolute, does not push layout */}
      {lapsOpen && laps.length > 0 && (
        <div className="absolute right-0 top-full z-30 mt-1 w-full min-w-[220px] rounded-xl border border-border bg-surface p-3 shadow-surface">
          <div className="mb-1.5 grid grid-cols-[16px_1fr_1fr] items-center gap-x-2">
            <span className="text-right text-[10px] text-content-disabled">#</span>
            <span className="text-[10px] text-content-disabled">Sesión</span>
            <span className="text-[10px] text-content-disabled">Total</span>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {laps.map((lap) => (
              <LapRow key={lap.n} lap={lap} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
