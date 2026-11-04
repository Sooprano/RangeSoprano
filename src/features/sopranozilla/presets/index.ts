// The default presets, validated once at load.

import { parsePresetFile } from '../schemas/presets';
import data from './default-presets.json';

export const DEFAULT_PRESETS = parsePresetFile(data).presets;

/**
 * Off for now (2026-11-04, first public version): the table is not
 * calibrated yet and starting rows at its weights got in the way. Every
 * action row starts at «Todo ✓ 100». The table stays in `default-presets.json`;
 * flip this when it is (P2/P3 in DECISIONS.md).
 */
export const PRESETS_ENABLED = false;

/** What the rows start from: the preset table, or nothing (all at 100). */
export const ACTIVE_PRESETS = PRESETS_ENABLED ? DEFAULT_PRESETS : [];
