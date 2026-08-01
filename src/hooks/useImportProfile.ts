import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useRangeStore } from '@/store/rangeStore';
import { useUiStore } from '@/store/uiStore';
import { useRandomizerStore } from '@/store/randomizerStore';
import { pushToast } from '@/store/toastStore';
import { MAX_IMPORT_BYTES } from '@/store/persist';
import { zExportPayload } from '@/store/schemas';

/**
 * Import a Range Soprano profile (.json) into the stores. Shared by the Home
 * onboarding button and the sidebar "Herramientas" entry. The consumer renders
 * its own hidden `<input ref={inputRef} onChange={onChange} …>` + trigger; only
 * the file-handling logic lives here (single source of truth).
 */
export function useImportProfile() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const importRanges = useRangeStore((s) => s.importRanges);
  const mergeGroupMeta = useUiStore((s) => s.mergeGroupMeta);
  const applyRandomizerConfig = useRandomizerStore(
    (s) => s.applyImportedConfig,
  );

  const openPicker = () => inputRef.current?.click();

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      pushToast({
        kind: 'error',
        message: `Archivo > ${Math.floor(MAX_IMPORT_BYTES / 1024)} KB`,
      });
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      pushToast({ kind: 'error', message: 'No se pudo leer el archivo' });
      return;
    }

    const result = importRanges(text, { replace: false });
    if (result.accepted === 0) {
      const reason = result.rejected[0]?.reason ?? 'sin rangos válidos';
      pushToast({ kind: 'error', message: `Import fallido: ${reason}` });
      return;
    }

    let metaApplied = 0;
    let randomizerApplied = false;
    try {
      const parsed = zExportPayload.safeParse(JSON.parse(text));
      if (parsed.success) {
        if (parsed.data.groupMeta) {
          metaApplied = mergeGroupMeta(parsed.data.groupMeta);
        }
        if (parsed.data.randomizer) {
          applyRandomizerConfig(parsed.data.randomizer);
          randomizerApplied = true;
        }
      }
    } catch {
      // JSON already validated by importRanges; meta is best-effort.
    }

    const tail =
      result.rejected.length > 0 ? `, ${result.rejected.length} rechazados` : '';
    const metaTail =
      metaApplied > 0
        ? ` · ${metaApplied} carpeta${metaApplied === 1 ? '' : 's'} con color`
        : '';
    const randomizerTail = randomizerApplied
      ? ' · randomizador restaurado'
      : '';
    pushToast({
      kind: 'success',
      message: `Importados ${result.accepted} rango${result.accepted === 1 ? '' : 's'}${tail}${metaTail}${randomizerTail}`,
    });
  };

  return { inputRef, onChange, openPicker };
}
