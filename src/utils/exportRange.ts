import { toPng } from 'html-to-image';
import type { Range } from '@/types/poker';
import { CURRENT_RANGE_STORE_VERSION } from '@/store/schemas';
import { serializeWeightedHands } from './handRangeSerializer';
import type { WeightedHand } from './handRangeParser';

export function rangeToNotation(range: Range): string {
  const entries: WeightedHand[] = [];
  for (const hand in range.cells) {
    const cell = range.cells[hand];
    if (!cell) continue;
    const sum = cell.actions.reduce((acc, a) => acc + a.weight, 0);
    if (sum <= 0) continue;
    const rounded = Math.round(sum * 100) / 100;
    entries.push({ hand: cell.hand, weight: Math.min(100, rounded) });
  }
  return serializeWeightedHands(entries);
}

export function rangeToJson(range: Range): string {
  return JSON.stringify(range, null, 2);
}

export function allRangesToJson(ranges: Range[]): string {
  return JSON.stringify(
    {
      version: CURRENT_RANGE_STORE_VERSION,
      exportedAt: new Date().toISOString(),
      ranges,
    },
    null,
    2,
  );
}

export function slugify(name: string): string {
  const normalized = name
    .normalize('NFKD')
    // eslint-disable-next-line no-misleading-character-class
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return normalized.length > 0 ? normalized : 'range';
}

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function downloadBlob(
  content: string | Blob,
  filename: string,
  mime = 'application/octet-stream',
): void {
  const blob =
    typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function resolveBackground(node: HTMLElement): string {
  const own = getComputedStyle(node).backgroundColor;
  if (own && own !== 'rgba(0, 0, 0, 0)' && own !== 'transparent') return own;
  const body = getComputedStyle(document.body).backgroundColor;
  if (body && body !== 'rgba(0, 0, 0, 0)' && body !== 'transparent') return body;
  return '#0b0f14';
}

export async function exportNodeToPng(
  node: HTMLElement,
  filename: string,
): Promise<void> {
  const dataUrl = await toPng(node, {
    backgroundColor: resolveBackground(node),
    pixelRatio: 2,
    cacheBust: true,
  });
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(blob, filename, 'image/png');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand path
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
