// Zod schema for the presets JSON (§12). The default file is validated when
// the module loads: a broken file fails loudly in dev instead of silently
// leaving rows empty.

import { z } from 'zod';
import { ALL_CATEGORIES, type CategoryId } from '../engine/categories';
import type { PresetFile, PresetRowValue } from '../engine/presets';

const zRowValue = z.union([z.number().min(0).max(100), z.literal('x')]);

const zPreset = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    street: z.enum(['flop', 'turn', 'river']),
    villainAction: z.enum(['call', 'raise']),
    sizeMin: z.number().min(0),
    sizeMax: z.number().min(0).optional(),
    rows: z.record(z.string(), zRowValue),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.sizeMax !== undefined && p.sizeMax < p.sizeMin) {
      ctx.addIssue({ code: 'custom', message: `${p.id}: sizeMax < sizeMin` });
    }
    for (const key of Object.keys(p.rows)) {
      if (!(ALL_CATEGORIES as readonly string[]).includes(key)) {
        ctx.addIssue({ code: 'custom', message: `${p.id}: categoría desconocida «${key}»` });
      }
    }
  });

const zPresetFile = z
  .object({ version: z.literal(1), presets: z.array(zPreset) })
  .strict()
  .superRefine((f, ctx) => {
    const ids = new Set<string>();
    for (const p of f.presets) {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', message: `id repetido «${p.id}»` });
      ids.add(p.id);
    }
  });

export function parsePresetFile(data: unknown): PresetFile {
  const f = zPresetFile.parse(data);
  return {
    version: 1,
    presets: f.presets.map((p) => ({
      ...p,
      rows: p.rows as Partial<Record<CategoryId, PresetRowValue>>,
    })),
  };
}
