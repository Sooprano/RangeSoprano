// Dev-only button in /analisis (D3): saves the hand as Sopranozilla's last
// hand and opens the analyzer. Loaded lazily and only when
// import.meta.env.DEV, so it never reaches the production build.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microscope } from 'lucide-react';
import { SAMPLE_RANGES } from '@/data/sampleRanges';
import { useRangeStore } from '@/store/rangeStore';
import type { ParsedHand } from '@/utils/handHistory';
import { savedHandFromParsed } from '../adapters/openHand';
import { readRangeSource, writeLastHand } from '../store/lastHand';

export type OpenInSopranozillaState = { fromAnalysis: true };

export default function OpenInSopranozillaButton({ hand }: { hand: ParsedHand }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          const result = savedHandFromParsed(hand, useRangeStore.getState().ranges, SAMPLE_RANGES, {
            prefer: readRangeSource(),
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          writeLastHand(result.saved);
          const state: OpenInSopranozillaState = { fromAnalysis: true };
          navigate('/sopranozilla', { state });
        }}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-content-muted hover:bg-surface-hover hover:text-content"
      >
        <Microscope className="h-3.5 w-3.5" /> Abrir en Sopranozilla
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
