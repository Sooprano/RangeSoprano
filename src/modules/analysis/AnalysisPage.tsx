import { useMemo, useState } from 'react';
import { AlertTriangle, FileSearch } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { parseHandHistory } from '@/utils/handHistory';
import { HandWorksheet } from './HandWorksheet';

const EXAMPLE = `GAME #12139533229 Version:25.9.1.9 Uncalled:Y Texas Hold'em NL  Tournament 2026-03-28 02:15:56/GMT
Table Info: Size: 3, Blinds: 15/30, Ante: 5
Table Twister €20 SNG, 1158648211, 1158648210 (Tournament: Twister €20 SNG Buy-In: €18.60 + €1.40)
Seat 6: Balans3 (€572.00 in chips)  DEALER
Seat 10: denf0rdz (€928.00 in chips)
Balans3: Post Ante €5.00
denf0rdz: Post Ante €5.00
Balans3: Post SB €15.00
denf0rdz: Post BB €30.00
*** HOLE CARDS ***
Dealt to Balans3 [HJ S9]
Balans3: Call €15.00
denf0rdz: Check
*** FLOP *** [HA H7 C9]
denf0rdz: Check
Balans3: Bet €35.00
denf0rdz: Call €35.00
*** TURN *** [H3]
denf0rdz: Check
Balans3: Bet €105.00
denf0rdz: Call €105.00
*** RIVER *** [S8]
denf0rdz: Check
Balans3: Check
*** SUMMARY ***
Total pot €350.00 Rake €0.00
Balans3: Shows [HJ S9] One Pair, Nines
denf0rdz: Shows [HK D10] High Card, Ace
Balans3: wins €350.00`;

export default function AnalysisPage() {
  useDocumentTitle('Análisis de manos · Range Soprano', {
    description:
      'Pega el historial de mano (.txt) de tu sala y la web extrae el spot y te abre la calculadora de EV correcta pre-llenada. La equity la traes de Flopzilla. Sin login, sin tracking.',
    canonical: 'https://rangesoprano.com/analisis/',
  });

  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState('');

  const parsed = useMemo(
    () => (submitted.trim() ? parseHandHistory(submitted) : null),
    [submitted],
  );

  return (
    <>
      <PageHeader
        eyebrow="Análisis · workbook"
        title="Análisis de manos"
        description="Pega el historial .txt de una mano jugada. La web extrae el spot (board, pot y apuesta de cada decisión) y por cada jugada del héroe te abre la calculadora de EV adecuada, ya cargada con los números. La equity la traes de Flopzilla y la tipeas."
      />

      <div className="flex flex-col gap-5">
        <section className="rounded-xl border border-border bg-surface/40 p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="hh-input" className="text-sm font-semibold text-content">
              Historial de la mano
            </label>
            <button
              type="button"
              onClick={() => setText(EXAMPLE)}
              className="text-xs font-medium text-accent-light hover:underline"
            >
              Cargar ejemplo
            </button>
          </div>
          <textarea
            id="hh-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder="Pega acá el texto exportado de la mano…"
            className="w-full resize-y rounded-lg border border-border bg-surface/60 px-3 py-2 font-mono text-xs text-content placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSubmitted(text)}
              disabled={text.trim() === ''}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            >
              <FileSearch className="h-4 w-4" strokeWidth={2.25} />
              Analizar mano
            </button>
            {submitted.trim() !== '' && (
              <button
                type="button"
                onClick={() => {
                  setText('');
                  setSubmitted('');
                }}
                className="text-xs font-medium text-content-muted hover:text-content"
              >
                Limpiar
              </button>
            )}
          </div>
        </section>

        {parsed && parsed.errors.length > 0 && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
            <div>
              <p className="font-medium">Leí la mano pero con algunas advertencias:</p>
              <ul className="mt-1 list-disc pl-4 text-amber-200/80">
                {parsed.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e.reason}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {parsed && parsed.hand && <HandWorksheet hand={parsed.hand} />}
        {parsed && !parsed.hand && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            No reconocí ninguna mano en el texto. Verifica que pegaste el historial
            completo.
          </div>
        )}
      </div>
    </>
  );
}
