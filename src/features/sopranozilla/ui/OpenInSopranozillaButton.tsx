// Button in /analisis (D3): saves the hand as Sopranozilla's last hand and
// opens the analyzer. Loaded lazily (its chunk only when a hand is on screen).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microscope } from 'lucide-react';
import { SAMPLE_RANGES } from '@/data/sampleRanges';
import { useRangeStore } from '@/store/rangeStore';
import type { ParsedHand } from '@/utils/handHistory';
import { openParsedHand } from '../adapters/openHand';
import { readRangeSource, writeLastHand } from '../store/lastHand';

export type OpenInSopranozillaState = { fromAnalysis: true };

export default function OpenInSopranozillaButton({ hand }: { hand: ParsedHand }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={async () => {
          const result = await openParsedHand(hand, useRangeStore.getState().ranges, SAMPLE_RANGES, {
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
